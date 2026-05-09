import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, limit, QueryDocumentSnapshot, getDoc, setDoc } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/Navbar';
import { Search, Shield, User, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

const BOOTSTRAP_ADMIN_UID = 'EeiBBDTu5jOooHbxyOC98JSlt6r1';

export default function AdminPage() {
  const { user, userData, logOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [canBootstrap, setCanBootstrap] = useState(false);

  const [pending, setPending] = useState<{ id: string; uid: string; plan: string; price: number; createdAt: unknown }[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState<{ id: string; email: string; plan: string; cardCount: number }[]>([]);
  const [, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const loadPending = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'pendingUpgrades'), where('used', '==', false), limit(50)));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; uid: string; plan: string; price: number; createdAt: unknown }));
      list.sort((a, b) => {
        const aTime = a.createdAt && typeof a.createdAt === 'object' && 'toMillis' in a.createdAt ? (a.createdAt as { toMillis: () => number }).toMillis() : 0;
        const bTime = b.createdAt && typeof b.createdAt === 'object' && 'toMillis' in b.createdAt ? (b.createdAt as { toMillis: () => number }).toMillis() : 0;
        return bTime - aTime;
      });
      setPending(list);
    } catch { toast.error('Failed to load pending upgrades'); }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/'); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : null;
        if (data?.isAdmin) { setIsAdmin(true); loadPending(); }
        else if (user.uid === BOOTSTRAP_ADMIN_UID) { setCanBootstrap(true); }
        else { toast.error('Access denied'); navigate('/dashboard'); }
      } catch { navigate('/dashboard'); }
      finally { setCheckingAdmin(false); }
    })();
  }, [user, authLoading, navigate]);

  const searchUsers = async () => {
    try {
      const search = userSearch.trim();
      let q;
      if (search) {
        q = query(collection(db, 'users'), where('email', '>=', search), where('email', '<=', search + '\uf8ff'), limit(20));
      } else {
        // Simple query without orderBy to avoid composite index requirement
        q = query(collection(db, 'users'), limit(20));
      }
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, email: d.data().email || '-', plan: d.data().plan || 'free', cardCount: d.data().cardCount || 0 }));
      // Sort client-side to avoid needing a composite index
      list.sort((a, b) => a.email.localeCompare(b.email));
      setUsers(list);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
    } catch { toast.error('Search failed'); }
  };

  const approveUpgrade = async (upgradeId: string, uid: string, plan: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { plan, planUpdatedAt: serverTimestamp() });
      await updateDoc(doc(db, 'pendingUpgrades', upgradeId), { used: true, usedAt: serverTimestamp() });
      toast.success('Approved to ' + plan);
      loadPending();
    } catch { toast.error('Failed to approve'); }
  };

  const setPlan = async (uid: string, plan: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { plan, planUpdatedAt: serverTimestamp() });
      toast.success('Plan updated');
      searchUsers();
    } catch { toast.error('Failed to update plan'); }
  };

  const handleBootstrap = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { isAdmin: true, plan: 'business', planUpdatedAt: serverTimestamp() }, { merge: true });
      toast.success('You are now admin');
      setIsAdmin(true);
      setCanBootstrap(false);
      loadPending();
    } catch {
      toast.error('Failed to set admin');
    }
  };

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
          <p className="text-sm text-ink-muted mb-6">This account is eligible for admin privileges. Click below to activate admin access.</p>
          <button onClick={handleBootstrap} className="w-full px-5 py-2.5 bg-accent text-space font-bold rounded-full hover:brightness-110 transition">
            Activate Admin
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-space">
      <Navbar
        onAuthClick={() => navigate('/')}
        onSignOut={() => { logOut(); navigate('/'); }}
        userEmail={user?.email}
        isAdmin={true}
        defaultCardSlug={userData?.defaultCardSlug}
      />

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-8">
        {/* Pending Upgrades */}
        <section className="bg-tile border border-line rounded-2xl p-6">
          <h2 className="text-lg font-extrabold mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-accent" /> Pending Upgrades</h2>
          {pending.length === 0 ? (
            <p className="text-sm text-ink-muted">No pending upgrades.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-ink-faint border-b border-line">
                  <tr><th className="text-left py-2 pr-4">User</th><th className="text-left py-2 pr-4">Plan</th><th className="text-left py-2 pr-4">Price</th><th className="text-left py-2"></th></tr>
                </thead>
                <tbody>
                  {pending.map((p) => (
                    <tr key={p.id} className="border-b border-line-soft">
                      <td className="py-2 pr-4 font-mono text-xs text-ink-muted">{p.uid.slice(0, 12)}…</td>
                      <td className="py-2 pr-4 capitalize font-semibold text-accent">{p.plan}</td>
                      <td className="py-2 pr-4">${p.price}</td>
                      <td className="py-2 text-right">
                        <button onClick={() => approveUpgrade(p.id, p.uid, p.plan)} className="px-3 py-1 bg-accent text-space text-xs font-bold rounded-lg hover:brightness-110 transition">Approve</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* User Search */}
        <section className="bg-tile border border-line rounded-2xl p-6">
          <h2 className="text-lg font-extrabold mb-4 flex items-center gap-2"><User className="w-5 h-5 text-accent" /> Users</h2>
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchUsers()} placeholder="Search by email…" className="w-full pl-9 pr-3 py-2 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            </div>
            <button onClick={searchUsers} className="px-4 py-2 bg-accent text-space text-sm font-bold rounded-full hover:brightness-110 transition">Search</button>
          </div>
          {users.length === 0 ? (
            <p className="text-sm text-ink-muted">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-ink-faint border-b border-line">
                  <tr><th className="text-left py-2 pr-4">Email</th><th className="text-left py-2 pr-4">Plan</th><th className="text-left py-2 pr-4">Cards</th><th className="text-left py-2"></th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-line-soft">
                      <td className="py-2 pr-4">{u.email}</td>
                      <td className="py-2 pr-4 capitalize font-semibold">{u.plan}</td>
                      <td className="py-2 pr-4">{u.cardCount}</td>
                      <td className="py-2 flex gap-2">
                        {['free', 'pro', 'business'].map((plan) => (
                          <button key={plan} onClick={() => setPlan(u.id, plan)} className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${u.plan === plan ? 'bg-accent text-space' : 'bg-tile-soft text-ink-muted border border-line'}`}>{plan}</button>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
