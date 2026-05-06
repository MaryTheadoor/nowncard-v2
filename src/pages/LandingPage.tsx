import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, QrCode, Download, Palette, Zap } from 'lucide-react';
import CardPreview from '@/components/CardPreview';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/hooks/useAuth';
import { createPendingUpgrade, SQUARE_LINKS } from '@/lib/payments';
import { toast } from 'sonner';

export default function LandingPage() {
  const { user, userData, signInEmail, signUpEmail, signInGoogle, linkGoogle, signInAnon, error } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-space overflow-x-hidden">
      <Navbar onAuthClick={() => setAuthOpen(true)} userEmail={user?.email} isAdmin={userData?.isAdmin} defaultCardSlug={userData?.defaultCardSlug} />

      {/* Hero */}
      <section className="text-center px-6 pt-16 pb-12 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-tile border border-line rounded-full text-accent text-xs font-bold uppercase tracking-wider mb-8">
          <Zap className="w-3.5 h-3.5" /> Your card. Your brand. Anywhere.
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
          Digital Business Cards<br /><span className="text-accent">That Work Everywhere</span>
        </h1>
        <p className="text-lg text-ink-muted max-w-lg mx-auto mb-8">
          Create a beautiful digital card in seconds. Share via NFC, QR code, link, or vCard. No app required for recipients.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {user ? (
            <Link to="/editor" className="px-7 py-3 bg-accent text-space font-bold rounded-full hover:brightness-110 transition inline-block no-underline">Create Your Card</Link>
          ) : (
            <button onClick={() => setAuthOpen(true)} className="px-7 py-3 bg-accent text-space font-bold rounded-full hover:brightness-110 transition cursor-pointer">Create Your Card</button>
          )}
          <Link to="/rolodex" className="px-7 py-3 border border-line text-ink font-bold rounded-full hover:bg-tile-soft transition inline-block no-underline">Browse</Link>
          <a href="#features" className="px-7 py-3 border border-line text-ink font-bold rounded-full hover:bg-tile-soft transition">Learn More</a>
        </div>

        {/* Demo card preview */}
        <div className="mt-12 mx-auto max-w-[380px]">
          <CardPreview
            card={{
              id: 'demo',
              slug: 'jane-doe',
              firstName: 'Jane',
              lastName: 'Doe',
              jobTitle: 'Product Designer',
              company: 'NownCard',
              email: 'jane@example.com',
              phone: '+1 555 123 4567',
              website: 'https://jane.design',
              bio: 'Building beautiful digital experiences. Always happy to connect.',
              cardTheme: 'dark',
              accentColor: '#c9a278',
              isPublic: true,
              socialLinks: { linkedin: 'https://linkedin.com', twitter: 'https://twitter.com' },
            }}
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-space-2 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center mb-10">Everything You Need</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: <Smartphone className="w-5 h-5" />, title: 'NFC Ready', desc: 'Tap-to-share with any NFC-enabled phone. No app needed on the receiving end.' },
              { icon: <QrCode className="w-5 h-5" />, title: 'QR Code', desc: 'Instant QR code for every card. Print it, share it, scan it anywhere.' },
              { icon: <Download className="w-5 h-5" />, title: 'vCard Export', desc: 'One tap adds your contact to any phone. Works with Apple, Android, and Outlook.' },
              { icon: <Palette className="w-5 h-5" />, title: 'Custom Design', desc: 'Choose your theme, accent color, and layout. Make it unmistakably yours.' },
            ].map((f) => (
              <div key={f.title} className="bg-tile border border-line rounded-2xl p-6 text-left hover:-translate-y-1 hover:shadow-surface transition">
                <div className="w-10 h-10 rounded-xl bg-tile-soft border border-line flex items-center justify-center text-accent mb-4">{f.icon}</div>
                <h3 className="text-base font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className="py-16 px-6 max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-extrabold mb-8">Who Is It For?</h2>
        <div className="flex flex-wrap justify-center gap-2.5">
          {['Freelancers', 'Consultants', 'Real Estate Agents', 'Sales Professionals', 'Startups', 'Small Business', 'Creative Agencies', 'Coaches', 'Event Organizers', 'Anyone Networking'].map((tag) => (
            <span key={tag} className="px-4 py-2 bg-tile border border-line rounded-full text-sm text-ink-muted hover:border-accent hover:text-accent transition cursor-default">{tag}</span>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-space-2 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold mb-2">Simple Plans</h2>
          <p className="text-ink-muted mb-10">Start free. Upgrade when you need more.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
            <div className="bg-tile border border-line rounded-2xl p-7 hover:-translate-y-1 hover:shadow-surface transition">
              <h3 className="text-xl font-extrabold">Free</h3>
              <p className="text-sm text-ink-faint mt-1">For individuals</p>
              <div className="flex items-baseline gap-1 my-4"><span className="text-4xl font-extrabold">$0</span><span className="text-sm text-ink-faint">forever</span></div>
              <ul className="space-y-2 text-sm text-ink-muted mb-6">
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> 1 digital card</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> NFC + QR sharing</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> vCard export</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Light &amp; dark themes</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Browse directory</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Basic analytics</li>
              </ul>
              {user ? (
                <Link to="/editor" className="block w-full py-2.5 text-center border border-line text-ink font-bold rounded-full hover:bg-tile-soft transition text-sm no-underline">Get Started</Link>
              ) : (
                <button onClick={() => setAuthOpen(true)} className="block w-full py-2.5 text-center border border-line text-ink font-bold rounded-full hover:bg-tile-soft transition text-sm cursor-pointer">Get Started</button>
              )}
            </div>

            <div className="bg-tile border-2 border-accent rounded-2xl p-7 relative hover:-translate-y-1 hover:shadow-surface transition">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-space text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Most Popular</span>
              <h3 className="text-xl font-extrabold">Pro</h3>
              <p className="text-sm text-ink-faint mt-1">For professionals</p>
              <div className="flex items-baseline gap-1 my-4"><span className="text-4xl font-extrabold">$19</span><span className="text-sm text-ink-faint">/year</span></div>
              <ul className="space-y-2 text-sm text-ink-muted mb-6">
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Up to 5 cards</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> 10 curated fonts</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Custom colors &amp; backgrounds</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Full analytics dashboard</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> NFC + QR + vCard</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> No branding</li>
              </ul>
              <button onClick={async () => { if (!user) { setAuthOpen(true); return; } try { await createPendingUpgrade(user.uid, 'pro', 19); const url = SQUARE_LINKS.pro + '&redirect_url=' + encodeURIComponent(window.location.origin + '/success') + '&cancel_url=' + encodeURIComponent(window.location.origin + '/cancel'); window.location.href = url; } catch (e) { console.error(e); toast.error('Payment setup failed. Please try again.'); } }} className="block w-full py-2.5 text-center bg-accent text-space font-bold rounded-full hover:brightness-110 transition text-sm cursor-pointer">Upgrade</button>
            </div>

            <div className="bg-tile border border-line rounded-2xl p-7 hover:-translate-y-1 hover:shadow-surface transition">
              <h3 className="text-xl font-extrabold">Business</h3>
              <p className="text-sm text-ink-faint mt-1">For teams</p>
              <div className="flex items-baseline gap-1 my-4"><span className="text-4xl font-extrabold">$39</span><span className="text-sm text-ink-faint">/year</span></div>
              <ul className="space-y-2 text-sm text-ink-muted mb-6">
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Unlimited cards</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Team cards for employees</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Upload your own font</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Business name layout</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> White-label cards</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Priority support</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Everything in Pro</li>
              </ul>
              <button onClick={async () => { if (!user) { setAuthOpen(true); return; } try { await createPendingUpgrade(user.uid, 'business', 49); const url = SQUARE_LINKS.business + '&redirect_url=' + encodeURIComponent(window.location.origin + '/success') + '&cancel_url=' + encodeURIComponent(window.location.origin + '/cancel'); window.location.href = url; } catch (e) { console.error(e); toast.error('Payment setup failed. Please try again.'); } }} className="block w-full py-2.5 text-center border border-line text-ink font-bold rounded-full hover:bg-tile-soft transition text-sm cursor-pointer">Upgrade</button>
            </div>
          </div>
        </div>
      </section>

      {/* Support */}
      <section className="py-14 px-6 text-center max-w-xl mx-auto">
        <h2 className="text-xl font-extrabold mb-2">Support NownCard</h2>
        <p className="text-sm text-ink-muted mb-5">
          We're keeping the platform ad-free. If NownCard helps you land a client or save a contact, a tip goes directly toward server costs.
        </p>
        <a href="https://square.link/u/ZyAyKBUp?src=sheet" target="_blank" rel="noopener noreferrer" className="px-6 py-2.5 border border-line text-ink text-sm font-bold rounded-full hover:bg-tile-soft transition inline-block no-underline">
          Leave a Tip
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-line-soft py-8 text-center">
        <p className="text-sm text-ink-faint">
          © 2026 NownCard — A product of{' '}
          <a href="https://www.nowndigital.com" target="_blank" rel="noopener noreferrer" className="text-ink-muted hover:text-ink underline underline-offset-2">NOWN Digital</a>
        </p>
      </footer>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignInEmail={signInEmail}
        onSignUpEmail={signUpEmail}
        onSignInGoogle={signInGoogle}
        onLinkGoogle={linkGoogle}
        onSignInAnon={signInAnon}
        error={error}
        isAuthenticated={!!user}
      />
    </div>
  );
}
