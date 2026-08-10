import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, getDocs, doc, limit, getDoc, orderBy, startAfter,
  getCountFromServer,
} from 'firebase/firestore';
import type { DocumentData, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/auth-context';
import { getPaymentDetails, getPricing } from '@/lib/payments';
import { adminMutation } from '@/lib/admin';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Navbar from '@/components/Navbar';
import {
  Shield, Search, KeyRound, CreditCard, BarChart3,
  Users, FileText, RefreshCw, TrendingUp, DollarSign,
  Eye, ExternalLink, Trash2, X, Star,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Review } from '@/types';

const BOOTSTRAP_ADMIN_UID = 'EeiBBDTu5jOooHbxyOC98JSlt6r1';

interface PendingUpgrade {
  id: string; uid: string; plan: string; price: number;
  orderId?: string; checkoutUrl?: string; createdAt: unknown;
  userEmail?: string;
}
interface CompletedUpgrade {
  id: string; uid: string; plan: string; price: number;
  paymentId?: string; orderId?: string; amountPaid?: number;
  cardBrand?: string; lastFour?: string; receiptUrl?: string;
  source?: string; appliedAt: unknown;
}
interface AdminUser {
  id: string; email: string; displayName?: string; plan: string; cardCount: number; isAdmin?: boolean;
}
interface AdminCard {
  id: string; slug: string; firstName?: string; lastName?: string;
  company?: string; jobTitle?: string; ownerUid?: string; isPublic?: boolean;
  viewCount?: number; createdAt?: unknown;
}

const TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'pricing', label: 'Pricing', icon: DollarSign },
  { key: 'pending', label: 'Pending', icon: Shield },
  { key: 'upgrades', label: 'Upgrades', icon: CreditCard },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'cards', label: 'Cards', icon: FileText },
  { key: 'reviews', label: 'Reviews', icon: Star },
] as const;

type TabKey = typeof TABS[number]['key'];

function fmtCents(amount?: number): string {
  if (!amount) return '-';
  return `$${(amount / 100).toFixed(2)}`;
}

function ts(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && 'toMillis' in (ts as Record<string, unknown>))
    return (ts as { toMillis: () => number }).toMillis();
  return 0;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [canBootstrap, setCanBootstrap] = useState(false);
  const [tab, setTab] = useState<TabKey>('overview');

  // --- Overview Stats ---
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [totalUpgrades, setTotalUpgrades] = useState(0);
  const [statsError, setStatsError] = useState(false);

  // --- Pricing ---
  const [proPriceStr, setProPriceStr] = useState('19');
  const [bizPriceStr, setBizPriceStr] = useState('39');
  const [savingPricing, setSavingPricing] = useState(false);

  // --- Pending ---
  const [pending, setPending] = useState<PendingUpgrade[]>([]);

  // --- Upgrades ---
  const [upgrades, setUpgrades] = useState<CompletedUpgrade[]>([]);
  const [upgradesLastDoc, setUpgradesLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [upgradesHasMore, setUpgradesHasMore] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<Record<string, Record<string, unknown>>>({});

  // --- Users ---
  const [userSearch, setUserSearch] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // --- Cards ---
  const [cardSearch, setCardSearch] = useState('');
  const [adminCards, setAdminCards] = useState<AdminCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);

  // --- Reviews ---
  const [reviews, setReviews] = useState<Review[]>([]);

  // --- Shared ---
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      const [usersSnap, cardsSnap, upgradesSnap] = await Promise.all([
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(collection(db, 'cards')),
        getCountFromServer(collection(db, 'upgrades')),
      ]);
      setTotalUsers(usersSnap.data().count);
      setTotalCards(cardsSnap.data().count);
      setTotalUpgrades(upgradesSnap.data().count);
      setStatsError(false);
    } catch {
      setStatsError(true);
    }
  };

  const loadPricing = async () => {
    const p = await getPricing();
    setProPriceStr(String(p.proPrice));
    setBizPriceStr(String(p.businessPrice));
  };

  // ---------- Load Pending ----------
  const loadPending = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'pendingUpgrades'), orderBy('createdAt', 'desc'), limit(50)));
      const list: PendingUpgrade[] = [];
      const uidSet = new Set<string>();
      for (const d of snap.docs) {
        const data = d.data();
        list.push({ id: d.id, ...data } as PendingUpgrade);
        uidSet.add(data.uid);
      }
      // Fetch user emails in parallel
      const userMap = new Map<string, string>();
      await Promise.all([...uidSet].map(async (uid) => {
        try {
          const uSnap = await getDoc(doc(db, 'users', uid));
          userMap.set(uid, uSnap.data()?.email || uid);
        } catch { userMap.set(uid, uid); }
      }));
      for (const p of list) p.userEmail = userMap.get(p.uid) || p.uid;
      list.sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
      setPending(list);
    } catch { toast.error('Failed to load pending'); }
  };

  // ---------- Load Upgrades (paginated) ----------
  const loadUpgrades = async (cursor?: QueryDocumentSnapshot<DocumentData>) => {
    try {
      let q = query(collection(db, 'upgrades'), orderBy('appliedAt', 'desc'), limit(20));
      if (cursor) q = query(collection(db, 'upgrades'), orderBy('appliedAt', 'desc'), startAfter(cursor), limit(20));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompletedUpgrade));
      if (cursor) setUpgrades((prev) => [...prev, ...list]);
      else setUpgrades(list);
      const last = snap.docs[snap.docs.length - 1] || null;
      setUpgradesLastDoc(last);
      setUpgradesHasMore(snap.docs.length === 20);
    } catch { toast.error('Failed to load upgrades'); }
  };

  const loadReviews = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(100)));
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review));
    } catch { toast.error('Failed to load reviews'); }
  };

  const toggleFeaturedReview = async (userId: string, featured: boolean) => {
    try {
      await adminMutation('toggleFeaturedReview', { userId, featured });
      toast.success('Review updated');
      loadReviews();
    } catch { toast.error('Failed to update review'); }
  };

  const deleteReview = async (userId: string) => {
    if (!confirm('Delete this review permanently?')) return;
    try {
      await adminMutation('deleteReview', { userId });
      toast.success('Review deleted');
      loadReviews();
    } catch { toast.error('Failed to delete review'); }
  };

  const loadPaymentDetail = async (orderId: string) => {
    if (paymentDetails[orderId]) return;
    try {
      const detail = await getPaymentDetails(orderId);
      setPaymentDetails((prev) => ({ ...prev, [orderId]: detail }));
    } catch { toast.error('Failed to load payment details'); }
  };

  // ---------- Load all users (paginated) + client-side search ----------
  const loadAllUsers = async () => {
    setUsersLoading(true);
    try {
      const all: AdminUser[] = [];
      let last: QueryDocumentSnapshot<DocumentData> | null = null;
      for (let i = 0; i < 10; i++) {
        const q = last
          ? query(collection(db, 'users'), orderBy('email'), startAfter(last), limit(200))
          : query(collection(db, 'users'), orderBy('email'), limit(200));
        const snap: QuerySnapshot<DocumentData> = await getDocs(q);
        if (snap.empty) break;
        snap.docs.forEach((d) => {
          const data = d.data();
          all.push({
            id: d.id, email: data.email || '-', displayName: data.displayName || '',
            plan: data.plan || 'free', cardCount: data.cardCount || 0, isAdmin: data.isAdmin || false,
          });
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.docs.length < 200) break;
      }
      all.sort((a, b) => a.email.localeCompare(b.email));
      setAdminUsers(all);
    } catch { toast.error('Failed to load users'); }
    setUsersLoading(false);
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return adminUsers;
    return adminUsers.filter((u) =>
      u.email.toLowerCase().includes(q)
      || (u.displayName || '').toLowerCase().includes(q)
      || u.id.toLowerCase().includes(q)
      || u.plan.toLowerCase().includes(q)
      || (u.isAdmin ? 'admin' : '').includes(q),
    );
  }, [adminUsers, userSearch]);

  // ---------- Load all cards (paginated) + client-side search ----------
  const loadAllCards = async () => {
    setCardsLoading(true);
    try {
      const all: AdminCard[] = [];
      let last: QueryDocumentSnapshot<DocumentData> | null = null;
      for (let i = 0; i < 10; i++) {
        const q = last
          ? query(collection(db, 'cards'), orderBy('createdAt', 'desc'), startAfter(last), limit(200))
          : query(collection(db, 'cards'), orderBy('createdAt', 'desc'), limit(200));
        const snap: QuerySnapshot<DocumentData> = await getDocs(q);
        if (snap.empty) break;
        snap.docs.forEach((d) => {
          const data = d.data();
          all.push({
            id: d.id, slug: data.slug || '', firstName: data.firstName,
            lastName: data.lastName, company: data.company, jobTitle: data.jobTitle,
            ownerUid: data.ownerUid, isPublic: data.isPublic, viewCount: data.viewCount || 0,
            createdAt: data.createdAt,
          } as AdminCard);
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.docs.length < 200) break;
      }
      setAdminCards(all);
    } catch { toast.error('Failed to load cards'); }
    setCardsLoading(false);
  };

  const filteredCards = useMemo(() => {
    const q = cardSearch.trim().toLowerCase();
    if (!q) return adminCards;
    return adminCards.filter((c) =>
      (c.slug || '').toLowerCase().includes(q)
      || (c.firstName || '').toLowerCase().includes(q)
      || (c.lastName || '').toLowerCase().includes(q)
      || (c.company || '').toLowerCase().includes(q)
      || (c.jobTitle || '').toLowerCase().includes(q)
      || (c.ownerUid || '').toLowerCase().includes(q)
      || String(c.isPublic ? 'public' : 'private').includes(q),
    );
  }, [adminCards, cardSearch]);

  // ---------- Actions ----------
  const approveUpgrade = async (upgradeId: string, uid: string, plan: string, price: number) => {
    setLoadingAction(upgradeId);
    try {
      await adminMutation('approveUpgrade', { upgradeId, uid, plan, price });
      toast.success(`Approved ${plan}`);
      loadPending();
      loadStats();
    } catch { toast.error('Failed to approve'); }
    setLoadingAction(null);
  };

  const savePricing = async () => {
    const pro = parseInt(proPriceStr, 10);
    const biz = parseInt(bizPriceStr, 10);
    if (isNaN(pro) || isNaN(biz) || pro < 1 || biz < 1) {
      toast.error('Enter valid prices');
      return;
    }
    setSavingPricing(true);
    try {
      await adminMutation('updatePricing', { proPrice: pro, businessPrice: biz });
      toast.success('Pricing updated');
    } catch { toast.error('Failed to save'); }
    setSavingPricing(false);
  };

  const rejectUpgrade = async (upgradeId: string) => {
    setLoadingAction(upgradeId);
    try {
      await adminMutation('rejectUpgrade', { upgradeId });
      toast.success('Rejected');
      loadPending();
    } catch { toast.error('Failed to reject'); }
    setLoadingAction(null);
  };

  const setPlan = async (uid: string, plan: string) => {
    try {
      await adminMutation('setPlan', { uid, plan });
      toast.success(`Plan → ${plan}`);
      loadAllUsers();
    } catch { toast.error('Failed to update plan'); }
  };

  const togglePublicCard = async (cardId: string, current: boolean) => {
    try {
      await adminMutation('toggleCardPublic', { cardId, current });
      toast.success(`Card ${!current ? 'public' : 'private'}`);
      loadAllCards();
    } catch { toast.error('Failed to toggle'); }
  };

  const deleteCard = async (cardId: string) => {
    if (!confirm('Delete this card permanently?')) return;
    try {
      await adminMutation('deleteCard', { cardId });
      toast.success('Card deleted');
      loadAllCards();
      loadStats();
    } catch { toast.error('Failed to delete card'); }
  };

  const handleBootstrap = async () => {
    if (!user) return;
    try {
      await httpsCallable(getFunctions(), 'bootstrapAdmin')();
      toast.success('You are now admin');
      setIsAdmin(true);
      setCanBootstrap(false);
      loadStats();
      loadPending();
      loadUpgrades();
      loadPricing();
    } catch { toast.error('Failed'); }
  };

  // ---------- Init ----------
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/'); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : null;
        if (data?.isAdmin) {
          setIsAdmin(true);
          loadStats();
          loadPending();
          loadUpgrades();
          loadPricing();
        } else if (user.uid === BOOTSTRAP_ADMIN_UID) {
          setCanBootstrap(true);
        } else {
          toast.error('Access denied');
          navigate('/dashboard');
        }
      } catch { navigate('/dashboard'); }
      finally { setCheckingAdmin(false); }
    })();
  }, [user, authLoading, navigate]);

  // ---------- Render ----------
  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-space flex flex-col items-center justify-center text-ink-muted">
        <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin mb-4" />
        <p>Checking access…</p>
      </div>
    );
  }

  if (canBootstrap) {
    return (
      <div className="min-h-screen bg-space flex flex-col items-center justify-center px-6">
        <div className="bg-tile border border-line rounded-2xl p-8 max-w-sm w-full text-center">
          <KeyRound className="w-10 h-10 text-accent mx-auto mb-4" />
          <h1 className="text-xl font-extrabold mb-2">Admin Setup</h1>
          <p className="text-sm text-ink-muted mb-6">This account is eligible for admin privileges.</p>
          <button onClick={handleBootstrap} className="btn btn-primary btn-md w-full">
            Activate Admin
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-space">
      <Navbar />

      <main className="max-w-6xl mx-auto px-5 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-extrabold">Admin Panel</h1>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-line overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); if (key === 'pending') loadPending(); if (key === 'overview') loadStats(); if (key === 'pricing') loadPricing(); if (key === 'reviews') loadReviews(); if (key === 'users') loadAllUsers(); if (key === 'cards') loadAllCards(); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 transition ${tab === key ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* ========================= OVERVIEW ========================= */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Total Users', value: totalUsers.toLocaleString(), icon: Users, color: 'text-blue-400' },
                { label: 'Total Cards', value: totalCards.toLocaleString(), icon: FileText, color: 'text-emerald-400' },
                { label: 'Total Upgrades', value: totalUpgrades.toLocaleString(), icon: TrendingUp, color: 'text-amber-400' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-tile border border-line rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wider mb-2">
                    <Icon className={`w-4 h-4 ${color}`} /> {label}
                  </div>
                  <div className="text-2xl font-extrabold">{value}</div>
                </div>
              ))}
            </div>
            {statsError && (
              <p className="text-xs text-danger">Could not load stats. Check the admin permissions.</p>
            )}
            <button onClick={loadStats} className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-accent transition">
              <RefreshCw className="w-3 h-3" /> Refresh stats
            </button>
          </div>
        )}

        {/* ========================= PRICING ========================= */}
        {tab === 'pricing' && (
          <section className="bg-tile border border-line rounded-2xl p-6 max-w-lg">
            <h2 className="text-lg font-extrabold mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-accent" /> Plan Pricing</h2>
            <p className="text-sm text-ink-muted mb-5">Changes apply immediately to the checkout flow on the landing page.</p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold w-24">Pro Plan</span>
                <span className="text-sm text-ink-muted">$</span>
                <input
                  type="number"
                  min={1}
                  value={proPriceStr}
                  onChange={(e) => setProPriceStr(e.target.value)}
                  className="w-20 px-3 py-2 bg-space border border-line rounded-lg text-ink text-sm font-bold focus:outline-none focus:border-accent"
                />
                <span className="text-sm text-ink-muted">/year</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold w-24">Business Plan</span>
                <span className="text-sm text-ink-muted">$</span>
                <input
                  type="number"
                  min={1}
                  value={bizPriceStr}
                  onChange={(e) => setBizPriceStr(e.target.value)}
                  className="w-20 px-3 py-2 bg-space border border-line rounded-lg text-ink text-sm font-bold focus:outline-none focus:border-accent"
                />
                <span className="text-sm text-ink-muted">/year</span>
              </div>
              <button
                onClick={savePricing}
                disabled={savingPricing}
                className="btn btn-primary btn-md"
              >
                {savingPricing ? 'Saving…' : 'Save Pricing'}
              </button>
            </div>
          </section>
        )}

        {/* ========================= PENDING ========================= */}
        {tab === 'pending' && (
          <section className="bg-tile border border-line rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold flex items-center gap-2"><Shield className="w-5 h-5 text-accent" /> Pending Upgrades</h2>
              <button onClick={loadPending} className="text-xs text-ink-muted hover:text-accent"><RefreshCw className="w-3.5 h-3.5" /></button>
            </div>
            {pending.length === 0 ? (
              <p className="text-sm text-ink-muted">No pending upgrades.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-ink-faint border-b border-line">
                    <tr>
                      <th className="text-left py-2 pr-4">User</th>
                      <th className="text-left py-2 pr-4">Plan</th>
                      <th className="text-left py-2 pr-4">Price</th>
                      <th className="text-left py-2 pr-4">Order</th>
                      <th className="text-left py-2 pr-4">Created</th>
                      <th className="text-right py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((p) => (
                      <tr key={p.id} className="border-b border-line-soft">
                        <td className="py-2 pr-4 text-xs">{p.userEmail || p.uid.slice(0, 14) + '…'}</td>
                        <td className="py-2 pr-4 capitalize font-semibold text-accent">{p.plan}</td>
                        <td className="py-2 pr-4">${p.price}</td>
                        <td className="py-2 pr-4 font-mono text-[11px] text-ink-faint">{p.orderId ? p.orderId.slice(0, 12) + '…' : '-'}</td>
                        <td className="py-2 pr-4 text-xs text-ink-muted">{ts(p.createdAt) ? new Date(ts(p.createdAt)).toLocaleDateString() : '-'}</td>
                        <td className="py-2 text-right flex gap-1.5 justify-end">
                          <button onClick={() => approveUpgrade(p.id, p.uid, p.plan, p.price)} disabled={loadingAction === p.id}
                            className="btn btn-primary btn-xs">
                            {loadingAction === p.id ? '…' : 'Approve'}
                          </button>
                          <button onClick={() => rejectUpgrade(p.id)} disabled={loadingAction === p.id}
                            className="btn btn-danger btn-xs">
                            <X className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ========================= UPGRADES ========================= */}
        {tab === 'upgrades' && (
          <section className="bg-tile border border-line rounded-2xl p-6">
            <h2 className="text-lg font-extrabold mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-accent" /> Completed Upgrades</h2>
            {upgrades.length === 0 ? (
              <p className="text-sm text-ink-muted">No completed upgrades.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-ink-faint border-b border-line">
                    <tr>
                      <th className="text-left py-2 pr-4">User</th>
                      <th className="text-left py-2 pr-4">Plan</th>
                      <th className="text-left py-2 pr-4">Amount</th>
                      <th className="text-left py-2 pr-4">Card</th>
                      <th className="text-left py-2 pr-4">Source</th>
                      <th className="text-left py-2 pr-4">Date</th>
                      <th className="text-left py-2 pr-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {upgrades.map((u) => (
                      <tr key={u.id} className="border-b border-line-soft">
                        <td className="py-2 pr-4 font-mono text-xs text-ink-muted">{u.uid.slice(0, 12)}…</td>
                        <td className="py-2 pr-4 capitalize font-semibold text-accent">{u.plan}</td>
                        <td className="py-2 pr-4">{fmtCents(u.amountPaid)}</td>
                        <td className="py-2 pr-4 text-xs">{u.cardBrand ? `${u.cardBrand} ••••${u.lastFour || ''}` : u.paymentId?.slice(0, 10) + '…' || '-'}</td>
                        <td className="py-2 pr-4 text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${u.source === 'square_webhook' ? 'bg-emerald-500/10 text-emerald-400' : u.source === 'admin_manual' ? 'bg-amber-500/10 text-amber-400' : 'bg-tile-soft text-ink-muted'}`}>
                            {u.source || 'unknown'}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-xs text-ink-muted whitespace-nowrap">{ts(u.appliedAt) ? new Date(ts(u.appliedAt)).toLocaleString() : '-'}</td>
                        <td className="py-2 pr-4">
                          {u.orderId && (
                            <button onClick={() => loadPaymentDetail(u.orderId!)} className="flex items-center gap-1 text-[11px] text-accent hover:underline">
                              <Eye className="w-3 h-3" /> Details
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {upgradesHasMore && (
              <button onClick={() => loadUpgrades(upgradesLastDoc || undefined)} className="mt-4 w-full py-2 text-sm font-semibold text-ink-muted hover:text-accent border border-line rounded-xl transition">
                Load More
              </button>
            )}
            {/* Payment detail popup */}
            {Object.entries(paymentDetails).map(([oid, detail]) => (
              <div key={oid} className="mt-4 bg-space border border-line rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-ink-muted uppercase">Order {oid.slice(0, 16)}…</span>
                  <button onClick={() => setPaymentDetails((prev) => { const n = { ...prev }; delete n[oid]; return n; })} className="text-ink-faint hover:text-ink"><X className="w-3.5 h-3.5" /></button>
                </div>
                <pre className="text-[11px] text-ink-muted whitespace-pre-wrap font-mono">{JSON.stringify(detail, null, 2)}</pre>
              </div>
            ))}
          </section>
        )}

        {/* ========================= USERS ========================= */}
        {tab === 'users' && (
          <section className="bg-tile border border-line rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-extrabold flex items-center gap-2"><Users className="w-5 h-5 text-accent" /> Users</h2>
              {!usersLoading && <span className="text-xs text-ink-faint">{filteredUsers.length} of {adminUsers.length} loaded</span>}
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by email, name, or plan…" className="w-full pl-9 pr-3 py-2 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            </div>
            {usersLoading ? (
              <p className="text-sm text-ink-muted">Loading users…</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-ink-muted">No users match your search.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-ink-faint border-b border-line">
                    <tr><th className="text-left py-2 pr-4">User</th><th className="text-left py-2 pr-4">Email</th><th className="text-left py-2 pr-4">Plan</th><th className="text-left py-2 pr-4">Cards</th><th className="text-left py-2 pr-4">Admin</th><th className="text-left py-2"></th></tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b border-line-soft">
                        <td className="py-2 pr-4 font-semibold">{u.displayName || '-'}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-ink-muted">{u.email}</td>
                        <td className="py-2 pr-4 capitalize font-semibold">{u.plan}</td>
                        <td className="py-2 pr-4">{u.cardCount}</td>
                        <td className="py-2 pr-4">{u.isAdmin ? <Shield className="w-3.5 h-3.5 text-accent" /> : '-'}</td>
                        <td className="py-2 flex gap-1.5">
                          {['free', 'pro', 'business'].map((plan) => (
                            <button key={plan} onClick={() => setPlan(u.id, plan)}
                              className={`btn btn-xs uppercase ${u.plan === plan ? 'btn-primary' : 'btn-secondary'}`}>
                              {plan}
                            </button>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ========================= CARDS ========================= */}
        {tab === 'cards' && (
          <section className="bg-tile border border-line rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-extrabold flex items-center gap-2"><FileText className="w-5 h-5 text-accent" /> Cards</h2>
              {!cardsLoading && <span className="text-xs text-ink-faint">{filteredCards.length} of {adminCards.length} loaded</span>}
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input value={cardSearch} onChange={(e) => setCardSearch(e.target.value)}
                placeholder="Search by slug, name, company, or owner…" className="w-full pl-9 pr-3 py-2 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            </div>
            {cardsLoading ? (
              <p className="text-sm text-ink-muted">Loading cards…</p>
            ) : filteredCards.length === 0 ? (
              <p className="text-sm text-ink-muted">No cards match your search.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-ink-faint border-b border-line">
                    <tr>
                      <th className="text-left py-2 pr-4">Card</th>
                      <th className="text-left py-2 pr-4">Slug</th>
                      <th className="text-left py-2 pr-4">Owner</th>
                      <th className="text-left py-2 pr-4">Public</th>
                      <th className="text-left py-2 pr-4">Views</th>
                      <th className="text-right py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCards.map((c) => (
                      <tr key={c.id} className="border-b border-line-soft">
                        <td className="py-2 pr-4 font-semibold">{[c.firstName, c.lastName].filter(Boolean).join(' ') || c.slug}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-ink-muted">{c.slug}</td>
                        <td className="py-2 pr-4 font-mono text-[11px] text-ink-faint">{c.ownerUid?.slice(0, 10)}…</td>
                        <td className="py-2 pr-4">
                          <button onClick={() => togglePublicCard(c.id, c.isPublic ?? true)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.isPublic ? 'bg-emerald-500/10 text-emerald-400' : 'bg-tile-soft text-ink-muted'}`}>
                            {c.isPublic ? 'Public' : 'Private'}
                          </button>
                        </td>
                        <td className="py-2 pr-4 text-xs text-ink-muted">{c.viewCount?.toLocaleString() || 0}</td>
                        <td className="py-2 text-right flex gap-1 justify-end">
                          <a href={`/card/${c.slug}`} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-tile-soft text-ink-muted transition" title="View">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button onClick={() => deleteCard(c.id)}
                            className="btn btn-danger btn-xs" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ========================= REVIEWS ========================= */}
        {tab === 'reviews' && (
          <section className="bg-tile border border-line rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold flex items-center gap-2"><Star className="w-5 h-5 text-accent" /> Reviews</h2>
              <button onClick={loadReviews} className="text-xs text-ink-muted hover:text-accent"><RefreshCw className="w-3.5 h-3.5" /></button>
            </div>
            {reviews.length === 0 ? (
              <p className="text-sm text-ink-muted">No reviews yet.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="border border-line rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="text-sm font-bold">{r.displayName || 'NownCard User'}</div>
                        {r.company && <div className="text-xs text-ink-muted">{r.company}</div>}
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-ink-faint'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-ink mb-3">"{r.content}"</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFeaturedReview(r.id, r.featured)}
                        className={`btn btn-xs ${r.featured ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        {r.featured ? 'Featured' : 'Feature'}
                      </button>
                      <button onClick={() => deleteReview(r.id)} className="btn btn-danger btn-xs" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
