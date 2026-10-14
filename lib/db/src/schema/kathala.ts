import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const categoriesTable = pgTable(
  "kathala_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull(),
    coverUrl: text("cover_url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("kathala_categories_sort_idx").on(table.sortOrder)],
);

export const storiesTable = pgTable(
  "kathala_stories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categoriesTable.id),
    description: text("description").notNull(),
    ageMin: integer("age_min").notNull(),
    ageMax: integer("age_max").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    coverUrl: text("cover_url").notNull(),
    moral: text("moral"),
    source: text("source").notNull(),
    licence: text("licence").notNull(),
    status: text("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    bedtime: boolean("bedtime").notNull().default(false),
    keywords: text("keywords").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("kathala_stories_category_idx").on(table.categoryId),
    index("kathala_stories_status_idx").on(table.status),
    index("kathala_stories_featured_idx").on(table.featured),
  ],
);

export const translationsTable = pgTable(
  "kathala_translations",
  {
    id: serial("id").primaryKey(),
    storyId: integer("story_id")
      .notNull()
      .references(() => storiesTable.id, { onDelete: "cascade" }),
    languageCode: text("language_code").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    script: text("script").notNull(),
    reviewed: boolean("reviewed").notNull().default(false),
    status: text("status").notNull().default("draft"),
    audioUrl: text("audio_url"),
    voiceIdentifier: text("voice_identifier"),
    audioApproved: boolean("audio_approved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("kathala_translation_story_language_idx").on(
      table.storyId,
      table.languageCode,
    ),
    index("kathala_translation_status_idx").on(table.status),
  ],
);

export const scenesTable = pgTable(
  "kathala_scenes",
  {
    id: serial("id").primaryKey(),
    translationId: integer("translation_id")
      .notNull()
      .references(() => translationsTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    illustrationUrl: text("illustration_url"),
    caption: text("caption"),
  },
  (table) => [
    uniqueIndex("kathala_scene_translation_position_idx").on(
      table.translationId,
      table.position,
    ),
  ],
);

export const favoritesTable = pgTable(
  "kathala_favorites",
  {
    id: serial("id").primaryKey(),
    guestId: text("guest_id").notNull(),
    storyId: integer("story_id")
      .notNull()
      .references(() => storiesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("kathala_favorite_guest_story_idx").on(
      table.guestId,
      table.storyId,
    ),
    index("kathala_favorite_guest_idx").on(table.guestId),
  ],
);

export const progressTable = pgTable(
  "kathala_progress",
  {
    id: serial("id").primaryKey(),
    guestId: text("guest_id").notNull(),
    storyId: integer("story_id")
      .notNull()
      .references(() => storiesTable.id, { onDelete: "cascade" }),
    languageCode: text("language_code").notNull().default("en"),
    playbackPosition: integer("playback_position").notNull().default(0),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("kathala_progress_guest_story_idx").on(
      table.guestId,
      table.storyId,
    ),
    index("kathala_progress_guest_updated_idx").on(
      table.guestId,
      table.updatedAt,
    ),
  ],
);

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({
  id: true,
  createdAt: true,
});
export const insertStorySchema = createInsertSchema(storiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertTranslationSchema = createInsertSchema(
  translationsTable,
).omit({ id: true, createdAt: true });

export type Category = typeof categoriesTable.$inferSelect;
export type Story = typeof storiesTable.$inferSelect;
export type Translation = typeof translationsTable.$inferSelect;
export type Scene = typeof scenesTable.$inferSelect;
export type Favorite = typeof favoritesTable.$inferSelect;
export type ListeningProgress = typeof progressTable.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertStory = z.infer<typeof insertStorySchema>;
export type InsertTranslation = z.infer<typeof insertTranslationSchema>;
