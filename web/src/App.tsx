import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { QueuePage } from '@/pages/QueuePage'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<QueuePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
