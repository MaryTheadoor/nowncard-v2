import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { downloadVCard } from '@/lib/vcard';
import { slugify } from '@/lib/utils';
import type { Card, SocialLink } from '@/types';
import { toast } from 'sonner';

const defaultCard: Omit<Card, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> = {
  slug: '', firstName: '', lastName: '', jobTitle: '', company: '',
  phones: [], emails: [], addresses: [], socialLinks: [],
  accentColor: '#e8a628', isPublic: true,
  viewCount: 0, saveCount: 0, bio: '',
};

export default function EditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [card, setCard] = useState<Partial<Card>>(defaultCard);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/'); return; }
    if (!id) { setLoading(false); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'cards', id));
        if (snap.exists() && snap.data().ownerId === user.uid) {
          setCard(snap.data() as Card);
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
  }, [id, user, authLoading, navigate]);

  const handleSave = async () => {
    if (!user) return;
    if (!card.slug) { toast.error('Slug is required'); return; }
    if (!card.firstName && !card.lastName) { toast.error('Name is required'); return; }

    setSaving(true);
    try {
      const slug = slugify(card.slug);
      const data: Record<string, unknown> = {
        ...card, slug,
        ownerId: user.uid,
        updatedAt: serverTimestamp(),
      };

      // Check slug uniqueness
      if (!id) {
        const existing = await getDocs(query(collection(db, 'cards'), where('slug', '==', slug)));
        const taken = existing.docs.some((d) => d.data().ownerId !== user.uid);
        if (taken) { toast.error('That slug is taken'); setSaving(false); return; }
        data.createdAt = serverTimestamp();
      }

      if (id) {
        await updateDoc(doc(db, 'cards', id), data);
      } else {
        const ref = doc(collection(db, 'cards'));
        await setDoc(ref, data);
        data.id = ref.id;
      }
      toast.success('Card saved');
      if (!id) navigate(`/editor/${data.id as string}`);
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-space">
      <header className="sticky top-0 z-40 bg-space/80 backdrop-blur-xl border-b border-line-soft">
        <div className="max-w-4xl mx-auto px-5 flex items-center justify-between h-14">
          <a href="/" className="flex items-center gap-2.5 text-ink font-bold text-[15px]">
            <img src="/nowncard-logo.png" alt="" className="h-[28px] w-auto object-contain rounded-lg" />
            <span>{id ? 'Edit Card' : 'New Card'}</span>
          </a>
          <div className="flex items-center gap-3">
            <button onClick={() => { if (id) downloadVCard(card as Card); }} className="px-4 py-2 border border-line text-ink text-sm font-bold rounded-full hover:bg-tile-soft transition" disabled={!id}>
              vCard
            </button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-accent text-space text-sm font-bold rounded-full hover:brightness-110 transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8">
        <div className="bg-tile border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Basic Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={card.firstName || ''} onChange={(e) => updateField('firstName', e.target.value)} placeholder="First Name *" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <input value={card.lastName || ''} onChange={(e) => updateField('lastName', e.target.value)} placeholder="Last Name *" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <input value={card.jobTitle || ''} onChange={(e) => updateField('jobTitle', e.target.value)} placeholder="Job Title" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <input value={card.company || ''} onChange={(e) => updateField('company', e.target.value)} placeholder="Company" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
            <input value={card.slug || ''} onChange={(e) => updateField('slug', e.target.value)} placeholder="Slug (e.g. jane-doe)" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent sm:col-span-2" />
            <input value={card.website || ''} onChange={(e) => updateField('website', e.target.value)} placeholder="Website" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent sm:col-span-2" />
            <textarea value={card.bio || ''} onChange={(e) => updateField('bio', e.target.value)} placeholder="Bio" rows={3} className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent sm:col-span-2" />
          </div>
        </div>

        <div className="bg-tile border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Settings</h2>
          <div className="flex items-center gap-4 mb-3">
            <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
              <input type="checkbox" checked={card.isPublic ?? true} onChange={(e) => updateField('isPublic', e.target.checked)} className="w-4 h-4 accent-accent rounded" />
              Public (visible to anyone with the link)
            </label>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-muted">Accent color</span>
            <input type="color" value={card.accentColor || '#e8a628'} onChange={(e) => updateField('accentColor', e.target.value)} className="w-10 h-10 rounded-lg border border-line bg-transparent cursor-pointer" />
          </div>
        </div>

        <div className="bg-tile border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Contact</h2>
          <div className="space-y-3">
            {card.phones?.length ? card.phones.map((p, i) => (
              <div key={i} className="flex gap-2">
                <select value={p.type} onChange={(e) => { const phones = [...card.phones!]; phones[i].type = e.target.value; updateField('phones', phones); }} className="px-2.5 py-2.5 bg-space border border-line rounded-lg text-sm focus:outline-none focus:border-accent">
                  <option>Cell</option><option>Work</option><option>Home</option><option>Fax</option>
                </select>
                <input value={p.number} onChange={(e) => { const phones = [...card.phones!]; phones[i].number = e.target.value; updateField('phones', phones); }} placeholder="Phone number" className="flex-1 px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <button onClick={() => updateField('phones', card.phones!.filter((_, j) => j !== i))} className="px-3 py-2 text-danger text-sm font-bold border border-line rounded-lg hover:border-danger">×</button>
              </div>
            )) : null}
            <button onClick={() => updateField('phones', [...(card.phones || []), { type: 'Cell', number: '' }])} className="px-4 py-2 border border-line rounded-lg text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent transition">+ Add Phone</button>

            {card.emails?.length ? card.emails.map((e, i) => (
              <div key={i} className="flex gap-2">
                <select value={e.type} onChange={(ev) => { const emails = [...card.emails!]; emails[i].type = ev.target.value; updateField('emails', emails); }} className="px-2.5 py-2.5 bg-space border border-line rounded-lg text-sm focus:outline-none focus:border-accent">
                  <option>Work</option><option>Personal</option>
                </select>
                <input value={e.address} onChange={(ev) => { const emails = [...card.emails!]; emails[i].address = ev.target.value; updateField('emails', emails); }} placeholder="Email address" className="flex-1 px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <button onClick={() => updateField('emails', card.emails!.filter((_, j) => j !== i))} className="px-3 py-2 text-danger text-sm font-bold border border-line rounded-lg hover:border-danger">×</button>
              </div>
            )) : null}
            <button onClick={() => updateField('emails', [...(card.emails || []), { type: 'Work', address: '' }])} className="px-4 py-2 border border-line rounded-lg text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent transition">+ Add Email</button>
          </div>
        </div>

        <div className="bg-tile border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Social Links</h2>
          <div className="space-y-3">
            {Array.isArray(card.socialLinks) && card.socialLinks.map((s: SocialLink, i: number) => (
              <div key={i} className="flex gap-2">
                <input value={s.platform} onChange={(e) => { const sl = [...(card.socialLinks as SocialLink[])]; sl[i].platform = e.target.value; updateField('socialLinks', sl); }} placeholder="Platform (e.g. LinkedIn)" className="w-[140px] px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <input value={s.url} onChange={(e) => { const sl = [...(card.socialLinks as SocialLink[])]; sl[i].url = e.target.value; updateField('socialLinks', sl); }} placeholder="URL" className="flex-1 px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <button onClick={() => updateField('socialLinks', (card.socialLinks as SocialLink[]).filter((_, j) => j !== i))} className="px-3 py-2 text-danger text-sm font-bold border border-line rounded-lg hover:border-danger">×</button>
              </div>
            ))}
            <button onClick={() => updateField('socialLinks', [...(Array.isArray(card.socialLinks) ? card.socialLinks : []), { platform: '', url: '' }])} className="px-4 py-2 border border-line rounded-lg text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent transition">+ Add Social</button>
          </div>
        </div>

        <div className="bg-tile border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Images</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-ink-muted">Profile Photo</span>
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload('profileImage', e.target.files[0])} className="text-sm text-ink-muted file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-line file:bg-tile file:text-ink file:text-sm file:font-semibold" />
              {card.profileImage && <img src={card.profileImage} alt="" className="w-16 h-16 rounded-full object-cover border border-line" />}
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-ink-muted">Background Photo</span>
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload('backgroundImage', e.target.files[0])} className="text-sm text-ink-muted file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-line file:bg-tile file:text-ink file:text-sm file:font-semibold" />
              {card.backgroundImage && <img src={card.backgroundImage} alt="" className="w-24 h-16 rounded-lg object-cover border border-line" />}
            </label>
          </div>
        </div>
      </main>
    </div>
  );
}
