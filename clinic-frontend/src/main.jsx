import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 min — don't refetch if data is fresh
      gcTime: 1000 * 60 * 15,        // 15 min — keep cache warm between navigations
      refetchOnWindowFocus: false,   // don't hit DB every time user alt-tabs back
      refetchOnReconnect: false,     // don't spam DB on network reconnect
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
