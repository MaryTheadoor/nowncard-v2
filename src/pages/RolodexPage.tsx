import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Building2, Briefcase, Eye, SlidersHorizontal, X } from 'lucide-react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import type { Card } from '@/types';

interface PublicCard {
  id: string;
  slug: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  profileImage?: string;
  viewCount?: number;
  industry?: string;
  cardTheme?: 'light' | 'dark';
  accentColor?: string;
}

function deriveIndustry(jobTitle?: string): string | undefined {
  if (!jobTitle) return undefined;
  const t = jobTitle.toLowerCase();
  if (/design|creative|artist|photographer|writer|brand|ux|ui/.test(t)) return 'Design & Creative';
  if (/developer|engineer|programmer|tech|it |software|web/.test(t)) return 'Technology';
  if (/real estate|realtor|property/.test(t)) return 'Real Estate';
  if (/sales|marketing|seo|growth|brand/.test(t)) return 'Sales & Marketing';
  if (/doctor|nurse|health|medical|therapist|dentist|care/.test(t)) return 'Healthcare';
  if (/consultant|coach|advisor|strategist/.test(t)) return 'Consulting';
  if (/finance|accountant|bank|invest|bookkeep/.test(t)) return 'Finance';
  if (/lawyer|attorney|legal|paralegal/.test(t)) return 'Legal';
  if (/teacher|professor|educat|tutor|trainer/.test(t)) return 'Education';
  if (t.length > 2) return 'Other';
  return undefined;
}

type SortMode = 'az' | 'views' | 'recent';

export default function RolodexPage() {
  const { user, userData, signInEmail, signUpEmail, signInGoogle, linkGoogle, logOut, error } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [cards, setCards] = useState<PublicCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeIndustry, setActiveIndustry] = useState('All');
  const [sortMode, setSortMode] = useState<SortMode>('az');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'cards'),
          where('isPublic', '==', true),
          limit(300)
        ));
        const list = snap.docs.map((d) => {
          const data = d.data() as Partial<Card>;
          return {
            id: d.id,
            slug: data.slug || '',
            firstName: data.firstName,
            lastName: data.lastName,
            company: data.company,
            jobTitle: data.jobTitle,
            profileImage: data.profileImage,
            viewCount: data.viewCount || 0,
            industry: data.industry || deriveIndustry(data.jobTitle),
            cardTheme: data.cardTheme,
            accentColor: data.accentColor,
          } as PublicCard;
        });
        list.sort((a, b) => a.slug.localeCompare(b.slug));
        setCards(list);
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Derive available industries from actual card data
  const availableIndustries = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => { if (c.industry) set.add(c.industry); });
    return ['All', ...Array.from(set).sort()];
  }, [cards]);

  const filtered = useMemo(() => {
    let list = cards;

    // Industry filter
    if (activeIndustry !== 'All') {
      list = list.filter((c) => c.industry === activeIndustry);
    }

    // Text search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
        const company = (c.company || '').toLowerCase();
        const job = (c.jobTitle || '').toLowerCase();
        const slug = (c.slug || '').toLowerCase();
        const industry = (c.industry || '').toLowerCase();
        return name.includes(q) || company.includes(q) || job.includes(q) || slug.includes(q) || industry.includes(q);
      });
    }

    // Sort
    if (sortMode === 'az') {
      list = [...list].sort((a, b) => {
        const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.slug;
        const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.slug;
        return nameA.localeCompare(nameB);
      });
    } else if (sortMode === 'views') {
      list = [...list].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    }
    // 'recent' falls back to default load order (could be enhanced with createdAt later)

    return list;
  }, [cards, search, activeIndustry, sortMode]);

  const initials = (first?: string, last?: string) => {
    const f = (first || '').trim().charAt(0).toUpperCase();
    const l = (last || '').trim().charAt(0).toUpperCase();
    return f + l || '?';
  };

  const hasActiveFilters = activeIndustry !== 'All' || search.trim().length > 0 || sortMode !== 'az';

  return (
    <div className="min-h-screen bg-space">
      <Navbar
        onAuthClick={() => setAuthOpen(true)}
        onSignOut={() => { logOut(); navigate('/'); }}
        userEmail={user?.email}
        isAdmin={userData?.isAdmin}
        defaultCardSlug={userData?.defaultCardSlug}
      />

      <main className="max-w-5xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold mb-2">Card Directory</h1>
          <p className="text-sm text-ink-muted">Browse and discover public business cards</p>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, job title, or industry…"
            className="w-full pl-10 pr-10 py-3 bg-tile border border-line rounded-xl text-ink text-sm focus:outline-none focus:border-accent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition ${showFilters ? 'bg-accent text-space border-accent' : 'bg-tile text-ink border-line hover:bg-tile-soft'}`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>

          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setActiveIndustry('All'); setSortMode('az'); }}
              className="text-xs text-ink-muted hover:text-accent underline underline-offset-2"
            >
              Clear all
            </button>
          )}

          <div className="ml-auto text-xs text-ink-faint">
            {filtered.length} card{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Expandable filter panel */}
        {showFilters && (
          <div className="bg-tile border border-line rounded-2xl p-5 mb-6">
            {/* Industry pills */}
            <div className="mb-4">
              <div className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">Industry</div>
              <div className="flex flex-wrap gap-2">
                {availableIndustries.map((ind) => (
                  <button
                    key={ind}
                    onClick={() => setActiveIndustry(ind)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      activeIndustry === ind
                        ? 'bg-accent text-space border-accent'
                        : 'bg-tile-soft text-ink border-line hover:border-accent hover:text-accent'
                    }`}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <div className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">Sort By</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'az', label: 'A – Z' },
                  { key: 'views', label: 'Most Viewed' },
                  { key: 'recent', label: 'Recently Updated' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSortMode(opt.key as SortMode)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      sortMode === opt.key
                        ? 'bg-accent text-space border-accent'
                        : 'bg-tile-soft text-ink border-line hover:border-accent hover:text-accent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-ink-muted">
            <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin mb-4" />
            <p className="text-sm">Loading cards…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-ink font-bold mb-1">
              {search.trim() || activeIndustry !== 'All' ? 'No matches found' : 'No public cards yet'}
            </p>
            <p className="text-ink-muted text-sm max-w-xs mx-auto">
              {search.trim() || activeIndustry !== 'All'
                ? 'Try adjusting your search or filters.'
                : 'Be the first to create and share a public card.'}
            </p>
            {!user && (
              <button
                onClick={() => setAuthOpen(true)}
                className="mt-5 px-5 py-2.5 bg-accent text-space font-bold rounded-full text-sm hover:brightness-110 transition"
              >
                Create Your Card
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <Link
                key={c.id}
                to={`/card/${c.slug}`}
                className="flex flex-col bg-tile border border-line rounded-2xl p-4 hover:border-accent transition no-underline group"
              >
                <div className="flex items-center gap-4 mb-3">
                  {c.profileImage ? (
                    <img src={c.profileImage} alt="" className="w-12 h-12 rounded-full object-cover border border-line flex-shrink-0" />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-extrabold text-white flex-shrink-0"
                      style={{ backgroundColor: c.accentColor || '#d4a34a' }}
                    >
                      {initials(c.firstName, c.lastName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-ink truncate group-hover:text-accent transition">
                      {c.firstName} {c.lastName}
                    </div>
                    {c.company && (
                      <div className="flex items-center gap-1 text-xs text-ink-muted truncate">
                        <Building2 className="w-3 h-3" />
                        {c.company}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-auto text-xs text-ink-muted">
                  {c.jobTitle && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      {c.jobTitle}
                    </span>
                  )}
                  {c.industry && c.industry !== 'Other' && (
                    <span className="px-2 py-0.5 bg-tile-soft border border-line rounded-full text-[11px]">
                      {c.industry}
                    </span>
                  )}
                  <span className="flex items-center gap-1 ml-auto">
                    <Eye className="w-3 h-3" />
                    {(c.viewCount || 0).toLocaleString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignInEmail={signInEmail}
        onSignUpEmail={signUpEmail}
        onSignInGoogle={signInGoogle}
        onLinkGoogle={linkGoogle}
        error={error}
        isAuthenticated={!!user}
      />

      <Footer />
    </div>
  );
}
