import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ExternalLink, Eye, EyeOff, Smartphone, Upload, User, Calendar, ChevronDown, ChevronUp, Copy, UtensilsCrossed } from 'lucide-react';
import LivePagePreview from '@/components/LivePagePreview';
import Navbar from '@/components/Navbar';
import BackLink from '@/components/BackLink';
import ShareModal from '@/components/ShareModal';
import MenuEditor from '@/components/MenuEditor';
import { MENU_ICON_OPTIONS } from '@/lib/menuIcons';
import { doc, getDoc, deleteField, serverTimestamp, collection, query, where, getDocs, limit, runTransaction } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '@/lib/firebase';
import { storage } from '@/lib/storage';
import { useAuth } from '@/hooks/auth-context';
import BackgroundPositioner from '@/components/BackgroundPositioner';
import { parseVCard } from '@/lib/vcard-parser';
import { slugify, getCardLimit, GOOGLE_FONTS, compressImage, SOCIAL_PLATFORMS, PAYMENT_PLATFORMS } from '@/lib/utils';
import type { Card, SocialLink, FeaturedLink, MenuCategory } from '@/types';
import { toast } from 'sonner';

const defaultCard: Omit<Card, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'> = {
  slug: '', firstName: '', lastName: '', jobTitle: '', company: '',
  phones: [], emails: [], websites: [], addresses: [], socialLinks: [], paymentLinks: [], industry: '',
  accentColor: '#f5b940', cardTheme: 'light', isPublic: true,
  viewCount: 0, saveCount: 0, bio: '', nameLayout: 'personal',
};

function ptFromScale(scale: number | undefined): number {
  return Math.round((scale ?? 0.97) * 16.5);
}

function scaleFromPt(pt: number): number {
  return Math.max(0.3, Math.min(3, pt / 16.5));
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function EditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, loading: authLoading } = useAuth();
  const [card, setCard] = useState<Partial<Card>>(defaultCard);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [showDates, setShowDates] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [accentHex, setAccentHex] = useState(card.accentColor || '#f5b940');
  const [cardBgHex, setCardBgHex] = useState(card.cardBgColor || '#f4f1ec');
  const [pageBgHex, setPageBgHex] = useState(card.pageBgColor || '#391681');
  const [textHex, setTextHex] = useState(card.textColor || '#1a1612');
  const slugManuallySet = useRef(false);
  const slugDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNewTeamCard = !id && (location.state as { isTeamCard?: boolean } | null)?.isTeamCard === true;
  const hasContactPicker = typeof navigator !== 'undefined' && 'contacts' in navigator;

  const [fontSizePt, setFontSizePt] = useState(() => ptFromScale(card.fontSizeScale));
  const fontSizeEditing = useRef(false);

  useEffect(() => {
    if (!fontSizeEditing.current) setFontSizePt(ptFromScale(card.fontSizeScale));
  }, [card.fontSizeScale]);

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
    const safeUrl = card.customFontUrl.replace(/'/g, '');
    const style = document.createElement('style');
    style.textContent = `@font-face { font-family: 'EditorCustomFont'; src: url('${safeUrl}'); font-weight: 400 800; font-display: swap; }`;
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
        const isOwner = data?.ownerUid === user.uid || data?.ownerId === user.uid;
        const isTeamOwner = data?.teamOwnerUid === user.uid || data?.teamOwnerId === user.uid;
        if (snap.exists() && (isOwner || isTeamOwner)) {
          setCard(data as Card);
          setAccentHex((data as Card).accentColor || '#f5b940');
          setCardBgHex((data as Card).cardBgColor || '#f4f1ec');
          setPageBgHex((data as Card).pageBgColor || '#391681');
          setTextHex((data as Card).textColor || '#1a1612');
          if (data?.birthday || data?.anniversary) setShowDates(true);
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

  // Auto-generate slug from name if not manually set (new cards only)
  useEffect(() => {
    if (id) return; // don't auto-regenerate slug when editing existing card
    if (slugManuallySet.current) return;
    const fn = (card.firstName || '').trim();
    const ln = (card.lastName || '').trim();
    if (!fn && !ln) return;
    const auto = slugify(`${fn} ${ln}`);
    if (auto.length >= 2) {
      queueMicrotask(() => setCard((prev) => ({ ...prev, slug: auto })));
    }
  }, [card.firstName, card.lastName, id]);

  // Debounced slug availability check
  useEffect(() => {
    const raw = (card.slug || '').trim();
    if (!raw) { queueMicrotask(() => setSlugStatus('idle')); return; }
    const slug = slugify(raw);
    if (slug.length < 3) { queueMicrotask(() => setSlugStatus('invalid')); return; }
    if (slugDebounce.current) clearTimeout(slugDebounce.current);
    queueMicrotask(() => setSlugStatus('checking'));
    slugDebounce.current = setTimeout(async () => {
      try {
        const [ownSnap, publicSnap] = await Promise.all([
          getDocs(query(collection(db, 'cards'), where('slug', '==', slug), where('ownerUid', '==', user!.uid))),
          getDocs(query(collection(db, 'cards'), where('slug', '==', slug), where('isPublic', '==', true), limit(1))),
        ]);
        const ownMatch = ownSnap.docs.some((d) => d.id !== id);
        const publicMatch = !publicSnap.empty && publicSnap.docs[0].id !== id;
        if (ownMatch || publicMatch) setSlugStatus('taken');
        else setSlugStatus('available');
      } catch {
        setSlugStatus('idle');
      }
    }, 400);
    return () => { if (slugDebounce.current) clearTimeout(slugDebounce.current); };
  }, [card.slug, user, id]);

  const handleSave = async () => {
    if (!user) return;
    if (!card.slug) { toast.error('Slug is required'); return; }
    if (!card.firstName && !card.lastName) { toast.error('Name is required'); return; }

    setSaving(true);
    try {
      const slug = slugify(card.slug);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, createdAt: _ca, updatedAt: _ua, ownerUid: _oi, ...rest } = card as Record<string, unknown>;

      if (Array.isArray(rest.phones)) rest.phones = rest.phones.filter((p: unknown) => (p as { number?: string }).number?.trim());
      if (Array.isArray(rest.emails)) rest.emails = rest.emails.filter((e: unknown) => (e as { address?: string }).address?.trim());
      if (Array.isArray(rest.websites)) rest.websites = rest.websites.filter((w: unknown) => (w as { url?: string }).url?.trim());
      if (Array.isArray(rest.addresses)) rest.addresses = rest.addresses.filter((a: unknown) => {
        const ad = a as { street?: string; city?: string; state?: string; zip?: string; country?: string };
        return ad.street?.trim() || ad.city?.trim() || ad.state?.trim() || ad.zip?.trim() || ad.country?.trim();
      });
      if (Array.isArray(rest.socialLinks)) rest.socialLinks = rest.socialLinks.filter((s: unknown) => (s as { url?: string }).url?.trim());
      if (Array.isArray(rest.paymentLinks)) rest.paymentLinks = rest.paymentLinks.filter((s: unknown) => (s as { url?: string }).url?.trim());
      if (Array.isArray(rest.menu)) {
        // Keep every category that has at least one named item — never silently
        // drop a category (and its items) just because its name is empty; fall
        // back to a generic label so the user's work is preserved. Empty optional
        // fields (price/description) are dropped so stored docs stay clean.
        rest.menu = (rest.menu as MenuCategory[])
          .map((cat) => {
            const items = cat.items
              .filter((it) => it.name?.trim())
              .map((it) => ({
                name: it.name.trim(),
                price: it.price?.trim() || undefined,
                description: it.description?.trim() || undefined,
              }));
            return { ...cat, name: (cat.name || '').trim() || 'Menu', items };
          })
          .filter((cat) => cat.items.length > 0);
        if ((rest.menu as MenuCategory[]).length === 0) rest.menu = [];
      }

      const stripUndefined = (obj: Record<string, unknown>): Record<string, unknown> => {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value === undefined) continue;
          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = stripUndefined(value as Record<string, unknown>);
          } else if (Array.isArray(value)) {
            // Recurse into array items too — imported contacts/vCards can leave
            // explicit `undefined` fields inside address/contact objects, and
            // Firestore throws on any nested undefined.
            result[key] = value.map((v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? stripUndefined(v as Record<string, unknown>) : v));
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

      // Track fields explicitly set to undefined for deletion on update
      if (id) {
        for (const [key, value] of Object.entries(rest)) {
          if (value === undefined) (data as Record<string, unknown>)[key] = deleteField();
        }
      }

      const existing = await getDocs(query(collection(db, 'cards'), where('slug', '==', slug), where('ownerUid', '==', user.uid)));
      const taken = existing.docs.some((d) => d.id !== id);
      if (taken) { toast.error('That slug is taken'); setSaving(false); return; }
      // The debounced availability check also covers other users' PUBLIC cards;
      // block save when it already flagged the slug as taken (still subject to a
      // check-then-act race — full uniqueness needs a slug registry transaction).
      if (slugStatus === 'taken') { toast.error('That slug is taken'); setSaving(false); return; }

      if (id) {
        // Slug uniqueness is enforced atomically via the slugs/{slug} registry
        // (see firestore.rules) inside a transaction — this closes the
        // check-then-act race between two users claiming the same slug.
        await runTransaction(db, async (tx) => {
          const slugRef = doc(db, 'slugs', slug);
          const slugSnap = await tx.get(slugRef);
          if (slugSnap.exists() && slugSnap.data()?.cardId !== id) throw new Error('That slug is taken');
          // If the card's slug changed, release the old registry entry.
          const oldSlug = typeof card.slug === 'string' && card.slug !== slug ? card.slug : null;
          if (oldSlug) {
            const oldRef = doc(db, 'slugs', oldSlug);
            const oldSnap = await tx.get(oldRef);
            if (oldSnap.exists() && oldSnap.data()?.cardId === id) tx.delete(oldRef);
          }
          // Legacy cards may only have ownerId — converge them onto ownerUid so the
          // dual-field fallback debt eventually goes away.
          if (!card.ownerUid && card.ownerId === user.uid) data.ownerUid = user.uid;
          tx.update(doc(db, 'cards', id), data);
          tx.set(slugRef, { cardId: id, ownerUid: user.uid, updatedAt: serverTimestamp() }, { merge: true });
        });
        toast.success('Card saved');
      } else {
        if (!data.isTeamCard) {
          const [uidCards, idCards] = await Promise.all([
            getDocs(query(collection(db, 'cards'), where('ownerUid', '==', user.uid))),
            getDocs(query(collection(db, 'cards'), where('ownerId', '==', user.uid))),
          ]);
          const ownedIds = new Set([...uidCards.docs, ...idCards.docs].map((d) => d.id));
          const personalCount = [...ownedIds].filter((docId) => {
            const docData = uidCards.docs.find((d) => d.id === docId)?.data() || idCards.docs.find((d) => d.id === docId)?.data();
            return !docData?.isTeamCard;
          }).length;
          const limit = getCardLimit(userData?.plan);
          if (personalCount >= limit) {
            toast.error(`Your ${userData?.plan || 'free'} plan allows ${limit === Infinity ? 'unlimited' : limit} personal card${limit === 1 ? '' : 's'}. Upgrade to create more.`);
            setSaving(false);
            return;
          }
        }
        data.ownerUid = user.uid;
        data.createdAt = serverTimestamp();
        const cardRef = doc(collection(db, 'cards'));
        await runTransaction(db, async (tx) => {
          const slugRef = doc(db, 'slugs', slug);
          const slugSnap = await tx.get(slugRef);
          if (slugSnap.exists()) throw new Error('That slug is taken');
          tx.set(cardRef, data);
          tx.set(slugRef, { cardId: cardRef.id, ownerUid: user.uid, updatedAt: serverTimestamp() });
        });
        toast.success('Card saved');
        navigate(`/editor/${cardRef.id}`);
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
    } catch (err) {
      console.error('[FontUpload] Failed:', err);
      toast.error('Font upload failed');
    }
  };

  const handleUpload = async (field: 'profileImage' | 'backgroundImage' | 'backBackgroundImage', file: File) => {
    if (!user) return;
    // Accept large phone photos — they're compressed client-side (1200px/85%)
    // before upload, so the stored file is small. 25MB source ceiling is
    // generous for typical phone camera output.
    if (file.size > 25 * 1024 * 1024) { toast.error('Image must be under 25MB'); return; }
    try {
      const compressed = await compressImage(file, 1200, 0.85);
      const ext = file.type === 'image/png' ? 'png' : 'jpg';
      // Use card ID for existing cards, slug for new cards, or draft fallback
      const pathPrefix = id || card.slug?.trim() || `draft-${Date.now()}`;
      const ref = storageRef(storage, `users/${user.uid}/cards/${pathPrefix}/${field}.${ext}`);
      await uploadBytes(ref, compressed);
      const url = await getDownloadURL(ref);
      setCard((prev) => ({ ...prev, [field]: url }));
      toast.success('Image uploaded');
    } catch (err) {
      console.error('[Upload] Failed:', err);
      toast.error('Upload failed — please try again');
    }
  };

  const updateField = <K extends keyof Card>(key: K, value: Card[K]) => {
    setCard((prev) => ({ ...prev, [key]: value }));
  };

  const uploadMenuImage = async (file: File, ci: number): Promise<string | null> => {
    if (!user) return null;
    try {
      const compressed = await compressImage(file, 800, 0.85);
      const ext = file.type === 'image/png' ? 'png' : 'jpg';
      const pathPrefix = id || card.slug?.trim() || `draft-${Date.now()}`;
      const ref = storageRef(storage, `users/${user.uid}/cards/${pathPrefix}/menu-${ci}.${ext}`);
      await uploadBytes(ref, compressed);
      return getDownloadURL(ref);
    } catch (err) {
      console.error('[Menu upload] Failed:', err);
      toast.error('Menu image upload failed — please try again');
      return null;
    }
  };

  const updateAppointmentSettings = (settings: NonNullable<Card['appointmentSettings']>) => {
    setCard((prev) => ({ ...prev, appointmentSettings: settings }));
  };

  const updateWeeklyHour = (day: number, key: 'start' | 'end', value: string) => {
    const hours = (card.appointmentSettings?.weeklyHours || []).map((h) => h.day === day ? { ...h, [key]: value } : h);
    updateAppointmentSettings({ ...(card.appointmentSettings || {}), weeklyHours: hours });
  };

  // Auto-populate handlers
  const populateFromGoogle = () => {
    if (!user) return;
    const updates: Partial<Card> = {};
    if (user.displayName) {
      const parts = user.displayName.split(' ');
      updates.firstName = parts[0];
      updates.lastName = parts.slice(1).join(' ');
    }
    if (user.email) updates.emails = [{ type: 'Work', address: user.email }];
    if (user.photoURL) updates.profileImage = user.photoURL;
    setCard((prev) => ({ ...prev, ...updates }));
    toast.success('Profile imported from Google');
  };

  const populateFromContacts = async () => {
    try {
      // Use only standard Contact Picker API properties. 'url' is non-standard and can cause throws.
      const baseProps = ['name', 'tel', 'email', 'address'];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const navContacts = (navigator as any).contacts;

      // Try with icon support first; fall back to base props if browser rejects it
      let contacts: unknown[] = [];
      try {
        contacts = await navContacts.select([...baseProps, 'icon'], { multiple: false });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        // If icon caused the failure, retry without it
        if (msg.toLowerCase().includes('icon') || msg.toLowerCase().includes('type')) {
          contacts = await navContacts.select(baseProps, { multiple: false });
        } else {
          throw err;
        }
      }

      if (!contacts || (contacts as unknown[]).length === 0) return;
      const contact = (contacts as Record<string, unknown>[])[0];
      const updates: Partial<Card> = {};

      // Name: handle prefix, firstName, lastName
      if ((contact.name as unknown[] | undefined)?.length && typeof (contact.name as string[])[0] === 'string') {
        const raw = (contact.name as string[])[0].trim();
        const prefixes = ['dr', 'mr', 'mrs', 'ms', 'prof'];
        const parts = raw.split(/\s+/);
        let start = 0;
        if (parts.length > 2 && prefixes.includes(parts[0].toLowerCase().replace('.', ''))) {
          updates.prefix = parts[0];
          start = 1;
        }
        updates.firstName = parts[start] || raw;
        updates.lastName = parts.slice(start + 1).join(' ') || '';
      }

      // Tel: might be string[] or ContactTelField[]
      if ((contact.tel as unknown[] | undefined)?.length) {
        const tels = (contact.tel as unknown[]).map((t: unknown) => {
          if (typeof t === 'string') return { type: 'Cell', number: t };
          const obj = t as { value?: string; type?: string[] | string };
          const num = obj.value || String(t);
          let label = 'Cell';
          if (obj.type) {
            const typeArr = Array.isArray(obj.type) ? obj.type : [obj.type];
            const rawType = typeArr[0]?.toLowerCase() || 'cell';
            label = rawType.charAt(0).toUpperCase() + rawType.slice(1);
          }
          return { type: label, number: num };
        }).filter((t: { number?: string }) => t.number?.trim());
        if (tels.length) updates.phones = tels;
      }

      // Email: might be string[] or objects
      if ((contact.email as unknown[] | undefined)?.length) {
        const emails = (contact.email as unknown[]).map((e: unknown) => {
          if (typeof e === 'string') return { type: 'Work', address: e };
          const obj = e as { value?: string; type?: string[] | string };
          const addr = obj.value || String(e);
          let label = 'Work';
          if (obj.type) {
            const typeArr = Array.isArray(obj.type) ? obj.type : [obj.type];
            const rawType = typeArr[0]?.toLowerCase() || 'work';
            label = rawType.charAt(0).toUpperCase() + rawType.slice(1);
          }
          return { type: label, address: addr };
        }).filter((e: { address?: string }) => e.address?.trim());
        if (emails.length) updates.emails = emails;
      }

      // Address: addressLine may be string[]
      if ((contact.address as unknown[] | undefined)?.length) {
        const a = (contact.address as Record<string, unknown>[])[0];
        let street = '';
        if (a.street && typeof a.street === 'string') street = a.street;
        else if (a.addressLine) {
          const lines = Array.isArray(a.addressLine) ? a.addressLine as string[] : [a.addressLine as string];
          street = lines.filter((l: string) => l?.trim()).join(', ');
        }
        updates.addresses = [{
          type: 'Work',
          street: street || undefined,
          city: (a.city as string) || undefined,
          state: (a.region as string) || undefined,
          zip: (a.postalCode as string) || undefined,
          country: (a.country as string) || undefined,
        }];
      }

      // Photo/icon: upload Blob to Firebase Storage
      if ((contact.icon as unknown[] | undefined)?.length && user) {
        const blob = (contact.icon as Blob[])[0];
        try {
          const ext = blob.type?.includes('png') ? 'png' : 'jpg';
          const path = `users/${user.uid}/contacts/${Date.now()}.${ext}`;
          const ref = storageRef(storage, path);
          await uploadBytes(ref, blob);
          const url = await getDownloadURL(ref);
          updates.profileImage = url;
        } catch (err) {
          console.warn('[ContactPicker] Photo upload failed:', err);
        }
      }

      setCard((prev) => ({ ...prev, ...updates }));
      toast.success('Contact imported');
    } catch (err: unknown) {
      console.error('[ContactPicker] Import failed:', err);
      toast.error('Contact picker failed or was cancelled');
    }
  };

  const handleVCardUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        // Basic validation — must contain vCard markers
        if (!text.includes('BEGIN:VCARD') || !text.includes('END:VCARD')) {
          toast.error('File does not appear to be a valid vCard');
          return;
        }
        const parsed = parseVCard(text);
        setCard((prev) => ({ ...prev, ...parsed }));
        if (parsed.birthday || parsed.anniversary) setShowDates(true);
        toast.success('vCard imported');
      } catch (err) {
        console.error('[vCard] Parse error:', err);
        toast.error('Failed to parse vCard');
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read the selected file');
    };
    reader.readAsText(file);
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
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-5 pt-5">
        <BackLink to="/dashboard">Back to Dashboard</BackLink>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-5 lg:grid lg:grid-cols-[1fr_420px] gap-6 pt-4 pb-24">
        <main className="flex-1 min-w-0 max-w-2xl">

          {/* Auto-populate */}
          <div className="bg-tile border border-line rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-bold text-ink-muted uppercase tracking-wider mb-3">Auto-Fill</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={populateFromGoogle} className="btn btn-secondary btn-sm">
                <User className="w-3.5 h-3.5" /> Use My Profile
              </button>
              {hasContactPicker && (
                <button onClick={populateFromContacts} className="btn btn-secondary btn-sm">
                  <Smartphone className="w-3.5 h-3.5" /> Pick from Phone
                </button>
              )}
              <label className="btn btn-secondary btn-sm cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Upload .vcf
                <input type="file" accept=".vcf,.vcard,text/vcard,text/x-vcard" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVCardUpload(f); e.target.value = ''; }} />
              </label>
            </div>
          </div>

          {/* Basic Info */}
          <details className="group bg-tile border border-line rounded-2xl p-6 mb-6" open>
            <summary className="text-lg font-bold mb-4 list-none cursor-pointer select-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Basic Info</span>
              <ChevronDown className="w-4 h-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input value={card.prefix || ''} onChange={(e) => updateField('prefix', e.target.value)} placeholder="Prefix" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
              <input value={card.firstName || ''} onChange={(e) => updateField('firstName', e.target.value)} placeholder="First Name *" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
              <input value={card.middleName || ''} onChange={(e) => updateField('middleName', e.target.value)} placeholder="Middle" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
              <input value={card.lastName || ''} onChange={(e) => updateField('lastName', e.target.value)} placeholder="Last Name *" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
              <input value={card.suffix || ''} onChange={(e) => updateField('suffix', e.target.value)} placeholder="Suffix" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
              <input value={card.nickname || ''} onChange={(e) => updateField('nickname', e.target.value)} placeholder="Nickname" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
              <input value={card.jobTitle || ''} onChange={(e) => updateField('jobTitle', e.target.value)} placeholder="Job Title" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
              <input value={card.department || ''} onChange={(e) => updateField('department', e.target.value)} placeholder="Department" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
              <input value={card.company || ''} onChange={(e) => updateField('company', e.target.value)} placeholder="Company" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
              <input value={card.industry || ''} onChange={(e) => updateField('industry', e.target.value)} placeholder="Industry" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
              <div className="sm:col-span-2 flex gap-2">
                <div className="flex-1 relative">
                  <input
                    value={card.slug || ''}
                    onChange={(e) => { slugManuallySet.current = true; updateField('slug', e.target.value); }}
                    placeholder="Slug (e.g. jane-doe)"
                    className={`w-full px-3.5 py-2.5 bg-space border rounded-lg text-ink text-sm focus:outline-none focus:border-accent ${
                      slugStatus === 'taken' || slugStatus === 'invalid' ? 'border-danger' :
                      slugStatus === 'available' ? 'border-emerald-500' :
                      'border-line'
                    }`}
                  />
                  {slugStatus !== 'idle' && slugStatus !== 'checking' && (
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold uppercase tracking-wider ${
                      slugStatus === 'taken' || slugStatus === 'invalid' ? 'text-danger' :
                      slugStatus === 'available' ? 'text-emerald-400' : 'text-ink-faint'
                    }`}>
                      {slugStatus === 'taken' ? 'Taken' : slugStatus === 'invalid' ? 'Too short' : 'Available'}
                    </span>
                  )}
                  {slugStatus === 'checking' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-line border-t-accent rounded-full animate-spin" />
                  )}
                </div>
                {card.slug?.trim() && (
                  <a href={`/card/${slugify(card.slug)}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm no-underline whitespace-nowrap">
                    <ExternalLink className="w-3.5 h-3.5" /> View
                  </a>
                )}
              </div>
              <textarea value={card.bio || ''} onChange={(e) => updateField('bio', e.target.value)} placeholder="Bio" rows={3} className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent sm:col-span-4" />
            </div>

            {/* Hidden dates toggle */}
            <button
              onClick={() => setShowDates((s) => !s)}
              className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-accent transition"
            >
              <Calendar className="w-3.5 h-3.5" />
              {showDates ? 'Hide date info' : 'Add date info'}
              {showDates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showDates && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <input type="date" value={card.birthday || ''} onChange={(e) => updateField('birthday', e.target.value)} placeholder="Birthday" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                <input type="date" value={card.anniversary || ''} onChange={(e) => updateField('anniversary', e.target.value)} placeholder="Anniversary" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
              </div>
            )}
          </details>

          {/* Settings */}
          <details className="group bg-tile border border-line rounded-2xl p-6 mb-6" open>
            <summary className="text-lg font-bold mb-4 list-none cursor-pointer select-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Settings</span>
              <ChevronDown className="w-4 h-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
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
              {(userData?.plan === 'pro' || userData?.plan === 'business') ? (
                <>
                  <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
                    <input type="checkbox" checked={card.hideNavbar ?? false} onChange={(e) => updateField('hideNavbar', e.target.checked)} className="w-4 h-4 accent-accent rounded" />
                    Hide branding nav on card page
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
                    <input type="checkbox" checked={card.hideLogo ?? false} onChange={(e) => updateField('hideLogo', e.target.checked)} className="w-4 h-4 accent-accent rounded" />
                    Hide logo on back of card
                  </label>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-ink-faint">
                  <input type="checkbox" disabled className="w-4 h-4 accent-accent rounded opacity-50" />
                  <span>Hide branding nav on card page</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">— Pro</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-ink-muted">Name layout</span>
              <div className="flex gap-2">
                <button onClick={() => updateField('nameLayout', 'personal')} className={`btn btn-sm btn-secondary ${card.nameLayout !== 'business' ? 'btn-selected' : ''}`}>Personal</button>
                <button onClick={() => updateField('nameLayout', 'business')} className={`btn btn-sm btn-secondary ${card.nameLayout === 'business' ? 'btn-selected' : ''}`}>Business</button>
              </div>
              <span className="text-xs text-ink-faint">{card.nameLayout === 'business' ? 'Company name is the header' : 'Person name is the header'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {/* Accent */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-muted">Accent</span>
                <input type="color" value={card.accentColor || '#f5b940'} onChange={(e) => { updateField('accentColor', e.target.value); setAccentHex(e.target.value); }} className="w-10 h-10 rounded-lg border border-line bg-transparent cursor-pointer" />
                <input
                  type="text"
                  value={accentHex}
                  onChange={(e) => {
                    setAccentHex(e.target.value);
                    const v = e.target.value.trim();
                    if (/^#[0-9A-Fa-f]{6}$/.test(v)) updateField('accentColor', v);
                  }}
                  className="w-20 px-2 py-1.5 bg-space border border-line rounded-lg text-ink text-xs font-mono uppercase focus:outline-none focus:border-accent"
                />
              </div>
              {/* Card BG */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-muted">Card BG</span>
                <input type="color" value={card.cardBgColor || '#f4f1ec'} onChange={(e) => { updateField('cardBgColor', e.target.value); setCardBgHex(e.target.value); }} className="w-10 h-10 rounded-lg border border-line bg-transparent cursor-pointer" />
                <input
                  type="text"
                  value={cardBgHex}
                  onChange={(e) => {
                    setCardBgHex(e.target.value);
                    const v = e.target.value.trim();
                    if (/^#[0-9A-Fa-f]{6}$/.test(v)) updateField('cardBgColor', v);
                  }}
                  className="w-20 px-2 py-1.5 bg-space border border-line rounded-lg text-ink text-xs font-mono uppercase focus:outline-none focus:border-accent"
                />
                {card.cardBgColor && (
                  <button onClick={() => updateField('cardBgColor', undefined)} className="text-xs text-ink-muted hover:text-ink underline">Reset</button>
                )}
              </div>
              {/* Page BG */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-muted">Page BG</span>
                <input type="color" value={card.pageBgColor || '#391681'} onChange={(e) => { updateField('pageBgColor', e.target.value); setPageBgHex(e.target.value); }} className="w-10 h-10 rounded-lg border border-line bg-transparent cursor-pointer" />
                <input
                  type="text"
                  value={pageBgHex}
                  onChange={(e) => {
                    setPageBgHex(e.target.value);
                    const v = e.target.value.trim();
                    if (/^#[0-9A-Fa-f]{6}$/.test(v)) updateField('pageBgColor', v);
                  }}
                  className="w-20 px-2 py-1.5 bg-space border border-line rounded-lg text-ink text-xs font-mono uppercase focus:outline-none focus:border-accent"
                />
                {card.pageBgColor && (
                  <button onClick={() => updateField('pageBgColor', undefined)} className="text-xs text-ink-muted hover:text-ink underline">Reset</button>
                )}
              </div>
              {/* Text */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-muted">Text</span>
                <button onClick={() => updateField('textColor', undefined)} className={`w-7 h-7 rounded-full border-2 ${!card.textColor ? 'border-accent' : 'border-line'}`} style={{ background: 'linear-gradient(135deg, #f4f1ec 50%, #1a1612 50%)' }} title="Auto" />
                <button onClick={() => updateField('textColor', '#1a1612')} className={`w-7 h-7 rounded-full border-2 ${card.textColor === '#1a1612' ? 'border-accent' : 'border-line'}`} style={{ background: '#1a1612' }} title="Black" />
                <button onClick={() => updateField('textColor', '#f4f1ec')} className={`w-7 h-7 rounded-full border-2 ${card.textColor === '#f4f1ec' ? 'border-accent' : 'border-line'}`} style={{ background: '#f4f1ec' }} title="White" />
                <button onClick={() => updateField('textColor', '#7a7166')} className={`w-7 h-7 rounded-full border-2 ${card.textColor === '#7a7166' ? 'border-accent' : 'border-line'}`} style={{ background: '#7a7166' }} title="Gray" />
                {(userData?.plan === 'pro' || userData?.plan === 'business') ? (
                  <>
                    <input type="color" value={card.textColor || '#1a1612'} onChange={(e) => { updateField('textColor', e.target.value); setTextHex(e.target.value); }} className="w-10 h-10 rounded-lg border border-line bg-transparent cursor-pointer" />
                    <input
                      type="text"
                      value={textHex}
                      onChange={(e) => {
                        setTextHex(e.target.value);
                        const v = e.target.value.trim();
                        if (/^#[0-9A-Fa-f]{6}$/.test(v)) updateField('textColor', v);
                      }}
                      className="w-20 px-2 py-1.5 bg-space border border-line rounded-lg text-ink text-xs font-mono uppercase focus:outline-none focus:border-accent"
                    />
                  </>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">— Pro</span>
                )}
                {card.textColor && (
                  <button onClick={() => updateField('textColor', undefined)} className="text-xs text-ink-muted hover:text-ink underline">Reset</button>
                )}
              </div>
              {/* Preset */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-ink-muted">Preset</span>
                <div className="flex gap-2">
                  <button onClick={() => { updateField('cardBgColor', undefined); updateField('cardTheme', 'light'); }} className={`btn btn-sm btn-secondary ${card.cardTheme !== 'dark' && !card.cardBgColor ? 'btn-selected' : ''}`}>Light</button>
                  <button onClick={() => { updateField('cardBgColor', undefined); updateField('cardTheme', 'dark'); }} className={`btn btn-sm btn-secondary ${card.cardTheme === 'dark' && !card.cardBgColor ? 'btn-selected' : ''}`}>Dark</button>
                </div>
              </div>
              {/* QR */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-ink-muted">QR code</span>
                <div className="flex gap-2">
                  <button onClick={() => updateField('qrMode', undefined)} className={`btn btn-sm btn-secondary ${card.qrMode !== 'vcard' ? 'btn-selected' : ''}`}>Link to card</button>
                  <button onClick={() => updateField('qrMode', 'vcard')} className={`btn btn-sm btn-secondary ${card.qrMode === 'vcard' ? 'btn-selected' : ''}`}>Contact card</button>
                </div>
                <span className="text-xs text-ink-faint">{card.qrMode === 'vcard' ? 'Scan adds contact directly' : 'Scan opens your card page'}</span>
              </div>
            </div>
          </details>

          {/* Typography */}
          <details className="group bg-tile border border-line rounded-2xl p-6 mb-6" open>
            <summary className="text-lg font-bold mb-4 list-none cursor-pointer select-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Typography</span>
              <ChevronDown className="w-4 h-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
            {(() => {
              const plan = userData?.plan || 'free';
              const isPro = plan === 'pro' || plan === 'business';
              const isBusiness = plan === 'business';
              return (
                <div className="space-y-4">
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

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-sm text-ink-muted w-28 shrink-0">Font size</span>
                    {isPro ? (
                      <div className="flex items-center gap-2 flex-1 flex-wrap">
                        {[
                          { pt: '12pt', scale: 0.73 },
                          { pt: '14pt', scale: 0.85 },
                          { pt: '16pt', scale: 0.97 },
                          { pt: '18pt', scale: 1.09 },
                        ].map(({ pt, scale }) => (
                          <button
                            key={pt}
                            onClick={() => setCard((prev) => ({ ...prev, fontSizeScale: scale }))}
                            className={`btn btn-xs btn-secondary ${Math.abs((card.fontSizeScale || 1) - scale) < 0.06 ? 'btn-selected' : ''}`}
                          >
                            {pt}
                          </button>
                        ))}
                        {isBusiness && (
                          <div className="flex items-center gap-1.5 ml-1">
                            <input
                              type="number"
                              min={8}
                              max={72}
                              value={fontSizePt}
                              onFocus={() => { fontSizeEditing.current = true; }}
                              onBlur={() => { fontSizeEditing.current = false; }}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setFontSizePt(raw === '' ? 0 : parseInt(raw, 10) || 0);
                                const pt = parseInt(raw, 10);
                                if (!isNaN(pt) && raw.trim() !== '') {
                                  setCard((prev) => ({ ...prev, fontSizeScale: scaleFromPt(pt) }));
                                }
                              }}
                              className="w-14 px-1.5 py-1 bg-space border border-line rounded-lg text-ink text-xs font-bold text-center focus:outline-none focus:border-accent"
                            />
                            <span className="text-xs text-ink-muted">pt</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-ink">16pt</span>
                        <span className="text-xs text-ink-faint">— Pro feature</span>
                      </div>
                    )}
                  </div>

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
          </details>

          {/* Contact */}
          <details className="group bg-tile border border-line rounded-2xl p-6 mb-6" open>
            <summary className="text-lg font-bold mb-4 list-none cursor-pointer select-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Contact</span>
              <ChevronDown className="w-4 h-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
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
          </details>

          {/* Addresses */}
          <details className="group bg-tile border border-line rounded-2xl p-6 mb-6" open>
            <summary className="text-lg font-bold mb-4 list-none cursor-pointer select-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Addresses</span>
              <ChevronDown className="w-4 h-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3">
              {card.addresses?.length ? card.addresses.map((a, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select value={a.type} onChange={(e) => updateField('addresses', card.addresses!.map((ad, idx) => idx === i ? { ...ad, type: e.target.value } : ad))} className="px-2.5 py-2.5 bg-space border border-line rounded-lg text-sm focus:outline-none focus:border-accent">
                    <option>Work</option><option>Home</option><option>Mailing</option>
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
          </details>

          {/* Social Links */}
          <details className="group bg-tile border border-line rounded-2xl p-6 mb-6" open>
            <summary className="text-lg font-bold mb-4 list-none cursor-pointer select-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Social Links</span>
              <ChevronDown className="w-4 h-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3">
              {Array.isArray(card.socialLinks) && card.socialLinks.map((s: SocialLink, i: number) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <select
                    value={SOCIAL_PLATFORMS.some(p => p.value === s.platform.toLowerCase()) ? s.platform.toLowerCase() : 'other'}
                    onChange={(e) => updateField('socialLinks', (card.socialLinks as SocialLink[]).map((sl, idx) => idx === i ? { ...sl, platform: e.target.value } : sl))}
                    className="w-full sm:w-[150px] px-3 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
                  >
                    {SOCIAL_PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>{p.name}</option>
                    ))}
                  </select>
                  {(!s.platform || s.platform.toLowerCase() === 'other' || !SOCIAL_PLATFORMS.some(p => p.value === s.platform.toLowerCase())) && (
                    <input
                      value={s.platform === 'other' ? '' : s.platform}
                      onChange={(e) => updateField('socialLinks', (card.socialLinks as SocialLink[]).map((sl, idx) => idx === i ? { ...sl, platform: e.target.value || 'Other' } : sl))}
                      placeholder="Custom platform"
                      className="w-full sm:w-[140px] px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
                    />
                  )}
                  <input value={s.url} onChange={(e) => updateField('socialLinks', (card.socialLinks as SocialLink[]).map((sl, idx) => idx === i ? { ...sl, url: e.target.value } : sl))} placeholder="URL" className="flex-1 min-w-0 px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                  <button onClick={() => updateField('socialLinks', (card.socialLinks as SocialLink[]).filter((_, j) => j !== i))} className="px-3 py-2 text-danger text-sm font-bold border border-line rounded-lg hover:border-danger">×</button>
                </div>
              ))}
              <button onClick={() => updateField('socialLinks', [...(Array.isArray(card.socialLinks) ? card.socialLinks : []), { platform: '', url: '' }])} className="px-4 py-2 border border-line rounded-lg text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent transition">+ Add Social</button>
            </div>
          </details>

          {/* Payment Links */}
          <details className="group bg-tile border border-line rounded-2xl p-6 mb-6" open>
            <summary className="text-lg font-bold mb-4 list-none cursor-pointer select-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Payment Links</span>
              <ChevronDown className="w-4 h-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3">
              {Array.isArray(card.paymentLinks) && card.paymentLinks.map((s: SocialLink, i: number) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <select
                    value={PAYMENT_PLATFORMS.some(p => p.value === s.platform.toLowerCase()) ? s.platform.toLowerCase() : 'other'}
                    onChange={(e) => updateField('paymentLinks', (card.paymentLinks as SocialLink[]).map((sl, idx) => idx === i ? { ...sl, platform: e.target.value } : sl))}
                    className="w-full sm:w-[150px] px-3 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
                  >
                    {PAYMENT_PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>{p.name}</option>
                    ))}
                  </select>
                  {(!s.platform || s.platform.toLowerCase() === 'other' || !PAYMENT_PLATFORMS.some(p => p.value === s.platform.toLowerCase())) && (
                    <input
                      value={s.platform === 'other' ? '' : s.platform}
                      onChange={(e) => updateField('paymentLinks', (card.paymentLinks as SocialLink[]).map((sl, idx) => idx === i ? { ...sl, platform: e.target.value || 'Other' } : sl))}
                      placeholder="Custom platform"
                      className="w-full sm:w-[140px] px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
                    />
                  )}
                  <input value={s.url} onChange={(e) => updateField('paymentLinks', (card.paymentLinks as SocialLink[]).map((sl, idx) => idx === i ? { ...sl, url: e.target.value } : sl))} placeholder="URL" className="flex-1 min-w-0 px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                  <button onClick={() => updateField('paymentLinks', (card.paymentLinks as SocialLink[]).filter((_, j) => j !== i))} className="px-3 py-2 text-danger text-sm font-bold border border-line rounded-lg hover:border-danger">×</button>
                </div>
              ))}
              <button onClick={() => updateField('paymentLinks', [...(Array.isArray(card.paymentLinks) ? card.paymentLinks : []), { platform: '', url: '' }])} className="px-4 py-2 border border-line rounded-lg text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent transition">+ Add Payment Link</button>
            </div>
          </details>

          {/* Appointments */}
          <details className="group bg-tile border border-line rounded-2xl p-6 mb-6" open>
            <summary className="text-lg font-bold mb-1 list-none cursor-pointer select-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Appointments</span>
              <ChevronDown className="w-4 h-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
            <p className="text-xs text-ink-faint mb-4">Visitors pick a date and time from the days you're available. Requests appear in Dashboard → Appointments, where you can confirm or cancel them.</p>
            <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer mb-4">
              <input type="checkbox" checked={card.appointmentsEnabled ?? false} onChange={(e) => updateField('appointmentsEnabled', e.target.checked)} className="w-4 h-4 accent-accent rounded" />
              Allow appointment requests on this card
            </label>
            {card.appointmentsEnabled && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-ink mb-1.5">Meeting length</label>
                  <select
                    value={card.appointmentSettings?.durationMinutes ?? 30}
                    onChange={(e) => updateAppointmentSettings({ ...(card.appointmentSettings || {}), durationMinutes: Number(e.target.value) })}
                    className="px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>

                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-semibold text-ink">Weekly availability</label>
                  <span className="text-[11px] text-ink-faint">Times are shown in each visitor's local time</span>
                </div>
                <div className="space-y-1.5 mt-2">
                  {DAYS_OF_WEEK.map((label, dayIndex) => {
                    const hour = (card.appointmentSettings?.weeklyHours || []).find((h) => h.day === dayIndex);
                    return (
                      <div key={dayIndex} className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-ink w-24 flex-shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!hour}
                            onChange={(e) => {
                              const hours = [...(card.appointmentSettings?.weeklyHours || [])].filter((h) => h.day !== dayIndex);
                              if (e.target.checked) hours.push({ day: dayIndex, start: '09:00', end: '17:00' });
                              updateAppointmentSettings({ ...(card.appointmentSettings || {}), weeklyHours: hours });
                            }}
                            className="w-4 h-4 accent-accent rounded"
                          />
                          {label}
                        </label>
                        {hour && (
                          <div className="flex items-center gap-1.5">
                            <input type="time" value={hour.start} onChange={(e) => updateWeeklyHour(dayIndex, 'start', e.target.value)} className="px-2 py-1.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                            <span className="text-ink-faint text-sm">to</span>
                            <input type="time" value={hour.end} onChange={(e) => updateWeeklyHour(dayIndex, 'end', e.target.value)} className="px-2 py-1.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </details>

          {/* Lead Capture */}
          <details className="group bg-tile border border-line rounded-2xl p-6 mb-6" open>
            <summary className="text-lg font-bold mb-1 list-none cursor-pointer select-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Lead Capture</span>
              <ChevronDown className="w-4 h-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
            <p className="text-xs text-ink-faint mb-4">Show a contact form on your card so visitors can reach out even without signing in. Leads (name, email, phone, company, message) land in your Dashboard → Inquiries and notify you instantly.</p>
            <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
              <input type="checkbox" checked={card.leadFormEnabled ?? false} onChange={(e) => updateField('leadFormEnabled', e.target.checked)} className="w-4 h-4 accent-accent rounded" />
              Enable lead capture form on this card
            </label>
          </details>

          {/* Link List — Pro, full-width links below the card */}
          <details className="group bg-tile border border-line rounded-2xl p-6 mb-6" open>
            <summary className="text-lg font-bold mb-1 list-none cursor-pointer select-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Link List</span>
              <ChevronDown className="w-4 h-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
            <p className="text-xs text-ink-faint mb-4">A list of featured links shown below your card — handy for migrating from other link-in-bio services.</p>
            {(userData?.plan === 'pro' || userData?.plan === 'business') ? (
              <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer mb-4">
                <input type="checkbox" checked={card.featuredLinksEnabled ?? false} onChange={(e) => updateField('featuredLinksEnabled', e.target.checked)} className="w-4 h-4 accent-accent rounded" />
                Show link list on this card
              </label>
            ) : (
              <div className="flex items-center gap-2 text-sm text-ink-faint mb-4">
                <input type="checkbox" disabled className="w-4 h-4 accent-accent rounded opacity-50" />
                <span>Show link list on this card</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">— Pro</span>
              </div>
            )}
            {card.featuredLinksEnabled && (userData?.plan === 'pro' || userData?.plan === 'business') && (
              <div className="space-y-3">
                {Array.isArray(card.featuredLinks) && card.featuredLinks.map((l: FeaturedLink, i: number) => (
                  <div key={i} className="flex flex-wrap gap-2">
                    <input value={l.label} onChange={(e) => updateField('featuredLinks', (card.featuredLinks as FeaturedLink[]).map((fl, idx) => idx === i ? { ...fl, label: e.target.value } : fl))} placeholder="Label (e.g. My Portfolio)" className="w-full sm:w-[220px] px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                    <input value={l.url} onChange={(e) => updateField('featuredLinks', (card.featuredLinks as FeaturedLink[]).map((fl, idx) => idx === i ? { ...fl, url: e.target.value } : fl))} placeholder="https://example.com" className="flex-1 min-w-0 px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                    <button onClick={() => updateField('featuredLinks', (card.featuredLinks as FeaturedLink[]).filter((_, j) => j !== i))} className="px-3 py-2 text-danger text-sm font-bold border border-line rounded-lg hover:border-danger">×</button>
                  </div>
                ))}
                <button onClick={() => updateField('featuredLinks', [...(Array.isArray(card.featuredLinks) ? card.featuredLinks : []), { label: '', url: '' }])} className="px-4 py-2 border border-line rounded-lg text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent transition">+ Add Link</button>
              </div>
            )}
          </details>

          {/* Menu — Business */}
          <details className="group bg-tile border border-line rounded-2xl p-6 mb-6" open>
            <summary className="text-lg font-bold mb-1 list-none cursor-pointer select-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Menu</span>
              <ChevronDown className="w-4 h-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
            <p className="text-xs text-ink-faint mb-4">Add a simple menu for your food truck or venue. Items appear on your card page with a toggle to expand the full list.</p>
            {userData?.plan === 'business' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-sm font-semibold text-ink mb-1.5">Section title</label>
                    <input
                      value={card.menuTitle || ''}
                      onChange={(e) => updateField('menuTitle', e.target.value)}
                      placeholder="Menu (e.g. Services, Price List)"
                      className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
                    />
                    <p className="text-[11px] text-ink-faint mt-1">Leave blank for "Menu".</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-ink mb-1.5">Header icon</label>
                    <select
                      value={card.menuIcon || 'utensils'}
                      onChange={(e) => updateField('menuIcon', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
                    >
                      {MENU_ICON_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <MenuEditor value={card.menu || []} onChange={(menu) => updateField('menu', menu)} onUploadImage={uploadMenuImage} />
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-ink-faint">
                <UtensilsCrossed className="w-4 h-4" />
                <span>Menu is a Business-plan feature.</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">— Business</span>
              </div>
            )}
          </details>

          {/* Images */}
          <details className="group bg-tile border border-line rounded-2xl p-6 mb-6" open>
            <summary className="text-lg font-bold mb-4 list-none cursor-pointer select-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Images</span>
              <ChevronDown className="w-4 h-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
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
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-ink-muted w-16">Size</span>
                  <select
                    value={card.profileSize || 'medium'}
                    onChange={(e) => updateField('profileSize', e.target.value as 'small' | 'medium' | 'large')}
                    className="flex-1 px-2.5 py-2 bg-space border border-line rounded-lg text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-muted w-16">Shape</span>
                  <select
                    value={card.profileShape || 'circle'}
                    onChange={(e) => updateField('profileShape', e.target.value as 'circle' | 'rounded' | 'square')}
                    className="flex-1 px-2.5 py-2 bg-space border border-line rounded-lg text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="circle">Circle</option>
                    <option value="rounded">Rounded</option>
                    <option value="square">Square</option>
                  </select>
                </div>
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
                {/* Background tuning controls — always visible */}
                <div className={`mt-2 space-y-3 border-t border-line pt-3 ${!card.backgroundImage ? 'opacity-50 pointer-events-none' : ''}`}>
                  {!card.backgroundImage && (
                    <p className="text-[11px] text-ink-faint">Upload a background photo to enable these controls</p>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-muted w-16">Display</span>
                    <select
                      value={card.bgDisplayMode || 'full'}
                      onChange={(e) => updateField('bgDisplayMode', e.target.value as 'full' | 'header')}
                      className="flex-1 px-2.5 py-2 bg-space border border-line rounded-lg text-sm focus:outline-none focus:border-accent"
                    >
                      <option value="full">Full card</option>
                      <option value="header">Header only</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-ink-muted">Overlay opacity</span>
                      <span className="text-xs font-bold text-ink">{Math.round((card.bgOpacity ?? 0.6) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={card.bgOpacity ?? 0.6}
                      onChange={(e) => updateField('bgOpacity', parseFloat(e.target.value))}
                      className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-ink-faint mt-0.5">
                      <span>Clear image</span>
                      <span>Solid color</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-muted w-16">Size</span>
                    <select value={card.bgSize || 'cover'} onChange={(e) => updateField('bgSize', e.target.value)} className="flex-1 px-2.5 py-2 bg-space border border-line rounded-lg text-sm focus:outline-none focus:border-accent">
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                  {card.backgroundImage && (
                    <BackgroundPositioner
                      imageUrl={card.backgroundImage}
                      opacity={card.bgOpacity ?? 0.6}
                      position={card.bgPosition || 'center'}
                      zoom={(card.bgZoom ?? 100) / 100}
                      rotation={card.bgRotation ?? 0}
                      onPositionChange={(pos) => updateField('bgPosition', pos)}
                      onZoomChange={(z) => updateField('bgZoom', z === 100 ? undefined : z)}
                      onRotationChange={(r) => updateField('bgRotation', r)}
                      accentColor={card.accentColor || '#f5b940'}
                    />
                  )}
                </div>
              </div>
            </div>
          </details>
          <details className="group bg-tile border border-line rounded-2xl p-6 mb-6" open>
            <summary className="text-lg font-bold mb-4 list-none cursor-pointer select-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Back Background Photo</span>
              <ChevronDown className="w-4 h-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload('backBackgroundImage', e.target.files[0])} className="text-sm text-ink-muted file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-line file:bg-tile file:text-ink file:text-sm file:font-semibold" />
            {card.backBackgroundImage && (
              <div className="flex items-center gap-2 mt-2">
                <img src={card.backBackgroundImage} alt="" className="w-24 h-16 rounded-lg object-cover border border-line" />
                <button type="button" onClick={() => updateField('backBackgroundImage', undefined)} className="text-xs text-danger font-bold border border-line rounded-lg px-2 py-1 hover:border-danger transition">Remove</button>
              </div>
            )}
            <div className={`mt-2 space-y-3 border-t border-line pt-3 ${!(card.backBackgroundImage || card.backgroundImage) ? 'opacity-50 pointer-events-none' : ''}`}>
              {!(card.backBackgroundImage || card.backgroundImage) && (
                <p className="text-[11px] text-ink-faint">Upload a back background photo to enable these controls</p>
              )}
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-muted w-16">Size</span>
                <select value={card.bgSize || 'cover'} onChange={(e) => updateField('bgSize', e.target.value)} className="flex-1 px-2.5 py-2 bg-space border border-line rounded-lg text-sm focus:outline-none focus:border-accent">
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
              {(card.backBackgroundImage || card.backgroundImage) && (
                <BackgroundPositioner
                  imageUrl={card.backBackgroundImage || card.backgroundImage || ''}
                  opacity={card.bgOpacity ?? 0.6}
                  position={card.backBgPosition || card.bgPosition || 'center'}
                  zoom={(card.backBgZoom ?? card.bgZoom ?? 100) / 100}
                  rotation={card.backBgRotation ?? card.bgRotation ?? 0}
                  onPositionChange={(pos) => updateField('backBgPosition', pos)}
                  onZoomChange={(z) => updateField('backBgZoom', z === 100 ? undefined : z)}
                  onRotationChange={(r) => updateField('backBgRotation', r)}
                  accentColor={card.accentColor || '#f5b940'}
                />
              )}
            </div>
          </details>
        </main>

        {/* Desktop sticky preview */}
        <aside className="hidden lg:block lg:sticky lg:top-14 self-start">
          <div className="bg-tile border border-line rounded-2xl p-3">
            <div className="text-[10px] text-ink-faint uppercase tracking-wider font-semibold mb-3">Live Page Preview</div>
            <LivePagePreview card={card} layout="row" />
          </div>
        </aside>
      </div>

      {/* Persistent bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-space/95 backdrop-blur-xl border-t border-line-soft px-3 md:px-6 py-2.5 flex items-center justify-between gap-1.5">
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary btn-sm">Cancel</button>
        <div className="flex items-center gap-1.5">
          {card.slug?.trim() && (
            <>
              <button onClick={() => setShareOpen(true)} className="btn btn-secondary btn-sm"><Copy className="w-3.5 h-3.5" /> Copy Link</button>
              <a href={`/card/${slugify(card.slug)}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><ExternalLink className="w-3.5 h-3.5" /> View</a>
            </>
          )}
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-md">
            {saving ? (<>Saving…<span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /></>) : 'Save'}
          </button>
        </div>
      </div>
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={`${typeof window !== 'undefined' ? window.location.origin : 'https://nowncard.com'}/card/${slugify(card.slug || '')}`}
        title={`${card.firstName || ''} ${card.lastName || ''}`.trim() || 'My NownCard'}
      />

      {/* Mobile preview toggle */}
      <button
        onClick={() => setPreviewOpen((o) => !o)}
        className="lg:hidden fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-accent text-space flex items-center justify-center shadow-lg hover:brightness-110 transition"
        aria-label="Toggle preview"
      >
        {previewOpen ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>

      {previewOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setPreviewOpen(false)}>
          <div className="bg-tile border border-line rounded-2xl p-4 max-w-[380px] w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-[10px] text-ink-faint uppercase tracking-wider font-semibold mb-3">Live Page Preview</div>
            <LivePagePreview card={card} />
            <button onClick={() => setPreviewOpen(false)} className="btn btn-primary btn-md w-full mt-4">
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
