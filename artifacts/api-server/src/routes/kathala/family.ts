import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  favoritesTable,
  progressTable,
  storiesTable,
  translationsTable,
} from "@workspace/db";
import {
  AddFavoriteBody,
  ListFavoritesQueryParams,
  ListFavoritesResponse,
  ListProgressQueryParams,
  ListProgressResponse,
  RemoveFavoriteQueryParams,
  SaveProgressBody,
  SaveProgressQueryParams,
  SaveProgressResponse,
} from "@workspace/api-zod";
import { listPublishedFavorites } from "./shared";

const router: IRouter = Router();

router.get("/favorites", async (req, res): Promise<void> => {
  const parsed = ListFavoritesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const stories = await listPublishedFavorites(parsed.data.guestId);
  res.json(ListFavoritesResponse.parse(stories));
});

router.post("/favorites", async (req, res): Promise<void> => {
  const parsed = AddFavoriteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [story] = await db
    .select({ id: storiesTable.id })
    .from(storiesTable)
    .where(
      and(
        eq(storiesTable.id, parsed.data.storyId),
        eq(storiesTable.status, "published"),
      ),
    )
    .limit(1);
  if (!story) {
    res.status(404).json({ error: "Story not found" });
    return;
  }
  await db
    .insert(favoritesTable)
    .values({ guestId: parsed.data.guestId, storyId: parsed.data.storyId })
    .onConflictDoNothing();
  res.sendStatus(204);
});

router.delete("/favorites", async (req, res): Promise<void> => {
  const parsed = RemoveFavoriteQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db
    .delete(favoritesTable)
    .where(
      and(
        eq(favoritesTable.guestId, parsed.data.guestId),
        eq(favoritesTable.storyId, parsed.data.storyId),
      ),
    );
  res.sendStatus(204);
});

router.get("/progress", async (req, res): Promise<void> => {
  const parsed = ListProgressQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const progress = await db
    .select({
      storyId: progressTable.storyId,
      languageCode: progressTable.languageCode,
      playbackPosition: progressTable.playbackPosition,
      durationSeconds: progressTable.durationSeconds,
      completed: progressTable.completed,
      updatedAt: progressTable.updatedAt,
    })
    .from(progressTable)
    .innerJoin(storiesTable, eq(progressTable.storyId, storiesTable.id))
    .where(
      and(
        eq(progressTable.guestId, parsed.data.guestId),
        eq(storiesTable.status, "published"),
      ),
    )
    .orderBy(desc(progressTable.updatedAt));
  res.json(ListProgressResponse.parse(progress));
});

router.put("/progress", async (req, res): Promise<void> => {
  const query = SaveProgressQueryParams.safeParse(req.query);
  const body = SaveProgressBody.safeParse(req.body);
  if (!query.success || !body.success) {
    res.status(400).json({
      error: !query.success ? query.error.message : body.error?.message ?? "Invalid request body.",
    });
    return;
  }
  const [translation] = await db
    .select({ storyId: storiesTable.id })
    .from(storiesTable)
    .innerJoin(
      translationsTable,
      and(
        eq(translationsTable.storyId, storiesTable.id),
        eq(translationsTable.languageCode, body.data.languageCode),
        eq(translationsTable.status, "published"),
      ),
    )
    .where(
      and(
        eq(storiesTable.id, query.data.storyId),
        eq(storiesTable.status, "published"),
      ),
    )
    .limit(1);
  if (!translation) {
    res.status(404).json({ error: "Published story language not found" });
    return;
  }

  const playbackPosition = Math.min(
    body.data.playbackPosition,
    body.data.durationSeconds || body.data.playbackPosition,
  );
  const [saved] = await db
    .insert(progressTable)
    .values({
      guestId: query.data.guestId,
      storyId: query.data.storyId,
      languageCode: body.data.languageCode,
      playbackPosition,
      durationSeconds: body.data.durationSeconds,
      completed: body.data.completed,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [progressTable.guestId, progressTable.storyId],
      set: {
        languageCode: body.data.languageCode,
        playbackPosition,
        durationSeconds: body.data.durationSeconds,
        completed: body.data.completed,
        updatedAt: new Date(),
      },
    })
    .returning({
      storyId: progressTable.storyId,
      languageCode: progressTable.languageCode,
      playbackPosition: progressTable.playbackPosition,
      durationSeconds: progressTable.durationSeconds,
      completed: progressTable.completed,
      updatedAt: progressTable.updatedAt,
    });
  res.json(SaveProgressResponse.parse(saved));
});

export default router;
