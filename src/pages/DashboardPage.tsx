import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ExternalLink, Download, Copy, Wand2, Nfc, BarChart3, Printer, Users, ClipboardCheck, Heart, Star, Search, X, Bell, MessageCircle, Mail, Check, Calendar, Clock } from 'lucide-react';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, getDoc, setDoc, onSnapshot, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/auth-context';
import { useFCM } from '@/hooks/useFCM';
import { downloadVCard } from '@/lib/vcard';
import Navbar from '@/components/Navbar';
import type { Appointment, Card, Message, Review } from '@/types';
import { toast } from 'sonner';

import { createDemoCard } from '@/lib/demo';
import { applyPendingUpgrades } from '@/lib/payments';
import { initials, getCardLimit, timeAgo } from '@/lib/utils';
import Footer from '@/components/Footer';

export default function DashboardPage() {
  const { user, userData, loading: authLoading } = useAuth();
  const { subscribed: pushSubscribed, ready: pushReady, enableNotifications } = useFCM(user?.uid);
  const navigate = useNavigate();
  const [personalCards, setPersonalCards] = useState<Card[]>([]);
  const [teamCards, setTeamCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string>('free');
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cards' | 'inquiries' | 'appointments' | 'review'>('cards');

  const [myReview, setMyReview] = useState<Review | null>(null);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewCompany, setReviewCompany] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/'); return; }
    const mounted = { current: true };

    const messagesQuery = query(
      collection(db, 'messages'),
      where('recipientUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );
    const appointmentsQuery = query(
      collection(db, 'appointments'),
      where('ownerUid', '==', user.uid),
      orderBy('requestedDate', 'asc'),
      orderBy('requestedTime', 'asc'),
    );
    const unsubMessages = onSnapshot(messagesQuery, (snap) => {
      if (!mounted.current) return;
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
      list.sort((a, b) => {
        const aTime = a.createdAt && typeof a.createdAt === 'object' && 'toMillis' in (a.createdAt as unknown as Record<string, unknown>) ? (a.createdAt as unknown as { toMillis: () => number }).toMillis() : 0;
        const bTime = b.createdAt && typeof b.createdAt === 'object' && 'toMillis' in (b.createdAt as unknown as Record<string, unknown>) ? (b.createdAt as unknown as { toMillis: () => number }).toMillis() : 0;
        return bTime - aTime;
      });
      setMessages(list);
      setMessagesLoading(false);
    }, () => {
      if (!mounted.current) return;
      setMessagesLoading(false);
    });

    const unsubAppointments = onSnapshot(appointmentsQuery, (snap) => {
      if (!mounted.current) return;
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment));
      setAppointments(list);
      setAppointmentsLoading(false);
    }, () => {
      if (!mounted.current) return;
      setAppointmentsLoading(false);
    });

    (async () => {
      try {
        applyPendingUpgrades(user.uid).catch(() => {});
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

        try {
          const snap = await getDoc(doc(db, 'reviews', user.uid));
          if (snap.exists()) {
            const data = snap.data() as Omit<Review, 'id'>;
            setMyReview({ id: user.uid, ...data });
            setRating(data.rating ?? 5);
            setReviewCompany(data.company ?? '');
            setReviewText(data.content ?? '');
          } else {
            setMyReview(null);
          }
        } catch {
          // rules deny read for non-featured reviews the user doesn't own — ignore
        } finally {
          setReviewLoading(false);
        }

        if (!mounted.current) return;
        setPersonalCards(personalList);
        setTeamCards(teamList);
      } catch {
        toast.error('Failed to load your cards');
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();

    return () => {
      mounted.current = false;
      unsubMessages();
      unsubAppointments();
    };
  }, [user, authLoading, navigate]);

  const handleSaveReview = async () => {
    if (!user) return;
    if (!reviewText.trim()) { toast.error('Please write a short review'); return; }
    setSavingReview(true);
    try {
      const payload = {
        userId: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'NownCard User',
        company: reviewCompany.trim(),
        email: user.email || null,
        rating,
        content: reviewText.trim(),
        featured: false,
        createdAt: myReview?.createdAt ?? serverTimestamp(),
      };
      await setDoc(doc(db, 'reviews', user.uid), payload, { merge: true });
      setMyReview({ id: user.uid, ...payload } as Review);
      toast.success('Thanks for your feedback!');
    } catch {
      toast.error('Failed to save review — make sure you are signed in');
    } finally {
      setSavingReview(false);
    }
  };

  const handleDelete = async (cardId: string) => {
    if (!confirm('Are you sure you want to delete this card? This cannot be undone.')) return;
    try {
      const deletedCard = [...personalCards, ...teamCards].find((c) => c.id === cardId);
      await deleteDoc(doc(db, 'cards', cardId));
      setPersonalCards(personalCards.filter((c) => c.id !== cardId));
      setTeamCards(teamCards.filter((c) => c.id !== cardId));
      // Clear favorite slots if this was a favorite card
      if (deletedCard?.slug && user) {
        const updates: Record<string, null> = {};
        if (userData?.defaultCardSlug === deletedCard.slug) updates.defaultCardSlug = null;
        if (userData?.secondaryCardSlug === deletedCard.slug) updates.secondaryCardSlug = null;
        if (Object.keys(updates).length > 0) {
          await setDoc(doc(db, 'users', user.uid), updates, { merge: true });
          toast.success('Card deleted — favorite slot cleared');
          return;
        }
      }
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
      toast.success('Set as your heart favorite');
    } catch {
      toast.error('Failed to set favorite');
    }
  };

  const setSecondaryCard = async (slug: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { secondaryCardSlug: slug }, { merge: true });
      toast.success('Set as your star favorite');
    } catch {
      toast.error('Failed to set second favorite');
    }
  };

  const updateAppointmentStatus = async (id: string, status: 'confirmed' | 'cancelled') => {
    try {
      await updateDoc(doc(db, 'appointments', id), { status, updatedAt: serverTimestamp() });
      toast.success(`Appointment ${status}`);
    } catch {
      toast.error('Failed to update appointment');
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!confirm('Delete this appointment?')) return;
    try {
      await deleteDoc(doc(db, 'appointments', id));
      toast.success('Appointment deleted');
    } catch {
      toast.error('Failed to delete appointment');
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
            title={userData?.defaultCardSlug === c.slug ? 'Heart favorite' : 'Set as heart favorite'}
          >
            <Heart className="w-3.5 h-3.5" fill={userData?.defaultCardSlug === c.slug ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => setSecondaryCard(c.slug)}
            className={`p-1 rounded transition cursor-pointer ${userData?.secondaryCardSlug === c.slug ? 'text-blue-400' : 'text-ink-faint hover:text-blue-400'}`}
            title={userData?.secondaryCardSlug === c.slug ? 'Star favorite' : 'Set as star favorite'}
          >
            <Star className="w-3.5 h-3.5" fill={userData?.secondaryCardSlug === c.slug ? 'currentColor' : 'none'} />
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
        <Link to={`/poster/${c.slug}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition">
          <Printer className="w-3 h-3" /> Poster
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
    <div className="min-h-screen bg-space">
      <Navbar messageCount={messages.filter((m) => !m.read).length} />

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

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-line">
          {[
            { key: 'cards', label: 'My Cards', badge: null },
            { key: 'inquiries', label: 'Inquiries', badge: messages.filter((m) => !m.read).length || null },
            { key: 'appointments', label: 'Appointments', badge: appointments.filter((a) => a.status === 'pending').length || null },
            { key: 'review', label: 'Feedback', badge: null },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition ${activeTab === t.key ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'}`}
            >
              {t.label}
              {t.badge !== null && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-space">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'cards' && (
          <>
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
      </>
    )}

    {activeTab === 'inquiries' && (
          <div>
            {/* Inquiries */}
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
                            toast.success('Marked as read');
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
        </div>
        )}

        {activeTab === 'appointments' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-extrabold">Appointments</h2>
              {appointments.filter((a) => a.status === 'pending').length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-accent text-space">
                  {appointments.filter((a) => a.status === 'pending').length} pending
                </span>
              )}
            </div>

            {appointmentsLoading ? (
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
                Loading appointments…
              </div>
            ) : appointments.length === 0 ? (
              <div className="bg-tile border border-line border-dashed rounded-2xl p-8 text-center">
                <Calendar className="w-8 h-8 text-ink-faint mx-auto mb-2" />
                <p className="text-sm text-ink-muted">No appointments yet.</p>
                <p className="text-xs text-ink-faint mt-1">When someone books time from your card page, it will appear here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {appointments.map((a) => (
                  <div
                    key={a.id}
                    className={`bg-tile border rounded-2xl p-5 transition ${a.status === 'pending' ? 'border-accent' : a.status === 'confirmed' ? 'border-emerald-500' : 'border-line'}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{a.requesterName}</span>
                          {a.status === 'pending' && <span className="w-2 h-2 rounded-full bg-accent" />}
                          {a.status === 'confirmed' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800">Confirmed</span>}
                          {a.status === 'cancelled' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-tile-soft text-ink-faint border border-line">Cancelled</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Mail className="w-3 h-3 text-ink-faint" />
                          <a href={`mailto:${a.requesterEmail}`} className="text-xs text-ink-muted hover:text-accent truncate no-underline">
                            {a.requesterEmail}
                          </a>
                        </div>
                        {a.requesterPhone && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-ink-muted">{a.requesterPhone}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Link
                          to={`/card/${a.cardSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-tile-soft border border-line text-ink-muted hover:text-ink no-underline"
                        >
                          /card/{a.cardSlug}
                        </Link>
                        <span className="text-[11px] text-ink-faint whitespace-nowrap">{timeAgo(a.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-3 text-sm text-ink">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-ink-faint" /> {a.requestedDate}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-ink-faint" /> {a.requestedTime}</span>
                      <span className="text-ink-faint">{a.timezone}</span>
                    </div>
                    {a.notes && <p className="text-sm text-ink mb-3 whitespace-pre-wrap">{a.notes}</p>}
                    <div className="flex items-center gap-2">
                      {a.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateAppointmentStatus(a.id, 'confirmed')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-950 border border-emerald-800 rounded-lg text-xs font-semibold text-emerald-400 hover:bg-emerald-900 transition cursor-pointer"
                          >
                            <Check className="w-3 h-3" /> Confirm
                          </button>
                          <button
                            onClick={() => updateAppointmentStatus(a.id, 'cancelled')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-danger hover:text-danger transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => deleteAppointment(a.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-danger hover:border-danger transition cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'review' && (
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-extrabold">Feedback</h2>
            </div>
            <p className="text-sm text-ink-muted mb-5 max-w-lg">
              Tell us what you think about NownCard. Your review helps us improve and may be featured on the homepage.
            </p>

            {reviewLoading ? (
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
                Loading…
              </div>
            ) : (
              <div className="bg-tile border border-line rounded-2xl p-6 max-w-xl">
                {/* Star rating */}
                <div className="flex items-center gap-1 mb-5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="cursor-pointer transition-transform hover:scale-110"
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    >
                      <Star
                        className={`w-7 h-7 ${n <= (hoverRating || rating) ? 'text-amber-400 fill-amber-400' : 'text-ink-faint'}`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-ink-muted">
                    {rating === 5 ? 'Excellent' : rating === 4 ? 'Great' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
                  </span>
                </div>

                <input
                  value={reviewCompany}
                  onChange={(e) => setReviewCompany(e.target.value)}
                  placeholder="Your company / business (optional)"
                  className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent mb-3"
                />

                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="What do you like about NownCard? How has it helped your business?"
                  rows={4}
                  maxLength={1000}
                  className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent resize-none mb-2"
                />
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] text-ink-faint">{reviewText.length}/1000</span>
                  {myReview && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800">Submitted</span>}
                </div>

                <button
                  onClick={handleSaveReview}
                  disabled={savingReview || !reviewText.trim()}
                  className="px-5 py-2.5 bg-accent text-space text-sm font-bold rounded-full hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {savingReview ? 'Saving…' : (myReview ? 'Update Review' : 'Submit Review')}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
