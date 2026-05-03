import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ExternalLink, Download } from 'lucide-react';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { downloadVCard } from '@/lib/vcard';
import type { Card } from '@/types';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/'); return; }
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'cards'),
          where('ownerId', '==', user.uid)
        ));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Card));
        list.sort((a, b) => {
          const ta = a.updatedAt && typeof a.updatedAt === 'object' && 'toMillis' in a.updatedAt ? (a.updatedAt as unknown as { toMillis: () => number }).toMillis() : 0;
          const tb = b.updatedAt && typeof b.updatedAt === 'object' && 'toMillis' in b.updatedAt ? (b.updatedAt as unknown as { toMillis: () => number }).toMillis() : 0;
          return tb - ta;
        });
        setCards(list);
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
      setCards(cards.filter((c) => c.id !== id));
      toast.success('Card deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleTogglePublic = async (c: Card) => {
    if (!c.id) return;
    try {
      await updateDoc(doc(db, 'cards', c.id), { isPublic: !c.isPublic });
      setCards(cards.map((x) => x.id === c.id ? { ...x, isPublic: !x.isPublic } : x));
      toast.success(c.isPublic ? 'Card is now private' : 'Card is now public');
    } catch {
      toast.error('Failed to update');
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

  return (
    <div className="min-h-screen bg-space">
      <header className="sticky top-0 z-40 bg-space/80 backdrop-blur-xl border-b border-line-soft">
        <div className="max-w-4xl mx-auto px-5 flex items-center justify-between h-14">
          <a href="/" className="flex items-center gap-2.5 text-ink font-bold text-[15px]">
            <img src="/nowncard-logo.png" alt="" className="h-[28px] w-auto object-contain rounded-lg" />
            <span>NownCard</span>
          </a>
          <a href="/editor" className="flex items-center gap-2 px-4 py-2 bg-accent text-space text-sm font-bold rounded-full hover:brightness-110 transition">
            <Plus className="w-4 h-4" /> New Card
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-extrabold mb-6">Your Cards</h1>

        {cards.length === 0 ? (
          <div className="bg-tile border border-line border-dashed rounded-2xl p-12 text-center">
            <p className="text-ink-muted mb-4">No cards yet.</p>
            <a href="/editor" className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent text-space font-bold rounded-full text-sm hover:brightness-110 transition">
              <Plus className="w-4 h-4" /> Create your first card
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {cards.map((c) => (
              <div key={c.id} className="bg-tile border border-line rounded-2xl p-5 hover:-translate-y-1 hover:shadow-surface transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-base">{c.firstName} {c.lastName}</h3>
                    <p className="text-xs text-ink-muted mt-0.5">/{c.slug}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${c.isPublic ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-tile-soft text-ink-faint border border-line'}`}>{c.isPublic ? 'Public' : 'Private'}</span>
                  </div>
                </div>

                <div className="text-sm text-ink-muted mb-4">
                  {c.jobTitle}{c.jobTitle && c.company ? ' · ' : ''}{c.company}
                </div>

                <div className="flex flex-wrap gap-2">
                  <a href={`/${c.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition">
                    <ExternalLink className="w-3 h-3" /> View
                  </a>
                  <button onClick={() => handleTogglePublic(c)} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition">
                    {c.isPublic ? 'Make Private' : 'Make Public'}
                  </button>
                  <button onClick={() => downloadVCard(c)} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition">
                    <Download className="w-3 h-3" /> vCard
                  </button>
                  <a href={`/editor/${c.id}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-ink hover:border-accent transition">
                    <Pencil className="w-3 h-3" /> Edit
                  </a>
                  <button onClick={() => handleDelete(c.id!)} className="flex items-center gap-1.5 px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs font-semibold text-danger hover:border-danger transition">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
