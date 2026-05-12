import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ExternalLink, Download, Copy, Wand2, Nfc, BarChart3, Users, ClipboardCheck, Star, Search, X, Bell } from 'lucide-react';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useOneSignal } from '@/hooks/useOneSignal';
import { downloadVCard } from '@/lib/vcard';
import Navbar from '@/components/Navbar';
import type { Card } from '@/types';
import { toast } from 'sonner';

import { createDemoCard } from '@/lib/demo';
import { initials, getCardLimit } from '@/lib/utils';
import Footer from '@/components/Footer';

export default function DashboardPage() {
  const { user, userData, loading: authLoading, logOut } = useAuth();
  const { subscribed: pushSubscribed, ready: pushReady, enableNotifications } = useOneSignal(user?.uid);
  const navigate = useNavigate();
  const [personalCards, setPersonalCards] = useState<Card[]>([]);
  const [teamCards, setTeamCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string>('free');
  const [search, setSearch] = useState('');


  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/'); return; }

    // Messaging subscription paused for beta (prevents wasteful Firestore reads)
    // const messagesQuery = query(collection(db, 'messages'), where('recipientUid', '==', user.uid));
    // const unsub = onSnapshot(messagesQuery, ...);
    const unsub = () => {};

    (async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) setPlan(userSnap.data().plan || 'free');

        const [personalSnapUid, personalSnapId] = await Promise.all([
          getDocs(query(collection(db, 'cards'), where('ownerUid', '==', user.uid))),
          getDocs(query(collection(db, 'cards'), where('ownerId', '==', user.uid))),
        ]);
        const personalMap = new Map<string, Card>();
        [...personalSnapUid.docs, ...personalSnapId.docs].forEach((d) => {
          if (!personalMap.has(d.id)) personalMap.set(d.id, { id: d.id, ...d.data() } as Card);
        });
        const personalList = Array.from(personalMap.values()).filter((c) => !c.isTeamCard);

        const [teamSnapUid, teamSnapId] = await Promise.all([
          getDocs(query(collection(db, 'cards'), where('teamOwnerUid', '==', user.uid))),
          getDocs(query(collection(db, 'cards'), where('teamOwnerId', '==', user.uid))),
        ]);
        const teamMap = new Map<string, Card>();
        [...teamSnapUid.docs, ...teamSnapId.docs].forEach((d) => {
          if (!teamMap.has(d.id)) teamMap.set(d.id, { id: d.id, ...d.data() } as Card);
        });
        const teamList = Array.from(teamMap.values());

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

    return () => unsub();
  }, [user, authLoading, navigate]);

  const handleDelete = async (cardId: string) => {
    if (!confirm('Are you sure you want to delete this card? This cannot be undone.')) return;
    try {
      const deletedCard = [...personalCards, ...teamCards].find((c) => c.id === cardId);
      await deleteDoc(doc(db, 'cards', cardId));
      setPersonalCards(personalCards.filter((c) => c.id !== cardId));
      setTeamCards(teamCards.filter((c) => c.id !== cardId));
      // Clear defaultCardSlug if this was the default card
      if (deletedCard?.slug && userData?.defaultCardSlug === deletedCard.slug && user) {
        await setDoc(doc(db, 'users', user.uid), { defaultCardSlug: null }, { merge: true });
        toast.success('Card deleted — default card cleared');
      } else {
        toast.success('Card deleted');
      }
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

  const filteredPersonal = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return personalCards;
    return personalCards.filter((c) => {
      const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
      const company = (c.company || '').toLowerCase();
      const job = (c.jobTitle || '').toLowerCase();
      const slug = (c.slug || '').toLowerCase();
      const bio = (c.bio || '').toLowerCase();
      const phones = (c.phones || []).map((p) => p.number).join(' ').toLowerCase();
      const emails = (c.emails || []).map((e) => e.address).join(' ').toLowerCase();
      return name.includes(q) || company.includes(q) || job.includes(q) || slug.includes(q) || bio.includes(q) || phones.includes(q) || emails.includes(q);
    });
  }, [personalCards, search]);

  const filteredTeam = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teamCards;
    return teamCards.filter((c) => {
      const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
      const company = (c.company || '').toLowerCase();
      const job = (c.jobTitle || '').toLowerCase();
      const slug = (c.slug || '').toLowerCase();
      const bio = (c.bio || '').toLowerCase();
      const phones = (c.phones || []).map((p) => p.number).join(' ').toLowerCase();
      const emails = (c.emails || []).map((e) => e.address).join(' ').toLowerCase();
      return name.includes(q) || company.includes(q) || job.includes(q) || slug.includes(q) || bio.includes(q) || phones.includes(q) || emails.includes(q);
    });
  }, [teamCards, search]);

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
            className={`p-1 rounded transition cursor-pointer ${userData?.defaultCardSlug === c.slug ? 'text-accent' : 'text-ink-faint hover:text-accent'}`}
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
        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/card/${c.slug}`); toast.success('Link copied'); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition cursor-pointer">
          <Copy className="w-3 h-3" /> Copy
        </button>
        <button onClick={() => handleTogglePublic(c)} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition cursor-pointer">
          {c.isPublic ? 'Make Private' : 'Make Public'}
        </button>
        <button onClick={() => downloadVCard(c, undefined, `${window.location.origin}/card/${c.slug}`)} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition cursor-pointer">
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
        <button onClick={() => handleDelete(c.id!)} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-danger hover:border-danger transition cursor-pointer">
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
            <h1 className="text-2xl font-extrabold">My Cards</h1>
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
            {pushReady && !pushSubscribed && (
              <button
                onClick={enableNotifications}
                className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition"
                title="Get notified when someone sends you an inquiry"
              >
                <Bell className="w-3 h-3" /> Enable notifications
              </button>
            )}
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

        {/* Search */}
        {personalCards.length > 0 && (
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your cards by name, company, phone, email…"
              className="w-full pl-10 pr-10 py-3 bg-tile border border-line rounded-xl text-ink text-sm focus:outline-none focus:border-accent"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

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
          <div className="flex flex-col gap-4 mb-8">
            {filteredPersonal.map((c) => (
              <CardRow key={c.id} c={c} />
            ))}
            {filteredPersonal.length === 0 && search.trim() && (
              <div className="text-center py-8 text-ink-muted text-sm">No cards match your search.</div>
            )}
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
              <div className="flex flex-col gap-4">
                {filteredTeam.map((c) => (
                  <CardRow key={c.id} c={c} showTeamBadge />
                ))}
                {filteredTeam.length === 0 && search.trim() && (
                  <div className="text-center py-8 text-ink-muted text-sm">No team cards match your search.</div>
                )}
              </div>
            )}
          </>
        )}
        {/* Inquiries — hidden for beta (preserve backend for later)
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-extrabold">Inquiries</h2>
            {messages.filter((m) => !m.read).length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-accent text-space">
                {messages.filter((m) => !m.read).length} new
              </span>
            )}
          </div>

          {messagesLoading ? (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
              Loading inquiries…
            </div>
          ) : messages.length === 0 ? (
            <div className="bg-tile border border-line border-dashed rounded-2xl p-8 text-center">
              <MessageCircle className="w-8 h-8 text-ink-faint mx-auto mb-2" />
              <p className="text-sm text-ink-muted">No inquiries yet.</p>
              <p className="text-xs text-ink-faint mt-1">When someone sends you a message from your card page, it will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`bg-tile border rounded-2xl p-5 transition ${m.read ? 'border-line' : 'border-accent'}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{m.senderName}</span>
                        {!m.read && <span className="w-2 h-2 rounded-full bg-accent" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Mail className="w-3 h-3 text-ink-faint" />
                        <a
                          href={`mailto:${m.senderEmail}?subject=Re: Your inquiry on NownCard`}
                          className="text-xs text-ink-muted hover:text-accent truncate no-underline"
                        >
                          {m.senderEmail}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Link
                        to={`/card/${m.cardSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-tile-soft border border-line text-ink-muted hover:text-ink no-underline"
                      >
                        /card/{m.cardSlug}
                      </Link>
                      <span className="text-[11px] text-ink-faint whitespace-nowrap">{timeAgo(m.createdAt)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-ink mb-3 whitespace-pre-wrap">{m.content}</p>
                  <div className="flex items-center gap-2">
                    {!m.read && (
                      <button
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'messages', m.id), { read: true });
                          } catch {
                            toast.error('Failed to mark as read');
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition cursor-pointer"
                      >
                        <Check className="w-3 h-3" /> Mark as read
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm('Delete this inquiry?')) return;
                        try {
                          await deleteDoc(doc(db, 'messages', m.id));
                          toast.success('Inquiry deleted');
                        } catch {
                          toast.error('Failed to delete');
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-danger hover:border-danger transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div> */}
      </main>

      <Footer />
    </div>
  );
}
