import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  categoriesTable,
  db,
  scenesTable,
  storiesTable,
  translationsTable,
} from "@workspace/db";
import {
  ArchiveAdminStoryParams,
  ArchiveAdminStoryResponse,
  CreateAdminStoryBody,
  CreateAdminStoryResponse,
  GetAdminDashboardResponse,
  ListAdminStoriesQueryParams,
  ListAdminStoriesResponse,
  PublishAdminStoryParams,
  PublishAdminStoryResponse,
  UpdateAdminStoryBody,
  UpdateAdminStoryParams,
  UpdateAdminStoryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getSafeAuth(req: Parameters<RequestHandler>[0]): { userId?: string | null; sessionClaims?: any } {
  const reqAuth = (req as any).auth;
  if (reqAuth) return reqAuth;
  try {
    return getAuth(req);
  } catch {
    return { userId: null };
  }
}

function hasAdminRole(req: Parameters<RequestHandler>[0]): boolean {
  const auth = getSafeAuth(req);
  if (!auth.userId) return false;
  const claims = auth.sessionClaims as
    | {
        publicMetadata?: { role?: string };
        metadata?: { role?: string };
        public_metadata?: { role?: string };
      }
    | undefined;
  const claimRole =
    claims?.publicMetadata?.role ??
    claims?.public_metadata?.role ??
    claims?.metadata?.role;
  const allowlist = (process.env.KATHALA_ADMIN_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return claimRole === "admin" || allowlist.includes(auth.userId);
}

const requireAdmin: RequestHandler = (req, res, next) => {
  const auth = getSafeAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  if (!hasAdminRole(req)) {
    res.status(403).json({ error: "Administrator access is required." });
    return;
  }
  next();
};

router.use(requireAdmin);

async function getAdminStories(status?: string) {
  const filters = status ? [eq(storiesTable.status, status)] : [];
  const rows = await db
    .select({ story: storiesTable, category: categoriesTable, script: translationsTable.script })
    .from(storiesTable)
    .innerJoin(categoriesTable, eq(storiesTable.categoryId, categoriesTable.id))
    .leftJoin(
      translationsTable,
      and(
        eq(translationsTable.storyId, storiesTable.id),
        eq(translationsTable.languageCode, "en"),
      ),
    )
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(storiesTable.updatedAt));
  if (!rows.length) return [];
  const translations = await db
    .select({
      storyId: translationsTable.storyId,
      languageCode: translationsTable.languageCode,
    })
    .from(translationsTable)
    .where(
      inArray(
        translationsTable.storyId,
        rows.map((row) => row.story.id),
      ),
    );
  const languages = new Map<number, string[]>();
  for (const translation of translations) {
    const available = languages.get(translation.storyId) ?? [];
    available.push(translation.languageCode);
    languages.set(translation.storyId, available);
  }
  return rows.map(({ story, category, script }) => ({
    id: story.id,
    slug: story.slug,
    title: story.title,
    categoryId: story.categoryId,
    category: category.name,
    description: story.description,
    script: script ?? "",
    ageMin: story.ageMin,
    ageMax: story.ageMax,
    durationMinutes: story.durationMinutes,
    coverUrl: story.coverUrl,
    moral: story.moral,
    source: story.source,
    licence: story.licence,
    status: story.status,
    languages: languages.get(story.id) ?? [],
  }));
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ status: storiesTable.status, id: storiesTable.id })
    .from(storiesTable);
  const published = rows.filter((story) => story.status === "published");
  const translations = await db
    .select({
      storyId: translationsTable.storyId,
      languageCode: translationsTable.languageCode,
      status: translationsTable.status,
      audioUrl: translationsTable.audioUrl,
      audioApproved: translationsTable.audioApproved,
    })
    .from(translationsTable);
  const byStory = new Map<number, Set<string>>();
  for (const translation of translations) {
    const languages = byStory.get(translation.storyId) ?? new Set<string>();
    if (translation.status === "published") {
      languages.add(translation.languageCode);
    }
    byStory.set(translation.storyId, languages);
  }
  const publishedIds = new Set(published.map((story) => story.id));
  const missingNarration = translations.filter(
    (translation) =>
      publishedIds.has(translation.storyId) &&
      translation.status === "published" &&
      (!translation.audioUrl || !translation.audioApproved),
  ).length;
  const missingTranslations = published.filter((story) => {
    const languages = byStory.get(story.id) ?? new Set<string>();
    return !["en", "te", "hi"].every((language) => languages.has(language));
  }).length;
  res.json(
    GetAdminDashboardResponse.parse({
      totalStories: rows.length,
      publishedStories: published.length,
      draftStories: rows.filter((story) => story.status === "draft").length,
      reviewStories: rows.filter((story) => story.status === "review").length,
      missingNarration,
      missingTranslations,
    }),
  );
});

router.get("/stories", async (req, res): Promise<void> => {
  const parsed = ListAdminStoriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const stories = await getAdminStories(parsed.data.status);
  res.json(ListAdminStoriesResponse.parse(stories));
});

router.post("/stories", async (req, res): Promise<void> => {
  const parsed = CreateAdminStoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, parsed.data.categoryId))
    .limit(1);
  if (!category) {
    res.status(400).json({ error: "Choose an existing category." });
    return;
  }
  const { script, ...storyFields } = parsed.data;
  const [created] = await db.transaction(async (tx) => {
    const [story] = await tx
      .insert(storiesTable)
      .values({
        ...storyFields,
        status: "draft",
        keywords: [],
      })
      .returning();
    if (!story) return [];
    const [translation] = await tx
      .insert(translationsTable)
      .values({
        storyId: story.id,
        languageCode: "en",
        title: story.title,
        description: story.description,
        script,
        reviewed: false,
        status: "draft",
      })
      .returning();
    if (translation) {
      const paragraphs = script.split(/\n\n+/).filter(Boolean);
      if (paragraphs.length) {
        await tx.insert(scenesTable).values(
          paragraphs.map((text, position) => ({
            translationId: translation.id,
            position: position + 1,
            text,
            illustrationUrl: null,
            caption: null,
          })),
        );
      }
    }
    return [story];
  });
  if (!created) {
    res.status(500).json({ error: "The story could not be saved." });
    return;
  }
  const stories = await getAdminStories("draft");
  const result = stories.find((story) => story.id === created.id);
  res.status(201).json(CreateAdminStoryResponse.parse(result));
});

router.patch("/stories/:id", async (req, res): Promise<void> => {
  const params = UpdateAdminStoryParams.safeParse(req.params);
  const body = UpdateAdminStoryBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      error: !params.success ? params.error.message : body.error?.message ?? "Invalid request body.",
    });
    return;
  }
  const [current] = await db
    .select()
    .from(storiesTable)
    .where(eq(storiesTable.id, params.data.id))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Story not found." });
    return;
  }
  if (body.data.categoryId) {
    const [category] = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, body.data.categoryId))
      .limit(1);
    if (!category) {
      res.status(400).json({ error: "Choose an existing category." });
      return;
    }
  }

  await db.transaction(async (tx) => {
    const { script, ...storyFields } = body.data;
    const updatedStory = {
      ...storyFields,
      ...(script !== undefined || current.status === "draft"
        ? { status: "review" }
        : {}),
      updatedAt: new Date(),
    };
    await tx
      .update(storiesTable)
      .set(updatedStory)
      .where(eq(storiesTable.id, params.data.id));
    if (script !== undefined) {
      const [existing] = await tx
        .select({ id: translationsTable.id })
        .from(translationsTable)
        .where(
          and(
            eq(translationsTable.storyId, params.data.id),
            eq(translationsTable.languageCode, "en"),
          ),
        )
        .limit(1);
      if (existing) {
        await tx
          .update(translationsTable)
          .set({
            script,
            title: body.data.title ?? current.title,
            description: body.data.description ?? current.description,
            reviewed: true,
            status: "review",
          })
          .where(eq(translationsTable.id, existing.id));
        await tx
          .delete(scenesTable)
          .where(eq(scenesTable.translationId, existing.id));
        const paragraphs = script.split(/\n\n+/).filter(Boolean);
        if (paragraphs.length) {
          await tx.insert(scenesTable).values(
            paragraphs.map((text, position) => ({
              translationId: existing.id,
              position: position + 1,
              text,
              illustrationUrl: null,
              caption: null,
            })),
          );
        }
      } else {
        const [translation] = await tx
          .insert(translationsTable)
          .values({
            storyId: params.data.id,
            languageCode: "en",
            title: body.data.title ?? current.title,
            description: body.data.description ?? current.description,
            script,
            reviewed: true,
            status: "review",
          })
          .returning();
        if (translation) {
          const paragraphs = script.split(/\n\n+/).filter(Boolean);
          if (paragraphs.length) {
            await tx.insert(scenesTable).values(
              paragraphs.map((text, position) => ({
                translationId: translation.id,
                position: position + 1,
                text,
                illustrationUrl: null,
                caption: null,
              })),
            );
          }
        }
      }
    }
  });
  const story = (await getAdminStories()).find(
    (item) => item.id === params.data.id,
  );
  res.json(UpdateAdminStoryResponse.parse(story));
});

router.post("/stories/:id/publish", async (req, res): Promise<void> => {
  const params = PublishAdminStoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ story: storiesTable, translation: translationsTable })
    .from(storiesTable)
    .innerJoin(
      translationsTable,
      and(
        eq(translationsTable.storyId, storiesTable.id),
        eq(translationsTable.languageCode, "en"),
      ),
    )
    .where(eq(storiesTable.id, params.data.id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Story not found." });
    return;
  }
  const { story, translation } = row;
  if (
    !story.title.trim() ||
    !story.description.trim() ||
    !story.categoryId ||
    story.ageMin < 3 ||
    story.ageMax > 12 ||
    story.ageMin > story.ageMax ||
    translation.script.trim().length < 100 ||
    !translation.reviewed ||
    story.status !== "review"
  ) {
    res.status(400).json({
      error:
        "Send a complete story for review before publishing. It needs a reviewed script, valid age range, title, description and category.",
    });
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .update(storiesTable)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(storiesTable.id, story.id));
    await tx
      .update(translationsTable)
      .set({ status: "published" })
      .where(eq(translationsTable.id, translation.id));
  });
  const updated = (await getAdminStories()).find((item) => item.id === story.id);
  res.json(PublishAdminStoryResponse.parse(updated));
});

router.post("/stories/:id/archive", async (req, res): Promise<void> => {
  const params = ArchiveAdminStoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [story] = await db
    .update(storiesTable)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(storiesTable.id, params.data.id))
    .returning({ id: storiesTable.id });
  if (!story) {
    res.status(404).json({ error: "Story not found." });
    return;
  }
  const result = (await getAdminStories()).find((item) => item.id === story.id);
  res.json(ArchiveAdminStoryResponse.parse(result));
});

export default router;
