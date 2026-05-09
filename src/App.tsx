import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/hooks/useTheme';
import LandingPage from '@/pages/LandingPage';
import DashboardPage from '@/pages/DashboardPage';
import EditorPage from '@/pages/EditorPage';
import CardViewerPage from '@/pages/CardViewerPage';
import SuccessPage from '@/pages/SuccessPage';
import CancelPage from '@/pages/CancelPage';
import AdminPage from '@/pages/AdminPage';
import NfcPage from '@/pages/NfcPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import RolodexPage from '@/pages/RolodexPage';
import TermsPage from '@/pages/TermsPage';
import PrivacyPage from '@/pages/PrivacyPage';
import NotFoundPage from '@/pages/NotFoundPage';
import ContactPage from '@/pages/ContactPage';

function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/editor/:id" element={<EditorPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/cancel" element={<CancelPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/card/:slug" element={<CardViewerPage />} />
        <Route path="/nfc/:slug" element={<NfcPage />} />
        <Route path="/analytics/:id" element={<AnalyticsPage />} />
        <Route path="/rolodex" element={<RolodexPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster position="top-center" richColors toastOptions={{ style: { background: '#111827', border: '1px solid #1e293b', color: '#f8f9fc' } }} />
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
