import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, serverTimestamp, limit, QueryDocumentSnapshot } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Search, Shield, User } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const [pending, setPending] = useState<{ id: string; uid: string; plan: string; price: number; createdAt: unknown }[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState<{ id: string; email: string; plan: string; cardCount: number }[]>([]);
  const [, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/'); return; }
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
        const data = snap.empty ? null : snap.docs[0].data();
        if (data?.isAdmin) { setIsAdmin(true); loadPending(); }
        else { toast.error('Access denied'); navigate('/dashboard'); }
      } catch { navigate('/dashboard'); }
      finally { setCheckingAdmin(false); }
    })();
  }, [user, authLoading, navigate]);

  const loadPending = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'pendingUpgrades'), where('used', '==', false), orderBy('createdAt', 'desc'), limit(50)));
      setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; uid: string; plan: string; price: number; createdAt: unknown })));
    } catch { toast.error('Failed to load pending upgrades'); }
  };

  const searchUsers = async () => {
    try {
      const q = userSearch.trim()
        ? query(collection(db, 'users'), where('email', '>=', userSearch), where('email', '<=', userSearch + '\uf8ff'), limit(20))
        : query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(20));
      const snap = await getDocs(q);
      setUsers(snap.docs.map((d) => ({ id: d.id, email: d.data().email || '-', plan: d.data().plan || 'free', cardCount: d.data().cardCount || 0 })));
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

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-space flex flex-col items-center justify-center text-ink-muted">
        <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin mb-4" />
        <p>Checking access…</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-space">
      <header className="sticky top-0 z-40 bg-space/80 backdrop-blur-xl border-b border-line-soft">
        <div className="max-w-5xl mx-auto px-5 flex items-center justify-between h-14">
          <a href="/" className="flex items-center gap-2.5 text-ink font-bold text-[15px]">
            <img src="/nowncard-logo.png" alt="" className="h-[28px] w-auto object-contain rounded-lg" />
            <span>Admin</span>
          </a>
          <a href="/dashboard" className="text-sm font-medium text-ink-muted hover:text-ink transition">Dashboard</a>
        </div>
      </header>

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
