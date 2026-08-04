import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function NotFoundPage() {

  return (
    <div className="min-h-screen bg-space flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-7xl mb-4">🔍</div>
        <h1 className="text-3xl font-extrabold text-ink mb-3">Page Not Found</h1>
        <p className="text-ink-muted text-sm max-w-sm mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-3">
          <Link to="/" className="px-6 py-2.5 bg-accent text-space font-bold rounded-full text-sm hover:brightness-110 transition no-underline">
            Back to Home
          </Link>
          <Link to="/contact" className="px-6 py-2.5 border border-line text-ink font-bold rounded-full text-sm hover:bg-tile-soft transition no-underline">
            Contact Support
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
