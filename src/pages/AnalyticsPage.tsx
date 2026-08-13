import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, Download, RotateCcw, Clock, MousePointer, Smartphone, Monitor, Tablet } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/auth-context';
import Navbar from '@/components/Navbar';
import BackLink from '@/components/BackLink';
import type { Card } from '@/types';
import { toast } from 'sonner';

interface AnalyticsData {
  taps?: Record<string, number>;
  timeOnPage?: number;
  device?: string;
  referrer?: string;
  updatedAt?: unknown;
}

const IconDevice = ({ type }: { type?: string }) => {
  if (type === 'mobile') return <Smartphone className="w-4 h-4" />;
  if (type === 'tablet') return <Tablet className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
};

export default function AnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/'); return; }
    if (!id) { navigate('/dashboard'); return; }

    (async () => {
      try {
        const cardSnap = await getDoc(doc(db, 'cards', id));
        if (!cardSnap.exists()) {
          toast.error('Card not found');
          navigate('/dashboard');
          return;
        }
        const cardData = { id: cardSnap.id, ...cardSnap.data() } as Card;
        const isCardOwner = [cardData.ownerUid, cardData.ownerId, cardData.teamOwnerUid, cardData.teamOwnerId].filter(Boolean).includes(user.uid);
        if (!isCardOwner) {
          toast.error('Not authorized');
          navigate('/dashboard');
          return;
        }
        setCard(cardData);

        const analyticsSnap = await getDoc(doc(db, 'analytics', id));
        if (analyticsSnap.exists()) {
          setAnalytics(analyticsSnap.data() as AnalyticsData);
        }
      } catch {
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-space flex flex-col items-center justify-center text-ink-muted">
        <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin mb-4" />
        <p>Loading analytics…</p>
      </div>
    );
  }

  if (!card) return null;

  const taps = analytics?.taps || {};
  const totalTaps = Object.values(taps).reduce((a, b) => a + b, 0);
  const flipCount = taps.flip || 0;
  const saveCount = card.saveCount || 0;
  const viewCount = card.viewCount || 0;
  const timeOnPage = analytics?.timeOnPage || 0;

  const tapBreakdown = Object.entries(taps)
    .filter(([k]) => k !== 'flip')
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-space">
      <Navbar />

      <main className="max-w-3xl xl:max-w-4xl mx-auto px-5 py-8">
        <div className="flex items-center gap-3 mb-6">
          <BackLink to="/dashboard">Back to Dashboard</BackLink>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-extrabold mb-1">Analytics</h1>
          <p className="text-sm text-ink-muted">
            {card.firstName} {card.lastName} · /card/{card.slug}
          </p>
        </div>

        {/* Overview stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-tile border border-line rounded-2xl p-4">
            <div className="flex items-center gap-2 text-ink-muted mb-2">
              <Eye className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Views</span>
            </div>
            <div className="text-2xl font-extrabold">{viewCount.toLocaleString()}</div>
          </div>
          <div className="bg-tile border border-line rounded-2xl p-4">
            <div className="flex items-center gap-2 text-ink-muted mb-2">
              <Download className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Saves</span>
            </div>
            <div className="text-2xl font-extrabold">{saveCount.toLocaleString()}</div>
          </div>
          <div className="bg-tile border border-line rounded-2xl p-4">
            <div className="flex items-center gap-2 text-ink-muted mb-2">
              <RotateCcw className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Flips</span>
            </div>
            <div className="text-2xl font-extrabold">{flipCount.toLocaleString()}</div>
          </div>
          <div className="bg-tile border border-line rounded-2xl p-4">
            <div className="flex items-center gap-2 text-ink-muted mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Time</span>
            </div>
            <div className="text-2xl font-extrabold">{Math.round(timeOnPage / 60)}m</div>
          </div>
        </div>

        {/* Engagement */}
        <div className="bg-tile border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <MousePointer className="w-4 h-4 text-ink-muted" /> Engagement
          </h2>
          {tapBreakdown.length === 0 ? (
            <p className="text-sm text-ink-muted">No engagement data yet.</p>
          ) : (
            <div className="space-y-3">
              {tapBreakdown.map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-sm text-ink-muted w-24 shrink-0 capitalize">{type.replace(':', ' ')}</span>
                  <div className="flex-1 h-2 bg-space rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${totalTaps ? (count / totalTaps) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold w-10 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Device & referrer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-tile border border-line rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-ink-muted" /> Device
            </h2>
            {analytics?.device ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-tile-soft border border-line flex items-center justify-center text-ink">
                  <IconDevice type={analytics.device} />
                </div>
                <div>
                  <div className="font-bold capitalize">{analytics.device}</div>
                  <div className="text-xs text-ink-muted">Last visitor</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No device data yet.</p>
            )}
          </div>

          <div className="bg-tile border border-line rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-ink-muted" /> Referrer
            </h2>
            {analytics?.referrer ? (
              <div>
                <div className="font-bold text-sm truncate">{analytics.referrer}</div>
                <div className="text-xs text-ink-muted mt-0.5">Last visitor source</div>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No referrer data yet.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
