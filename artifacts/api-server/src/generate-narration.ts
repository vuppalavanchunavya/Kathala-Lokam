import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, asc, eq } from "drizzle-orm";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import {
  db,
  pool,
  scenesTable,
  storiesTable,
  translationsTable,
} from "@workspace/db";
import { logger } from "./lib/logger";

/**
 * Pre-generates a gentle girl narrator for every story translation and points
 * the translation's audio_url at the file, so the story page plays recorded
 * audio instead of the browser's (often deep, male) default voice.
 *
 *   pnpm --filter @workspace/api-server run narrate -- --slug birbals-khichdi
 *   pnpm --filter @workspace/api-server run narrate -- --force
 */

// Voice and prosody per language. Change here to retune the narrator.
const VOICES: Record<string, { voice: string; rate: string; pitch: string }> = {
  en: { voice: "en-US-AnaNeural", rate: "-8%", pitch: "+5%" },
  te: { voice: "te-IN-ShrutiNeural", rate: "-8%", pitch: "+8%" },
  hi: { voice: "hi-IN-SwaraNeural", rate: "-8%", pitch: "+8%" },
};

const here = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.resolve(here, "../../kathala-lokam/public/audio");

const args = process.argv.slice(2);
const force = args.includes("--force");
const slugIndex = args.indexOf("--slug");
const onlySlug = slugIndex >= 0 ? args[slugIndex + 1] : undefined;

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 48 kbps constant-bitrate MP3: seconds = bytes * 8 / 48000
const BYTES_TO_SECONDS = 8 / 48000;
const TICKS_PER_SECOND = 10_000_000;

type Sentence = { text: string; start: number; end: number };
type Rendered = { audio: Buffer; sentences: Sentence[] };

function synthesize(tts: MsEdgeTTS, text: string, prosody: { rate: string; pitch: string }) {
  return new Promise<Rendered>((resolve, reject) => {
    const { audioStream, metadataStream } = tts.toStream(escapeXml(text), prosody);
    const chunks: Buffer[] = [];
    const sentences: Sentence[] = [];
    audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    audioStream.on("error", reject);
    metadataStream?.on("data", (raw: Buffer | string) => {
      try {
        const parsed = JSON.parse(raw.toString());
        for (const item of parsed.Metadata ?? []) {
          if (item.Type !== "SentenceBoundary") continue;
          const start = item.Data.Offset / TICKS_PER_SECOND;
          sentences.push({
            text: item.Data.text.Text,
            start,
            end: start + item.Data.Duration / TICKS_PER_SECOND,
          });
        }
      } catch {
        // ignore malformed metadata chunks
      }
    });
    audioStream.on("close", () => {
      const audio = Buffer.concat(chunks);
      if (audio.length === 0) reject(new Error("empty audio"));
      else resolve({ audio, sentences });
    });
  });
}

async function synthesizeWithRetry(tts: MsEdgeTTS, text: string, prosody: { rate: string; pitch: string }) {
  try {
    return await synthesize(tts, text, prosody);
  } catch (error) {
    logger.warn({ err: error }, "Scene failed, retrying once");
    return synthesize(tts, text, prosody);
  }
}

async function fileExists(file: string) {
  try {
    return (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

try {
  await mkdir(AUDIO_DIR, { recursive: true });

  const rows = await db
    .select({
      id: translationsTable.id,
      languageCode: translationsTable.languageCode,
      script: translationsTable.script,
      slug: storiesTable.slug,
    })
    .from(translationsTable)
    .innerJoin(storiesTable, eq(translationsTable.storyId, storiesTable.id))
    .where(onlySlug ? eq(storiesTable.slug, onlySlug) : undefined)
    .orderBy(asc(storiesTable.slug), asc(translationsTable.languageCode));

  let made = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const config = VOICES[row.languageCode];
    if (!config) {
      logger.warn({ lang: row.languageCode }, "No voice configured, skipping");
      skipped++;
      continue;
    }

    const fileName = `${row.slug}-${row.languageCode}.mp3`;
    const filePath = path.join(AUDIO_DIR, fileName);
    if (!force && (await fileExists(filePath))) {
      skipped++;
      continue;
    }

    try {
      const scenes = await db
        .select({ text: scenesTable.text })
        .from(scenesTable)
        .where(eq(scenesTable.translationId, row.id))
        .orderBy(asc(scenesTable.position));
      const parts = scenes.length > 0 ? scenes.map((s) => s.text) : [row.script];

      const tts = new MsEdgeTTS();
      await tts.setMetadata(config.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
        sentenceBoundaryEnabled: true,
      });

      const buffers: Buffer[] = [];
      const timings: Array<Sentence & { scene: number }> = [];
      let elapsedBytes = 0;
      for (const [index, part] of parts.entries()) {
        if (!part.trim()) continue;
        const rendered = await synthesizeWithRetry(tts, part, config);
        const offset = elapsedBytes * BYTES_TO_SECONDS;
        for (const sentence of rendered.sentences) {
          timings.push({
            scene: index + 1,
            text: sentence.text,
            start: Number((sentence.start + offset).toFixed(2)),
            end: Number((sentence.end + offset).toFixed(2)),
          });
        }
        buffers.push(rendered.audio);
        elapsedBytes += rendered.audio.length;
      }
      tts.close();

      await writeFile(filePath, Buffer.concat(buffers));
      await writeFile(
        filePath.replace(/.mp3$/, ".json"),
        JSON.stringify({ voice: config.voice, duration: Number((elapsedBytes * BYTES_TO_SECONDS).toFixed(2)), sentences: timings }, null, 1),
      );
      await db
        .update(translationsTable)
        .set({
          audioUrl: `/audio/${fileName}`,
          voiceIdentifier: config.voice,
          audioApproved: true,
        })
        .where(and(eq(translationsTable.id, row.id)));

      logger.info({ file: fileName, voice: config.voice }, "Narration ready");
      made++;
    } catch (error) {
      logger.error({ err: error, file: fileName }, "Could not generate narration");
      failed++;
    }
  }

  logger.info({ made, skipped, failed }, "Narration run finished");
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
} catch (error) {
  logger.error({ err: error }, "Narration run failed");
  process.exit(1);
}
