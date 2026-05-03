import { useState } from 'react';
import { Smartphone, QrCode, Download, Palette, Zap } from 'lucide-react';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/hooks/useAuth';
import { createPendingUpgrade, SQUARE_LINKS } from '@/lib/payments';

export default function LandingPage() {
  const { user, signInEmail, signUpEmail, signInGoogle, signInAnon, error } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="min-h-screen bg-space">
      <Navbar onAuthClick={() => setAuthOpen(true)} userEmail={user?.email} />

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
          <a href="/editor" className="px-7 py-3 bg-accent text-space font-bold rounded-full hover:brightness-110 transition">Create Your Card</a>
          <a href="#features" className="px-7 py-3 border border-line text-ink font-bold rounded-full hover:bg-tile-soft transition">Learn More</a>
        </div>

        {/* Demo card */}
        <div className="mt-12 mx-auto max-w-[260px] rounded-[20px] overflow-hidden bg-tile border border-line shadow-card">
          <div className="h-20 bg-gradient-to-br from-accent-hover to-accent opacity-70" />
          <div className="px-5 pb-5 text-center relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#64748b] to-[#94a3b8] mx-auto -mt-8 flex items-center justify-center text-xl font-extrabold text-white border-4 border-tile shadow-lg">JD</div>
            <h3 className="mt-3 text-base font-bold">Jane Doe</h3>
            <p className="text-xs text-ink-muted mt-1">Product Designer</p>
            <div className="flex gap-1.5 justify-center mt-3">
              <span className="px-2 py-0.5 bg-tile-soft text-accent text-[10px] font-bold rounded border border-line">NFC</span>
              <span className="px-2 py-0.5 bg-tile-soft text-accent text-[10px] font-bold rounded border border-line">QR</span>
              <span className="px-2 py-0.5 bg-tile-soft text-accent text-[10px] font-bold rounded border border-line">vCard</span>
            </div>
          </div>
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
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Basic themes</li>
              </ul>
              <a href="/editor" className="block w-full py-2.5 text-center border border-line text-ink font-bold rounded-full hover:bg-tile-soft transition text-sm">Get Started</a>
            </div>

            <div className="bg-tile border-2 border-accent rounded-2xl p-7 relative hover:-translate-y-1 hover:shadow-surface transition">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-space text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Most Popular</span>
              <h3 className="text-xl font-extrabold">Pro</h3>
              <p className="text-sm text-ink-faint mt-1">For professionals</p>
              <div className="flex items-baseline gap-1 my-4"><span className="text-4xl font-extrabold">$19</span><span className="text-sm text-ink-faint">one-time</span></div>
              <ul className="space-y-2 text-sm text-ink-muted mb-6">
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Up to 5 cards</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Custom domain</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Analytics</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Priority support</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> All themes</li>
              </ul>
              <button onClick={async () => { if (!user) { setAuthOpen(true); return; } try { await createPendingUpgrade(user.uid, 'pro', 19); const url = SQUARE_LINKS.pro + '&redirect_url=' + encodeURIComponent(window.location.origin + '/success') + '&cancel_url=' + encodeURIComponent(window.location.origin + '/cancel'); window.location.href = url; } catch {} }} className="block w-full py-2.5 text-center bg-accent text-space font-bold rounded-full hover:brightness-110 transition text-sm">Upgrade</button>
            </div>

            <div className="bg-tile border border-line rounded-2xl p-7 hover:-translate-y-1 hover:shadow-surface transition">
              <h3 className="text-xl font-extrabold">Business</h3>
              <p className="text-sm text-ink-faint mt-1">For teams</p>
              <div className="flex items-baseline gap-1 my-4"><span className="text-4xl font-extrabold">$49</span><span className="text-sm text-ink-faint">one-time</span></div>
              <ul className="space-y-2 text-sm text-ink-muted mb-6">
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Unlimited cards</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Team management</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> White-label</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> API access</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">✓</span> Dedicated support</li>
              </ul>
              <button onClick={async () => { if (!user) { setAuthOpen(true); return; } try { await createPendingUpgrade(user.uid, 'business', 49); const url = SQUARE_LINKS.business + '&redirect_url=' + encodeURIComponent(window.location.origin + '/success') + '&cancel_url=' + encodeURIComponent(window.location.origin + '/cancel'); window.location.href = url; } catch {} }} className="block w-full py-2.5 text-center border border-line text-ink font-bold rounded-full hover:bg-tile-soft transition text-sm">Upgrade</button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line-soft py-8 text-center">
        <p className="text-sm text-ink-faint">© 2025 NownCard. All rights reserved.</p>
      </footer>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignInEmail={signInEmail}
        onSignUpEmail={signUpEmail}
        onSignInGoogle={signInGoogle}
        onSignInAnon={signInAnon}
        error={error}
      />
    </div>
  );
}
