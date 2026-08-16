import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MenuHeaderIcon from '@/components/MenuHeaderIcon';
import { fullName, orgLine } from '@/lib/utils';
import { captureElementAsPNG } from '@/lib/image-export';
import { useAuth } from '@/hooks/auth-context';
import { toast } from 'sonner';
import type { Card } from '@/types';

const IconPrinter = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
const IconCamera = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>;

export default function MenuPrintPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        let found: Card | null = null;
        const publicSnap = await getDocs(query(
          collection(db, 'cards'),
          where('slug', '==', slug),
          where('isPublic', '==', true),
          limit(1),
        ));
        if (!publicSnap.empty) {
          found = { id: publicSnap.docs[0].id, ...publicSnap.docs[0].data() } as Card;
        } else if (user) {
          // Owners can print the menu of their own private cards too.
          const ownerSnap = await getDocs(query(
            collection(db, 'cards'),
            where('slug', '==', slug),
            where('ownerUid', '==', user.uid),
            limit(1),
          ));
          if (!ownerSnap.empty) {
            found = { id: ownerSnap.docs[0].id, ...ownerSnap.docs[0].data() } as Card;
          } else {
            // Legacy cards may only carry ownerId. The (slug, ownerId) index may be
            // missing, so treat this as best-effort.
            try {
              const legacySnap = await getDocs(query(
                collection(db, 'cards'),
                where('slug', '==', slug),
                where('ownerId', '==', user.uid),
                limit(1),
              ));
              if (!legacySnap.empty) found = { id: legacySnap.docs[0].id, ...legacySnap.docs[0].data() } as Card;
            } catch { /* missing composite index — fall through to not-found */ }
          }
        }
        if (!cancelled) {
          if (found) setCard(found);
          else setError(`Card "${slug}" not found.`);
        }
      } catch {
        if (!cancelled) setError('Failed to load card.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, user]);

  const name = card ? fullName(card) : '';
  const org = card ? orgLine(card) : '';
  const menuTitle = card?.menuTitle?.trim() || 'Menu';
  const menu = Array.isArray(card?.menu)
    ? card.menu.filter((c) => c?.name?.trim() && Array.isArray(c.items) && c.items.some((it) => it?.name?.trim()))
    : [];

  const handleSaveImage = async () => {
    if (!previewRef.current || saving) return;
    setSaving(true);
    try {
      const safe = (menuTitle || slug || 'menu').replace(/[^a-z0-9_-]/gi, '_');
      await captureElementAsPNG(previewRef.current, `${safe}-menu.png`);
      toast.success('Menu image saved');
    } catch (err) {
      console.error('Failed to save menu image:', err);
      toast.error('Failed to save menu image');
    } finally {
      setSaving(false);
    }
  };

  if (!slug) {
    return <div className="min-h-screen bg-space flex items-center justify-center"><p className="text-ink-muted">No card specified.</p></div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-space flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-space flex flex-col">
        <Navbar onAuthClick={() => {}} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <h1 className="text-xl font-bold text-ink mb-2">Card Not Found</h1>
            <p className="text-ink-muted text-sm">{error}</p>
            <Link to="/" className="btn btn-primary btn-md no-underline inline-block mt-4">Home</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (menu.length === 0) {
    return (
      <div className="min-h-screen bg-space flex flex-col">
        <Navbar onAuthClick={() => {}} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <h1 className="text-xl font-bold text-ink mb-2">No Menu</h1>
            <p className="text-ink-muted text-sm">This card doesn't have a menu yet.</p>
            <Link to={`/card/${slug}`} className="btn btn-primary btn-md no-underline inline-block mt-4">View Card</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const subtitle = name ? (org ? `${name} · ${org}` : name) : org;

  return (
    <div className="min-h-screen bg-space text-ink">
      {/* Screen preview */}
      <div className="print:hidden">
        <Navbar onAuthClick={() => {}} />
        <main className="max-w-2xl mx-auto px-6 py-10 text-center">
          <h1 className="text-2xl font-extrabold mb-2">Printable Menu — {menuTitle}</h1>
          <p className="text-ink-muted text-sm mb-8">
            Display this menu at your storefront, event booth, or office. Standard 8.5"×11" letter size — just print and post.
          </p>

          {/* Menu preview */}
          <div ref={previewRef} className="inline-block bg-white rounded-2xl border border-line shadow-surface overflow-hidden w-full max-w-[400px]">
            <div className="flex flex-col p-8 sm:p-10 text-[#111827] text-left" style={{ width: '100%' }}>
              <img src="/nowncard-logo.png" alt="" className="h-7 w-auto object-contain mb-4 opacity-70 mx-auto" />
              <h1 className="text-2xl font-extrabold text-center flex items-center justify-center gap-2 mb-1">
                <MenuHeaderIcon value={card.menuIcon} className="w-6 h-6" /> {menuTitle}
              </h1>
              {subtitle && <p className="text-sm text-[#6b7280] text-center mb-5">{subtitle}</p>}

              {menu.map((cat, ci) => (
                <div key={ci} className={ci > 0 ? 'mt-5 pt-4 border-t border-[#e5e7eb]' : ''}>
                  <div className="flex items-center gap-2 mb-2">
                    {cat.image ? <img src={cat.image} alt="" className="w-9 h-9 rounded-lg object-cover border border-[#e5e7eb] flex-shrink-0" /> : null}
                    <h2 className="text-lg font-bold">{cat.name}</h2>
                  </div>
                  <div className="flex flex-col">
                    {cat.items.map((item, ii) => (
                      <div key={ii} className="flex items-baseline justify-between gap-3 py-1.5">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{item.name}</div>
                          {item.description ? <div className="text-xs text-[#6b7280]">{item.description}</div> : null}
                        </div>
                        {item.price ? <div className="text-sm font-bold whitespace-nowrap">{item.price}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="mt-6 pt-5 border-t border-[#e5e7eb] w-full text-center">
                <p className="text-[10px] text-[#9ca3af]">Powered by NownCard — nowncard.com</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <button onClick={() => window.print()} className="btn btn-primary btn-lg">
              <IconPrinter /> Print Menu
            </button>
            <button onClick={handleSaveImage} disabled={saving} className="btn btn-secondary btn-lg">
              <IconCamera /> {saving ? 'Saving…' : 'Save as Image'}
            </button>
            <Link to={`/card/${slug}`} className="btn btn-secondary btn-lg no-underline">
              View Card
            </Link>
          </div>
        </main>
        <Footer />
      </div>

      {/* Print-only: standard 8.5"×11" letter. Colors are explicit sRGB hex — the
          Tailwind v4 palette (oklch) renders with wrong saturation in print. */}
      <div className="hidden print:flex print:flex-col print:min-h-[11in] print:w-[8.5in] print:mx-auto print:bg-white print:text-[#111827] print:px-[1in] print:py-[0.75in]">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold mb-1 flex items-center justify-center gap-2">
            <MenuHeaderIcon value={card.menuIcon} className="w-7 h-7" /> {menuTitle}
          </h1>
          {subtitle && <p className="text-base text-[#6b7280] mb-1">{subtitle}</p>}
        </div>

        {menu.map((cat, ci) => (
          <div key={ci} className={ci > 0 ? 'mt-6 pt-5 border-t border-[#e5e7eb]' : ''}>
            <div className="flex items-center gap-2 mb-2">
              {cat.image ? <img src={cat.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-[#e5e7eb] flex-shrink-0" /> : null}
              <h2 className="text-xl font-bold">{cat.name}</h2>
            </div>
            <div className="flex flex-col">
              {cat.items.map((item, ii) => (
                <div key={ii} className="flex items-baseline justify-between gap-3 py-1.5">
                  <div className="min-w-0">
                    <div className="text-base font-medium">{item.name}</div>
                    {item.description ? <div className="text-sm text-[#6b7280]">{item.description}</div> : null}
                  </div>
                  {item.price ? <div className="text-base font-bold whitespace-nowrap">{item.price}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-auto pt-6 border-t border-[#e5e7eb] w-full text-center">
          <p className="text-xs text-[#9ca3af]">Powered by NownCard — nowncard.com</p>
        </div>
      </div>
    </div>
  );
}
