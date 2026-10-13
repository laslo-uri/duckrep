import { Capacitor } from '@capacitor/core';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { WorkoutPage } from './pages/WorkoutPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { StatsPage } from './pages/StatsPage';
import { FoodPage } from './pages/FoodPage';
import { SettingsPage } from './pages/SettingsPage';
import { LobbyPage } from './pages/LobbyPage';

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
    <div className="min-h-[100dvh] w-full min-w-0">
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route element={<Layout />}>
          <Route path="journal" element={<HomePage />} />
          <Route path="activity/:id" element={<WorkoutPage />} />
          <Route path="workout/:id" element={<LegacyWorkoutRedirect />} />
          <Route path="exercises" element={<ExercisesPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="food" element={<FoodPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="/feed" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
