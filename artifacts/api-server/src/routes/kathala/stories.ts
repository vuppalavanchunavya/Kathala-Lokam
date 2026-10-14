import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import {
  categoriesTable,
  db,
  scenesTable,
  storiesTable,
  translationsTable,
} from "@workspace/db";
import {
  GetStoryParams,
  GetStoryResponse,
  GetHomeResponse,
  ListCategoriesResponse,
  ListStoriesQueryParams,
  ListStoriesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type StoryRow = {
  story: typeof storiesTable.$inferSelect;
  category: typeof categoriesTable.$inferSelect;
};

async function summariesForRows(
  rows: StoryRow[],
  preferredLanguage?: string,
) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.story.id);
  const translations = await db
    .select()
    .from(translationsTable)
    .where(
      and(
        inArray(translationsTable.storyId, ids),
        eq(translationsTable.status, "published"),
      ),
    );
  const translationsByStory = new Map<number, typeof translations>();
  for (const translation of translations) {
    const list = translationsByStory.get(translation.storyId) ?? [];
    list.push(translation);
    translationsByStory.set(translation.storyId, list);
  }

  return rows.map(({ story, category }) => {
    const available = translationsByStory.get(story.id) ?? [];
    const preferred = available.find(
      (translation) => translation.languageCode === preferredLanguage,
    );
    return {
      id: story.id,
      slug: story.slug,
      title: preferred?.title ?? story.title,
      description: preferred?.description ?? story.description,
      category: category.name,
      categorySlug: category.slug,
      coverUrl: story.coverUrl,
      ageMin: story.ageMin,
      ageMax: story.ageMax,
      durationMinutes: story.durationMinutes,
      languages: available.map((translation) => translation.languageCode),
      keywords: story.keywords,
      moral: story.moral,
      featured: story.featured,
      bedtime: story.bedtime,
    };
  });
}

async function getPublishedRows() {
  return db
    .select({ story: storiesTable, category: categoriesTable })
    .from(storiesTable)
    .innerJoin(categoriesTable, eq(storiesTable.categoryId, categoriesTable.id))
    .where(and(eq(storiesTable.status, "published"), eq(categoriesTable.published, true)));
}

router.get("/home", async (_req, res): Promise<void> => {
  const rows = await getPublishedRows();
  const summaries = await summariesForRows(rows);
  const featured =
    summaries.find((story) => story.featured) ?? summaries.at(0) ?? null;
  const popular = [...summaries]
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.id - b.id)
    .slice(0, 8);
  const recent = [...summaries].sort((a, b) => b.id - a.id).slice(0, 8);
  res.json(
    GetHomeResponse.parse({
      featured,
      popular,
      recent,
    }),
  );
});

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      description: categoriesTable.description,
      coverUrl: categoriesTable.coverUrl,
      storyCount: sql<number>`count(distinct ${storiesTable.id})::int`,
    })
    .from(categoriesTable)
    .leftJoin(
      storiesTable,
      and(
        eq(storiesTable.categoryId, categoriesTable.id),
        eq(storiesTable.status, "published"),
      ),
    )
    .where(eq(categoriesTable.published, true))
    .groupBy(categoriesTable.id)
    .orderBy(asc(categoriesTable.sortOrder));
  res.json(ListCategoriesResponse.parse(categories));
});

router.get("/stories", async (req, res): Promise<void> => {
  const parsed = ListStoriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { q, category, age, bedtime, sort, language } = parsed.data;
  const filters = [
    eq(storiesTable.status, "published"),
    eq(categoriesTable.published, true),
    category ? eq(categoriesTable.slug, category) : undefined,
    age !== undefined
      ? and(lte(storiesTable.ageMin, age), gte(storiesTable.ageMax, age))
      : undefined,
    bedtime !== undefined ? eq(storiesTable.bedtime, bedtime) : undefined,
    q
      ? or(
          ilike(storiesTable.title, `%${q}%`),
          ilike(storiesTable.description, `%${q}%`),
          ilike(categoriesTable.name, `%${q}%`),
          ilike(storiesTable.moral, `%${q}%`),
          sql`${storiesTable.keywords}::text ILIKE ${`%${q}%`}`,
        )
      : undefined,
  ];
  const rows = await db
    .select({ story: storiesTable, category: categoriesTable })
    .from(storiesTable)
    .innerJoin(categoriesTable, eq(storiesTable.categoryId, categoriesTable.id))
    .where(and(...filters))
    .orderBy(
      sort === "title"
        ? asc(storiesTable.title)
        : sort === "recent"
          ? desc(storiesTable.createdAt)
          : desc(storiesTable.featured),
      desc(storiesTable.createdAt),
    );
  let summaries = await summariesForRows(rows, language);
  if (language) {
    summaries = summaries.filter((story) =>
      story.languages.includes(language),
    );
  }
  res.json(ListStoriesResponse.parse(summaries));
});

router.get("/stories/:slug", async (req, res): Promise<void> => {
  const params = GetStoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ story: storiesTable, category: categoriesTable })
    .from(storiesTable)
    .innerJoin(categoriesTable, eq(storiesTable.categoryId, categoriesTable.id))
    .where(
      and(
        eq(storiesTable.slug, params.data.slug),
        eq(storiesTable.status, "published"),
        eq(categoriesTable.published, true),
      ),
    )
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Story not found" });
    return;
  }

  const translations = await db
    .select()
    .from(translationsTable)
    .where(
      and(
        eq(translationsTable.storyId, row.story.id),
        eq(translationsTable.status, "published"),
      ),
    )
    .orderBy(asc(translationsTable.languageCode));
  const languageIds = translations.map((translation) => translation.id);
  const scenes = languageIds.length
    ? await db
        .select()
        .from(scenesTable)
        .where(inArray(scenesTable.translationId, languageIds))
        .orderBy(asc(scenesTable.position))
    : [];
  const scenesByTranslation = new Map<number, typeof scenes>();
  for (const scene of scenes) {
    const list = scenesByTranslation.get(scene.translationId) ?? [];
    list.push(scene);
    scenesByTranslation.set(scene.translationId, list);
  }

  const summary = await summariesForRows([row]);
  const base = summary[0];
  if (!base) {
    res.status(404).json({ error: "Story not found" });
    return;
  }
  const detail = {
    ...base,
    source: row.story.source,
    licence: row.story.licence,
    translations: translations.map((translation) => ({
      languageCode: translation.languageCode,
      title: translation.title,
      script: translation.script,
      reviewed: translation.reviewed,
      audioUrl:
        translation.audioApproved && translation.audioUrl
          ? translation.audioUrl
          : null,
      scenes: (scenesByTranslation.get(translation.id) ?? []).map((scene) => ({
        position: scene.position,
        text: scene.text,
        illustrationUrl: scene.illustrationUrl,
        caption: scene.caption,
      })),
    })),
  };
  res.json(GetStoryResponse.parse(detail));
});

export default router;
