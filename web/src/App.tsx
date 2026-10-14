import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { CasePage } from '@/pages/CasePage'
import { ProfilePage } from '@/pages/ProfilePage'
import { QueuePage } from '@/pages/QueuePage'
import { SummaryPage } from '@/pages/SummaryPage'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<QueuePage />} />
        <Route path="/cases/:accountId" element={<CasePage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
