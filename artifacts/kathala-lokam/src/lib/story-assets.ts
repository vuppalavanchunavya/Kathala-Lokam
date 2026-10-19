export interface CategoryDesign {
  slug: string;
  name: string;
  shortName: string;
  subtitle: string;
  image: string;
  bgColor: string;
  borderColor: string;
  pillBg: string;
  pillColor: string;
}

export const CATEGORY_DESIGNS: Record<string, CategoryDesign> = {
  'akbar-and-birbal': {
    slug: 'akbar-and-birbal',
    name: 'Akbar & Birbal',
    shortName: 'Akbar & Birbal',
    subtitle: 'Clever minds, funny tales',
    image: '/images/cat_akbar_birbal.jpg',
    bgColor: '#FFE3D3',
    borderColor: '#FFC4A8',
    pillBg: '#FF6B6B',
    pillColor: '#FFFFFF',
  },
  'pedarasi-peddamma': {
    slug: 'pedarasi-peddamma',
    name: 'Pedarasi Peddamma Kathalu',
    shortName: 'Pedarasi Peddamma',
    subtitle: 'Village tales and a little magic',
    image: '/images/cat_peddamma.jpg',
    bgColor: '#D9F7E5',
    borderColor: '#A8EDC1',
    pillBg: '#2EAA68',
    pillColor: '#FFFFFF',
  },
  'vikram-and-betal': {
    slug: 'vikram-and-betal',
    name: 'Vikram & Betal',
    shortName: 'Vikram & Betal',
    subtitle: 'Mystery & riddles',
    image: '/images/cat_vikram_betal.jpg',
    bgColor: '#E6DCFF',
    borderColor: '#C8B5FF',
    pillBg: '#7A52D4',
    pillColor: '#FFFFFF',
  },
  'panchatantra': {
    slug: 'panchatantra',
    name: 'Panchatantra',
    shortName: 'Panchatantra',
    subtitle: 'Animal adventures',
    image: '/images/cat_panchatantra.jpg',
    bgColor: '#FFF0AA',
    borderColor: '#FFE066',
    pillBg: '#2EAA68',
    pillColor: '#FFFFFF',
  },
  'tenali-raman': {
    slug: 'tenali-raman',
    name: 'Tenali Raman',
    shortName: 'Tenali Raman',
    subtitle: 'Quick wit & humour',
    image: '/images/cat_tenali_raman.jpg',
    bgColor: '#FFE5C8',
    borderColor: '#FFCCA0',
    pillBg: '#FF8833',
    pillColor: '#FFFFFF',
  },
  'bedtime-stories': {
    slug: 'bedtime-stories',
    name: 'Bedtime Tales',
    shortName: 'Bedtime Tales',
    subtitle: 'Slow stories for sleepy eyes',
    image: '/images/cat_bedtime.jpg',
    bgColor: '#D2EAFF',
    borderColor: '#A6D4FF',
    pillBg: '#4A7CDA',
    pillColor: '#FFFFFF',
  },
  'indian-folk-tales': {
    slug: 'indian-folk-tales',
    name: 'Indian Folk Tales',
    shortName: 'Indian Folk Tales',
    subtitle: 'Stories from different regions',
    image: '/images/cat_folk_tales.jpg',
    bgColor: '#FFE3D8',
    borderColor: '#FFC8B8',
    pillBg: '#E85A3C',
    pillColor: '#FFFFFF',
  },
  'moral-stories': {
    slug: 'moral-stories',
    name: 'Moral Stories',
    shortName: 'Moral Stories',
    subtitle: 'Kindness & wisdom',
    image: '/images/cat_moral_stories.jpg',
    bgColor: '#EADFFF',
    borderColor: '#D4C2FC',
    pillBg: '#8A5CD6',
    pillColor: '#FFFFFF',
  },
};

const STORY_SLUG_IMAGES: Record<string, string> = {
  'birbals-khichdi': '/images/story_birbal_khichdi.jpg',
  'birbal-counts-the-crows': '/images/cat_akbar_birbal.jpg',
  'the-clever-rabbit-and-the-lion': '/images/story_clever_rabbit_lion.jpg',
  'the-kind-woodcutter': '/images/story_kind_woodcutter.jpg',
  'the-golden-goose': '/images/cat_panchatantra.jpg',
  'the-helpful-friends': '/images/cat_moral_stories.jpg',
  'the-clever-merchant': '/images/cat_folk_tales.jpg',
  'the-brave-little-girl': '/images/story_adventure_airplane.png',
  'the-thirsty-crow': '/images/cat_panchatantra.jpg',
  'the-tortoise-and-the-hare': '/images/cat_moral_stories.jpg',
  'the-monkey-and-the-crocodile': '/images/cat_panchatantra.jpg',
};

export function getStoryArtwork(slug?: string | null, categorySlugOrName?: string | null, explicitCover?: string | null): string {
  if (slug && STORY_SLUG_IMAGES[slug]) {
    return STORY_SLUG_IMAGES[slug];
  }
  
  if (categorySlugOrName) {
    const key = categorySlugOrName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (CATEGORY_DESIGNS[key]) {
      return CATEGORY_DESIGNS[key].image;
    }
    // Match partial
    for (const [catKey, design] of Object.entries(CATEGORY_DESIGNS)) {
      if (key.includes(catKey) || catKey.includes(key)) {
        return design.image;
      }
    }
  }

  if (explicitCover && explicitCover.startsWith('/images/')) {
    return explicitCover;
  }

  return '/images/cat_panchatantra.jpg';
}

export function getCategoryDesign(slugOrName?: string | null): CategoryDesign {
  if (!slugOrName) return CATEGORY_DESIGNS['panchatantra'];
  const key = slugOrName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (CATEGORY_DESIGNS[key]) return CATEGORY_DESIGNS[key];
  for (const [catKey, design] of Object.entries(CATEGORY_DESIGNS)) {
    if (key.includes(catKey) || catKey.includes(key)) return design;
  }
  return {
    slug: key,
    name: slugOrName,
    shortName: slugOrName,
    subtitle: 'Folk tales for children',
    image: '/images/cat_panchatantra.jpg',
    bgColor: '#FFF4DA',
    borderColor: '#FFE29A',
    pillBg: '#FF8833',
    pillColor: '#FFFFFF',
  };
}
