import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/hooks/useTheme';
import { AuthProvider } from '@/hooks/useAuth';

// Lazy-load all routes (including the landing page) so anonymous card viewers
// and first-time visitors don't download heavy chunks (QR encoder, payments)
// they don't need on entry.
const LandingPage = lazy(() => import('@/pages/LandingPage'));

// Lazy-load all other pages for code-splitting
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const EditorPage = lazy(() => import('@/pages/EditorPage'));
const CardViewerPage = lazy(() => import('@/pages/CardViewerPage'));
const SuccessPage = lazy(() => import('@/pages/SuccessPage'));
const CancelPage = lazy(() => import('@/pages/CancelPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const NfcPage = lazy(() => import('@/pages/NfcPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const RolodexPage = lazy(() => import('@/pages/RolodexPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const QrPosterPage = lazy(() => import('@/pages/QrPosterPage'));
const MenuPrintPage = lazy(() => import('@/pages/MenuPrintPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-space flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
        <span className="text-sm text-ink-muted">Loading…</span>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/editor/:id" element={<EditorPage />} />
            <Route path="/success" element={<SuccessPage />} />
            <Route path="/cancel" element={<CancelPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/card/:slug" element={<CardViewerPage />} />
            <Route path="/poster/:slug" element={<QrPosterPage />} />
            <Route path="/menu/:slug" element={<MenuPrintPage />} />
            <Route path="/nfc/:slug" element={<NfcPage />} />
            <Route path="/analytics/:id" element={<AnalyticsPage />} />
            <Route path="/rolodex" element={<RolodexPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <Toaster position="top-center" richColors toastOptions={{ style: { background: '#111827', border: '1px solid #1e293b', color: '#f8f9fc' } }} />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
