import { Link, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';

export default function PrivacyPage() {
  const { user, userData, logOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-space">
      <Navbar
        onAuthClick={() => navigate('/')}
        onSignOut={() => { logOut(); navigate('/'); }}
        userEmail={user?.email}
        isAdmin={userData?.isAdmin}
        defaultCardSlug={userData?.defaultCardSlug}
      />

      <main className="max-w-3xl mx-auto px-5 py-12">
        <div className="mb-8">
          <Link to="/" className="text-sm text-ink-muted hover:text-ink transition no-underline">← Back to Home</Link>
        </div>

        <h1 className="text-3xl font-extrabold mb-2">Privacy Policy</h1>
        <p className="text-sm text-ink-muted mb-10">Last updated: May 6, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-ink-muted">
          <section>
            <h2 className="text-xl font-bold text-ink mb-3">1. Introduction</h2>
            <p className="text-sm leading-relaxed">
              NOWN Digital ("we," "us," or "our") operates the NownCard website and service (collectively, "the Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. By using the Service, you consent to the practices described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">2. Information We Collect</h2>
            <h3 className="text-base font-semibold text-ink mb-2">2.1 Personal Information</h3>
            <p className="text-sm leading-relaxed">
              When you create an account or use our Service, we may collect:
            </p>
            <ul className="list-disc list-inside text-sm leading-relaxed mt-2 space-y-1">
              <li>Name, email address, and profile photo</li>
              <li>Contact information you choose to include on your digital card (phone, address, social links, etc.)</li>
              <li>Authentication credentials via Firebase Authentication (Google sign-in, email/password)</li>
              <li>Payment information processed by Square (we do not store full payment card details)</li>
            </ul>

            <h3 className="text-base font-semibold text-ink mb-2 mt-4">2.2 Usage Data</h3>
            <p className="text-sm leading-relaxed">
              We automatically collect certain information about your interaction with the Service, including:
            </p>
            <ul className="list-disc list-inside text-sm leading-relaxed mt-2 space-y-1">
              <li>IP address, browser type, and device information</li>
              <li>Pages visited, time spent, and click patterns</li>
              <li>Card view counts, save counts, and tap analytics</li>
              <li>Referrer URLs</li>
            </ul>

            <h3 className="text-base font-semibold text-ink mb-2 mt-4">2.3 Cookies and Local Storage</h3>
            <p className="text-sm leading-relaxed">
              We use cookies and browser local storage to maintain your session, remember preferences (such as theme selection), and improve your experience. You can disable cookies in your browser settings, but some features of the Service may not function properly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">3. How We Use Your Information</h2>
            <p className="text-sm leading-relaxed">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-sm leading-relaxed mt-2 space-y-1">
              <li>Provide, operate, and maintain the Service</li>
              <li>Process transactions and manage subscriptions</li>
              <li>Send service-related notifications and updates</li>
              <li>Analyze usage trends and improve the Service</li>
              <li>Prevent fraud, abuse, and unauthorized access</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">4. How We Share Your Information</h2>
            <p className="text-sm leading-relaxed">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-sm leading-relaxed mt-2 space-y-1">
              <li>
                <strong>Service Providers:</strong> We use third-party services including Google Firebase (hosting, database, authentication), Square (payment processing), and Google Fonts. These providers have access to your information only to perform tasks on our behalf.
              </li>
              <li>
                <strong>Public Cards:</strong> Any information you include on a public digital card is visible to anyone who accesses your card URL. You control the visibility settings of each card.
              </li>
              <li>
                <strong>Legal Requirements:</strong> We may disclose your information if required by law, subpoena, or governmental request, or to protect our rights, property, or safety.
              </li>
              <li>
                <strong>Business Transfers:</strong> In the event of a merger, acquisition, or asset sale, your information may be transferred as part of that transaction.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">5. Data Security</h2>
            <p className="text-sm leading-relaxed">
              We implement reasonable security measures to protect your information, including encryption in transit (HTTPS/TLS) and access controls. However, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">6. Data Retention</h2>
            <p className="text-sm leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide the Service. You may delete your account and associated data at any time by contacting us. Some data may be retained in backups or logs for a limited period for security and compliance purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">7. Your Rights</h2>
            <p className="text-sm leading-relaxed">
              Depending on your location, you may have certain rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside text-sm leading-relaxed mt-2 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Request that we correct inaccurate or incomplete data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data ("right to be forgotten")</li>
              <li><strong>Portability:</strong> Request transfer of your data to another service</li>
              <li><strong>Objection:</strong> Object to certain processing of your data</li>
              <li><strong>Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="text-sm leading-relaxed mt-2">
              To exercise these rights, contact us at{' '}
              <a href="mailto:support@nowncard.com" className="text-accent hover:underline">support@nowncard.com</a>. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">8. Children's Privacy</h2>
            <p className="text-sm leading-relaxed">
              The Service is not intended for individuals under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete such information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">9. International Data Transfers</h2>
            <p className="text-sm leading-relaxed">
              Your information may be transferred to and processed in countries other than your own, including the United States, where our servers and service providers are located. By using the Service, you consent to such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">10. Third-Party Services</h2>
            <p className="text-sm leading-relaxed">
              Our Service integrates with third-party services. Their use of your information is governed by their respective privacy policies:
            </p>
            <ul className="list-disc list-inside text-sm leading-relaxed mt-2 space-y-1">
              <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Google Privacy Policy</a> (Firebase, Authentication, Fonts)</li>
              <li><a href="https://squareup.com/us/en/legal/general/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Square Privacy Policy</a> (Payments)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">11. Changes to This Policy</h2>
            <p className="text-sm leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on this page with a revised "Last updated" date. Your continued use of the Service after such changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">12. Contact Us</h2>
            <p className="text-sm leading-relaxed">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="text-sm leading-relaxed mt-2">
              <strong>Email:</strong>{' '}
              <a href="mailto:support@nowncard.com" className="text-accent hover:underline">support@nowncard.com</a>
              <br />
              <strong>Company:</strong> NOWN Digital
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
