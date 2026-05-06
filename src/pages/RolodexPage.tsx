import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, User, Building2 } from 'lucide-react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Navbar from '@/components/Navbar';
// import type { Card } from '@/types';

interface PublicCard {
  id: string;
  slug: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  profileImage?: string;
}

export default function RolodexPage() {
  const [cards, setCards] = useState<PublicCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'cards'),
          where('isPublic', '==', true),
          limit(200)
        ));
        const list = snap.docs.map((d) => ({
          id: d.id,
          slug: d.data().slug || '',
          firstName: d.data().firstName,
          lastName: d.data().lastName,
          company: d.data().company,
          jobTitle: d.data().jobTitle,
          profileImage: d.data().profileImage,
        } as PublicCard));
        // Sort by most recently updated (client-side)
        list.sort((a, b) => a.slug.localeCompare(b.slug));
        setCards(list);
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => {
      const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
      const company = (c.company || '').toLowerCase();
      const slug = (c.slug || '').toLowerCase();
      return name.includes(q) || company.includes(q) || slug.includes(q);
    });
  }, [cards, search]);

  return (
    <div className="min-h-screen bg-space overflow-x-hidden">
      <Navbar onAuthClick={() => {}} onSignOut={() => {}} defaultCardSlug={undefined} />

      <main className="max-w-3xl mx-auto px-5 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold mb-2">Browse</h1>
          <p className="text-sm text-ink-muted">Search public business cards</p>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, or username…"
            className="w-full pl-10 pr-4 py-3 bg-tile border border-line rounded-xl text-ink text-sm focus:outline-none focus:border-accent"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-ink-muted">
            <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin mb-4" />
            <p className="text-sm">Loading cards…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-ink-muted text-sm">
              {search.trim() ? 'No matches found.' : 'No public cards yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <Link
                key={c.id}
                to={`/card/${c.slug}`}
                className="flex items-center gap-4 bg-tile border border-line rounded-2xl p-4 hover:border-accent transition no-underline group"
              >
                {c.profileImage ? (
                  <img src={c.profileImage} alt="" className="w-12 h-12 rounded-full object-cover border border-line flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#64748b] to-[#94a3b8] flex items-center justify-center text-sm font-extrabold text-white flex-shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-ink truncate group-hover:text-accent transition">
                    {c.firstName} {c.lastName}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-ink-muted truncate">
                    {c.company ? (
                      <>
                        <Building2 className="w-3 h-3" />
                        {c.company}
                      </>
                    ) : (
                      <span>@{c.slug}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
