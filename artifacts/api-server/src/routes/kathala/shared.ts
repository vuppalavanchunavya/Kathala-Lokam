import { and, inArray, eq } from "drizzle-orm";
import {
  categoriesTable,
  db,
  favoritesTable,
  storiesTable,
  translationsTable,
} from "@workspace/db";

export async function listPublishedFavorites(guestId: string) {
  const rows = await db
    .select({ story: storiesTable, category: categoriesTable })
    .from(favoritesTable)
    .innerJoin(storiesTable, eq(favoritesTable.storyId, storiesTable.id))
    .innerJoin(categoriesTable, eq(storiesTable.categoryId, categoriesTable.id))
    .where(
      and(
        eq(favoritesTable.guestId, guestId),
        eq(storiesTable.status, "published"),
        eq(categoriesTable.published, true),
      ),
    );
  if (!rows.length) return [];

  const translations = await db
    .select({
      storyId: translationsTable.storyId,
      languageCode: translationsTable.languageCode,
    })
    .from(translationsTable)
    .where(
      and(
        inArray(
          translationsTable.storyId,
          rows.map(({ story }) => story.id),
        ),
        eq(translationsTable.status, "published"),
      ),
    );
  const languages = new Map<number, string[]>();
  for (const translation of translations) {
    const available = languages.get(translation.storyId) ?? [];
    available.push(translation.languageCode);
    languages.set(translation.storyId, available);
  }
  return rows.map(({ story, category }) => ({
    id: story.id,
    slug: story.slug,
    title: story.title,
    description: story.description,
    category: category.name,
    categorySlug: category.slug,
    coverUrl: story.coverUrl,
    ageMin: story.ageMin,
    ageMax: story.ageMax,
    durationMinutes: story.durationMinutes,
    languages: languages.get(story.id) ?? [],
    keywords: story.keywords,
    moral: story.moral,
    featured: story.featured,
    bedtime: story.bedtime,
  }));
}
