import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Link2, QrCode, Download, Palette, Smartphone, Leaf, Star } from 'lucide-react';
import DemoCard from '@/components/DemoCard';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/auth-context';
import { useTheme } from '@/hooks/useThemeContext';
import { createSquareCheckout, getPricing, type PricingConfig } from '@/lib/payments';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Review } from '@/types';
import { toast } from 'sonner';

export default function LandingPage() {
  const { user, userData, signInEmail, signUpEmail, signInGoogle, linkGoogle, error } = useAuth();
  const { resolved: themeResolved } = useTheme();
  const [authOpen, setAuthOpen] = useState(false);
  const [pricing, setPricing] = useState<PricingConfig>({ proPrice: 19, businessPrice: 39 });
  const [featuredReviews, setFeaturedReviews] = useState<Review[]>([]);

  useEffect(() => {
    getPricing().then(setPricing).catch(() => {});
  }, []);

  const faqs = useMemo(() => [
    {
      q: 'What is a digital business card?',
      a: 'A digital business card is a mobile-friendly web page that displays your contact information, photo, social links, and more. Recipients can save your details as a vCard with one tap — no app required. It\'s like a physical business card, but always with you and never runs out.',
    },
    {
      q: 'Do recipients need to download an app?',
      a: 'No. Your card opens in any browser — on any phone, tablet, or computer. Recipients can call, email, visit your website, follow your socials, and save your contact directly from the page. Nothing to install.',
    },
    {
      q: 'Can I use my own domain or branding?',
      a: 'Yes. Pro and Business plans let you remove NownCard branding and use custom colors, fonts, and layouts. Business plans support white-label cards with no external branding at all.',
    },
    {
      q: 'How does the QR code and NFC work?',
      a: 'Every card automatically gets a QR code that links directly to your card page. For NFC, you can program a physical NFC tag to open your card when tapped — great for keychains, stickers, or business card blanks. Writing tags works from Android Chrome (Web NFC); any NFC-enabled phone can then tap the tag to open the card.',
    },
    {
      q: 'Is there a free plan?',
      a: `Yes — the Free plan gives you one digital card with a shareable link, QR code, vCard export, and basic analytics. Upgrade to Pro ($${pricing.proPrice}/year) for up to 5 cards, custom fonts, and no branding. Business ($${pricing.businessPrice}/year) adds unlimited cards, team features, and white-label options.`,
    },
    {
      q: 'Can I update my card after sharing it?',
      a: 'Absolutely. Your card lives at a permanent URL. Update your info, photo, or design anytime — everyone who has your link sees the latest version instantly. No reprinting, no "sorry, that\'s my old number."',
    },
  ], [pricing.proPrice, pricing.businessPrice]);

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, 'reviews'), where('featured', '==', true), limit(6));
        const snap = await getDocs(q);
        setFeaturedReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review));
      } catch {
        setFeaturedReviews([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-space">
      <Navbar onAuthClick={() => setAuthOpen(true)} />

      <main>
      {/* Hero */}
      <section className="relative overflow-x-clip text-center px-6 pt-16 pb-12 max-w-2xl mx-auto">
        <div aria-hidden className="pointer-events-none absolute -z-10 -inset-x-24 -top-24 h-[28rem] bg-[radial-gradient(ellipse_at_top,rgba(245,185,64,0.20),transparent_60%)]" />
        <div aria-hidden className="pointer-events-none absolute -z-10 -inset-x-24 top-32 h-[28rem] bg-[radial-gradient(ellipse_at_top,rgba(116,184,255,0.14),transparent_60%)]" />
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-tile border border-line rounded-full text-accent text-xs font-bold uppercase tracking-wider mb-8">
          Your card. Your brand. Anywhere.
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
          Digital Business Cards<br /><span className="text-accent">That Work Everywhere</span>
        </h1>
        <p className="text-lg text-ink-muted max-w-lg mx-auto mb-8">
          Create a beautiful digital card in seconds. Share via link, QR code, or NFC tap. Download as a vCard. No app required for recipients.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {user ? (
            <Link to="/editor" className="btn btn-primary btn-xl no-underline">Create Your Card</Link>
          ) : (
            <button onClick={() => setAuthOpen(true)} className="btn btn-primary btn-xl cursor-pointer">Create Your Card</button>
          )}
          <Link to="/rolodex" className="btn btn-secondary btn-xl no-underline">Card Directory</Link>
          <a href="#pricing" className="btn btn-secondary btn-xl">View Plans</a>
        </div>

        {/* Interactive demo card */}
        <div className="mt-14 mx-auto max-w-[380px]">
          <DemoCard forceLight={themeResolved === 'dark'} />
        </div>
      </section>

      {/* Pain Points */}
      <section className="bg-space-2 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-rose-500 dark:text-rose-400 mb-10">Does This Sound Familiar?</h2>
          <div className="space-y-5">
            {[
              {
                title: '"Let me text you my number — wait, what was it?"',
                desc: 'You meet someone at an event. You fumble through your phone, dictate your number while they type it in, or worse, scribble it on a napkin. Not exactly a great first impression.',
              },
              {
                title: '"I ran out of business cards again."',
                desc: 'You ordered 500 cards six months ago. Half are still in the box. The rest are in a desk drawer back at the office, and you are at a conference three states away. Physical cards are expensive, static, and never where you need them.',
              },
              {
                title: '"I looked at digital card apps but they felt complicated."',
                desc: 'Too many features you do not need. Clunky editors. Apps to download. Platforms that want to own your data. You just want something simple that looks great and works everywhere, with no app required for the person receiving it.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-tile border border-line rounded-2xl p-6 hover:border-accent/30 transition">
                <h3 className="text-base font-bold text-ink-muted italic mb-2">{item.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-ink-muted mt-8">
            We built NownCard because we lived every one of these. One link, one tap, your card wherever you are.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-space-2 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-sky-500 dark:text-sky-400 mb-10">Everything You Need</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <Link2 className="w-5 h-5" />, title: 'Shareable Link', desc: 'Every card gets a clean URL. Share it anywhere — text, email, social, or embed it in your signature.', chip: 'text-amber-400 bg-amber-500/10 border border-amber-500/25' },
              { icon: <QrCode className="w-5 h-5" />, title: 'QR Code', desc: 'Instant QR for every card. Print it on flyers, posters, or your phone wallpaper.', chip: 'text-sky-400 bg-sky-500/10 border border-sky-500/25' },
              { icon: <Download className="w-5 h-5" />, title: 'vCard Export', desc: 'One tap adds your contact to any phone. Works with Apple, Android, and Outlook.', chip: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/25' },
              { icon: <Palette className="w-5 h-5" />, title: 'Custom Design', desc: 'Choose your theme, accent color, fonts, and layout. Make it unmistakably yours.', chip: 'text-violet-400 bg-violet-500/10 border border-violet-500/25' },
              { icon: <Smartphone className="w-5 h-5" />, title: 'NFC Ready', desc: 'Tap any programmed tag with an NFC-enabled phone to open your card instantly. Program tags right from Android Chrome.', chip: 'text-teal-400 bg-teal-500/10 border border-teal-500/25' },
              { icon: <Leaf className="w-5 h-5" />, title: 'Eco Friendly', desc: 'Skip the paper waste. Every digital card saves resources compared to printed cards that often end up in the trash.', chip: 'text-lime-400 bg-lime-500/10 border border-lime-500/25' },
            ].map((f) => (
              <div key={f.title} className="bg-tile border border-line rounded-2xl p-5 text-left hover:-translate-y-1 hover:shadow-surface transition">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.chip}`}>{f.icon}</div>
                <h3 className="text-base font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sustainability */}
      <section className="py-16 px-6 max-w-3xl mx-auto text-center">
        <div className="bg-tile border border-line rounded-2xl p-8 md:p-10">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
            <Leaf className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold mb-3">Better for the Planet</h2>
          <p className="text-ink-muted max-w-lg mx-auto leading-relaxed">
            The average business card is held for less than 10 seconds before being lost, tossed, or forgotten. Billions are printed every year, consuming trees, water, and energy, only to end up in landfills within weeks. A digital NownCard is infinitely reusable, instantly updatable, and leaves no physical waste behind. Same first impression, zero carbon footprint.
          </p>
        </div>
      </section>

      {/* Testimonials — featured reviews from users */}
      {featuredReviews.length > 0 && (
        <section id="reviews" className="bg-space-2 py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-extrabold text-center text-violet-500 dark:text-violet-400 mb-3">Loved by Professionals</h2>
            <p className="text-ink-muted text-center mb-10">Real feedback from the people using NownCard every day.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredReviews.map((r) => (
                <div key={r.id} className="bg-tile border border-line rounded-2xl p-6 flex flex-col">
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-4 h-4 ${n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-ink-faint'}`} />
                    ))}
                  </div>
                  <p className="text-sm text-ink leading-relaxed flex-1">"{r.content}"</p>
                  <div className="mt-4 pt-4 border-t border-line-soft">
                    <div className="text-sm font-bold">{r.displayName || 'NownCard User'}</div>
                    {r.company && <div className="text-xs text-ink-muted">{r.company}</div>}
                  </div>
                </div>
              ))}
            </div>
            {!user && (
              <p className="text-center text-sm text-ink-muted mt-8">
                Used a digital card that changed how you network?{' '}
                <button onClick={() => setAuthOpen(true)} className="text-accent font-semibold hover:underline cursor-pointer bg-transparent border-none">Leave a review</button>
                .
              </p>
            )}
          </div>
        </section>
      )}

      {/* Audience */}
      <section className="py-16 px-6 max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-extrabold mb-10">Who Is It For?</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {['Freelancers', 'Consultants', 'Real Estate Agents', 'Sales Professionals', 'Startups', 'Small Business Owners', 'Creative Agencies', 'Coaches & Trainers', 'Event Organizers', 'Anyone Who Networks'].map((tag) => (
            <span key={tag} className="px-5 py-2.5 bg-tile border border-line rounded-full text-sm text-ink hover:border-accent hover:text-accent transition cursor-default">{tag}</span>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-space-2 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-accent mb-2">Simple Plans</h2>
          <p className="text-ink-muted mb-10">Start free. Upgrade when you need more.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
            <div className="bg-tile border border-line rounded-2xl p-7 hover:-translate-y-1 hover:shadow-surface transition">
              <h3 className="text-xl font-extrabold">Free</h3>
              <p className="text-sm text-ink-faint mt-1">For individuals</p>
              <div className="flex items-baseline gap-1 my-4"><span className="text-4xl font-extrabold">$0</span><span className="text-sm text-ink-faint">forever</span></div>
              <ul className="space-y-2 text-sm text-ink-muted mb-6">
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> 1 digital card</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Shareable link + QR</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> vCard export</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Light &amp; dark themes</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Card directory</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Basic analytics</li>
              </ul>
              {user ? (
                <Link to="/editor" className="btn btn-secondary btn-lg block w-full text-center no-underline">Get Started</Link>
              ) : (
                <button onClick={() => setAuthOpen(true)} className="btn btn-secondary btn-lg block w-full text-center cursor-pointer">Get Started</button>
              )}
            </div>

            <div className="bg-tile border-2 border-accent rounded-2xl p-7 relative hover:-translate-y-1 hover:shadow-surface transition">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-space text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Most Popular</span>
              <h3 className="text-xl font-extrabold">Pro</h3>
              <p className="text-sm text-ink-faint mt-1">For professionals</p>
              <div className="flex items-baseline gap-1 my-4"><span className="text-4xl font-extrabold">${pricing.proPrice}</span><span className="text-sm text-ink-faint">/year</span></div>
              <ul className="space-y-2 text-sm text-ink-muted mb-6">
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Up to 5 cards</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> 10 curated fonts</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Custom colors &amp; backgrounds</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Full analytics dashboard</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> NFC + QR + vCard</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> No branding</li>
              </ul>
              <button onClick={async () => {
                if (!user) { setAuthOpen(true); return; }
                if (userData?.plan === 'pro' || userData?.plan === 'business') { toast.error('You already have Pro or Business'); return; }
                try { const origin = window.location.origin; const result = await createSquareCheckout('pro', pricing.proPrice, `${origin}/success`, `${origin}/cancel`); window.location.href = result.url; } catch (e) { console.error(e); toast.error('Payment setup failed. Please try again.'); }
              }} className="btn btn-primary btn-lg block w-full text-center text-sm cursor-pointer">Upgrade</button>
            </div>

            <div className="bg-tile border border-line rounded-2xl p-7 hover:-translate-y-1 hover:shadow-surface transition">
              <h3 className="text-xl font-extrabold">Business</h3>
              <p className="text-sm text-ink-faint mt-1">For teams</p>
              <div className="flex items-baseline gap-1 my-4"><span className="text-4xl font-extrabold">${pricing.businessPrice}</span><span className="text-sm text-ink-faint">/year</span></div>
              <ul className="space-y-2 text-sm text-ink-muted mb-6">
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Unlimited cards</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Team cards for employees</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Upload your own font</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Business name layout</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> White-label cards</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Priority support</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Everything in Pro</li>
              </ul>
              <button onClick={async () => {
                if (!user) { setAuthOpen(true); return; }
                if (userData?.plan === 'business') { toast.error('You already have Business'); return; }
                try { const origin = window.location.origin; const result = await createSquareCheckout('business', pricing.businessPrice, `${origin}/success`, `${origin}/cancel`); window.location.href = result.url; } catch (e) { console.error(e); toast.error('Payment setup failed. Please try again.'); }
              }} className="btn btn-secondary btn-lg block w-full text-center text-sm cursor-pointer">Upgrade</button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6 max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-extrabold text-center mb-10">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <details key={faq.q} className="bg-tile border border-line rounded-2xl group">
              <summary className="p-5 text-sm font-bold cursor-pointer hover:text-accent transition select-none">{faq.q}</summary>
              <p className="px-5 pb-5 text-sm text-ink-muted leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqs.slice(0, 4).map((faq) => ({
                '@type': 'Question',
                name: faq.q,
                acceptedAnswer: { '@type': 'Answer', text: faq.a },
              })),
            }),
          }}
        />
      </section>

      {/* Support */}
      <section className="py-14 px-6 text-center max-w-xl mx-auto">
        <h2 className="text-xl font-extrabold mb-2">Support NownCard</h2>
        <p className="text-sm text-ink-muted mb-5">
          We're keeping the platform ad-free. If NownCard helps you land a client or save a contact, a tip goes directly toward server costs.
        </p>
        <a href="https://square.link/u/ZyAyKBUp?src=sheet" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-md no-underline">
          Leave a Tip
        </a>
      </section>

      </main>

      <Footer />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignInEmail={signInEmail}
        onSignUpEmail={signUpEmail}
        onSignInGoogle={signInGoogle}
        onLinkGoogle={linkGoogle}
        error={error}
        isAuthenticated={!!user}
      />
    </div>
  );
}
