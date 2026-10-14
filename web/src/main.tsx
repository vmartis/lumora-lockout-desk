import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { AgentProvider } from '@/lib/agent'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AgentProvider>
          <App />
        </AgentProvider>
        <Toaster richColors />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
