import { Sidebar } from '@/components/layout/Sidebar'
import { OnboardingGate } from '@/components/OnboardingGate'
import { TopBar } from '@/components/layout/TopBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full bg-zinc-100 min-h-screen">
      <Sidebar />
      <main className="ml-64 flex-1 overflow-y-auto min-h-screen bg-zinc-100">
        <OnboardingGate>
          <TopBar />
          {children}
        </OnboardingGate>
      </main>
    </div>
  )
}
