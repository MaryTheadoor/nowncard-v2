import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { downloadVCard } from '@/lib/vcard';
import { slugify, getCardLimit, GOOGLE_FONTS } from '@/lib/utils';
import type { Card, SocialLink } from '@/types';
import { toast } from 'sonner';

const defaultCard: Omit<Card, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'> = {
  slug: '', firstName: '', lastName: '', jobTitle: '', company: '',
  phones: [], emails: [], websites: [], addresses: [], socialLinks: [],
  accentColor: '#e8a628', cardTheme: 'light', isPublic: true,
  viewCount: 0, saveCount: 0, bio: '', nameLayout: 'personal',
};

export default function EditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, loading: authLoading } = useAuth();
  const [card, setCard] = useState<Partial<Card>>(defaultCard);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isNewTeamCard = !id && (location.state as { isTeamCard?: boolean } | null)?.isTeamCard === true;

  // Load selected Google Font for live preview
  useEffect(() => {
    if (!card.fontFamily || card.fontFamily === 'Manrope') return;
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(card.fontFamily)}:wght@400;500;600;700;800&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [card.fontFamily]);

  // Load custom font for live preview
  useEffect(() => {
    if (!card.customFontUrl) return;
    const style = document.createElement('style');
    style.textContent = `@font-face { font-family: 'EditorCustomFont'; src: url('${card.customFontUrl}'); font-weight: 400 800; font-display: swap; }`;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [card.customFontUrl]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/'); return; }
    (async () => {
      if (!id) {
        if (isNewTeamCard) {
          setCard((prev) => ({ ...prev, isTeamCard: true, teamOwnerUid: user.uid }));
        }
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'cards', id));
        const data = snap.data();
        if (snap.exists() && (data?.ownerUid === user.uid || data?.teamOwnerUid === user.uid)) {
          setCard(data as Card);
        } else {
          toast.error('Card not found');
          navigate('/dashboard');
        }
      } catch {
        toast.error('Failed to load card');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user, authLoading, navigate, isNewTeamCard]);

  const handleSave = async () => {
    if (!user) return;
    if (!card.slug) { toast.error('Slug is required'); return; }
    if (!card.firstName && !card.lastName) { toast.error('Name is required'); return; }

    setSaving(true);
    try {
      const slug = slugify(card.slug);

      // Strip Firestore metadata fields so we don't send them back
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, createdAt: _ca, updatedAt: _ua, ownerUid: _oi, ...rest } = card as Record<string, unknown>;

      // Strip empty array entries so we don't save blanks
      if (Array.isArray(rest.phones)) rest.phones = rest.phones.filter((p: unknown) => (p as { number?: string }).number?.trim());
      if (Array.isArray(rest.emails)) rest.emails = rest.emails.filter((e: unknown) => (e as { address?: string }).address?.trim());
      if (Array.isArray(rest.websites)) rest.websites = rest.websites.filter((w: unknown) => (w as { url?: string }).url?.trim());
      if (Array.isArray(rest.addresses)) rest.addresses = rest.addresses.filter((a: unknown) => {
        const ad = a as { street?: string; city?: string; state?: string; zip?: string; country?: string };
        return ad.street?.trim() || ad.city?.trim() || ad.state?.trim() || ad.zip?.trim() || ad.country?.trim();
      });
      if (Array.isArray(rest.socialLinks)) rest.socialLinks = rest.socialLinks.filter((s: unknown) => (s as { url?: string }).url?.trim());

      // Strip undefined values — Firestore rejects them
      const stripUndefined = (obj: Record<string, unknown>): Record<string, unknown> => {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value === undefined) continue;
          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = stripUndefined(value as Record<string, unknown>);
          } else {
            result[key] = value;
          }
        }
        return result;
      };

      const data = stripUndefined({
        ...rest,
        slug,
        updatedAt: serverTimestamp(),
      });

      // Check slug uniqueness (scoped to user's cards to satisfy Firestore rules)
      const existing = await getDocs(query(collection(db, 'cards'), where('slug', '==', slug), where('ownerUid', '==', user.uid)));
      const taken = existing.docs.some((d) => d.id !== id);
      if (taken) { toast.error('That slug is taken'); setSaving(false); return; }

      if (id) {
        await updateDoc(doc(db, 'cards', id), data);
        toast.success('Card saved');
      } else {
        // Enforce plan card limit (team cards don't count)
        if (!data.isTeamCard) {
          const userCards = await getDocs(query(collection(db, 'cards'), where('ownerUid', '==', user.uid)));
          const personalCount = userCards.docs.filter((d) => !d.data().isTeamCard).length;
          const limit = getCardLimit(userData?.plan);
          if (personalCount >= limit) {
            toast.error(`Your ${userData?.plan || 'free'} plan allows ${limit === Infinity ? 'unlimited' : limit} personal card${limit === 1 ? '' : 's'}. Upgrade to create more.`);
            setSaving(false);
            return;
          }
        }
        data.ownerUid = user.uid;
        data.createdAt = serverTimestamp();
        const ref = doc(collection(db, 'cards'));
        await setDoc(ref, data);
        toast.success('Card saved');
        navigate(`/editor/${ref.id}`);
      }
    } catch (err: unknown) {
      console.error('Save error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleFontUpload = async (file: File) => {
    if (!user) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext || '')) {
      toast.error('Please upload TTF, OTF, WOFF, or WOFF2');
      return;
    }
    try {
      const ref = storageRef(storage, `users/${user.uid}/fonts/${Date.now()}.${ext}`);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      setCard((prev) => ({ ...prev, customFontUrl: url, fontFamily: undefined }));
      toast.success('Custom font uploaded');
    } catch {
      toast.error('Font upload failed');
    }
  };

  const handleUpload = async (field: 'profileImage' | 'backgroundImage', file: File) => {
    if (!user || !card.slug) return;
    try {
      const ref = storageRef(storage, `users/${user.uid}/cards/${card.slug}/${field}.${file.name.split('.').pop()}`);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      setCard({ ...card, [field]: url });
      toast.success('Image uploaded');
    } catch {
      toast.error('Upload failed');
    }
  };

  const updateField = <K extends keyof Card>(key: K, value: Card[K]) => {
    setCard((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-space flex flex-col items-center justify-center text-ink-muted">
        <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin mb-4" />
        <p>Loading editor…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space overflow-x-hidden">
      <header className="sticky top-0 z-40 bg-space/80 backdrop-blur-xl border-b border-line-soft">
        <div className="max-w-4xl mx-auto px-4 sm:px-5 flex items-center justify-between h-14 gap-3">
          <Link to="/" className="flex items-center gap-2.5 text-ink font-bold text-[15px] shrink-0">
            <img src="/nowncard-logo.png" alt="" className="h-[28px] w-auto object-contain rounded-lg" />
            <span className="hidden sm:inline">{id ? 'Edit Card' : 'New Card'}</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            <button onClick={() => { if (id) downloadVCard(card as Card); }} className="px-3 sm:px-4 py-2 border border-line text-ink text-sm font-bold rounded-full hover:bg-tile-soft transition" disabled={!id}>
              vCard
            </button>
            {card.slug?.trim() && (
              <a href={`/card/${slugify(card.slug)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border border-line text-ink text-sm font-bold rounded-full hover:bg-tile-soft transition cursor-pointer">
                <ExternalLink className="w-3.5 h-3.5" /> View
              </a>
            )}
            <button onClick={handleSave} disabled={saving} className="px-4 sm:px-5 py-2 bg-accent text-space text-sm font-bold rounded-full hover:brightness-110 transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8">
        <div className="bg-tile border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Basic Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input value={card.prefix || ''} onChange={(e) => updateField('prefix', e.target.value)} placeholder="Prefix" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <input value={card.firstName || ''} onChange={(e) => updateField('firstName', e.target.value)} placeholder="First Name *" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <input value={card.middleName || ''} onChange={(e) => updateField('middleName', e.target.value)} placeholder="Middle" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <input value={card.lastName || ''} onChange={(e) => updateField('lastName', e.target.value)} placeholder="Last Name *" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <input value={card.suffix || ''} onChange={(e) => updateField('suffix', e.target.value)} placeholder="Suffix" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <input value={card.nickname || ''} onChange={(e) => updateField('nickname', e.target.value)} placeholder="Nickname" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <input value={card.jobTitle || ''} onChange={(e) => updateField('jobTitle', e.target.value)} placeholder="Job Title" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <input value={card.department || ''} onChange={(e) => updateField('department', e.target.value)} placeholder="Department" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <input value={card.company || ''} onChange={(e) => updateField('company', e.target.value)} placeholder="Company" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent sm:col-span-2" />
            <div className="sm:col-span-2 flex gap-2">
              <input value={card.slug || ''} onChange={(e) => updateField('slug', e.target.value)} placeholder="Slug (e.g. jane-doe)" className="flex-1 px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
              {card.slug?.trim() && (
                <a href={`/card/${slugify(card.slug)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2.5 bg-tile-soft border border-line rounded-lg text-sm font-bold text-ink hover:border-accent transition cursor-pointer no-underline whitespace-nowrap">
                  <ExternalLink className="w-3.5 h-3.5" /> View
                </a>
              )}
            </div>
            {/* Legacy website field removed — use Websites in Contact section */}
            <input type="date" value={card.birthday || ''} onChange={(e) => updateField('birthday', e.target.value)} placeholder="Birthday" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <input type="date" value={card.anniversary || ''} onChange={(e) => updateField('anniversary', e.target.value)} placeholder="Anniversary" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <textarea value={card.bio || ''} onChange={(e) => updateField('bio', e.target.value)} placeholder="Bio" rows={3} className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent sm:col-span-4" />
          </div>
        </div>

        <div className="bg-tile border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Settings</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-3">
            <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
              <input type="checkbox" checked={card.isPublic ?? true} onChange={(e) => updateField('isPublic', e.target.checked)} className="w-4 h-4 accent-accent rounded" />
              Public (visible to anyone with the link)
            </label>
            {userData?.plan === 'business' && (
              <label className={`flex items-center gap-2 text-sm ${isNewTeamCard ? 'text-accent' : 'text-ink-muted'} cursor-pointer`}>
                <input type="checkbox" checked={card.isTeamCard ?? false} onChange={(e) => updateField('isTeamCard', e.target.checked)} disabled={isNewTeamCard} className="w-4 h-4 accent-accent rounded" />
                Team card (doesn't count against member's plan limit)
                {isNewTeamCard && <span className="text-[10px] font-bold uppercase tracking-wider">— Pre-set</span>}
              </label>
            )}
          </div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-ink-muted">Name layout</span>
            <div className="flex rounded-lg border border-line overflow-hidden">
              <button onClick={() => updateField('nameLayout', 'personal')} className={`px-3 py-1.5 text-sm font-semibold transition ${card.nameLayout !== 'business' ? 'bg-accent text-space' : 'text-ink-muted hover:bg-tile-soft'}`}>Personal</button>
              <button onClick={() => updateField('nameLayout', 'business')} className={`px-3 py-1.5 text-sm font-semibold transition ${card.nameLayout === 'business' ? 'bg-accent text-space' : 'text-ink-muted hover:bg-tile-soft'}`}>Business</button>
            </div>
            <span className="text-xs text-ink-faint">{card.nameLayout === 'business' ? 'Company name is the header' : 'Person name is the header'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-muted">Accent color</span>
              <input type="color" value={card.accentColor || '#e8a628'} onChange={(e) => updateField('accentColor', e.target.value)} className="w-10 h-10 rounded-lg border border-line bg-transparent cursor-pointer" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-muted">Card background</span>
              <div className="flex items-center gap-2">
                <input type="color" value={card.cardBgColor || '#f4f1ec'} onChange={(e) => updateField('cardBgColor', e.target.value)} className="w-10 h-10 rounded-lg border border-line bg-transparent cursor-pointer" />
                {card.cardBgColor && (
                  <button onClick={() => updateField('cardBgColor', undefined)} className="text-xs text-ink-muted hover:text-ink underline">Reset</button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-muted">Preset</span>
              <div className="flex rounded-lg border border-line overflow-hidden">
                <button onClick={() => { updateField('cardBgColor', undefined); updateField('cardTheme', 'light'); }} className={`px-3 py-1.5 text-sm font-semibold transition ${card.cardTheme !== 'dark' && !card.cardBgColor ? 'bg-accent text-space' : 'text-ink-muted hover:bg-tile-soft'}`}>Light</button>
                <button onClick={() => { updateField('cardBgColor', undefined); updateField('cardTheme', 'dark'); }} className={`px-3 py-1.5 text-sm font-semibold transition ${card.cardTheme === 'dark' && !card.cardBgColor ? 'bg-accent text-space' : 'text-ink-muted hover:bg-tile-soft'}`}>Dark</button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-tile border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Typography</h2>
          {(() => {
            const plan = userData?.plan || 'free';
            const isPro = plan === 'pro' || plan === 'business';
            const isBusiness = plan === 'business';
            return (
              <div className="space-y-4">
                {/* Font family */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm text-ink-muted w-28 shrink-0">Font family</span>
                  {isPro ? (
                    <select
                      value={card.customFontUrl ? '__custom__' : (card.fontFamily || 'Manrope')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') return;
                        setCard((prev) => ({ ...prev, fontFamily: val === 'Manrope' ? undefined : val, customFontUrl: undefined }));
                      }}
                      className="flex-1 min-w-0 px-3 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
                    >
                      {GOOGLE_FONTS.map((f) => (
                        <option key={f.value} value={f.value}>{f.name}</option>
                      ))}
                      {isBusiness && card.customFontUrl && (
                        <option value="__custom__">Custom Upload</option>
                      )}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-ink">Manrope (default)</span>
                      <span className="text-xs text-ink-faint">— Pro feature</span>
                    </div>
                  )}
                </div>

                {/* Custom font upload (Business only) */}
                {isBusiness && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-sm text-ink-muted w-28 shrink-0">Custom font</span>
                    <input
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={(e) => e.target.files?.[0] && handleFontUpload(e.target.files[0])}
                      className="text-sm text-ink-muted file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-line file:bg-tile file:text-ink file:text-sm file:font-semibold"
                    />
                  </div>
                )}
                {card.customFontUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-400 font-semibold">Custom font active</span>
                    <button type="button" onClick={() => setCard((prev) => ({ ...prev, customFontUrl: undefined, fontFamily: 'Manrope' }))} className="text-xs text-danger font-bold border border-line rounded-lg px-2 py-1 hover:border-danger transition">Remove</button>
                  </div>
                )}

                {/* Font size scale */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm text-ink-muted w-28 shrink-0">Size scale</span>
                  {isPro ? (
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="range"
                        min={0.9}
                        max={1.15}
                        step={0.01}
                        value={card.fontSizeScale || 1}
                        onChange={(e) => setCard((prev) => ({ ...prev, fontSizeScale: parseFloat(e.target.value) }))}
                        className="flex-1 accent-accent"
                      />
                      <span className="text-sm font-bold w-12 text-right">{((card.fontSizeScale || 1) * 100).toFixed(0)}%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-ink">100%</span>
                      <span className="text-xs text-ink-faint">— Pro feature</span>
                    </div>
                  )}
                </div>

                {/* Live preview */}
                {(card.fontFamily || card.customFontUrl) && (
                  <div className="bg-space border border-line rounded-xl p-4 mt-2">
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider mb-1.5 font-semibold">Preview</div>
                    <div
                      style={{
                        fontFamily: card.customFontUrl ? "'EditorCustomFont', sans-serif" : (card.fontFamily || 'Manrope'),
                        fontSize: `${(card.fontSizeScale || 1) * 22}px`,
                        lineHeight: 1.3,
                      }}
                      className="text-ink font-extrabold"
                    >
                      {card.firstName || 'Jane'} {card.lastName || 'Doe'}
                    </div>
                    <div
                      style={{
                        fontFamily: card.customFontUrl ? "'EditorCustomFont', sans-serif" : (card.fontFamily || 'Manrope'),
                        fontSize: `${(card.fontSizeScale || 1) * 13}px`,
                      }}
                      className="text-ink-muted mt-1"
                    >
                      {card.jobTitle || 'Product Designer'} · {card.company || 'Acme Inc'}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <div className="bg-tile border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Contact</h2>
          <div className="space-y-3">
            {card.phones?.length ? card.phones.map((p, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <select value={p.type} onChange={(e) => updateField('phones', card.phones!.map((ph, idx) => idx === i ? { ...ph, type: e.target.value } : ph))} className="px-2.5 py-2.5 bg-space border border-line rounded-lg text-sm focus:outline-none focus:border-accent w-full sm:w-auto">
                  <option>Cell</option><option>Work</option><option>Home</option><option>Fax</option>
                </select>
                <input value={p.number} onChange={(e) => updateField('phones', card.phones!.map((ph, idx) => idx === i ? { ...ph, number: e.target.value } : ph))} placeholder="Phone number" className="flex-1 min-w-0 px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <button onClick={() => updateField('phones', card.phones!.filter((_, j) => j !== i))} className="px-3 py-2 text-danger text-sm font-bold border border-line rounded-lg hover:border-danger">×</button>
              </div>
            )) : null}
            <button onClick={() => updateField('phones', [...(card.phones || []), { type: 'Cell', number: '' }])} className="px-4 py-2 border border-line rounded-lg text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent transition">+ Add Phone</button>

            {card.emails?.length ? card.emails.map((e, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <select value={e.type} onChange={(ev) => updateField('emails', card.emails!.map((em, idx) => idx === i ? { ...em, type: ev.target.value } : em))} className="px-2.5 py-2.5 bg-space border border-line rounded-lg text-sm focus:outline-none focus:border-accent w-full sm:w-auto">
                  <option>Work</option><option>Personal</option>
                </select>
                <input value={e.address} onChange={(ev) => updateField('emails', card.emails!.map((em, idx) => idx === i ? { ...em, address: ev.target.value } : em))} placeholder="Email address" className="flex-1 min-w-0 px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <button onClick={() => updateField('emails', card.emails!.filter((_, j) => j !== i))} className="px-3 py-2 text-danger text-sm font-bold border border-line rounded-lg hover:border-danger">×</button>
              </div>
            )) : null}
            <button onClick={() => updateField('emails', [...(card.emails || []), { type: 'Work', address: '' }])} className="px-4 py-2 border border-line rounded-lg text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent transition">+ Add Email</button>

            {card.websites?.length ? card.websites.map((w, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <select value={w.type} onChange={(e) => updateField('websites', card.websites!.map((wb, idx) => idx === i ? { ...wb, type: e.target.value } : wb))} className="px-2.5 py-2.5 bg-space border border-line rounded-lg text-sm focus:outline-none focus:border-accent w-full sm:w-auto">
                  <option>Work</option><option>Personal</option><option>Portfolio</option><option>Blog</option>
                </select>
                <input value={w.url} onChange={(e) => updateField('websites', card.websites!.map((wb, idx) => idx === i ? { ...wb, url: e.target.value } : wb))} placeholder="https://example.com" className="flex-1 min-w-0 px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <button onClick={() => updateField('websites', card.websites!.filter((_, j) => j !== i))} className="px-3 py-2 text-danger text-sm font-bold border border-line rounded-lg hover:border-danger">×</button>
              </div>
            )) : null}
            <button onClick={() => updateField('websites', [...(card.websites || []), { type: 'Work', url: '' }])} className="px-4 py-2 border border-line rounded-lg text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent transition">+ Add Website</button>
          </div>
        </div>

        <div className="bg-tile border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Addresses</h2>
          <div className="space-y-3">
            {card.addresses?.length ? card.addresses.map((a, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select value={a.type} onChange={(e) => updateField('addresses', card.addresses!.map((ad, idx) => idx === i ? { ...ad, type: e.target.value } : ad))} className="px-2.5 py-2.5 bg-space border border-line rounded-lg text-sm focus:outline-none focus:border-accent">
                  <option>Work</option><option>Home</option>
                </select>
                <input value={a.street || ''} onChange={(e) => updateField('addresses', card.addresses!.map((ad, idx) => idx === i ? { ...ad, street: e.target.value } : ad))} placeholder="Street" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <input value={a.city || ''} onChange={(e) => updateField('addresses', card.addresses!.map((ad, idx) => idx === i ? { ...ad, city: e.target.value } : ad))} placeholder="City" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <input value={a.state || ''} onChange={(e) => updateField('addresses', card.addresses!.map((ad, idx) => idx === i ? { ...ad, state: e.target.value } : ad))} placeholder="State" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <input value={a.zip || ''} onChange={(e) => updateField('addresses', card.addresses!.map((ad, idx) => idx === i ? { ...ad, zip: e.target.value } : ad))} placeholder="ZIP" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <input value={a.country || ''} onChange={(e) => updateField('addresses', card.addresses!.map((ad, idx) => idx === i ? { ...ad, country: e.target.value } : ad))} placeholder="Country" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <button onClick={() => updateField('addresses', card.addresses!.filter((_, j) => j !== i))} className="px-3 py-2 text-danger text-sm font-bold border border-line rounded-lg hover:border-danger sm:col-span-2">Remove address</button>
              </div>
            )) : null}
            <button onClick={() => updateField('addresses', [...(card.addresses || []), { type: 'Work', street: '', city: '', state: '', zip: '', country: '' }])} className="px-4 py-2 border border-line rounded-lg text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent transition">+ Add Address</button>
          </div>
        </div>

        <div className="bg-tile border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Social Links</h2>
          <div className="space-y-3">
            {Array.isArray(card.socialLinks) && card.socialLinks.map((s: SocialLink, i: number) => (
              <div key={i} className="flex flex-wrap gap-2">
                <input value={s.platform} onChange={(e) => updateField('socialLinks', (card.socialLinks as SocialLink[]).map((sl, idx) => idx === i ? { ...sl, platform: e.target.value } : sl))} placeholder="Platform (e.g. LinkedIn)" className="w-full sm:w-[140px] px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <input value={s.url} onChange={(e) => updateField('socialLinks', (card.socialLinks as SocialLink[]).map((sl, idx) => idx === i ? { ...sl, url: e.target.value } : sl))} placeholder="URL" className="flex-1 min-w-0 px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <button onClick={() => updateField('socialLinks', (card.socialLinks as SocialLink[]).filter((_, j) => j !== i))} className="px-3 py-2 text-danger text-sm font-bold border border-line rounded-lg hover:border-danger">×</button>
              </div>
            ))}
            <button onClick={() => updateField('socialLinks', [...(Array.isArray(card.socialLinks) ? card.socialLinks : []), { platform: '', url: '' }])} className="px-4 py-2 border border-line rounded-lg text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent transition">+ Add Social</button>
          </div>
        </div>

        <div className="bg-tile border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Images</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-ink-muted">Profile Photo</label>
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload('profileImage', e.target.files[0])} className="text-sm text-ink-muted file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-line file:bg-tile file:text-ink file:text-sm file:font-semibold" />
              {card.profileImage && (
                <div className="flex items-center gap-2">
                  <img src={card.profileImage} alt="" className="w-16 h-16 rounded-full object-cover border border-line" />
                  <button type="button" onClick={() => updateField('profileImage', undefined)} className="text-xs text-danger font-bold border border-line rounded-lg px-2 py-1 hover:border-danger transition">Remove</button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-ink-muted">Background Photo</label>
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload('backgroundImage', e.target.files[0])} className="text-sm text-ink-muted file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-line file:bg-tile file:text-ink file:text-sm file:font-semibold" />
              {card.backgroundImage && (
                <div className="flex items-center gap-2">
                  <img src={card.backgroundImage} alt="" className="w-24 h-16 rounded-lg object-cover border border-line" />
                  <button type="button" onClick={() => updateField('backgroundImage', undefined)} className="text-xs text-danger font-bold border border-line rounded-lg px-2 py-1 hover:border-danger transition">Remove</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
