import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, UserButton, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  useGetHome, useListCategories, useListStories, useGetStory, useListFavorites,
  useAddFavorite, useRemoveFavorite, useListProgress, useSaveProgress,
  useGetAdminDashboard, useListAdminStories, useCreateAdminStory, useUpdateAdminStory,
  usePublishAdminStory, useArchiveAdminStory, getGetHomeQueryKey,
  getListStoriesQueryKey, getListFavoritesQueryKey, getListProgressQueryKey,
  getGetAdminDashboardQueryKey, getListAdminStoriesQueryKey,
} from '@workspace/api-client-react';
import type { AdminStory, StorySummary, StoryInput, StoryUpdate, Translation, Category } from '@workspace/api-client-react';
import { Route, Switch, Link, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, Clock3, Headphones,
  Heart, LibraryBig, LockKeyhole, Menu, Moon, Pause, Play, Search, ShieldCheck,
  Sparkles, Star, Volume2, X, RotateCcw, Compass, Home as HomeIcon, Award, User, VolumeX, Laugh, PawPrint, Lightbulb
} from 'lucide-react';
import NotFound from '@/pages/not-found';
import { CATEGORY_DESIGNS, getCategoryDesign, getStoryArtwork } from '@/lib/story-assets';
import {
  LANGUAGE_LABEL, SPEECH_LANG, loadLanguage, saveLanguage, pickVoice, sentenceAt, splitSentences,
} from '@/lib/narration';
import type { NarrationSentence } from '@/lib/narration';
import { STORY_SCENES } from '@/data/story-scenes';
import type { SceneProp, SceneVisual } from '@/data/story-scenes';

const queryClient = new QueryClient();
const guestId = (() => {
  try {
    const key = 'kathala-guest-profile';
    let id = localStorage.getItem(key);
    if (!id) { id = `guest-${crypto.randomUUID()}`; localStorage.setItem(key, id); }
    return id;
  } catch { return 'guest-browser'; }
})();

import { createContext, useContext } from 'react';

const SafeUserContext = createContext<{ isLoaded: boolean; isSignedIn: boolean; user: any }>({
  isLoaded: true,
  isSignedIn: false,
  user: null,
});

const rawClerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
// Only use real Clerk publishable keys (pk_test_... or pk_live_...) and avoid synthetic clerk.localhost
const clerkPubKey = (rawClerkKey && !rawClerkKey.includes('localhost') && (rawClerkKey.startsWith('pk_test_') || rawClerkKey.startsWith('pk_live_'))) ? rawClerkKey : null;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function useSafeUser() {
  const fallback = useContext(SafeUserContext);
  if (!clerkPubKey) {
    return fallback;
  }
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useUser();
  } catch {
    return fallback;
  }
}

const languageNames: Record<string, string> = { en: 'English', te: 'తెలుగు', hi: 'हिन्दी' };

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkAppearance = {
  theme: shadcn, cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/favicon.svg` },
  variables: {
    colorPrimary: '#B4432B', colorForeground: '#2B2118', colorMutedForeground: '#6B5A4A',
    colorDanger: '#A84343', colorBackground: '#FBF3E4', colorInput: '#FFFBF2',
    colorInputForeground: '#2B2118', colorNeutral: '#E3D3B8', fontFamily: 'Nunito, sans-serif', borderRadius: '0.5rem',
  },
};

function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
function assetUrl(url?: string | null) {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${basePath}${url.startsWith('/') ? url : `/${url}`}`;
}

/* ========================================================
   CUTE MASCOTS: Katha Buddy & Smiling Star
   ======================================================== */
function KathaBuddy({ size = 52, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={`katha-buddy-svg ${className}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Book Body */}
      <rect x="18" y="24" width="84" height="76" rx="18" fill="#FFF2DD" stroke="#49366B" strokeWidth="4.5"/>
      {/* Book Cover Spine Accent */}
      <path d="M18 36C18 29.3726 23.3726 24 30 24H36V100H30C23.3726 100 18 94.6274 18 88V36Z" fill="#FF82B2"/>
      <line x1="36" y1="24" x2="36" y2="100" stroke="#49366B" strokeWidth="4"/>
      {/* Ribbon Bookmark */}
      <path d="M72 16V34L80 28L88 34V16H72Z" fill="#FFE680" stroke="#49366B" strokeWidth="3"/>
      {/* Big Cute Eyes */}
      <ellipse cx="54" cy="55" rx="6.5" ry="8" fill="#49366B"/>
      <ellipse cx="78" cy="55" rx="6.5" ry="8" fill="#49366B"/>
      <circle cx="56.5" cy="52" r="2.5" fill="#FFFFFF"/>
      <circle cx="80.5" cy="52" r="2.5" fill="#FFFFFF"/>
      {/* Cheerful Rosy Cheeks */}
      <ellipse cx="46" cy="65" rx="5" ry="3.5" fill="#FFAEC9" opacity="0.85"/>
      <ellipse cx="86" cy="65" rx="5" ry="3.5" fill="#FFAEC9" opacity="0.85"/>
      {/* Happy Smile */}
      <path d="M60 66C63 72 69 72 72 66" stroke="#49366B" strokeWidth="4" strokeLinecap="round"/>
      {/* Little Star Sparkle on top corner */}
      <path d="M96 18L98 24L104 26L98 28L96 34L94 28L88 26L94 24L96 18Z" fill="#FFE680" stroke="#D4A72C" strokeWidth="1.5"/>
    </svg>
  );
}

function StarMascot({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="sparkle-anim">
      <path d="M30 4L37 20L54 23L42 36L45 53L30 44L15 53L18 36L6 23L23 20L30 4Z" fill="#FFE680" stroke="#E5B218" strokeWidth="3" strokeLinejoin="round"/>
      <circle cx="25" cy="27" r="2.5" fill="#49366B"/>
      <circle cx="35" cy="27" r="2.5" fill="#49366B"/>
      <path d="M27 34C28.5 37 31.5 37 33 34" stroke="#49366B" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

/* ========================================================
   HEADER & NAVIGATION
   ======================================================== */
function Header() {
  const [loc, setLoc] = useLocation();
  const { isSignedIn, user } = useSafeUser();
  const isAdmin = user?.publicMetadata?.role === 'admin';
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (headerSearch.trim()) {
      setLoc(`/explore?q=${encodeURIComponent(headerSearch.trim())}`);
      setSearchOpen(false);
    }
  };

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Brand Logo */}
        <Link href="/" className="brand" data-testid="link-home-brand">
          <div className="brand-icon-box">
            <BookOpen size={24} color="#2B2118" strokeWidth={2.2} />
          </div>
          <div className="brand-text">
            <h1>Kathala <b>Lokam</b></h1>
            <small>Folk tales for children</small>
          </div>
        </Link>

        {/* Mobile toggle */}
        <button
          className="mobile-menu-btn"
          style={{ display: 'none', background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer' }}
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation"
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>

        {/* Nav links: active page gets an accent underline */}
        <nav className={`main-nav ${open ? 'nav-open' : ''}`} aria-label="Main navigation">
          <Link href="/" className={`nav-pill ${loc === '/' ? 'active' : ''}`} data-testid="link-nav-home">
            <HomeIcon size={16} /> Home
          </Link>
          <Link href="/explore" className={`nav-pill ${loc.startsWith('/explore') ? 'active' : ''}`} data-testid="link-nav-explore">
            <Compass size={16} /> Explore Stories
          </Link>
          <Link href="/favorites" className={`nav-pill ${loc === '/favorites' ? 'active' : ''}`} data-testid="link-nav-favorites">
            <Heart size={16} /> My Favourites
          </Link>
          <Link href="/grandma-tales" className={`nav-pill ${loc === '/grandma-tales' ? 'active' : ''}`} data-testid="link-nav-grandma">
            <Award size={16} /> Grandma's Tales
          </Link>
          <Link href="/parent" className={`nav-pill ${loc.startsWith('/parent') ? 'active' : ''}`} data-testid="link-nav-parent">
            <User size={16} /> Parent Corner
          </Link>
          {isAdmin && (
            <Link href="/admin" className={`nav-pill ${loc.startsWith('/admin') ? 'active' : ''}`} data-testid="link-nav-admin">
              <LibraryBig size={16} /> Story Studio
            </Link>
          )}
        </nav>

        {/* Header Right Actions */}
        <div className="header-right">
          {searchOpen ? (
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="text"
                value={headerSearch}
                onChange={e => setHeaderSearch(e.target.value)}
                placeholder="Find a tale..."
                autoFocus
                className="header-search-input"
                aria-label="Search stories"
              />
              <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search" style={{ background: 'none', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44 }}>
                <X size={18} color="#2B2118" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="header-search-btn"
              onClick={() => setSearchOpen(true)}
              aria-label="Search stories"
              data-testid="button-header-search"
            >
              <Search size={18} />
            </button>
          )}

          {isSignedIn ? (
            <div className="user-chip">
              <UserButton />
            </div>
          ) : (
            <Link href="/parent" className="header-buddy-avatar" title="Parent Corner & Story Mascot" data-testid="link-avatar-buddy">
              <KathaBuddy size={34} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div style={{ maxWidth: 1260, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-6)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--marigold)', display: 'grid', placeItems: 'center' }}>
              <BookOpen size={22} color="#2B2118" strokeWidth={2.2} />
            </div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--paper)' }}>Kathala Lokam</h2>
          </div>
          <p style={{ color: '#EADFCB', fontSize: 'var(--text-sm)', lineHeight: 1.7, margin: 0, maxWidth: '30em' }}>
            Indian folk tales for young listeners and their families, told simply and kept close to the originals.
          </p>
        </div>

        <div>
          <h4 style={{ fontSize: 'var(--text-lg)', color: '#F1D78A', margin: '0 0 var(--space-2)' }}>Story shelves</h4>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 'var(--text-sm)' }}>
            <Link href="/categories/akbar-and-birbal">Akbar & Birbal</Link>
            <Link href="/categories/panchatantra">Panchatantra Tales</Link>
            <Link href="/categories/tenali-raman">Tenali Raman Wit</Link>
            <Link href="/categories/pedarasi-peddamma">Pedarasi Peddamma</Link>
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: 'var(--text-lg)', color: '#F1D78A', margin: '0 0 var(--space-2)' }}>Find your way around</h4>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 'var(--text-sm)' }}>
            <Link href="/explore">Explore all tales</Link>
            <Link href="/grandma-tales">Grandma's favourites</Link>
            <Link href="/favorites">Saved stories</Link>
            <Link href="/parent">Parent corner</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1260, margin: 'var(--space-6) auto 0', paddingTop: 'var(--space-4)', borderTop: '1px solid rgba(251,243,228,0.2)', fontSize: 13, color: '#D9CCB5' }}>
        Kathala Lokam · Folk tales for children · 2026
      </div>
    </footer>
  );
}

/* ========================================================
   FAVOURITE HEART TOGGLE
   ======================================================== */
function FavoriteHeartButton({ story }: { story: StorySummary }) {
  const qc = useQueryClient();
  const favorites = useListFavorites({ guestId });
  const add = useAddFavorite();
  const remove = useRemoveFavorite();
  const saved = !!favorites.data?.some(item => item.id === story.id);
  const busy = add.isPending || remove.isPending;

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const onSuccess = () => qc.invalidateQueries({ queryKey: getListFavoritesQueryKey({ guestId }) });
    if (saved) remove.mutate({ params: { guestId, storyId: story.id } }, { onSuccess });
    else add.mutate({ data: { guestId, storyId: story.id } }, { onSuccess });
  };

  return (
    <button
      className={`story-card-heart-btn ${saved ? 'is-saved' : ''}`}
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={saved ? `Remove ${story.title} from favourites` : `Save ${story.title} to favourites`}
      data-testid={`button-card-favorite-${story.id}`}
    >
      <Heart size={18} fill={saved ? '#B4432B' : 'none'} color={saved ? '#B4432B' : 'currentColor'} />
    </button>
  );
}

/* ========================================================
   MAGIC STORY CARD
   ======================================================== */
function MagicStoryCard({ story }: { story: StorySummary }) {
  const artwork = getStoryArtwork(story.slug, story.category, story.coverUrl);
  const catDesign = getCategoryDesign(story.category);
  const [imgSrc, setImgSrc] = useState(() => assetUrl(artwork));

  useEffect(() => {
    setImgSrc(assetUrl(artwork));
  }, [artwork]);

  return (
    <article className="magic-story-card" data-testid={`card-story-${story.id}`}>
      <FavoriteHeartButton story={story} />
      <Link href={`/stories/${story.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="story-card-cover-wrap">
          <img
            src={imgSrc}
            alt={`Cover artwork for ${story.title}`}
            className="story-card-cover-img"
            loading="lazy"
            onError={() => {
              setImgSrc(assetUrl(catDesign.image) || assetUrl('/images/cat_panchatantra.jpg'));
            }}
          />
        </div>

        <div className="story-card-body">
          <div className="story-card-meta">
            <span>Ages {story.ageMin}–{story.ageMax}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock3 size={12} /> {story.durationMinutes} min
            </span>
          </div>

          <h3 className="story-card-title">{story.title}</h3>
          <span className="story-card-cat-pill">{catDesign.shortName}</span>
          <p className="story-card-desc">{story.description}</p>

          <div className="story-card-action-bar">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)' }}>
              {story.languages?.map(l => languageNames[l] || l).join(' · ')}
            </span>
            <span className="btn-play-mini">
              <Play size={13} fill="currentColor" /> Play
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

/* ========================================================
   CATEGORY CARD COMPONENT
   ======================================================== */
function IllustratedCategoryCard({ category }: { category: { slug: string; name: string; storyCount?: number } }) {
  const design = getCategoryDesign(category.slug);

  return (
    <Link
      href={`/categories/${category.slug}`}
      className="category-card"
      data-testid={`link-category-${category.slug}`}
    >
      <div className="category-card-img-wrap">
        <img
          src={assetUrl(design.image)}
          alt={design.name}
          className="category-card-img"
          loading="lazy"
        />
      </div>

      <div className="category-card-body">
        <h4 className="category-card-title">{design.name}</h4>
        <p className="category-card-subtitle">{design.subtitle}</p>
        <p className="category-card-count">{category.storyCount ?? 4} stories</p>
      </div>
    </Link>
  );
}

/* ========================================================
   HOME EXTRAS: mood picker + riddle of the day
   ======================================================== */
const MOODS = [
  { slug: 'bedtime-stories', label: 'Sleepy', line: 'Slow stories for the end of the day', Icon: Moon },
  { slug: 'tenali-raman', label: 'Giggly', line: 'Quick wit and funny turns', Icon: Laugh },
  { slug: 'vikram-and-betal', label: 'Curious', line: 'Riddles, ghosts and puzzles', Icon: Lightbulb },
  { slug: 'panchatantra', label: 'Animal-minded', line: 'Lions, rabbits, crows and clever friends', Icon: PawPrint },
];

const RIDDLES = [
  { q: 'I have cities but no houses, forests but no trees, and water but no fish. What am I?', a: 'A map.' },
  { q: 'I have two hands but cannot clap. What am I?', a: 'A clock.' },
  { q: 'The more of me you take, the more you leave behind. What am I?', a: 'Footsteps.' },
  { q: 'I have a spine but no bones, and a story in every page. What am I?', a: 'A book.' },
  { q: 'I go up when the rain comes down. What am I?', a: 'An umbrella.' },
  { q: 'I follow you all day but disappear in the dark. What am I?', a: 'Your shadow.' },
  { q: 'I am full of holes, yet I still hold water. What am I?', a: 'A sponge.' },
];

function MoodPicker() {
  return (
    <section className="section-wrapper" aria-labelledby="mood-heading">
      <div className="section-header-row">
        <div>
          <div className="section-label-chip">Tonight</div>
          <h2 className="section-title" id="mood-heading">How are you feeling?</h2>
        </div>
      </div>
      <div className="mood-grid">
        {MOODS.map(({ slug, label, line, Icon }) => (
          <Link key={slug} href={`/categories/${slug}`} className="mood-tile" data-testid={`link-mood-${slug}`}>
            <span className="mood-icon" aria-hidden="true"><Icon size={26} strokeWidth={2} /></span>
            <span className="mood-label">{label}</span>
            <span className="mood-line">{line}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RiddleCard() {
  const day = Math.floor(Date.now() / 86400000);
  const riddle = RIDDLES[day % RIDDLES.length];
  const [shown, setShown] = useState(false);
  return (
    <section className="section-wrapper">
      <div className="riddle-card">
        <div>
          <div className="riddle-kicker">Betal's riddle of the day</div>
          <p className="riddle-q">{riddle.q}</p>
        </div>
        <div className="riddle-side">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShown(v => !v)}
            aria-expanded={shown}
            data-testid="button-riddle-reveal"
          >
            {shown ? 'Hide the answer' : 'Think first, then tap'}
          </button>
          <p className="riddle-a" aria-live="polite">{shown ? riddle.a : ''}</p>
        </div>
      </div>
    </section>
  );
}

/* ========================================================
   SCREEN ONE: HOMEPAGE
   ======================================================== */
function HomePage() {
  const home = useGetHome();
  const categories = useListCategories();
  const allStories = useListStories({ sort: 'popular' });
  const featured = home.data?.featured;

  // The 6 main showcase categories matching Screen 1 in design reference
  const showcaseSlugs = [
    'akbar-and-birbal',
    'pedarasi-peddamma',
    'vikram-and-betal',
    'panchatantra',
    'tenali-raman',
    'bedtime-stories',
  ];

  const showcaseCategories = useMemo(() => {
    if (!categories.data) return [];
    return showcaseSlugs.map(slug => {
      const found = categories.data.find(c => c.slug === slug);
      if (found) return found;
      const design = CATEGORY_DESIGNS[slug];
      return { id: 0, slug, name: design?.name || slug, description: design?.subtitle || '', storyCount: 4, coverUrl: design?.image || '', sortOrder: 1 };
    });
  }, [categories.data]);

  // Curated lists
  const animalStories = useMemo(() => {
    const list = allStories.data && allStories.data.length > 0 ? allStories.data : home.data?.popular || [];
    const matched = list.filter(s => s.category?.toLowerCase().includes('panchatantra') || s.keywords?.some(k => ['rabbit', 'lion', 'animal', 'crow'].includes(k)));
    return matched.length > 0 ? matched : list.slice(0, 4);
  }, [allStories.data, home.data?.popular]);

  const grandmaTales = useMemo(() => {
    const list = allStories.data && allStories.data.length > 0 ? allStories.data : home.data?.recent || [];
    const matched = list.filter(s => s.category?.toLowerCase().includes('pedarasi') || s.category?.toLowerCase().includes('folk') || s.category?.toLowerCase().includes('moral'));
    return matched.length > 0 ? matched : list.slice(0, 4);
  }, [allStories.data, home.data?.recent]);

  return (
    <main className="page-enter">
      {/* 1. HERO SECTION: text panel beside the artwork */}
      <section className="hero-container">
        <div className="hero-banner">
          <div className="hero-content">
            <h1 className="hero-title">
              Stories your grandmother <span className="wonder-word">would tell.</span>
            </h1>

            <p className="hero-subtitle">
              Folk tales from across India, read aloud in English, Telugu and Hindi, each ending with the lesson.
            </p>

            <div className="hero-actions">
              <Link href="/explore" className="btn-primary-pill" data-testid="button-find-story">
                <Play size={18} fill="currentColor" /> Find my story
              </Link>
              <span className="hero-tagline">Short enough for bedtime.</span>
            </div>
          </div>

          <figure className="hero-art">
            <img
              src={assetUrl('/images/hero_wonder_landscape.jpg')}
              alt="A storybook village scene with Katha Buddy, the book mascot"
            />
          </figure>
        </div>
      </section>
      <div className="kolam-rule" aria-hidden="true" />

      <MoodPicker />

      {/* 2. EXPLORE BY CATEGORY SECTION */}
      <section className="section-wrapper">
        <div className="section-header-row">
          <div>
            <div className="section-label-chip">Browse by shelf</div>
            <h2 className="section-title">Pick a storyteller</h2>
          </div>
          <Link href="/explore" className="section-view-all" data-testid="link-view-all-categories">
            All categories <ArrowRight size={16} />
          </Link>
        </div>

        {categories.isLoading ? (
          <div className="category-cards-grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ minHeight: 180 }} className="skeleton" />
            ))}
          </div>
        ) : (
          <div className="category-cards-grid">
            {showcaseCategories.map(cat => (
              <IllustratedCategoryCard key={cat.slug} category={cat} />
            ))}
          </div>
        )}
      </section>

      {/* 3. FEATURED STORY SECTION */}
      {featured && (
        <section className="section-wrapper">
          <div className="featured-story-banner">
            <div className="featured-img-col">
              <img
                src={assetUrl(getStoryArtwork(featured.slug, featured.category, featured.coverUrl))}
                alt={featured.title}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src = assetUrl('/images/story_birbal_khichdi.jpg') || '';
                }}
              />
            </div>
            <div className="featured-content-col">
              <span className="featured-pill-tag">Featured story</span>
              <h2 className="featured-story-title">{featured.title}</h2>
              <p className="featured-story-desc">{featured.description}</p>

              <div className="featured-meta-pills">
                <span className="meta-pill">
                  Ages {featured.ageMin}–{featured.ageMax}
                </span>
                <span className="meta-pill">
                  <Clock3 size={14} /> {featured.durationMinutes} minutes
                </span>
                <span className="meta-pill">
                  <BookOpen size={14} /> {featured.category}
                </span>
              </div>

              <Link
                href={`/stories/${featured.slug}`}
                className="btn-primary-pill"
                style={{ marginTop: 8 }}
                data-testid="button-featured-play"
              >
                <Play size={16} fill="currentColor" /> Read this story
              </Link>
            </div>
          </div>
        </section>
      )}

      <RiddleCard />

      {/* 4. GRANDMA'S FAVOURITE TALES COLLECTION BANNER */}
      <section className="section-wrapper">
        <div className="section-header-row">
          <div>
            <div className="section-label-chip">Folk tales, retold</div>
            <h2 className="section-title">Grandma's Favourite Tales</h2>
          </div>
          <Link href="/grandma-tales" className="section-view-all" data-testid="link-view-grandma-tales">
            Visit Grandma's Nook <ArrowRight size={16} />
          </Link>
        </div>

        <div className="stories-grid-container">
          {grandmaTales.slice(0, 4).map(story => (
            <MagicStoryCard key={story.id} story={story} />
          ))}
        </div>
      </section>

      {/* 5. POPULAR STORYTIME PICKS */}
      <section className="section-wrapper">
        <div className="section-header-row">
          <div>
            <div className="section-label-chip">Popular right now</div>
            <h2 className="section-title">Storytime picks</h2>
          </div>
          <Link href="/explore" className="section-view-all">
            See the library <ArrowRight size={16} />
          </Link>
        </div>

        <div className="stories-grid-container">
          {(home.data?.popular || allStories.data?.slice(0, 4) || []).map(story => (
            <MagicStoryCard key={story.id} story={story} />
          ))}
        </div>
      </section>

      {/* 6. ANIMAL ADVENTURES */}
      {animalStories.length > 0 && (
        <section className="section-wrapper">
          <div className="section-header-row">
            <div>
              <div className="section-label-chip">Panchatantra and nature</div>
              <h2 className="section-title">Clever animals, short lessons</h2>
            </div>
            <Link href="/categories/panchatantra" className="section-view-all">
              More animals <ArrowRight size={16} />
            </Link>
          </div>

          <div className="stories-grid-container">
            {animalStories.slice(0, 4).map(story => (
              <MagicStoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}

      {/* 7. NOTE FOR PARENTS */}
      <section className="section-wrapper" style={{ marginTop: 'var(--space-8)' }}>
        <div className="family-band">
          <div>
            <span className="family-band-kicker">For parents</span>
            <h2>Stories chosen with care.</h2>
            <p>
              Every tale is read for kindness and a clear lesson before it goes up. No ads, no surprises. Just classic Indian folk tales for children.
            </p>
          </div>

          <div className="family-band-note">
            <ShieldCheck size={28} color="#F1D78A" strokeWidth={2} />
            <span>Safe for the whole family</span>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ========================================================
   SCREEN TWO: EXPLORE STORIES
   ======================================================== */
function ExplorePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [age, setAge] = useState('');
  const [bedtime, setBedtime] = useState(false);
  const [sort, setSort] = useState<'popular' | 'recent' | 'title'>('popular');

  const cats = useListCategories();
  const params = useMemo(() => ({
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(category ? { category } : {}),
    ...(language ? { language: language as 'en' | 'te' | 'hi' } : {}),
    ...(age ? { age: Number(age) } : {}),
    ...(bedtime ? { bedtime: true } : {}),
    sort,
  }), [search, category, language, age, bedtime, sort]);

  const stories = useListStories(params);

  // All 8 categories to match Screen Two in reference
  const allCategorySlugs = [
    'akbar-and-birbal',
    'pedarasi-peddamma',
    'vikram-and-betal',
    'panchatantra',
    'tenali-raman',
    'bedtime-stories',
    'indian-folk-tales',
    'moral-stories',
  ];

  const fullCategories = useMemo(() => {
    return allCategorySlugs.map(slug => {
      const found = cats.data?.find(c => c.slug === slug);
      if (found) return found;
      const design = CATEGORY_DESIGNS[slug];
      return { id: 0, slug, name: design?.name || slug, description: design?.subtitle || '', storyCount: 4, coverUrl: design?.image || '', sortOrder: 1 };
    });
  }, [cats.data]);

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setLanguage('');
    setAge('');
    setBedtime(false);
    setSort('popular');
  };

  return (
    <main className="page-enter section-wrapper" style={{ paddingTop: 32 }}>
      {/* Heading, left-aligned */}
      <div className="explore-head">
        <div className="section-label-chip">All shelves</div>
        <h1 className="explore-title">Find a story to read tonight</h1>
        <p className="explore-sub">
          Birbal's wit, Panchatantra animals, Telugu grandma tales and more.
        </p>
      </div>

      {/* Category grid: first shelf larger, the rest smaller */}
      <div className="category-cards-grid category-cards-grid--explore" style={{ marginBottom: 'var(--space-7)' }}>
        {fullCategories.map(cat => (
          <IllustratedCategoryCard key={cat.slug} category={cat} />
        ))}
      </div>

      {/* Search and Filters Bar */}
      <div className="filter-panel">
        <div className="filter-row">
          <div className="filter-search">
            <Search size={20} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, animal or character"
              aria-label="Search stories"
              className="field-input"
              data-testid="input-search-stories"
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              aria-label="Category"
              className="field-select"
              data-testid="select-category"
            >
              <option value="">All Categories</option>
              {fullCategories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>

            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              aria-label="Language"
              className="field-select"
              data-testid="select-language"
            >
              <option value="">Any Language</option>
              <option value="en">English</option>
              <option value="te">తెలుగు</option>
              <option value="hi">हिन्दी</option>
            </select>

            <select
              value={age}
              onChange={e => setAge(e.target.value)}
              aria-label="Age"
              className="field-select"
              data-testid="select-age"
            >
              <option value="">Any Age</option>
              {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => <option key={n} value={n}>{n} years</option>)}
            </select>

            <button
              type="button"
              onClick={() => setBedtime(!bedtime)}
              aria-pressed={bedtime}
              className="toggle-btn"
              data-testid="button-bedtime-filter"
            >
              <Moon size={14} /> Bedtime Tales
            </button>
          </div>
        </div>

        <div className="filter-foot">
          <span>{stories.data?.length ?? '—'} stories found</span>
          {(search || category || language || age || bedtime) && (
            <button
              type="button"
              onClick={clearFilters}
              className="link-button"
              data-testid="button-clear-filters"
            >
              <X size={14} /> Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Stories Grid */}
      {stories.isLoading ? (
        <div className="stories-grid-container">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} style={{ height: 320 }} className="skeleton" />
          ))}
        </div>
      ) : !stories.data?.length ? (
        <div className="empty-state">
          <h3>Nothing matches yet</h3>
          <p>Try fewer filters, or a different shelf.</p>
          <button type="button" onClick={clearFilters} className="btn-primary-pill">
            Reset filters
          </button>
        </div>
      ) : (
        <div className="stories-grid-container">
          {stories.data.map(story => (
            <MagicStoryCard key={story.id} story={story} />
          ))}
        </div>
      )}
    </main>
  );
}

/* ========================================================
   STORY GUIDE: a little girl who walks along the path while the story is told
   ======================================================== */
function ScenePropArt({ name }: { name: SceneProp }) {
  switch (name) {
    case 'lake':
      return (
        <svg className="scene-prop scene-prop-lake" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 12 Q25 2 50 12 T100 12 T150 12 T200 12 V40 H0 Z" fill="#6F86B8" opacity="0.85" />
        </svg>
      );
    case 'lamp':
      return (
        <svg className="scene-prop scene-prop-lamp" viewBox="0 0 40 70" aria-hidden="true">
          <circle cx="20" cy="14" r="15" fill="#F6D36B" opacity="0.3" />
          <rect x="18.5" y="22" width="3" height="46" fill="#4A3A2C" />
          <circle cx="20" cy="14" r="7" fill="#F6D36B" />
        </svg>
      );
    case 'pot':
      return (
        <svg className="scene-prop scene-prop-pot" viewBox="0 0 70 80" aria-hidden="true">
          <path d="M35 4 L12 76 M35 4 L58 76" stroke="#4A3A2C" strokeWidth="3" strokeLinecap="round" />
          <path d="M35 4 V18" stroke="#4A3A2C" strokeWidth="2" />
          <path d="M22 22 H48 L45 44 Q35 50 25 44 Z" fill="#8A5A3C" />
          <rect x="20" y="19" width="30" height="5" rx="2.5" fill="#6D452D" />
        </svg>
      );
    case 'fire':
      return (
        <svg className="scene-prop scene-prop-fire" viewBox="0 0 30 36" aria-hidden="true">
          <path d="M15 2 C20 12 26 16 24 26 C22 34 8 34 6 26 C4 18 11 14 15 2 Z" fill="#E0762B" />
          <path d="M15 14 C18 20 21 22 19 28 C17 32 12 32 11 27 C10 22 14 20 15 14 Z" fill="#F6D36B" />
        </svg>
      );
  }
}

function StoryGuide({ playing, progress, caption, scene, visuals, lang }: {
  playing: boolean;
  progress: number | null; // 0-100 when recorded audio is playing, otherwise null
  caption?: string; // the sentence being told, in the story's own language
  scene?: number; // the scene (paragraph) being told
  visuals?: Record<number, SceneVisual>;
  lang: string;
}) {
  const hasProgress = progress !== null;
  const pct = Math.min(100, Math.max(0, progress ?? 0));

  let line = caption || 'Press play and I will walk you through the story.';
  if (!caption) {
    if (playing) line = 'Listen closely. Here comes the story.';
    else if (hasProgress && pct > 0) line = 'Taking a little rest. Tap play to keep walking.';
  }
  const sceneVisual = visuals?.[scene ?? 1];

  const walking = playing;
  const loop = playing && !hasProgress;
  const left = hasProgress ? `${8 + pct * 0.84}%` : undefined;

  return (
    <div className="guide" data-testid="story-guide">
      <p className="guide-bubble" lang={caption ? lang : 'en'} aria-live="off">{line}</p>
      <div
        className={`guide-stage ${sceneVisual ? `guide-bg-${sceneVisual.background}` : ''}`}
        role="img"
        aria-label="A little girl storyteller walks along a village path while the story plays"
      >
        <div className="guide-hill guide-hill-back" />
        <div className="guide-hill guide-hill-front" />
        {sceneVisual?.props.map(prop => <ScenePropArt key={prop} name={prop} />)}
        <div className="guide-path" />
        <div
          className={`guide-girl ${walking ? 'guide-walking' : ''} ${loop ? 'guide-loop' : ''}`}
          style={left ? { left } : undefined}
        >
          <svg viewBox="0 0 80 124" aria-hidden="true">
            {/* braids */}
            <ellipse cx="21" cy="52" rx="5" ry="15" fill="#2E2018" />
            <ellipse cx="59" cy="52" rx="5" ry="15" fill="#2E2018" />
            <circle cx="21" cy="64" r="3.2" fill="#E0A21B" />
            <circle cx="59" cy="64" r="3.2" fill="#E0A21B" />
            {/* legs */}
            <g className="guide-leg guide-leg-a">
              <rect x="31" y="94" width="7" height="22" rx="3.5" fill="#E9B98F" />
              <ellipse cx="35" cy="117" rx="6" ry="3.4" fill="#2B2118" />
            </g>
            <g className="guide-leg guide-leg-b">
              <rect x="42" y="94" width="7" height="22" rx="3.5" fill="#E9B98F" />
              <ellipse cx="46" cy="117" rx="6" ry="3.4" fill="#2B2118" />
            </g>
            {/* arms */}
            <g className="guide-arm guide-arm-a">
              <rect x="22" y="58" width="7" height="26" rx="3.5" fill="#E9B98F" />
            </g>
            <g className="guide-arm guide-arm-b">
              <rect x="51" y="58" width="7" height="26" rx="3.5" fill="#E9B98F" />
            </g>
            {/* frock */}
            <path d="M28 56 L52 56 L62 98 L18 98 Z" fill="#B4432B" />
            <path d="M30 56 H50 L51 66 H29 Z" fill="#2F3A6B" />
            <rect x="18" y="93" width="44" height="5" fill="#E0A21B" />
            <circle cx="26" cy="60" r="4.5" fill="#B4432B" />
            <circle cx="54" cy="60" r="4.5" fill="#B4432B" />
            {/* head */}
            <circle cx="40" cy="34" r="20" fill="#E9B98F" />
            <path d="M19.5 32 A20.5 20.5 0 0 1 60.5 32 Q51 22 40 25 Q29 22 19.5 32 Z" fill="#2E2018" />
            <circle cx="40" cy="26.5" r="1.6" fill="#B4432B" />
            <ellipse cx="33" cy="36" rx="2.4" ry="3" fill="#2B2118" />
            <ellipse cx="47" cy="36" rx="2.4" ry="3" fill="#2B2118" />
            <circle cx="33.8" cy="34.8" r="0.9" fill="#FFFFFF" />
            <circle cx="47.8" cy="34.8" r="0.9" fill="#FFFFFF" />
            <circle cx="27.5" cy="43" r="3.6" fill="#E58F7B" opacity="0.6" />
            <circle cx="52.5" cy="43" r="3.6" fill="#E58F7B" opacity="0.6" />
            <ellipse className={`guide-mouth ${walking ? 'guide-talking' : ''}`} cx="40" cy="46" rx="3.4" ry="2.4" fill="#8A2E22" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ========================================================
   SCREEN THREE: STORY DETAIL AND PLAYER
   ======================================================== */
function StoryPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const query = useGetStory(slug);
  const [language, setLanguage] = useState(loadLanguage);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [activeTab, setActiveTab] = useState<'text' | 'about'>('text');
  const [largeText, setLargeText] = useState(false);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [timings, setTimings] = useState<NarrationSentence[] | null>(null);
  const [timingsReady, setTimingsReady] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [audioFailed, setAudioFailed] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const [ttsCaption, setTtsCaption] = useState<{ text: string; scene: number } | null>(null);
  // Where the child was when they switched language, so the new language can pick up the same scene
  const resumeRef = useRef<{ scene: number; wasPlaying: boolean } | null>(null);

  const progress = useSaveProgress();
  const qc = useQueryClient();
  const story = query.data;

  // Related stories query
  const relatedQuery = useListStories({ category: story?.category, sort: 'popular' });
  const relatedStories = useMemo(() => {
    return relatedQuery.data?.filter(s => s.slug !== slug).slice(0, 3) || [];
  }, [relatedQuery.data, slug]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) { setVoicesReady(true); return; }
    const readVoices = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
      if (list.length > 0) setVoicesReady(true);
    };
    readVoices();
    // some browsers never report any voices, so stop waiting after a moment
    const giveUp = window.setTimeout(() => setVoicesReady(true), 1500);
    window.speechSynthesis.addEventListener('voiceschanged', readVoices);
    return () => {
      window.clearTimeout(giveUp);
      window.speechSynthesis.removeEventListener('voiceschanged', readVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    setSpeaking(false);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    // Stop any recorded narration too when the language or story changes
    audioRef.current?.pause();
    setIsPlayingRecorded(false);
    setAudioProgress(0);
    setAudioTime(0);
    setTtsCaption(null);
  }, [language, slug]);

  // A different story never inherits the previous story's scene
  useEffect(() => { resumeRef.current = null; }, [slug]);

  const translation: Translation | undefined = story?.translations.find(t => t.languageCode === language) ?? story?.translations[0];
  const code = translation?.languageCode ?? 'en';
  const audioUrl = translation?.audioUrl ?? null;
  const recordedOk = !!audioUrl && !audioFailed;
  // Fallback voice (used only when a story has no recorded narration): a girl's voice in the story's own language
  const matchingVoice = pickVoice(voices, code);
  // Hindi/Telugu are never read with another language's voice; say so instead of failing silently
  const narrationUnavailable = !recordedOk && code !== 'en' && voicesReady && !matchingVoice;

  // Sentence timings for this language's recording (one small JSON file next to the mp3)
  useEffect(() => {
    setTimings(null);
    setAudioFailed(false);
    setTimingsReady(!audioUrl);
    if (!audioUrl) return;
    let cancelled = false;
    fetch(audioUrl.replace(/\.mp3$/i, '.json'))
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled) setTimings(Array.isArray(data?.sentences) ? data.sentences : null); })
      .catch(() => { if (!cancelled) setTimings(null); })
      .finally(() => { if (!cancelled) setTimingsReady(true); });
    return () => { cancelled = true; };
  }, [audioUrl, code]);

  // What is being told right now: exact sentence when we have timings, otherwise the paragraph
  const sceneList = translation?.scenes ?? [];
  let liveCaption: string | undefined;
  let liveScene: number | undefined;
  if (recordedOk && timings && (isPlayingRecorded || audioTime > 0)) {
    const current = sentenceAt(timings, audioTime);
    if (current) { liveCaption = current.text; liveScene = current.scene; }
  } else if (recordedOk && (isPlayingRecorded || audioProgress > 0) && sceneList.length > 0) {
    const total = sceneList.reduce((sum, s) => sum + s.text.length, 0) || 1;
    let used = 0;
    for (const s of sceneList) {
      used += s.text.length;
      liveScene = s.position;
      liveCaption = s.text;
      if ((used / total) * 100 >= audioProgress) break;
    }
  } else if (speaking && ttsCaption) {
    liveCaption = ttsCaption.text;
    liveScene = ttsCaption.scene;
  }
  if (narrationUnavailable) { liveCaption = sceneList[0]?.text; liveScene = 1; }
  const activeScene = liveScene ?? 1;

  const chooseLanguage = (next: string) => {
    if (next === code) return;
    resumeRef.current = { scene: activeScene, wasPlaying: speaking || isPlayingRecorded };
    saveLanguage(next);
    setLanguage(next);
  };

  const speak = (startScene = 1, restart = false) => {
    if (!translation || !('speechSynthesis' in window)) return;
    if (!restart && speaking) {
      window.speechSynthesis.pause();
      setSpeaking(false);
      return;
    }
    if (code !== 'en' && !matchingVoice) return;
    window.speechSynthesis.cancel();
    const parts = (translation.scenes?.length ? translation.scenes.map(s => s.text) : [translation.script]).slice(startScene - 1);
    const fullText = parts.join('\n\n');
    const sceneStarts: number[] = [];
    let position = 0;
    for (const part of parts) { sceneStarts.push(position); position += part.length + 2; }
    const sentences = splitSentences(fullText);
    const utterance = new SpeechSynthesisUtterance(fullText);
    if (matchingVoice) {
      utterance.voice = matchingVoice;
      utterance.lang = matchingVoice.lang;
    }
    utterance.pitch = 1.3;
    utterance.rate = 0.92;
    utterance.onboundary = event => {
      const sentence = sentences.find(s => event.charIndex >= s.start && event.charIndex < s.end);
      if (!sentence) return;
      let index = 0;
      sceneStarts.forEach((start, i) => { if (event.charIndex >= start) index = i; });
      setTtsCaption({ text: sentence.text, scene: startScene + index });
    };
    utterance.onend = () => { setSpeaking(false); setTtsCaption(null); };
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  // After a language switch, go back to the same scene in the new language (and keep playing if it was)
  useEffect(() => {
    const resume = resumeRef.current;
    if (!resume || !timingsReady || !translation) return;
    resumeRef.current = null;
    if (recordedOk) {
      const audio = audioRef.current;
      const first = timings?.find(s => s.scene === resume.scene);
      if (audio && first) audio.currentTime = first.start;
      if (audio && resume.wasPlaying) {
        audio.play().then(() => setIsPlayingRecorded(true)).catch(() => {});
      }
    } else if (resume.wasPlaying) {
      speak(resume.scene, true);
    }
  }, [timingsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Right accents and reading rules for Telugu and Hindi
  useEffect(() => {
    document.documentElement.lang = code;
    return () => { document.documentElement.lang = 'en'; };
  }, [code]);

  const handleTogglePlay = () => {
    if (recordedOk && audioRef.current) {
      if (isPlayingRecorded) {
        audioRef.current.pause();
        setIsPlayingRecorded(false);
      } else {
        audioRef.current.play();
        setIsPlayingRecorded(true);
      }
    } else {
      speak();
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
      setAudioTime(audioRef.current.currentTime);
    }
  };

  if (query.isLoading) {
    return (
      <main className="section-wrapper" style={{ paddingTop: 40 }}>
        <div style={{ height: 450, borderRadius: 32, background: '#F0E5D4' }} className="skeleton" />
      </main>
    );
  }

  if (query.isError || !story) {
    return (
      <main className="section-wrapper" style={{ paddingTop: 60, textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, color: 'var(--color-purple)' }}>Story Could Not Be Found</h2>
        <p style={{ color: '#776686' }}>It may have moved or been updated. Let's head back to the shelves!</p>
        <Link href="/explore" className="btn-primary-pill" style={{ marginTop: 16 }}>
          <Compass size={18} /> Explore Stories
        </Link>
      </main>
    );
  }

  const artwork = getStoryArtwork(story.slug, story.category, story.coverUrl);
  const catDesign = getCategoryDesign(story.category);

  return (
    <main className="page-enter section-wrapper" style={{ paddingTop: 24 }}>
      {/* Top Navigation Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Link
          href="/explore"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--color-purple)',
            textDecoration: 'none',
            background: '#FFFFFF',
            padding: '8px 16px',
            borderRadius: 999,
            border: '1.5px solid #EADAC8'
          }}
          data-testid="link-back-stories"
        >
          <ArrowLeft size={16} /> Back to stories
        </Link>

        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: '#E9F9F0',
          color: '#1B5E20',
          padding: '6px 14px',
          borderRadius: 999,
          fontSize: 12.5,
          fontWeight: 800,
          border: '1px solid #C8E6C9'
        }}>
          <ShieldCheck size={16} /> A story for ages {story.ageMin}–{story.ageMax}
        </span>
      </div>

      {/* Picture Book Two-Column Layout */}
      <div className="story-player-layout">
        {/* LEFT COLUMN: Main Illustration & Lesson & Related */}
        <div>
          {/* Main Story Illustration Card */}
          <div className="story-player-illustration-card">
            <img
              src={assetUrl(artwork)}
              alt={story.title}
              className="story-player-main-art"
            />
            <div className="story-player-badge">
              <Sparkles size={14} color="#FFE680" />
              <span>Animated Story Picture</span>
            </div>
          </div>

          {/* Story Lesson Box */}
          {story.moral && (
            <div className="story-lesson-box">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <StarMascot size={44} />
                <div style={{ flex: 1 }}>
                  <div className="story-lesson-heading">✦ Story Lesson ✦</div>
                  <p className="story-lesson-text">{story.moral}</p>
                </div>
              </div>
            </div>
          )}

          {/* Related Stories Carousel */}
          {relatedStories.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontSize: 18, color: 'var(--color-purple)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✦ Related Stories ✦</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {relatedStories.map(rel => (
                  <Link
                    key={rel.id}
                    href={`/stories/${rel.slug}`}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: 18,
                      overflow: 'hidden',
                      border: '1.5px solid #F0E2D2',
                      textDecoration: 'none',
                      color: 'inherit',
                      boxShadow: 'var(--shadow-soft)',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <div style={{ height: 90, overflow: 'hidden' }}>
                      <img
                        src={assetUrl(getStoryArtwork(rel.slug, rel.category))}
                        alt={rel.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ padding: '8px 10px' }}>
                      <h5 style={{ margin: '0 0 2px', fontSize: 13, color: 'var(--color-purple)' }}>{rel.title}</h5>
                      <small style={{ color: '#887799', fontSize: 11 }}>{rel.durationMinutes} min</small>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Info, Audio Player & Picture-Book Story Text */}
        <div>
          {/* Header & Badges */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <span style={{
                background: catDesign.bgColor,
                color: 'var(--color-purple)',
                padding: '4px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                border: `1.5px solid ${catDesign.borderColor}`
              }}>
                {story.category}
              </span>
              <FavoriteHeartButton story={story} />
            </div>

            <h1 lang={code} style={{ fontSize: 'clamp(28px, 3.8vw, 42px)', color: 'var(--color-purple)', margin: '0 0 10px', lineHeight: 1.15 }}>
              {translation?.title || story.title}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <span className="meta-pill">
                <Clock3 size={13} /> {story.durationMinutes} min read
              </span>
              <span className="meta-pill">
                <ShieldCheck size={13} /> Ages {story.ageMin}–{story.ageMax}
              </span>
              <span className="meta-pill">
                🌐 {story.languages?.map(l => languageNames[l] || l).join(', ')}
              </span>
            </div>

            {/* Language Switcher Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#7E6C8E' }}>Story Language:</span>
              {story.translations.map(t => (
                <button
                  key={t.languageCode}
                  type="button"
                  onClick={() => chooseLanguage(t.languageCode)}
                  lang={t.languageCode}
                  aria-pressed={translation?.languageCode === t.languageCode}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: '1.5px solid',
                    backgroundColor: (translation?.languageCode === t.languageCode) ? '#FF4785' : '#FFF8EA',
                    borderColor: (translation?.languageCode === t.languageCode) ? '#FF4785' : '#E8D6C3',
                    color: (translation?.languageCode === t.languageCode) ? '#FFFFFF' : '#49366B',
                    boxShadow: (translation?.languageCode === t.languageCode) ? '0 3px 8px rgba(255, 71, 133, 0.3)' : 'none'
                  }}
                  data-testid={`button-lang-${t.languageCode}`}
                >
                  {languageNames[t.languageCode] || t.languageCode}
                </button>
              ))}
            </div>
            {translation && !translation.reviewed && (
              <p className="review-note">
                This {LANGUAGE_LABEL[code as 'en' | 'hi' | 'te'] ?? code} version is waiting for a native speaker to check it.
              </p>
            )}
          </div>

          {/* Interactive Audio Player Card */}
          <div className="player-controls-card">
            <StoryGuide
              playing={speaking || isPlayingRecorded}
              progress={recordedOk ? audioProgress : null}
              caption={liveCaption}
              scene={liveScene}
              visuals={STORY_SCENES[story.slug]}
              lang={SPEECH_LANG[code as 'en' | 'hi' | 'te'] ?? code}
            />
            <div className="player-main-row">
              <button
                type="button"
                className="btn-player-circle"
                onClick={handleTogglePlay}
                disabled={narrationUnavailable}
                aria-label={speaking || isPlayingRecorded ? "Pause story" : "Play story"}
                data-testid="button-main-play"
              >
                {speaking || isPlayingRecorded ? (
                  <Pause size={30} fill="currentColor" />
                ) : (
                  <Play size={30} fill="currentColor" style={{ marginLeft: 3 }} />
                )}
              </button>

              <div className="player-scrubber-box">
                <div className="player-time-row">
                  <span>{speaking || isPlayingRecorded ? "Playing narration..." : "Ready to listen"}</span>
                  <span>{story.durationMinutes}:00</span>
                </div>
                <div
                  className="player-waveform-bar"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - rect.left) / rect.width;
                    if (audioRef.current && audioRef.current.duration) {
                      audioRef.current.currentTime = ratio * audioRef.current.duration;
                    }
                  }}
                >
                  <div
                    className="player-progress-fill"
                    style={{ width: `${speaking ? 45 : audioProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Hidden HTML5 audio element for recorded narration if present */}
            {translation?.audioUrl && (
              <audio
                ref={audioRef}
                src={translation.audioUrl}
                onTimeUpdate={handleAudioTimeUpdate}
                onEnded={() => setIsPlayingRecorded(false)}
                onError={() => setAudioFailed(true)}
              />
            )}

            {narrationUnavailable && (
              <p className="narration-note" role="status">
                Narration not available in {LANGUAGE_LABEL[code as 'en' | 'hi' | 'te'] ?? code} on this device.
              </p>
            )}

            <div className="player-actions-row">
              <button
                type="button"
                className="btn-player-action"
                onClick={() => {
                  const el = document.getElementById('story-text-container');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <BookOpen size={16} /> Read Story
              </button>

              <button
                type="button"
                className="btn-player-action"
                onClick={() => {
                  progress.mutate({
                    params: { guestId, storyId: story.id },
                    data: { languageCode: translation?.languageCode || 'en', playbackPosition: story.durationMinutes * 60, durationSeconds: story.durationMinutes * 60, completed: true }
                  });
                  alert('🌟 Wonderful! You completed this story! 🎉');
                }}
              >
                <Award size={16} /> Mark as Finished
              </button>
            </div>
          </div>

          {/* Picture Book Story Text Panel */}
          <div className="picture-book-panel" id="story-text-container">
            <div className="reader-tabs-row">
              <div className="reader-tab-btns">
                <button
                  type="button"
                  className={`reader-tab-btn ${activeTab === 'text' ? 'active' : ''}`}
                  onClick={() => setActiveTab('text')}
                >
                  Story Text
                </button>
                <button
                  type="button"
                  className={`reader-tab-btn ${activeTab === 'about' ? 'active' : ''}`}
                  onClick={() => setActiveTab('about')}
                >
                  About the Tale
                </button>
              </div>

              <div className="font-size-btns">
                <button
                  type="button"
                  className="font-size-btn"
                  onClick={() => setLargeText(false)}
                  title="Normal font size"
                >
                  A-
                </button>
                <button
                  type="button"
                  className="font-size-btn"
                  onClick={() => setLargeText(true)}
                  title="Larger font size"
                >
                  A+
                </button>
              </div>
            </div>

            {activeTab === 'text' ? (
              <div lang={code} className={`story-text-readable ${largeText ? 'reader-large' : ''}`}>
                {translation?.scenes?.length ? (
                  translation.scenes.map(scene => (
                    <div key={scene.position} style={{ marginBottom: 20 }}>
                      {scene.illustrationUrl && (
                        <img
                          src={assetUrl(scene.illustrationUrl)}
                          alt={scene.caption || `Story scene ${scene.position}`}
                          style={{ width: '100%', borderRadius: 18, marginBottom: 12 }}
                          loading="lazy"
                        />
                      )}
                      <p>{scene.text}</p>
                    </div>
                  ))
                ) : (
                  (translation?.script || '').split(/\n{2,}/).map((p: string, idx: number) => (
                    <p key={idx}>{p}</p>
                  ))
                )}
              </div>
            ) : (
              <div style={{ fontSize: 15, color: '#5C4A6E', lineHeight: 1.7 }}>
                <h4 style={{ color: 'var(--color-purple)', fontSize: 18, margin: '0 0 8px' }}>Source & Folk Background</h4>
                <p>{story.source}</p>
                <h4 style={{ color: 'var(--color-purple)', fontSize: 18, margin: '16px 0 8px' }}>Recommended Age</h4>
                <p>Designed for children ages {story.ageMin} through {story.ageMax} to inspire kindness, cleverness, and curiosity.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ========================================================
   SCREEN FOUR: GRANDMA'S FAVOURITE TALES
   ======================================================== */
function GrandmaTalesPage() {
  const storiesQuery = useListStories({ sort: 'popular' });
  const [selectedStory, setSelectedStory] = useState<StorySummary | null>(null);

  // Curated heartwarming stories
  const curatedTales = useMemo(() => {
    return storiesQuery.data || [];
  }, [storiesQuery.data]);

  return (
    <main className="page-enter section-wrapper" style={{ paddingTop: 24 }}>
      {/* 1. Giant Illustrated Magical Forest Hero */}
      <div className="grandma-hero-banner">
        <img
          src={assetUrl('/images/grandma_story_hero.jpg')}
          alt="Grandma reading glowing stories to children under ancient lanterns in an enchanted forest"
          className="grandma-hero-art"
        />
        <div className="grandma-hero-vignette"></div>

        <div className="grandma-hero-badge-box">
          <div className="wooden-sign-pill">
            <span>🪵 Grandma's Favourite Tales</span>
          </div>
          <h1 className="grandma-hero-title">Warm stories, big lessons,<br />forever in our hearts.</h1>
          <p className="grandma-hero-sub">
            The gentle folktales that our grandmothers told us under starlit nights, woven with wisdom, love and laughter.
          </p>

          <Link href="/stories/the-clever-rabbit-and-the-lion" className="btn-primary-pill" data-testid="button-grandma-hero-play">
            <Play size={18} fill="currentColor" /> Listen to Grandma's story
          </Link>
        </div>
      </div>

      {/* 2. Curated Story Shelves */}
      <div className="section-header-row">
        <div>
          <div className="section-label-chip">✦ HANDPICKED WITH WARMTH ✦</div>
          <h2 className="section-title">Grandma's Story Chest</h2>
        </div>
        <Link href="/explore" className="section-view-all">
          Explore all <ArrowRight size={16} />
        </Link>
      </div>

      <div className="stories-grid-container">
        {curatedTales.slice(0, 8).map(story => (
          <MagicStoryCard key={story.id} story={story} />
        ))}
      </div>

      {/* Floating CTA Pill */}
      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <Link href="/explore" className="btn-primary-pill" style={{ padding: '16px 36px', fontSize: 17 }}>
          <Sparkles size={20} /> Listen to another story ➔
        </Link>
      </div>
    </main>
  );
}

/* ========================================================
   CATEGORY PAGE
   ======================================================== */
function CategoryPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const categories = useListCategories();
  const cat = categories.data?.find(c => c.slug === slug);
  const stories = useListStories({ category: slug, sort: 'popular' });
  const design = getCategoryDesign(slug);

  return (
    <main className="page-enter section-wrapper" style={{ paddingTop: 28 }}>
      <Link href="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-purple)', fontWeight: 800, textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={16} /> All Categories
      </Link>

      <div style={{
        borderRadius: 32,
        background: design.bgColor,
        border: `3px solid ${design.borderColor}`,
        padding: '36px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 30,
        marginBottom: 36,
        boxShadow: 'var(--shadow-soft)',
        flexWrap: 'wrap'
      }}>
        <div style={{ maxWidth: 540 }}>
          <span style={{ background: design.pillBg, color: design.pillColor, padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800 }}>
            {cat?.storyCount ?? 4} stories on this shelf
          </span>
          <h1 style={{ fontSize: 'clamp(32px, 4.2vw, 48px)', color: 'var(--color-purple)', margin: '12px 0 8px', lineHeight: 1.15 }}>
            {cat?.name || design.name}
          </h1>
          <p style={{ fontSize: 16, color: '#68547A', margin: 0, fontWeight: 600 }}>
            {cat?.description || design.subtitle}
          </p>
        </div>

        <div style={{ width: 140, height: 140, borderRadius: 28, overflow: 'hidden', border: '3px solid #FFF', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}>
          <img src={assetUrl(design.image)} alt={design.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>

      <div className="stories-grid-container">
        {stories.data?.map(story => (
          <MagicStoryCard key={story.id} story={story} />
        ))}
      </div>
    </main>
  );
}

/* ========================================================
   SAVED STORIES / FAVORITES PAGE
   ======================================================== */
function FavoritesPage() {
  const favorites = useListFavorites({ guestId });

  return (
    <main className="page-enter section-wrapper" style={{ paddingTop: 32 }}>
      <div style={{ marginBottom: 32 }}>
        <span className="section-label-chip">✦ YOUR FAMILY NOOK ✦</span>
        <h1 style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', color: 'var(--color-purple)', margin: '8px 0 6px' }}>
          Saved Stories
        </h1>
        <p style={{ fontSize: 16, color: '#746282', margin: 0, fontWeight: 600 }}>
          Keep your family's favourites close for bedtime and storytime.
        </p>
      </div>

      {favorites.isLoading ? (
        <div className="stories-grid-container">
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: 320 }} className="skeleton" />
          ))}
        </div>
      ) : !favorites.data?.length ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', background: '#FFFFFF', borderRadius: 32, border: '2px solid #EEDFCB' }}>
          <KathaBuddy size={80} className="float-anim" />
          <h3 style={{ fontSize: 24, color: 'var(--color-purple)', marginTop: 16 }}>Your family nook is waiting</h3>
          <p style={{ color: '#776686', maxWidth: 400, margin: '8px auto 20px' }}>
            Tap the heart icon on any story you love, and it will be safely kept right here!
          </p>
          <Link href="/explore" className="btn-primary-pill">
            <Compass size={18} /> Discover Stories
          </Link>
        </div>
      ) : (
        <div className="stories-grid-container">
          {favorites.data.map(story => (
            <MagicStoryCard key={story.id} story={story} />
          ))}
        </div>
      )}
    </main>
  );
}

/* ========================================================
   PARENT GATE & CORNER
   ======================================================== */
function ParentGate() {
  const [unlocked, setUnlocked] = useState(false);
  const [answer, setAnswer] = useState('');
  const [challenge, setChallenge] = useState(() => {
    const a = 4 + Math.floor(Math.random() * 6);
    const b = 2 + Math.floor(Math.random() * 5);
    return { a, b, sum: a + b };
  });
  const [error, setError] = useState('');

  const verify = (e: FormEvent) => {
    e.preventDefault();
    if (Number(answer) === challenge.sum) {
      setUnlocked(true);
      setError('');
    } else {
      setError('That answer is not quite right. Try once more.');
      setAnswer('');
      setChallenge(() => {
        const a = 4 + Math.floor(Math.random() * 6);
        const b = 2 + Math.floor(Math.random() * 5);
        return { a, b, sum: a + b };
      });
    }
  };

  if (!unlocked) {
    return (
      <main className="section-wrapper page-enter" style={{ display: 'grid', placeItems: 'center', minHeight: '65vh', padding: '60px 20px' }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: 32,
          padding: '42px 48px',
          border: '3px solid #EEDFCB',
          boxShadow: 'var(--shadow-lift)',
          maxWidth: 440,
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FFF2DD', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <LockKeyhole size={28} color="#FF4785" />
          </div>
          <span className="section-label-chip">✦ GROWN-UP CORNER ✦</span>
          <h2 style={{ fontSize: 28, color: 'var(--color-purple)', margin: '10px 0 8px' }}>Before you enter…</h2>
          <p style={{ color: '#746282', fontSize: 14.5, marginBottom: 24 }}>
            Let's make sure a grown-up is here. Please solve this little sum:
          </p>

          <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#49366B' }}>
              {challenge.a} + {challenge.b} = ?
            </div>
            <input
              type="number"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Your answer"
              required
              autoFocus
              style={{
                padding: '12px 18px',
                borderRadius: 16,
                border: '2px solid #E4D4BF',
                fontSize: 18,
                textAlign: 'center',
                fontWeight: 800,
                color: '#49366B',
                outline: 'none',
              }}
              data-testid="input-parent-answer"
            />
            {error && <p style={{ color: '#CC295F', fontSize: 13, margin: 0, fontWeight: 700 }}>{error}</p>}
            <button type="submit" className="btn-primary-pill" style={{ justifyContent: 'center' }} data-testid="button-unlock-parent">
              Enter Parent Corner <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </main>
    );
  }

  return <ParentDashboard />;
}

function ParentDashboard() {
  const progress = useListProgress({ guestId });
  const favorites = useListFavorites({ guestId });
  const { isSignedIn } = useSafeUser();

  return (
    <main className="page-enter section-wrapper" style={{ paddingTop: 32 }}>
      <div style={{ marginBottom: 32 }}>
        <span className="section-label-chip">✦ FAMILY PEACE OF MIND ✦</span>
        <h1 style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', color: 'var(--color-purple)', margin: '8px 0 6px' }}>
          Parent & Family Corner
        </h1>
        <p style={{ fontSize: 16, color: '#746282', margin: 0, fontWeight: 600 }}>
          Manage your children's storytime preferences, safe library features, and history.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 40 }}>
        <div style={{ background: '#FFFFFF', borderRadius: 26, padding: '28px', border: '2px solid #EEDFCB', boxShadow: 'var(--shadow-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <ShieldCheck size={26} color="#2EAA68" />
            <h3 style={{ margin: 0, fontSize: 20, color: 'var(--color-purple)' }}>Curated & Safe</h3>
          </div>
          <p style={{ color: '#68547A', fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
            Every tale is thoughtfully chosen from Indian folklore with gentle themes, friendly morals, and positive cultural values.
          </p>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: 26, padding: '28px', border: '2px solid #EEDFCB', boxShadow: 'var(--shadow-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Moon size={26} color="#7A52D4" />
            <h3 style={{ margin: 0, fontSize: 20, color: 'var(--color-purple)' }}>Bedtime Routine</h3>
          </div>
          <p style={{ color: '#68547A', fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
            Filter by soothing bedtime tales with calm pacing, peaceful background narration, and sweet dreams guaranteed.
          </p>
        </div>
      </div>

      <div style={{ background: '#FFFFFF', borderRadius: 28, padding: '32px', border: '2px solid #EEDFCB', boxShadow: 'var(--shadow-soft)' }}>
        <h3 style={{ fontSize: 22, color: 'var(--color-purple)', margin: '0 0 16px' }}>Storytime Activity</h3>
        <p style={{ color: '#746282', fontSize: 14, marginBottom: 20 }}>
          Your child has saved {favorites.data?.length ?? 0} stories and listened to {progress.data?.length ?? 0} story sessions.
        </p>
        {favorites.data && favorites.data.length > 0 && (
          <div className="stories-grid-container">
            {favorites.data.slice(0, 4).map(story => (
              <MagicStoryCard key={story.id} story={story} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

/* ========================================================
   ADMIN STUDIO ROUTE
   ======================================================== */
function AdminRoute() {
  const { isLoaded, isSignedIn, user } = useSafeUser();
  const isAdmin = user?.publicMetadata?.role === 'admin';
  const stories = useListAdminStories({});
  const cats = useListCategories();

  if (!isLoaded) return <main className="section-wrapper" style={{ paddingTop: 40 }}><p>Checking permissions...</p></main>;
  if (!isSignedIn) {
    return (
      <main className="section-wrapper" style={{ paddingTop: 60, textAlign: 'center' }}>
        <h2>Sign In Required</h2>
        <p>Please sign in with an administrator account to access Story Studio.</p>
        <Link href="/sign-in" className="btn-primary-pill">Sign In</Link>
      </main>
    );
  }

  return (
    <main className="section-wrapper page-enter" style={{ paddingTop: 32 }}>
      <h1 style={{ fontSize: 36, color: 'var(--color-purple)', marginBottom: 20 }}>Story Studio (Admin)</h1>
      <p style={{ color: '#746282', marginBottom: 28 }}>Manage story shelves, manuscripts, and translations.</p>
      <div className="stories-grid-container">
        {stories.data?.map(s => (
          <article key={s.id} className="magic-story-card" style={{ padding: 18 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 18 }}>{s.title}</h4>
            <span style={{ fontSize: 12, color: '#887799' }}>{s.category} • Status: {s.status}</span>
          </article>
        ))}
      </div>
    </main>
  );
}

function AuthPage({ signup = false }: { signup?: boolean }) {
  return (
    <main className="section-wrapper page-enter" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '40px 20px' }}>
      <div style={{ maxWidth: 440, width: '100%' }}>
        {signup ? (
          <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
        ) : (
          <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
        )}
      </div>
    </main>
  );
}

/* ========================================================
   ROUTER & APP ROOT
   ======================================================== */
function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/explore" component={ExplorePage} />
      <Route path="/categories/:slug" component={CategoryPage} />
      <Route path="/stories/:slug" component={StoryPage} />
      <Route path="/favorites" component={FavoritesPage} />
      <Route path="/grandma-tales" component={GrandmaTalesPage} />
      <Route path="/parent" component={ParentGate} />
      <Route path="/admin" component={AdminRoute} />
      <Route path="/sign-in/*?" component={() => <AuthPage />} />
      <Route path="/sign-up/*?" component={() => <AuthPage signup />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function SiteFrame() {
  const [location] = useLocation();
  const isAuthPage = location.startsWith('/sign-in') || location.startsWith('/sign-up');
  return (
    <div className="paper-grain" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!isAuthPage && <Header />}
      <div style={{ flex: 1 }}>
        <AppRoutes />
      </div>
      {!isAuthPage && <Footer />}
    </div>
  );
}

function ClerkRoutesProvider() {
  const [, setLocation] = useLocation();

  if (!clerkPubKey) {
    return <SiteFrame />;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={path => setLocation(stripBase(path))}
      routerReplace={path => setLocation(stripBase(path), { replace: true })}
    >
      <SiteFrame />
    </ClerkProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={basePath}>
        <ClerkRoutesProvider />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
