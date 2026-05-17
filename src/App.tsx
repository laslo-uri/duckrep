import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { WorkoutPage } from './pages/WorkoutPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { FeedPage } from './pages/FeedPage';
import { StatsPage } from './pages/StatsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useTranslation } from 'react-i18next';
import { useAuth } from './contexts/AuthContext';

const queryClient = new QueryClient();

function LegacyWorkoutRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/activity/${id}`} replace />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-[100dvh] flex items-center justify-center text-[var(--color-muted)] px-4">{t('loading')}</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <div className="min-h-[100dvh] w-full min-w-0">
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="activity/:id" element={<ProtectedRoute><WorkoutPage /></ProtectedRoute>} />
        <Route path="workout/:id" element={<ProtectedRoute><LegacyWorkoutRedirect /></ProtectedRoute>} />
        <Route path="exercises" element={<ProtectedRoute><ExercisesPage /></ProtectedRoute>} />
        <Route path="stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="feed" element={<FeedPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
