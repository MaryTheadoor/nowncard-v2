import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import LandingPage from '@/pages/LandingPage';
import DashboardPage from '@/pages/DashboardPage';
import EditorPage from '@/pages/EditorPage';
import CardViewerPage from '@/pages/CardViewerPage';
import SuccessPage from '@/pages/SuccessPage';
import CancelPage from '@/pages/CancelPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/editor/:id" element={<EditorPage />} />
        <Route path="/:slug" element={<CardViewerPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/cancel" element={<CancelPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
      <Toaster position="top-center" richColors toastOptions={{ style: { background: '#111827', border: '1px solid #1e293b', color: '#f8f9fc' } }} />
    </BrowserRouter>
  );
}

export default App;
