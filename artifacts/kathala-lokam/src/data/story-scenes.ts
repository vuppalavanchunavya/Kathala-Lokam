/**
 * Scene visuals for the story player, shared by every language of a story.
 *
 * Scenes are the story's paragraphs (scene 1 = first paragraph, in English, Hindi and Telugu alike),
 * so the picture stays the same when the language changes. How long each scene lasts comes from
 * the narration timing file made by `pnpm --filter @workspace/api-server run narrate`.
 *
 * To add visuals for another story: add its slug here with one entry per paragraph.
 * A story with no entry simply keeps the plain village-path stage.
 */
export type SceneBackground = 'dusk-lake' | 'palace-morning' | 'hearth';
export type SceneProp = 'lake' | 'lamp' | 'pot' | 'fire';
export type SceneVisual = { background: SceneBackground; props: SceneProp[] };

export const STORY_SCENES: Record<string, Record<number, SceneVisual>> = {
  'birbals-khichdi': {
    1: { background: 'dusk-lake', props: ['lake'] },
    2: { background: 'dusk-lake', props: ['lake', 'lamp'] },
    3: { background: 'hearth', props: ['pot', 'fire'] },
  },
};
