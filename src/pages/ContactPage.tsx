import { Link } from 'react-router-dom';
import { Mail, MessageSquare, Bug, ArrowRight } from 'lucide-react';
import BackLink from '@/components/BackLink';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function ContactPage() {

  const bugReportBody = encodeURIComponent(
    `Bug Report — NownCard\n\n` +
    `Date: ${new Date().toLocaleDateString()}\n` +
    `Browser: ${navigator.userAgent}\n` +
    `URL: ${typeof window !== 'undefined' ? window.location.href : ''}\n\n` +
    `Describe the bug:\n` +
    `[What happened? What did you expect?]\n\n` +
    `Steps to reproduce:\n` +
    `1. \n` +
    `2. \n` +
    `3. \n\n` +
    `Screenshots (attach if possible):\n`
  );

  const supportBody = encodeURIComponent(
    `Support Request — NownCard\n\n` +
    `Date: ${new Date().toLocaleDateString()}\n` +
    `Browser: ${navigator.userAgent}\n\n` +
    `How can we help?\n`
  );

  return (
    <div className="min-h-screen bg-space">
      <Navbar />

      <main className="max-w-2xl mx-auto px-5 py-12">
        <div className="mb-8">
          <BackLink to="/">Back to Home</BackLink>
        </div>

        <h1 className="text-3xl font-extrabold mb-2">Contact Support</h1>
        <p className="text-sm text-ink-muted mb-10">
          Need help or found something broken? We're here for you.
        </p>

        <div className="space-y-5">
          {/* General Support */}
          <a
            href={`mailto:support@nowncard.com?subject=Support%20Request&body=${supportBody}`}
            className="flex items-center gap-4 bg-tile border border-line rounded-2xl p-5 hover:border-accent transition no-underline group"
          >
            <div className="w-12 h-12 rounded-xl bg-tile-soft border border-line flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-ink group-hover:text-accent transition">Email Support</h2>
              <p className="text-sm text-ink-muted">support@nowncard.com</p>
            </div>
            <ArrowRight className="w-4 h-4 text-ink-faint group-hover:text-accent transition" />
          </a>

          {/* Report a Bug */}
          <a
            href={`mailto:support@nowncard.com?subject=Bug%20Report&body=${bugReportBody}`}
            className="flex items-center gap-4 bg-tile border border-line rounded-2xl p-5 hover:border-accent transition no-underline group"
          >
            <div className="w-12 h-12 rounded-xl bg-tile-soft border border-line flex items-center justify-center flex-shrink-0">
              <Bug className="w-5 h-5 text-danger" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-ink group-hover:text-accent transition">Report a Bug</h2>
              <p className="text-sm text-ink-muted">Include steps to reproduce and your browser info</p>
            </div>
            <ArrowRight className="w-4 h-4 text-ink-faint group-hover:text-accent transition" />
          </a>

          {/* Feedback */}
          <a
            href={`mailto:support@nowncard.com?subject=Feature%20Request%20/%20Feedback&body=${encodeURIComponent('I\'d love to see...\n\n')}`}
            className="flex items-center gap-4 bg-tile border border-line rounded-2xl p-5 hover:border-accent transition no-underline group"
          >
            <div className="w-12 h-12 rounded-xl bg-tile-soft border border-line flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-ink group-hover:text-accent transition">Feature Request</h2>
              <p className="text-sm text-ink-muted">Got an idea? We'd love to hear it.</p>
            </div>
            <ArrowRight className="w-4 h-4 text-ink-faint group-hover:text-accent transition" />
          </a>
        </div>

        {/* Quick Help */}
        <div className="mt-10 bg-tile border border-line rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4">Quick Help</h2>
          <div className="space-y-3 text-sm text-ink-muted">
            <details className="group">
              <summary className="cursor-pointer font-semibold text-ink hover:text-accent transition list-none flex items-center justify-between">
                How do I create a card?
                <ArrowRight className="w-3.5 h-3.5 rotate-90 group-open:-rotate-90 transition-transform" />
              </summary>
              <p className="mt-2 pl-1">
                Sign in, go to your <Link to="/dashboard" className="text-accent hover:underline">Dashboard</Link>, and click "New Card." Fill in your details, customize the design, and save.
              </p>
            </details>
            <div className="h-px bg-line-soft" />
            <details className="group">
              <summary className="cursor-pointer font-semibold text-ink hover:text-accent transition list-none flex items-center justify-between">
                Can I share my card without the app?
                <ArrowRight className="w-3.5 h-3.5 rotate-90 group-open:-rotate-90 transition-transform" />
              </summary>
              <p className="mt-2 pl-1">
                Yes — anyone can view your card via the shareable link or QR code. No app installation is required for recipients.
              </p>
            </details>
            <div className="h-px bg-line-soft" />
            <details className="group">
              <summary className="cursor-pointer font-semibold text-ink hover:text-accent transition list-none flex items-center justify-between">
                How do I upgrade or cancel?
                <ArrowRight className="w-3.5 h-3.5 rotate-90 group-open:-rotate-90 transition-transform" />
              </summary>
              <p className="mt-2 pl-1">
                Visit the <Link to="/#pricing" className="text-accent hover:underline">Pricing</Link> section and select your plan. To cancel, contact us at support@nowncard.com.
              </p>
            </details>
            <div className="h-px bg-line-soft" />
            <details className="group">
              <summary className="cursor-pointer font-semibold text-ink hover:text-accent transition list-none flex items-center justify-between">
                Is my contact data secure?
                <ArrowRight className="w-3.5 h-3.5 rotate-90 group-open:-rotate-90 transition-transform" />
              </summary>
              <p className="mt-2 pl-1">
                Yes. Your data is encrypted in transit (HTTPS/TLS) and stored securely via Google Firebase. See our <Link to="/privacy" className="text-accent hover:underline">Privacy Policy</Link> for details.
              </p>
            </details>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
