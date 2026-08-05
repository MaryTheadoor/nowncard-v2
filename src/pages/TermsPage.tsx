import BackLink from '@/components/BackLink';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function TermsPage() {

  return (
    <div className="min-h-screen bg-space">
      <Navbar />

      <main className="max-w-3xl mx-auto px-5 py-12">
        <div className="mb-8">
          <BackLink to="/">Back to Home</BackLink>
        </div>

        <h1 className="text-3xl font-extrabold mb-2">Terms of Service</h1>
        <p className="text-sm text-ink-muted mb-10">Last updated: May 6, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-ink-muted">
          <section>
            <h2 className="text-xl font-bold text-ink mb-3">1. Acceptance of Terms</h2>
            <p className="text-sm leading-relaxed">
              By accessing or using NownCard ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. The Service is operated by NOWN Digital ("we," "us," or "our").
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">2. Description of Service</h2>
            <p className="text-sm leading-relaxed">
              NownCard is a digital business card platform that allows users to create, customize, and share digital contact cards via URL, QR code, NFC, and vCard export. We reserve the right to modify, suspend, or discontinue the Service at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">3. User Accounts</h2>
            <p className="text-sm leading-relaxed">
              You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">4. User Content</h2>
            <p className="text-sm leading-relaxed">
              You retain ownership of any content you submit to the Service, including but not limited to names, photos, contact information, and custom designs ("User Content"). By submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, display, and distribute your content solely for the purpose of operating and providing the Service.
            </p>
            <p className="text-sm leading-relaxed mt-2">
              You represent and warrant that your User Content does not violate any third-party rights, including copyright, trademark, privacy, or publicity rights, and does not contain unlawful, defamatory, or offensive material.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">5. Acceptable Use</h2>
            <p className="text-sm leading-relaxed">
              You agree not to use the Service to:
            </p>
            <ul className="list-disc list-inside text-sm leading-relaxed mt-2 space-y-1">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the rights of others</li>
              <li>Upload viruses, malware, or other harmful code</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Engage in spam, phishing, or other deceptive practices</li>
              <li>Use the Service for any illegal or unauthorized purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">6. Payments and Refunds</h2>
            <p className="text-sm leading-relaxed">
              Pro and Business plans are billed annually. All payments are processed through Square. By subscribing, you authorize us to charge the applicable fees to your payment method.
            </p>
            <p className="text-sm leading-relaxed mt-2">
              You may cancel your subscription at any time. Refunds are provided at our sole discretion. No refunds will be issued for partial billing periods. We reserve the right to change pricing upon reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">7. Termination</h2>
            <p className="text-sm leading-relaxed">
              We may suspend or terminate your account and access to the Service at any time, with or without cause, and with or without notice. Upon termination, your right to use the Service will immediately cease. All provisions of these Terms that by their nature should survive termination shall survive.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">8. Intellectual Property</h2>
            <p className="text-sm leading-relaxed">
              The Service, including its design, logos, trademarks, and underlying software, is the property of NOWN Digital and is protected by copyright, trademark, and other intellectual property laws. You may not use our trademarks without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">9. Disclaimer of Warranties</h2>
            <p className="text-sm leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. YOUR USE OF THE SERVICE IS AT YOUR SOLE RISK.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">10. Limitation of Liability</h2>
            <p className="text-sm leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, NOWN DIGITAL SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">11. Indemnification</h2>
            <p className="text-sm leading-relaxed">
              You agree to indemnify and hold harmless NOWN Digital and its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising out of your use of the Service or your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">12. Governing Law</h2>
            <p className="text-sm leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">13. Changes to Terms</h2>
            <p className="text-sm leading-relaxed">
              We may update these Terms from time to time. We will notify you of any material changes by posting the updated Terms on this page with a revised "Last updated" date. Your continued use of the Service after such changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-ink mb-3">14. Contact Information</h2>
            <p className="text-sm leading-relaxed">
              If you have any questions about these Terms, please contact us at{' '}
              <a href="mailto:support@nowncard.com" className="text-accent hover:underline">support@nowncard.com</a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
