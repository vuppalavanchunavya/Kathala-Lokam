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
import type { AdminStory, StorySummary, StoryInput, StoryUpdate, Translation } from '@workspace/api-client-react';
import { Route, Switch, Link, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, Clock3, Headphones,
  Heart, LibraryBig, LockKeyhole, Menu, Moon, Pause, Search, ShieldCheck,
  Sparkles, Volume2, X,
} from 'lucide-react';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const guestId = (() => {
  try {
    const key = 'kathala-guest-profile';
    let id = localStorage.getItem(key);
    if (!id) { id = `guest-${crypto.randomUUID()}`; localStorage.setItem(key, id); }
    return id;
  } catch { return 'guest-browser'; }
})();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const clerkAppearance = {
  theme: shadcn, cssLayerName: 'clerk',
   options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#49366B', colorForeground: '#49362D', colorMutedForeground: '#776C7F',
    colorDanger: '#A84343', colorBackground: '#FFF9EF', colorInput: '#FFFDF9',
    colorInputForeground: '#49362D', colorNeutral: '#D9CEBD', fontFamily: 'DM Sans, sans-serif', borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#FFF9EF] rounded-[24px] w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-semibold text-[#49366B]', headerSubtitle: 'text-[#776C7F]',
    socialButtonsBlockButtonText: 'font-semibold text-[#49362D]', formFieldLabel: 'font-semibold text-[#49362D]',
    footerActionLink: 'font-semibold text-[#49366B]', footerActionText: 'text-[#776C7F]', dividerText: 'text-[#776C7F]',
    identityPreviewEditButton: 'text-[#49366B]', formFieldSuccessText: 'text-[#286A4E]', alertText: 'text-[#49362D]',
    logoBox: 'rounded-xl', logoImage: 'rounded-lg', socialButtonsBlockButton: 'rounded-xl border-[#D9CEBD]',
    formButtonPrimary: 'rounded-xl bg-[#49366B] hover:bg-[#3B2A5A] text-[#FFF9EF]',
    formFieldInput: 'rounded-xl border-[#D9CEBD] bg-[#FFFDF9] text-[#49362D]',
    footerAction: 'text-[#776C7F]', dividerLine: 'bg-[#E6DDCE]', alert: 'rounded-xl bg-[#FFF0E8]',
    otpCodeFieldInput: 'rounded-lg border-[#D9CEBD]', formFieldRow: 'text-[#49362D]', main: 'text-[#49362D]',
  },
};

const languageNames: Record<string, string> = { en: 'English', te: 'తెలుగు', hi: 'हिन्दी' };
const palette = ['pink', 'blue', 'yellow', 'mint', 'lavender', 'peach'];
const artColor: Record<string, string> = {
  pink: '#FFB6D5', blue: '#AEE6FF', yellow: '#FFE680', mint: '#B9F3D0', lavender: '#DCCBFF', peach: '#FFD0B5',
};
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
function assetUrl(url?: string | null) {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${basePath}${url.startsWith('/') ? url : `/${url}`}`;
}

function Buddy({ small = false }: { small?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 180 174" className={small ? 'buddy buddy-small' : 'buddy'}>
    <path d="M25 49Q14 24 34 18Q48 16 56 37Q87 15 119 38Q151 21 158 42Q164 58 145 69Q154 95 139 120Q127 143 91 147Q53 148 35 127Q18 106 29 76Q12 69 25 49Z" fill="#E9D9FF" stroke="#49366B" strokeWidth="5" strokeLinejoin="round"/>
    <path d="M44 46Q61 29 91 32Q117 32 134 49L141 118Q128 139 91 140Q55 141 38 119Z" fill="#FFF9EF" stroke="#49366B" strokeWidth="4"/>
    <path d="M30 31Q25 10 38 8Q51 8 55 31M137 35Q147 12 159 18Q170 26 150 48" fill="#FFB6D5" stroke="#49366B" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="68" cy="79" r="4.7" fill="#49366B"/><circle cx="111" cy="79" r="4.7" fill="#49366B"/>
    <path d="M82 92Q90 98 98 92" fill="none" stroke="#49366B" strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M60 105Q90 119 120 104" fill="none" stroke="#FFB6D5" strokeWidth="7" strokeLinecap="round"/>
    <path d="M74 58Q89 50 104 58" fill="none" stroke="#49366B" strokeWidth="3" strokeLinecap="round"/>
    <path d="M57 129Q90 153 125 128" fill="none" stroke="#AEE6FF" strokeWidth="7" strokeLinecap="round"/>
  </svg>;
}

function IconButton({ label, children, onClick, className = '' }: { label: string; children: ReactNode; onClick: () => void; className?: string }) {
  return <button type="button" aria-label={label} data-testid={`button-${label.toLowerCase().replaceAll(' ', '-')}`} onClick={onClick} className={`icon-button ${className}`}>{children}</button>;
}

function Header() {
  const [loc] = useLocation();
  const { isSignedIn, user } = useUser();
  const isAdmin = user?.publicMetadata?.role === 'admin';
  const [open, setOpen] = useState(false);
  const active = (path: string) => loc === path ? 'nav-link nav-active' : 'nav-link';
  return <header className="site-header">
    <div className="header-inner">
      <Link href="/" className="brand" data-testid="link-home-brand"><span className="brand-mark"><BookOpen size={21}/></span><span>Kathala <b>Lokam</b><small>A little world of stories</small></span></Link>
      <button className="mobile-menu" type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} onClick={() => setOpen(!open)} data-testid="button-menu"><Menu size={22}/></button>
      <nav className={`main-nav ${open ? 'nav-open' : ''}`} aria-label="Main navigation">
        <Link href="/explore" className={active('/explore')} data-testid="link-explore">Explore stories</Link>
        <Link href="/favorites" className={active('/favorites')} data-testid="link-favorites">Saved stories</Link>
        <Link href="/parent" className={active('/parent')} data-testid="link-parent">For grown-ups</Link>
        {isAdmin && <Link href="/admin" className={active('/admin')} data-testid="link-admin">Story studio</Link>}
      </nav>
      <div className="header-actions">
        {isSignedIn ? <div className="user-chip"><UserButton/></div> : <Link href="/sign-in" className="parent-signin" data-testid="link-sign-in"><LockKeyhole size={15}/> Parent sign in</Link>}
      </div>
    </div>
  </header>;
}

function Footer() {
  return <footer className="footer"><div className="footer-inner"><div className="footer-brand"><span className="brand-mark"><BookOpen size={19}/></span><span><b>Kathala Lokam</b><small>Stories to grow up with.</small></span></div><p>From the heart of India, for every little dreamer.</p><div className="footer-links"><Link href="/explore" data-testid="link-footer-explore">Explore</Link><Link href="/favorites" data-testid="link-footer-favorites">Saved stories</Link><Link href="/parent" data-testid="link-footer-family">Family corner</Link></div><small className="copyright">A storybook home for curious minds</small></div></footer>;
}

function PageIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1 className="font-display">{title}</h1>{copy && <p>{copy}</p>}</div>;
}
function Cover({ story, className = '' }: { story: Pick<StorySummary, 'title' | 'coverUrl' | 'category'>; className?: string }) {
  const color = artColor[palette[(story.title.length + story.category.length) % palette.length]];
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [story.coverUrl]);
  return <div className={`story-cover ${className}`} style={{ backgroundColor: color }}>
     {story.coverUrl && !imageFailed ? <img className="cover-image" src={assetUrl(story.coverUrl)} alt={`Cover artwork for ${story.title}`} loading="lazy" onError={()=>setImageFailed(true)}/> :
      <div className="cover-unavailable"><span className="cover-orbit" aria-hidden="true"></span><BookOpen size={31} strokeWidth={1.4}/><small>{story.coverUrl ? 'Cover could not be loaded' : 'Story cover unavailable'}</small></div>}
    <span className="cover-category">{story.category}</span>
  </div>;
}
function StoryCard({ story, index = 0 }: { story: StorySummary; index?: number }) {
  return <article className="story-card" data-testid={`card-story-${story.id}`} style={{ animationDelay: `${index * 55}ms` }}>
    <FavoriteHeartButton story={story}/>
    <Link href={`/stories/${story.slug}`} className="story-card-link" aria-label={`Read ${story.title}`} data-testid={`link-story-${story.id}`}>
      <Cover story={story}/><div className="story-info"><div className="story-tags"><span>Ages {story.ageMin}–{story.ageMax}</span><span><Clock3 size={12}/>{story.durationMinutes} min</span></div><h3 className="font-display">{story.title}</h3><p>{story.description}</p><span className="read-link">Open story <ArrowRight size={14}/></span></div>
    </Link>
  </article>;
}
function FavoriteHeartButton({story}: {story: StorySummary}) {
  const qc = useQueryClient();
  const favorites = useListFavorites({guestId});
  const add = useAddFavorite();
  const remove = useRemoveFavorite();
  const saved = !!favorites.data?.some(item=>item.id===story.id);
  const busy = add.isPending || remove.isPending;
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const onSuccess = () => qc.invalidateQueries({queryKey:getListFavoritesQueryKey({guestId})});
    if(saved) remove.mutate({params:{guestId,storyId:story.id}},{onSuccess});
    else add.mutate({data:{guestId,storyId:story.id}},{onSuccess});
  };
  return <button className={`card-heart ${saved ? 'saved' : ''}`} type="button" onClick={toggle} disabled={busy} aria-label={saved ? `Remove ${story.title} from favourites` : `Save ${story.title} to favourites`} aria-pressed={saved} data-testid={`button-card-favorite-${story.id}`}><Heart size={17} fill={saved ? 'currentColor' : 'none'}/></button>;
}
function StoryGrid({ stories, loading, error, emptyTitle = 'No stories found', emptyCopy = 'Try another search or explore a different shelf.' }: { stories?: StorySummary[]; loading?: boolean; error?: boolean; emptyTitle?: string; emptyCopy?: string }) {
  if (loading) return <div className="story-grid" aria-label="Loading stories">{[0,1,2,3].map(n => <div className="skeleton story-skeleton" key={n}/>)}</div>;
  if (error) return <div className="notice error-notice" role="alert"><strong>That shelf is taking a little rest.</strong><p>We could not load stories just now. Please try again.</p><button className="button button-outline" onClick={() => window.location.reload()} data-testid="button-retry-stories">Try again</button></div>;
  if (!stories?.length) return <div className="empty-state"><div className="empty-icon"><BookOpen size={26}/></div><h3 className="font-display">{emptyTitle}</h3><p>{emptyCopy}</p></div>;
  return <div className="story-grid">{stories.map((story, i) => <StoryCard key={story.id} story={story} index={i}/>)}</div>;
}
function SectionHeading({ kicker, title, link, href }: { kicker?: string; title: string; link?: string; href?: string }) {
  return <div className="section-heading"><div>{kicker && <span className="eyebrow">{kicker}</span>}<h2 className="font-display">{title}</h2></div>{href && <Link href={href} className="text-link">{link || 'See all'} <ArrowRight size={15}/></Link>}</div>;
}
function CategoryTiles({ categories }: { categories?: import('@workspace/api-client-react').Category[] }) {
  if (!categories?.length) return null;
  return <div className="category-list">{categories.map((cat, i) => <Link href={`/categories/${cat.slug}`} key={cat.id} className={`category-tile cat-${palette[i % palette.length]}`} data-testid={`link-category-${cat.slug}`}><span className="category-sigil"><Sparkles size={20}/></span><span className="category-copy"><b>{cat.name}</b><small>{cat.storyCount} {cat.storyCount === 1 ? 'story' : 'stories'}</small></span><ArrowRight className="category-arrow" size={17}/></Link>)}</div>;
}
function LoadingBlock() { return <div className="content-skeleton"><div className="skeleton skeleton-line"/><div className="skeleton skeleton-line short"/><div className="skeleton skeleton-panel"/></div>; }
function HomePage() {
  const home = useGetHome();
  const categories = useListCategories();
  const featured = home.data?.featured;
  return <main className="page-enter">
    <section className="hero-wrap"><div className="hero">
      <div className="hero-copy"><span className="eyebrow"><Sparkles size={14}/> Stories from our shared childhood</span><h1 className="font-display">A whole world<br/>of wonder, <em>just<br/>for little ears.</em></h1><p>Folktales from across India, told with warmth and care. Pick a story, find a comfy spot, and let the journey begin.</p><div className="hero-buttons"><Link href="/explore" className="button button-primary" data-testid="button-browse-stories">Find a story <ArrowRight size={17}/></Link><Link href="/parent" className="trust-note" data-testid="link-parent-trust"><ShieldCheck size={16}/> Thoughtfully chosen for children</Link></div></div>
      <div className="hero-art"><div className="sun-disc"></div><span className="star star-one" aria-hidden="true"></span><span className="star star-two" aria-hidden="true"></span><span className="story-cloud cloud-one"></span><span className="story-cloud cloud-two"></span><div className="open-book"><div className="book-page page-left"><span></span><span></span><span></span></div><div className="book-page page-right"><span></span><span></span><span></span></div></div><div className="buddy-label"><Buddy/><span className="speech">Shall we read<br/>a story together?</span></div><span className="hero-caption">Meet Katha Buddy, your storytime friend</span></div>
    </div></section>
    <section className="home-section categories-section"><div className="section-inner"><SectionHeading kicker="Choose your kind of magic" title="Stories for every mood" link="Browse all stories" href="/explore"/>{categories.isLoading ? <div className="category-list">{[0,1,2,3].map(i=><div className="skeleton cat-skeleton" key={i}/>)}</div> : categories.isError ? <div className="notice error-notice">Story shelves could not load. <button onClick={() => categories.refetch()} data-testid="button-retry-categories">Try again</button></div> : <CategoryTiles categories={categories.data}/>}</div></section>
    <section className="home-section feature-section"><div className="section-inner feature-layout"><div className="feature-intro"><span className="eyebrow">A little tale to start</span><h2 className="font-display">Your next<br/>favourite might<br/>be <em>in here.</em></h2><p>Small adventures, brave hearts, clever animals and the sort of endings that stay with you.</p><Link href="/explore" className="button button-primary" data-testid="button-all-tales">Explore the library <ArrowRight size={16}/></Link></div>{home.isLoading ? <LoadingBlock/> : home.isError ? <div className="notice error-notice">We could not open the story shelves. <button onClick={() => home.refetch()} data-testid="button-retry-home">Try again</button></div> : featured ? <div className="featured-story"><Cover story={featured} className="featured-cover"/><div className="featured-copy"><span className="pill">Featured tale</span><h3 className="font-display">{featured.title}</h3><p>{featured.description}</p><div className="featured-meta"><span>Ages {featured.ageMin}–{featured.ageMax}</span><span>{featured.durationMinutes} minutes</span></div><Link href={`/stories/${featured.slug}`} className="button button-primary" data-testid="button-featured-story">Meet this story <ArrowRight size={16}/></Link></div></div> : <div className="empty-state"><h3 className="font-display">A new favourite is on its way</h3><p>There are no featured stories just yet. Visit the library to discover what is ready.</p><Link href="/explore" className="text-link">Open the library <ArrowRight size={15}/></Link></div>}</div></section>
    <section className="home-section popular-section"><div className="section-inner"><SectionHeading kicker="Little listeners love these" title="Popular storytime picks" link="See the library" href="/explore"/>{home.isLoading ? <div className="story-grid">{[0,1,2,3].map(i=><div className="skeleton story-skeleton" key={i}/>)}</div> : <StoryGrid stories={home.data?.popular} error={home.isError}/>}</div></section>
    <section className="promise-band"><div className="promise-inner"><div className="promise-copy"><span className="eyebrow">Made for little listeners</span><h2 className="font-display">Good stories.<br/>A safe place to find them.</h2><p>Every tale is here to be browsed, read and enjoyed together. No story-generating tools, no surprises — just a growing library of Indian folk tales.</p><Link href="/parent" className="button button-light" data-testid="button-family-details">How we care for stories <ArrowRight size={16}/></Link></div><div className="promise-seal"><div className="seal-ring"><ShieldCheck size={38}/><b>Family<br/>friendly</b><small>curated with care</small></div></div></div></section>
    <section className="home-section recent-section"><div className="section-inner"><SectionHeading kicker="Fresh from the storybook" title="Recently added" link="See what is waiting" href="/explore"/>{home.isLoading ? <div className="story-grid">{[0,1,2,3].map(i=><div className="skeleton story-skeleton" key={i}/>)}</div> : <StoryGrid stories={home.data?.recent} error={home.isError}/>}</div></section>
    <section className="last-invitation"><Buddy small/><div><span className="eyebrow">The next chapter is yours</span><h2 className="font-display">Find a story to share.</h2></div><Link className="button button-primary" href="/explore" data-testid="button-start-reading">Let's explore <ArrowRight size={16}/></Link></section>
  </main>;
}

function ExplorePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [age, setAge] = useState('');
  const [bedtime, setBedtime] = useState(() => {
    try { return localStorage.getItem('kathala-bedtime-pref') === 'true'; } catch { return false; }
  });
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
  const reset = () => { setSearch(''); setCategory(''); setLanguage(''); setAge(''); setBedtime(false); setSort('popular'); };
  return <main className="page-shell page-enter"><PageIntro eyebrow="The story shelves" title="Find your next favourite" copy="Search by story, choose a shelf, or follow your bedtime feeling."/>
    <section className="library-tools" aria-label="Search and filters"><label className="search-box"><Search size={20}/><input value={search} onChange={e=>setSearch(e.target.value)} type="search" placeholder="Search stories, animals, adventures…" aria-label="Search stories" data-testid="input-search-stories"/>{search && <IconButton label="Clear search" onClick={()=>setSearch('')}><X size={17}/></IconButton>}</label>
      <div className="filter-row"><label><span>Story shelf</span><select value={category} onChange={e=>setCategory(e.target.value)} data-testid="select-category"><option value="">All shelves</option>{cats.data?.map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}</select></label><label><span>Language</span><select value={language} onChange={e=>setLanguage(e.target.value)} data-testid="select-language"><option value="">Any language</option><option value="en">English</option><option value="te">తెలుగు</option><option value="hi">हिन्दी</option></select></label><label><span>Age</span><select value={age} onChange={e=>setAge(e.target.value)} data-testid="select-age"><option value="">Any age</option>{[3,4,5,6,7,8,9,10,11,12].map(n=><option key={n} value={n}>{n} years</option>)}</select></label><label><span>Order by</span><select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} data-testid="select-sort"><option value="popular">Popular</option><option value="recent">Recently added</option><option value="title">Title A–Z</option></select></label><button type="button" onClick={()=>setBedtime(!bedtime)} className={`filter-chip ${bedtime ? 'selected' : ''}`} aria-pressed={bedtime} data-testid="button-bedtime-filter">{bedtime ? <Check size={15}/> : <Moon size={15}/>} Bedtime stories</button></div>
    </section><div className="results-heading"><span>{stories.data?.length ?? '—'} stories for curious minds</span>{(search||category||language||age||bedtime) && <button className="text-link" onClick={reset} data-testid="button-clear-filters">Clear filters <X size={14}/></button>}</div>
    <StoryGrid stories={stories.data} loading={stories.isLoading} error={stories.isError} emptyTitle="No tales on this shelf" emptyCopy="Try widening the filters, or search for a different word."/>
  </main>;
}
function CategoryPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const categories = useListCategories();
  const cat = categories.data?.find(c=>c.slug===slug);
  const stories = useListStories({ category: slug, sort: 'popular' });
  return <main className="page-shell page-enter"><Link href="/explore" className="back-link" data-testid="link-back-explore"><ArrowLeft size={15}/> All stories</Link>{cat ? <PageIntro eyebrow={`${cat.storyCount} stories in this collection`} title={cat.name} copy={cat.description}/> : categories.isLoading ? <LoadingBlock/> : <PageIntro eyebrow="Story collection" title="A story shelf"/>}<StoryGrid stories={stories.data} loading={stories.isLoading} error={stories.isError} emptyTitle="This shelf is waiting for its first tale" emptyCopy="There are no published stories in this collection yet."/></main>;
}

function FavoriteAction({ story }: { story: StorySummary }) {
  const qc = useQueryClient();
  const list = useListFavorites({ guestId });
  const add = useAddFavorite();
  const remove = useRemoveFavorite();
  const saved = !!list.data?.some(s=>s.id===story.id);
  const busy = add.isPending || remove.isPending;
  const toggle = () => {
    const done = () => { qc.invalidateQueries({queryKey:getListFavoritesQueryKey({guestId})}); };
    if (saved) remove.mutate({params:{guestId,storyId:story.id}},{onSuccess:done});
    else add.mutate({data:{guestId,storyId:story.id}},{onSuccess:done});
  };
  return <div className="save-wrap"><button type="button" className={`save-button ${saved ? 'saved' : ''}`} onClick={toggle} disabled={busy} aria-pressed={saved} data-testid="button-save-story"><Heart size={17} fill={saved ? 'currentColor' : 'none'}/>{busy ? 'Saving…' : saved ? 'Saved to favourites' : 'Save this story'}</button>{(list.isError || add.isError || remove.isError) && <span className="inline-error" role="alert">Could not update saved stories. Try again.</span>}</div>;
}
function StoryPage() {
  const { slug = '' } = useParams<{slug:string}>();
  const query = useGetStory(slug);
  const [language, setLanguage] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const progress = useSaveProgress();
  const qc = useQueryClient();
  const story = query.data;
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const readVoices = () => setVoices(window.speechSynthesis.getVoices());
    readVoices(); window.speechSynthesis.addEventListener('voiceschanged', readVoices);
    return () => { window.speechSynthesis.removeEventListener('voiceschanged', readVoices); window.speechSynthesis.cancel(); };
  }, []);
  useEffect(() => { setSpeaking(false); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, [language, slug]);
  useEffect(() => {
    try { document.body.classList.toggle('reader-large', localStorage.getItem('kathala-large-text-pref') === 'true'); } catch { /* Continue with default reading size. */ }
    return () => document.body.classList.remove('reader-large');
  }, [slug]);
  const translation: Translation | undefined = story?.translations.find(t=>t.languageCode===language) ?? story?.translations[0];
  const matchingVoice = translation && voices.find(v=>v.lang.toLowerCase().startsWith(translation.languageCode === 'te' ? 'te' : translation.languageCode === 'hi' ? 'hi' : 'en'));
  const speak = () => {
    if (!translation || !matchingVoice || !('speechSynthesis' in window)) return;
    if (speaking) { window.speechSynthesis.pause(); setSpeaking(false); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(translation.scenes.map(s=>s.text).join('\n\n') || translation.script);
    utterance.voice = matchingVoice; utterance.lang = matchingVoice.lang;
    utterance.onend = () => setSpeaking(false); utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance); setSpeaking(true);
  };
  const saveReadProgress = useCallback((completed: boolean) => {
    if (!story || !translation) return;
     progress.mutate({params:{guestId,storyId:story.id},data:{languageCode:translation.languageCode,playbackPosition:completed ? story.durationMinutes*60 : 0,durationSeconds:story.durationMinutes*60,completed}}, {onSuccess:()=>qc.invalidateQueries({queryKey:getListProgressQueryKey({guestId})})});
  }, [story, translation, progress.mutate, qc]);
  if (query.isLoading) return <main className="page-shell"><LoadingBlock/></main>;
  if (query.isError || !story) return <main className="page-shell"><div className="notice error-notice"><h2 className="font-display">This story could not be opened</h2><p>It may have moved from the library. Please try again or choose another story.</p><button className="button button-outline" onClick={()=>query.refetch()} data-testid="button-retry-story">Try again</button> <Link className="text-link" href="/explore">Browse stories</Link></div></main>;
  return <main className="story-page page-enter"><div className="story-top"><Link href="/explore" className="back-link" data-testid="link-story-back"><ArrowLeft size={15}/> Back to stories</Link><span className="story-top-note"><ShieldCheck size={15}/> A story for ages {story.ageMin}–{story.ageMax}</span></div>
    <div className="story-hero"><div className="story-hero-cover"><Cover story={story}/><span className="cover-duration"><Clock3 size={14}/>{story.durationMinutes} min read</span></div><div className="story-hero-text"><span className="eyebrow">{story.category}</span><h1 className="font-display">{translation?.title || story.title}</h1><p>{story.description}</p><div className="story-meta"><span>For ages {story.ageMin}–{story.ageMax}</span><span>{story.languages.map(l=>languageNames[l]||l).join(' · ')}</span></div><FavoriteAction story={story}/></div></div>
    <section className="reader-panel"><div className="reader-header"><div><span className="eyebrow">Settle in together</span><h2 className="font-display">Read along</h2></div><label className="reader-language">Story language<select value={translation?.languageCode || ''} onChange={e=>setLanguage(e.target.value)} data-testid="select-story-language">{story.translations.map(t=><option key={t.languageCode} value={t.languageCode}>{languageNames[t.languageCode]||t.languageCode}{t.reviewed ? ' · reviewed' : ''}</option>)}</select></label></div>
      <div className="reader-actions"><div className="listen-control"><button type="button" className="button button-primary" disabled={!matchingVoice} onClick={speak} data-testid="button-speech-read">{speaking ? <Pause size={17}/> : <Volume2 size={17}/>} {matchingVoice ? (speaking ? 'Pause reading' : 'Read aloud') : 'Read along'}</button><span>{matchingVoice ? `Using your device's ${languageNames[translation?.languageCode || 'en']} voice` : 'No matching voice is available on this device. Read along below.'}</span></div><span className="media-status"><Headphones size={15}/> {translation?.audioUrl ? 'Recorded narration available' : 'Recorded narration is not available yet'}</span></div>
      {translation?.audioUrl ? <audio className="audio-player" controls preload="none" src={translation.audioUrl} aria-label={`Recorded narration in ${languageNames[translation.languageCode] || translation.languageCode}`}>Your browser does not support audio playback.</audio> : <p className="honesty-note">There is no recorded audio file for this language yet. The read-aloud option uses your device speech voice only when it matches this language; otherwise the story text is ready below.</p>}
       {!translation?.scenes?.length && !translation?.script ? <div className="notice">The story text is not available in this language just now. Choose another language if one is ready.</div> : <article className="story-text font-story" lang={translation?.languageCode === 'te' ? 'te' : translation?.languageCode === 'hi' ? 'hi' : 'en'}>{translation?.scenes?.length ? translation.scenes.map(scene=><section className="scene" key={scene.position}>{scene.illustrationUrl && <img src={assetUrl(scene.illustrationUrl)} alt={scene.caption || `Story scene ${scene.position}`} loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}<p>{scene.text}</p>{scene.caption && <small>{scene.caption}</small>}</section>) : translation?.script.split(/\n{2,}/).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</article>}
      <div className="story-ending"><div><Check size={18}/><span>Finished reading together?</span></div><button className="button button-outline" type="button" onClick={()=>saveReadProgress(true)} disabled={progress.isPending} data-testid="button-mark-read">{progress.isPending ? 'Saving…' : 'Mark as read'}</button></div>{progress.isError && <p className="inline-error" role="alert">Reading progress could not be saved. Please try again.</p>}
    </section>{story.moral && <aside className="moral-note"><Sparkles size={19}/><div><b>A thought to take with you</b><p>{story.moral}</p></div></aside>}
  </main>;
}

function FavoritesPage() {
  const favorites = useListFavorites({guestId});
  return <main className="page-shell page-enter"><PageIntro eyebrow="Your little story nook" title="Saved stories" copy="Keep your family's favourites close for another storytime."/><StoryGrid stories={favorites.data} loading={favorites.isLoading} error={favorites.isError} emptyTitle="Your nook is waiting" emptyCopy="Tap “Save this story” on a tale you love, and it will be right here."/></main>;
}

function ParentGate() {
  const [unlocked, setUnlocked] = useState(false);
  const [answer, setAnswer] = useState('');
  const [challenge, setChallenge] = useState(() => { const a = 4 + Math.floor(Math.random()*6); const b = 2 + Math.floor(Math.random()*5); return {a,b,sum:a+b}; });
  const [error, setError] = useState('');
  const verify = (e: FormEvent) => { e.preventDefault(); if (Number(answer) === challenge.sum) {setUnlocked(true);setError('');} else {setError('That answer is not quite right. Try once more.'); setAnswer(''); setChallenge(()=>{const a=4+Math.floor(Math.random()*6);const b=2+Math.floor(Math.random()*5);return {a,b,sum:a+b};});} };
  if (!unlocked) return <main className="parent-gate page-enter"><div className="gate-card"><div className="gate-lock"><LockKeyhole size={25}/></div><span className="eyebrow">A grown-up corner</span><h1 className="font-display">Before you come in…</h1><p>Let's make sure a grown-up is here. Solve this little sum to continue.</p><form onSubmit={verify}><label htmlFor="parent-answer">{challenge.a} + {challenge.b} = ?</label><input id="parent-answer" value={answer} onChange={e=>setAnswer(e.target.value)} inputMode="numeric" type="number" required aria-describedby={error?'parent-error':undefined} data-testid="input-parent-answer"/>{error && <p role="alert" className="form-error" id="parent-error">{error}</p>}<button className="button button-primary button-wide" type="submit" data-testid="button-unlock-parent">Continue to family corner <ArrowRight size={16}/></button></form><Link className="text-link centered" href="/">Back to storytime</Link></div><div className="gate-doodle"><Buddy/></div></main>;
  return <ParentDashboard/>;
}
function ParentDashboard() {
  const progress = useListProgress({guestId});
  const favorites = useListFavorites({guestId});
  const [bedtimeOnly, setBedtimeOnly] = useState(() => {
    try { return localStorage.getItem('kathala-bedtime-pref') === 'true'; } catch { return false; }
  });
  const [largeText, setLargeText] = useState(() => {
    try { return localStorage.getItem('kathala-large-text-pref') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try {
      localStorage.setItem('kathala-bedtime-pref', String(bedtimeOnly));
      localStorage.setItem('kathala-large-text-pref', String(largeText));
    } catch { /* Preferences remain available for this view even if storage is disabled. */ }
    document.body.classList.toggle('reader-large', largeText);
    return () => document.body.classList.remove('reader-large');
  }, [bedtimeOnly, largeText]);
  return <main className="page-shell page-enter parent-dashboard"><PageIntro eyebrow="A little peace of mind" title="Family corner" copy="A thoughtful home for your child's storytime habits."/>
    <section className="parent-values"><div><ShieldCheck size={22}/><div><b>Stories made for children</b><p>Children can browse, read and listen to stories already in the library. There is no story-writing tool here.</p></div></div><div><BookOpen size={22}/><div><b>Story details, up front</b><p>Age ranges, languages and story length are shown before you open a tale.</p></div></div></section>
    <section className="settings-panel"><div className="settings-heading"><div><span className="eyebrow">Reading preferences</span><h2 className="font-display">Make storytime yours</h2></div></div><label className="setting-row"><span><Moon size={19}/><span><b>Bedtime shelf first</b><small>Keep the library focused on bedtime stories.</small></span></span><input type="checkbox" checked={bedtimeOnly} onChange={e=>setBedtimeOnly(e.target.checked)} data-testid="toggle-bedtime"/></label><label className="setting-row"><span><BookOpen size={19}/><span><b>Roomier story text</b><small>Enlarge the reading text on story pages.</small></span></span><input type="checkbox" checked={largeText} onChange={e=>setLargeText(e.target.checked)} data-testid="toggle-large-text"/></label><p className="settings-local-note">Preferences are saved only in this browser and can be changed at any time.</p></section>
    <section className="parent-history"><div className="history-column"><SectionHeading kicker="Ready when you are" title="Saved stories"/><StoryGrid stories={favorites.data} loading={favorites.isLoading} error={favorites.isError} emptyTitle="No favourites just yet" emptyCopy="Stories your family saves will appear here."/></div><div className="history-column"><SectionHeading kicker="A gentle recap" title="Reading history"/>{progress.isLoading ? <LoadingBlock/> : progress.isError ? <div className="notice error-notice">Reading history could not load. <button onClick={()=>progress.refetch()} data-testid="button-retry-progress">Try again</button></div> : !progress.data?.length ? <div className="empty-state"><div className="empty-icon"><BookOpen size={24}/></div><h3 className="font-display">Your first story awaits</h3><p>Finished stories will be remembered here on this device.</p></div> : <ProgressList items={progress.data}/>}</div></section>
    <section className="account-panel"><div><span className="eyebrow">Grown-up account</span><h2 className="font-display">Manage sign-in</h2><p>Sign in to use your Clerk account for family access. Story favorites and reading history use this browser's guest profile.</p></div><AccountAction/></section>
  </main>;
}
function ProgressList({items}: {items: import('@workspace/api-client-react').Progress[]}) {
  const stories = useListStories({sort:'recent'});
  return <div className="progress-list">{items.map((p,i)=>{const story=stories.data?.find(s=>s.id===p.storyId);return <div className="progress-row" key={`${p.storyId}-${i}`}><span className="progress-book"><BookOpen size={18}/></span><div><b>{story?.title || `Story ${p.storyId}`}</b><small>{p.completed ? 'Finished' : 'In progress'} · {languageNames[p.languageCode]||p.languageCode}</small></div><span className="progress-date">{new Date(p.updatedAt).toLocaleDateString()}</span></div>;})}</div>;
}
function AccountAction() {
  const {isSignedIn} = useUser();
  return isSignedIn ? <div className="account-signed"><UserButton/><span>Signed in to your family account</span></div> : <Link className="button button-outline" href="/sign-in" data-testid="button-account-signin">Sign in to Clerk <ArrowRight size={15}/></Link>;
}

function AdminRoute() {
  const {isLoaded,isSignedIn,user} = useUser();
  if (!isLoaded) return <main className="page-shell"><LoadingBlock/></main>;
  if (!isSignedIn) return <main className="page-shell page-enter"><div className="notice admin-locked"><LockKeyhole size={24}/><h1 className="font-display">Story studio is for editors</h1><p>Sign in with an approved editor account to manage the library.</p><Link className="button button-primary" href="/sign-in" data-testid="button-admin-signin">Sign in <ArrowRight size={15}/></Link></div></main>;
  if (user?.publicMetadata?.role !== 'admin') return <main className="page-shell page-enter"><div className="notice admin-locked"><ShieldCheck size={24}/><h1 className="font-display">This shelf is private</h1><p>Your account does not have editor access. The children's library is still open to explore.</p><Link className="button button-outline" href="/" data-testid="button-admin-home">Return to stories</Link></div></main>;
  return <AdminDashboard/>;
}
function AdminDashboard() {
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<AdminStory|null>(null);
  const [creating, setCreating] = useState(false);
  const dashQuery = useGetAdminDashboard();
  const dash = {...dashQuery, data: dashQuery.data ?? {totalStories:0,publishedStories:0,draftStories:0,reviewStories:0,missingNarration:0,missingTranslations:0}};
  const stories = useListAdminStories(status ? {status:status as 'draft'|'review'|'published'|'archived'} : {});
  const cats = useListCategories();
  const qc = useQueryClient();
  const create = useCreateAdminStory(); const update = useUpdateAdminStory();
  const publish = usePublishAdminStory(); const archive = useArchiveAdminStory();
  const invalidate=()=>{qc.invalidateQueries({queryKey:getGetAdminDashboardQueryKey()});qc.invalidateQueries({queryKey:getListAdminStoriesQueryKey()});qc.invalidateQueries({queryKey:getGetHomeQueryKey()});qc.invalidateQueries({queryKey:getListStoriesQueryKey()});};
  return <main className="admin-page page-enter"><div className="admin-titlebar"><div><span className="eyebrow">Kathala Lokam · editor space</span><h1 className="font-display">Story studio</h1><p>Prepare thoughtful tales for the library.</p></div><button className="button button-primary" onClick={()=>{setEditing(null);setCreating(true);}} data-testid="button-create-story"><span>+</span> New story</button></div>
    {dash.isLoading ? <div className="stats-grid">{[0,1,2,3].map(i=><div className="skeleton stat-skeleton" key={i}/>)}</div> : dash.isError ? <div className="notice error-notice">Dashboard counts could not load. <button onClick={()=>dash.refetch()} data-testid="button-retry-dashboard">Try again</button></div> : <div className="stats-grid">{[['All stories',dash.data.totalStories],['Published',dash.data.publishedStories],['In review',dash.data.reviewStories],['Drafts',dash.data.draftStories],['Missing narration',dash.data.missingNarration],['Missing translations',dash.data.missingTranslations]].map(([label,value])=><div className="stat-card" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>}
    <section className="admin-table-panel"><div className="admin-table-heading"><div><span className="eyebrow">Content library</span><h2 className="font-display">Every story, clearly tracked</h2></div><label className="admin-filter">Status <select value={status} onChange={e=>setStatus(e.target.value)} data-testid="select-admin-status"><option value="">All status</option>{['draft','review','published','archived'].map(s=><option key={s}>{s}</option>)}</select></label></div>
      {stories.isLoading ? <LoadingBlock/> : stories.isError ? <div className="notice error-notice">Stories could not be loaded. <button onClick={()=>stories.refetch()} data-testid="button-retry-admin">Try again</button></div> : !stories.data?.length ? <div className="empty-state"><div className="empty-icon"><LibraryBig size={24}/></div><h3 className="font-display">No stories in this view</h3><p>Try another status or add the first tale.</p></div> : <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Story</th><th>Category</th><th>Age</th><th>Languages</th><th>Status</th><th>Actions</th></tr></thead><tbody>{stories.data.map(s=><tr key={s.id} data-testid={`row-admin-story-${s.id}`}><td><b>{s.title}</b><small>/{s.slug}</small></td><td>{s.category}</td><td>{s.ageMin}–{s.ageMax}</td><td>{s.languages.join(', ')}</td><td><span className={`status status-${s.status}`}>{s.status}</span></td><td className="table-actions"><button type="button" onClick={()=>{setEditing(s);setCreating(false);}} data-testid={`button-edit-${s.id}`}>Edit</button>{s.status==='review' && <button type="button" onClick={()=>publish.mutate({id:s.id},{onSuccess:invalidate})} disabled={publish.isPending} data-testid={`button-publish-${s.id}`}>Publish</button>}{s.status!=='archived' && <button type="button" className="archive-action" onClick={()=>{if(window.confirm(`Archive “${s.title}”?`))archive.mutate({id:s.id},{onSuccess:invalidate});}} disabled={archive.isPending} data-testid={`button-archive-${s.id}`}>Archive</button>}</td></tr>)}</tbody></table></div>}
    </section>
    {(create.isError || update.isError || publish.isError || archive.isError) && <p className="notice error-notice" role="alert">That content change could not be saved. Please try again.</p>}
    {(creating || editing) && <StoryEditor story={editing} categories={cats.data||[]} saving={create.isPending||update.isPending} onClose={()=>{setCreating(false);setEditing(null);}} onSubmit={(payload)=>{
      if(editing) { const change: StoryUpdate=payload; update.mutate({id:editing.id,data:change},{onSuccess:()=>{setEditing(null);invalidate();}}); }
      else create.mutate({data:payload as StoryInput},{onSuccess:()=>{setCreating(false);invalidate();}});
    }}/>}
  </main>;
}
function StoryEditor({story,categories,saving,onClose,onSubmit}: {story:AdminStory|null;categories:import('@workspace/api-client-react').Category[];saving:boolean;onClose:()=>void;onSubmit:(data:StoryInput|StoryUpdate)=>void}) {
  const [form,setForm]=useState({slug:story?.slug||'',title:story?.title||'',categoryId:String(story?.categoryId||categories[0]?.id||''),description:story?.description||'',script:story?.script||'',ageMin:String(story?.ageMin||5),ageMax:String(story?.ageMax||8),durationMinutes:String(story?.durationMinutes||5),coverUrl:story?.coverUrl||'',moral:story?.moral||'',source:story?.source||'',licence:story?.licence||''});
  const [error,setError]=useState('');
  const change=(key:keyof typeof form)=>(e:ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setForm(v=>({...v,[key]:e.target.value}));
  const submit=(e:FormEvent)=>{e.preventDefault();if(form.script.trim().length<100){setError('The story script must be at least 100 characters.');return;}if(!form.categoryId){setError('Choose a category before saving.');return;}setError('');const body={slug:form.slug.trim(),title:form.title.trim(),categoryId:Number(form.categoryId),description:form.description.trim(),script:form.script.trim(),ageMin:Number(form.ageMin),ageMax:Number(form.ageMax),durationMinutes:Number(form.durationMinutes),coverUrl:form.coverUrl.trim(),moral:form.moral.trim()||null,source:form.source.trim(),licence:form.licence.trim()};onSubmit(body);};
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title"><div className="modal-heading"><div><span className="eyebrow">{story ? 'Edit library entry' : 'Add to the story shelves'}</span><h2 className="font-display" id="editor-title">{story ? 'Edit story' : 'New story draft'}</h2></div><IconButton label="Close editor" onClick={onClose}><X size={19}/></IconButton></div><p className="editor-guidance">Add a pre-made folk tale and its source details. This editor manages library content; it does not generate stories.</p><form onSubmit={submit} className="editor-form">
    <label>Title<input required minLength={2} value={form.title} onChange={change('title')} data-testid="input-story-title"/></label><label>URL slug<input required minLength={2} value={form.slug} onChange={change('slug')} data-testid="input-story-slug"/></label>
    <label>Category<select required value={form.categoryId} onChange={change('categoryId')} data-testid="select-story-category"><option value="">Choose a category</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Cover image URL<input value={form.coverUrl} onChange={change('coverUrl')} placeholder="Optional image URL" data-testid="input-story-cover"/></label>
    <label className="wide-field">Description<textarea required minLength={10} value={form.description} onChange={change('description')} data-testid="input-story-description"/></label><label className="wide-field">Story script<textarea required minLength={100} rows={8} value={form.script} onChange={change('script')} data-testid="input-story-script"/></label>
    <div className="editor-numbers"><label>Age from<input type="number" required min={3} max={12} value={form.ageMin} onChange={change('ageMin')} data-testid="input-age-min"/></label><label>Age to<input type="number" required min={3} max={12} value={form.ageMax} onChange={change('ageMax')} data-testid="input-age-max"/></label><label>Minutes<input type="number" required min={1} value={form.durationMinutes} onChange={change('durationMinutes')} data-testid="input-duration"/></label></div>
    <label>Moral or takeaway<input value={form.moral} onChange={change('moral')} data-testid="input-story-moral"/></label><label>Source<input required minLength={2} value={form.source} onChange={change('source')} data-testid="input-story-source"/></label><label className="wide-field">Licence<input required minLength={2} value={form.licence} onChange={change('licence')} data-testid="input-story-licence"/></label>
    {error && <p role="alert" className="form-error wide-field">{error}</p>}<div className="editor-actions wide-field"><button type="button" className="button button-outline" onClick={onClose} data-testid="button-cancel-editor">Cancel</button><button type="submit" className="button button-primary" disabled={saving} data-testid="button-save-draft">{saving?'Saving…':story?'Save changes':'Save as draft'} <Check size={16}/></button></div>
  </form></section></div>;
}

function AuthPage({signup=false}:{signup?:boolean}) {
  return <main className="auth-page"><div className="auth-story"><Link href="/" className="brand" data-testid="link-auth-home"><span className="brand-mark"><BookOpen size={21}/></span><span>Kathala <b>Lokam</b><small>A little world of stories</small></span></Link><Buddy/><span className="eyebrow">Come back to the storybook</span><h1 className="font-display">{signup?'A new chapter begins here.':'Your family story nook awaits.'}</h1><p>A little space for the grown-ups who share the magic.</p></div><div className="auth-form">{signup?<SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`}/>:<SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}/>}</div></main>;
}
function AppRoutes() {
  return <Switch>
    <Route path="/" component={HomePage}/>
    <Route path="/explore" component={ExplorePage}/>
    <Route path="/categories/:slug" component={CategoryPage}/>
    <Route path="/stories/:slug" component={StoryPage}/>
    <Route path="/favorites" component={FavoritesPage}/>
    <Route path="/parent" component={ParentGate}/>
    <Route path="/admin" component={AdminRoute}/>
    <Route path="/sign-in/*?" component={()=> <AuthPage/>}/>
    <Route path="/sign-up/*?" component={()=> <AuthPage signup/>}/>
    <Route component={NotFound}/>
  </Switch>;
}
function SiteFrame() {
  const [location] = useLocation();
  const isAuthPage = location.startsWith('/sign-in') || location.startsWith('/sign-up');
  return <div className={isAuthPage ? '' : 'paper-grain'}>{!isAuthPage && <Header/>}<AppRoutes/>{!isAuthPage && <Footer/>}</div>;
}
function ClerkRoutesProvider() {
  const [,setLocation]=useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} routerPush={path=>setLocation(stripBase(path))} routerReplace={path=>setLocation(stripBase(path),{replace:true})} localization={{signIn:{start:{title:'Welcome back to storytime',subtitle:'Sign in to your family nook'}},signUp:{start:{title:'Make a little story nook',subtitle:'Create a grown-up account'}}}}><SiteFrame/></ClerkProvider>;
}
function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><ClerkRoutesProvider/></WouterRouter></QueryClientProvider>;
}

export default App;
