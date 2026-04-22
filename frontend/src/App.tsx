import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { connect, initSocketHandlers } from './services/socket';
import DashboardPage from './pages/DashboardPage';
import SessionPage from './pages/SessionPage';
import TelemetryPage from './pages/TelemetryPage';
import IntegrationsSetupPage from './pages/IntegrationsSetupPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5000, retry: 2 } },
});

initSocketHandlers(queryClient);

export default function App() {
  useEffect(() => {
    connect();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/sessions/:id" element={<SessionPage />} />
          <Route path="/telemetry" element={<TelemetryPage />} />
          <Route path="/setup/integrations" element={<IntegrationsSetupPage />} />
          <Route path="/setup/teams" element={<IntegrationsSetupPage />} />
          <Route path="/setup/slack" element={<IntegrationsSetupPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}