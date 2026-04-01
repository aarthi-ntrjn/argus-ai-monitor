import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { connect, initSocketHandlers } from './services/socket';
import DashboardPage from './pages/DashboardPage';

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
          <Route path="/sessions/:id" element={<div className="p-8 text-gray-500">Session detail coming soon...</div>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}