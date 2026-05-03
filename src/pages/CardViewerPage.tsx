import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, limit, getDocs, doc, updateDoc, increment, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { downloadVCard } from '@/lib/vcard';
import { escHtml, initials, fullName, orgLine, formatAddress, shareCard } from '@/lib/utils';
import type { Card } from '@/types';

const PLAT: Record<string, string> = {
  linkedin: 'LinkedIn', twitter: 'X/Twitter', x: 'X/Twitter',
  github: 'GitHub', instagram: 'Instagram', youtube: 'YouTube',
  facebook: 'Facebook', tiktok: 'TikTok', website: 'Website',
};

const IconPhone = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IconMail = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
const IconGlobe = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IconPin = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconDownload = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-[18px] h-[18px]"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10 12 15 17 10"/><path d="M12 15V3"/></svg>;

export default function CardViewerPage() {
  const { slug } = useParams<{ slug: string }>();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!slug) { setError('No card slug provided'); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        let snap = await getDocs(query(collection(db, 'publicCards'), where('slug', '==', slug), limit(1)));
        let data: Card | null = null;
        if (!snap.empty) { const d = snap.docs[0]; data = { id: d.id, ...d.data() } as Card; }
        else {
          const c = await getDocs(query(collection(db, 'cards'), where('slug', '==', slug), where('isPublic', '==', true), limit(1)));
          if (!c.empty) { const d = c.docs[0]; data = { id: d.id, ...d.data() } as Card; }
        }
        if (cancelled) return;
        if (!data) { setError(`The card "${escHtml(slug)}" does not exist or is not public.`); }
        else {
          setCard(data);
          document.title = `${fullName(data) || 'Contact'} — NownCard`;
          try { await updateDoc(doc(db, 'cards', data.id), { viewCount: increment(1) }); } catch {}
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load card. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const track = async (type: string) => {
    if (!card) return;
    try { await setDoc(doc(db, 'analytics', card.id), { [`taps.${type}`]: increment(1), updatedAt: serverTimestamp() }, { merge: true }); } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-space flex flex-col items-center justify-center text-ink-muted">
        <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin mb-4" />
        <p>Loading card…</p>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-space flex flex-col items-center justify-center px-6">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-xl font-bold text-ink mb-2">Card Not Found</h1>
        <p className="text-ink-muted text-sm max-w-xs text-center">{error}</p>
        <a href="/" className="mt-6 px-5 py-2.5 bg-accent text-space font-bold rounded-xl text-sm hover:brightness-110 transition">Create your own →</a>
      </div>
    );
  }

  const name = fullName(card);
  const init = initials(card.firstName, card.lastName);
  const org = orgLine(card);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`${window.location.origin}/${card.slug}`)}`;
  const bgStyle = card.backgroundImage ? { backgroundImage: `url('${escHtml(card.backgroundImage)}')` } : undefined;

  const phones = card.phones?.length ? card.phones : (card.phone ? [{ type: 'cell', number: card.phone }] : []);
  const emails = card.emails?.length ? card.emails : (card.email ? [{ type: 'work', address: card.email }] : []);
  const addrs = card.addresses?.length ? card.addresses : (card.address ? [{ type: 'work', street: card.address }] : []);

  let socials: { platform: string; url: string }[] = [];
  if (Array.isArray(card.socialLinks)) socials = card.socialLinks.filter((s) => s?.url);
  else if (typeof card.socialLinks === 'object' && card.socialLinks !== null)
    socials = Object.entries(card.socialLinks).filter(([, v]) => v).map(([k, v]) => ({ platform: k, url: v as string }));

  return (
    <div className="min-h-screen bg-space flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 max-w-lg mx-auto w-full">
        <a href="/" className="flex items-center gap-2.5 text-ink font-bold text-[15px] no-underline">
          <img src="/nowncard-logo.png" alt="" className="h-[30px] w-auto object-contain rounded-lg" />
          <span>NownCard</span>
        </a>
      </div>

      {/* Card stage */}
      <div className="flex-1 flex flex-col items-center px-5 pt-2 pb-24">
        <div className="w-full max-w-[380px] aspect-[2/3.5] perspective-1200 relative" onClick={() => setFlipped((f) => !f)}>
          <div className={`w-full h-full preserve-3d transition-transform duration-[800ms] ${flipped ? 'rotate-y-180' : ''}`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            {/* Front */}
            <div className="card-face bg-card-bg flex flex-col">
              {card.backgroundImage && (
                <>
                  <div className="absolute inset-0 bg-cover bg-center" style={bgStyle} />
                  <div className="absolute inset-0 bg-gradient-to-br from-[rgba(244,241,236,0.92)] via-[rgba(244,241,236,0.75)] to-[rgba(244,241,236,0.9)]" />
                </>
              )}
              <div className="relative z-10 flex-1 flex flex-col p-6 pb-5">
                <div className="flex items-start gap-4 mb-5">
                  {card.profileImage ? (
                    <div className="w-[72px] h-[72px] rounded-full overflow-hidden border-[3px] border-[rgba(42,37,32,0.1)] shadow-md flex-shrink-0">
                      <img src={card.profileImage} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-[#d4cfc8] to-[#e8e4de] flex items-center justify-center text-[22px] font-extrabold text-[#6b6256] border-[3px] border-[rgba(42,37,32,0.1)] shadow-md flex-shrink-0">
                      {init}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[22px] font-extrabold leading-tight tracking-tight text-[#1a1612]">{name || 'Anonymous'}</div>
                    {org && <div className="text-[13px] font-semibold text-[#6b6256] mt-1">{org}</div>}
                    {card.bio && <div className="text-xs text-[#7a7166] leading-relaxed mt-2">{card.bio}</div>}
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-[rgba(42,37,32,0.12)] to-transparent my-1.5" />

                <div className="flex flex-col gap-2">
                  {phones.map((p, i) => (
                    <a key={`p-${i}`} href={`tel:${p.number}`} className="flex items-center gap-2.5 text-[13px] text-[#4a4238] no-underline" onClick={(e) => { e.stopPropagation(); track('call'); }}>
                      <IconPhone /> {p.number}
                    </a>
                  ))}
                  {emails.map((e, i) => (
                    <a key={`e-${i}`} href={`mailto:${e.address}`} className="flex items-center gap-2.5 text-[13px] text-[#4a4238] no-underline" onClick={(ev) => { ev.stopPropagation(); track('email'); }}>
                      <IconMail /> {e.address}
                    </a>
                  ))}
                  {card.website && (
                    <a href={card.website.startsWith('http') ? card.website : `https://${card.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-[13px] text-[#4a4238] no-underline" onClick={(e) => { e.stopPropagation(); track('website'); }}>
                      <IconGlobe /> {card.website}
                    </a>
                  )}
                  {addrs.map((a, i) => {
                    const line = formatAddress(a);
                    return line ? (
                      <a key={`a-${i}`} href={`https://maps.google.com/?q=${encodeURIComponent(line)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-[13px] text-[#4a4238] no-underline" onClick={(e) => { e.stopPropagation(); track('map'); }}>
                        <IconPin /> {line}
                      </a>
                    ) : null;
                  })}
                </div>

                {socials.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-auto pt-4">
                    {socials.map((s, i) => (
                      <a key={`s-${i}`} href={s.url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-[rgba(42,37,32,0.05)] text-[#5a5046] border border-[rgba(42,37,32,0.08)] no-underline" onClick={(e) => { e.stopPropagation(); track(`social:${s.platform}`); }}>
                        {PLAT[s.platform.toLowerCase()] || s.platform}
                      </a>
                    ))}
                  </div>
                )}

                <div className="text-center text-[11px] text-[#9a9186] mt-3 tracking-wide">Tap to flip · QR on back</div>
              </div>
            </div>

            {/* Back */}
            <div className="card-face bg-card-bg flex flex-col items-center justify-center p-7 text-center" style={{ transform: 'rotateY(180deg)' }}>
              <img src="/nowncard-logo.png" alt="" className="h-10 w-auto object-contain mb-3" />
              <div className="text-lg font-extrabold text-[#1a1612] mb-1">{name || 'Contact'}</div>
              <div className="text-xs text-[#7a7166] mb-5">Scan to save</div>
              <div className="bg-white rounded-xl p-3 shadow-sm mb-5">
                <img src={qrUrl} alt="QR Code" className="w-[150px] h-[150px] block" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '<p class="text-[#333] text-xs">QR unavailable</p>'; }} />
              </div>
              <div className="flex gap-2.5">
                <button onClick={(e) => { e.stopPropagation(); downloadVCard(card); track('save'); }} className="px-[18px] py-2 rounded-[10px] text-[13px] font-bold bg-[#2a2520] text-[#f4f1ec] border-none cursor-pointer font-sans">Save</button>
                <button onClick={(e) => { e.stopPropagation(); shareCard(name); track('share'); }} className="px-[18px] py-2 rounded-[10px] text-[13px] font-bold bg-transparent text-[#4a4238] border border-[rgba(42,37,32,0.15)] cursor-pointer font-sans">Share</button>
              </div>
              <div className="absolute bottom-3.5 text-[11px] text-[#9a9186]">Tap to flip back</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-[rgba(10,14,26,0.92)] backdrop-blur-xl px-4 py-3">
        <button onClick={() => { downloadVCard(card); track('save'); }} className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-[15px] font-bold bg-card-bg text-space border-none cursor-pointer">
          <IconDownload /> Save to contacts
        </button>
      </div>

      {/* Footer */}
      <div className="text-center py-6">
        <a href="/" className="text-xs font-semibold text-ink-faint hover:text-ink no-underline">Built with NownCard</a>
      </div>
    </div>
  );
}
