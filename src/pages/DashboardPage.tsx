import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ExternalLink, Download, Copy, Wand2, Nfc, BarChart3, Users, ClipboardCheck, Star } from 'lucide-react';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { downloadVCard } from '@/lib/vcard';
import Navbar from '@/components/Navbar';
import type { Card } from '@/types';
import { toast } from 'sonner';

import { createDemoCard } from '@/lib/demo';
import { initials, getCardLimit } from '@/lib/utils';

export default function DashboardPage() {
  const { user, userData, loading: authLoading, logOut } = useAuth();
  const navigate = useNavigate();
  const [personalCards, setPersonalCards] = useState<Card[]>([]);
  const [teamCards, setTeamCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string>('free');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/'); return; }
    (async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) setPlan(userSnap.data().plan || 'free');

        // Load personal cards — query both ownerUid (new + old static app) and ownerId (legacy React cards)
        const [personalSnapUid, personalSnapId] = await Promise.all([
          getDocs(query(collection(db, 'cards'), where('ownerUid', '==', user.uid))),
          getDocs(query(collection(db, 'cards'), where('ownerId', '==', user.uid))),
        ]);
        const personalMap = new Map<string, Card>();
        [...personalSnapUid.docs, ...personalSnapId.docs].forEach((d) => {
          if (!personalMap.has(d.id)) personalMap.set(d.id, { id: d.id, ...d.data() } as Card);
        });
        const personalList = Array.from(personalMap.values()).filter((c) => !c.isTeamCard);

        // Load team cards — query both teamOwnerUid and teamOwnerId
        const [teamSnapUid, teamSnapId] = await Promise.all([
          getDocs(query(collection(db, 'cards'), where('teamOwnerUid', '==', user.uid))),
          getDocs(query(collection(db, 'cards'), where('teamOwnerId', '==', user.uid))),
        ]);
        const teamMap = new Map<string, Card>();
        [...teamSnapUid.docs, ...teamSnapId.docs].forEach((d) => {
          if (!teamMap.has(d.id)) teamMap.set(d.id, { id: d.id, ...d.data() } as Card);
        });
        const teamList = Array.from(teamMap.values());

        // Combine and sort by updatedAt
        const sortByUpdated = (a: Card, b: Card) => {
          const ta = a.updatedAt && typeof a.updatedAt === 'object' && 'toMillis' in a.updatedAt ? (a.updatedAt as unknown as { toMillis: () => number }).toMillis() : 0;
          const tb = b.updatedAt && typeof b.updatedAt === 'object' && 'toMillis' in b.updatedAt ? (b.updatedAt as unknown as { toMillis: () => number }).toMillis() : 0;
          return tb - ta;
        };

        personalList.sort(sortByUpdated);
        teamList.sort(sortByUpdated);

        setPersonalCards(personalList);
        setTeamCards(teamList);
      } catch {
        toast.error('Failed to load your cards');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, navigate]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this card?')) return;
    try {
      await deleteDoc(doc(db, 'cards', id));
      setPersonalCards(personalCards.filter((c) => c.id !== id));
      setTeamCards(teamCards.filter((c) => c.id !== id));
      toast.success('Card deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleTogglePublic = async (c: Card) => {
    if (!c.id) return;
    try {
      await updateDoc(doc(db, 'cards', c.id), { isPublic: !c.isPublic });
      const updater = (list: Card[]) => list.map((x) => x.id === c.id ? { ...x, isPublic: !x.isPublic } : x);
      setPersonalCards(updater);
      setTeamCards(updater);
      toast.success(c.isPublic ? 'Card is now private' : 'Card is now public');
    } catch {
      toast.error('Failed to update');
    }
  };

  const setDefaultCard = async (slug: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { defaultCardSlug: slug }, { merge: true });
      toast.success('Set as your default card');
    } catch {
      toast.error('Failed to set default card');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-space flex flex-col items-center justify-center text-ink-muted">
        <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin mb-4" />
        <p>Loading…</p>
      </div>
    );
  }

  const isBusiness = plan === 'business';

  const CardRow = ({ c, showTeamBadge }: { c: Card; showTeamBadge?: boolean }) => (
    <div className="bg-tile border border-line rounded-2xl p-5 hover:-translate-y-1 hover:shadow-surface transition">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {c.profileImage ? (
            <img src={c.profileImage} alt="" className="w-10 h-10 rounded-full object-cover border border-line flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#64748b] to-[#94a3b8] flex items-center justify-center text-sm font-extrabold text-white flex-shrink-0">
              {initials(c.firstName, c.lastName)}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-bold text-base truncate">{c.firstName} {c.lastName}</h3>
            <p className="text-xs text-ink-muted mt-0.5">/card/{c.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setDefaultCard(c.slug)}
            className={`p-1 rounded transition ${userData?.defaultCardSlug === c.slug ? 'text-accent' : 'text-ink-faint hover:text-accent'}`}
            title={userData?.defaultCardSlug === c.slug ? 'Your default card' : 'Set as default card'}
          >
            <Star className="w-3.5 h-3.5" fill={userData?.defaultCardSlug === c.slug ? 'currentColor' : 'none'} />
          </button>
          {showTeamBadge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-purple-950 text-purple-400 border border-purple-800">Team</span>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${c.isPublic ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-tile-soft text-ink-faint border border-line'}`}>{c.isPublic ? 'Public' : 'Private'}</span>
        </div>
      </div>

      <div className="text-sm text-ink-muted mb-2">
        {c.jobTitle}{c.jobTitle && c.company ? ' · ' : ''}{c.company}
      </div>
      <div className="text-xs text-ink-faint mb-4">
        {c.viewCount || 0} views · {c.saveCount || 0} saves
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to={`/card/${c.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition">
          <ExternalLink className="w-3 h-3" /> View
        </Link>
        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/card/${c.slug}`); toast.success('Link copied'); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition">
          <Copy className="w-3 h-3" /> Copy
        </button>
        <button onClick={() => handleTogglePublic(c)} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition">
          {c.isPublic ? 'Private' : 'Public'}
        </button>
        <button onClick={() => downloadVCard(c)} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition">
          <Download className="w-3 h-3" /> vCard
        </button>
        <Link to={`/nfc/${c.slug}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition">
          <Nfc className="w-3 h-3" /> NFC
        </Link>
        <Link to={`/analytics/${c.id}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition">
          <BarChart3 className="w-3 h-3" /> Analytics
        </Link>
        <Link to={`/editor/${c.id}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition">
          <Pencil className="w-3 h-3" /> Edit
        </Link>
        <button onClick={() => handleDelete(c.id!)} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-danger hover:border-danger transition">
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-space overflow-x-hidden">
      <Navbar onAuthClick={() => navigate('/')} onSignOut={() => { logOut(); navigate('/'); }} userEmail={user?.email} isAdmin={userData?.isAdmin} defaultCardSlug={userData?.defaultCardSlug} />

      <main className="max-w-4xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold">Your Cards</h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${plan === 'business' ? 'bg-purple-950 text-purple-400 border-purple-800' : plan === 'pro' ? 'bg-amber-950 text-amber-400 border-amber-800' : 'bg-tile-soft text-ink-faint border-line'}`}>
              {plan} · {personalCards.length}/{getCardLimit(plan) === Infinity ? '∞' : getCardLimit(plan)}
            </span>
            <button
              onClick={() => { navigator.clipboard.writeText(user?.uid || ''); toast.success('UID copied — share with your team admin'); }}
              className="flex items-center gap-1 text-[10px] text-ink-faint hover:text-ink transition"
              title="Copy your UID to share with a team admin"
            >
              <ClipboardCheck className="w-3 h-3" /> UID
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={async () => { if (!user) return; try { const result = await createDemoCard(user.uid); toast.success('Demo card created'); navigate(`/editor/${result.id}`); } catch { toast.error('Failed to create demo'); } }} className="flex items-center gap-1.5 px-3 py-2 border border-line text-ink text-xs font-bold rounded-full hover:bg-tile-soft transition">
              <Wand2 className="w-3.5 h-3.5" /> Demo
            </button>
            {plan === 'free' && (
              <Link to="/#pricing" className="px-4 py-2 bg-accent text-space text-sm font-bold rounded-full hover:brightness-110 transition cursor-pointer no-underline">
                Upgrade to Pro
              </Link>
            )}
            {(() => {
              const limit = getCardLimit(plan);
              const atLimit = personalCards.length >= limit;
              return atLimit ? (
                <button onClick={() => toast.error(`Your ${plan} plan allows ${limit === Infinity ? 'unlimited' : limit} personal card${limit === 1 ? '' : 's'}. Upgrade to create more.`)} className="flex items-center gap-2 px-4 py-2 bg-tile-soft border border-line text-ink-faint text-sm font-bold rounded-full cursor-not-allowed no-underline">
                  <Plus className="w-4 h-4" /> New Card
                </button>
              ) : (
                <Link to="/editor" className="flex items-center gap-2 px-4 py-2 bg-accent text-space text-sm font-bold rounded-full hover:brightness-110 transition no-underline">
                  <Plus className="w-4 h-4" /> New Card
                </Link>
              );
            })()}
          </div>
        </div>

        {/* Personal Cards */}
        {personalCards.length === 0 ? (
          <div className="bg-tile border border-line border-dashed rounded-2xl p-12 text-center mb-8">
            <p className="text-ink-muted mb-4">No personal cards yet.</p>
            {(() => {
              const limit = getCardLimit(plan);
              const atLimit = personalCards.length >= limit;
              return atLimit ? (
                <button onClick={() => toast.error(`Your ${plan} plan allows ${limit === Infinity ? 'unlimited' : limit} personal card${limit === 1 ? '' : 's'}. Upgrade to create more.`)} className="inline-flex items-center gap-2 px-6 py-2.5 bg-tile-soft border border-line text-ink-faint font-bold rounded-full text-sm cursor-not-allowed">
                  <Plus className="w-4 h-4" /> Create your first card
                </button>
              ) : (
                <Link to="/editor" className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent text-space font-bold rounded-full text-sm hover:brightness-110 transition">
                  <Plus className="w-4 h-4" /> Create your first card
                </Link>
              );
            })()}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
            {personalCards.map((c) => (
              <CardRow key={c.id} c={c} />
            ))}
          </div>
        )}

        {/* Team Cards */}
        {isBusiness && (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold">Team Cards</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-purple-950 text-purple-400 border border-purple-800">
                  {teamCards.length} member{teamCards.length === 1 ? '' : 's'}
                </span>
              </div>
              <Link
                to="/editor"
                state={{ isTeamCard: true }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-full hover:brightness-110 transition no-underline"
              >
                <Users className="w-4 h-4" /> Create Team Card
              </Link>
            </div>

            {teamCards.length === 0 ? (
              <div className="bg-tile border border-line border-dashed rounded-2xl p-8 text-center">
                <p className="text-sm text-ink-muted mb-2">No team cards yet.</p>
                <p className="text-xs text-ink-faint mb-4">Create cards for your employees. They won't count against anyone's plan limit.</p>
                <Link
                  to="/editor"
                  state={{ isTeamCard: true }}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-purple-600 text-white font-bold rounded-full text-sm hover:brightness-110 transition no-underline"
                >
                  <Users className="w-4 h-4" /> Create Team Card
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {teamCards.map((c) => (
                  <CardRow key={c.id} c={c} showTeamBadge />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
