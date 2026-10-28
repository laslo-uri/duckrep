import { Capacitor } from '@capacitor/core';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { CookieConsent } from './components/CookieConsent';
import { LobbyPage } from './pages/LobbyPage';

// The lobby is the entry page; the journal pages load as their own chunks.
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const WorkoutPage = lazy(() => import('./pages/WorkoutPage').then((m) => ({ default: m.WorkoutPage })));
const ExercisesPage = lazy(() => import('./pages/ExercisesPage').then((m) => ({ default: m.ExercisesPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then((m) => ({ default: m.StatsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function LegacyWorkoutRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/activity/${id}`} replace />;
}

function AppRoutes() {
  return (
    <div className="min-h-[var(--app-dvh)] w-full min-w-0">
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route element={<Layout />}>
          <Route path="journal" element={<Page><HomePage /></Page>} />
          <Route path="activity/:id" element={<Page><WorkoutPage /></Page>} />
          <Route path="workout/:id" element={<LegacyWorkoutRedirect />} />
          <Route path="exercises" element={<Page><ExercisesPage /></Page>} />
          <Route path="stats" element={<Page><StatsPage /></Page>} />
          {/* Food moved to Dovediet; old links land on the journal. */}
          <Route path="food" element={<Navigate to="/journal" replace />} />
          <Route path="settings" element={<Page><SettingsPage /></Page>} />
        </Route>
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="/feed" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CookieConsent />
    </div>
  );
}

function AppRouter({ children }: { children: ReactNode }) {
  if (Capacitor.isNativePlatform()) return <HashRouter>{children}</HashRouter>;
  return <BrowserRouter>{children}</BrowserRouter>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter>
        <AppRoutes />
      </AppRouter>
    </QueryClientProvider>
  );
}
