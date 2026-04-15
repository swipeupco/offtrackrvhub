import { Sidebar } from '@/components/layout/Sidebar'
import { OnboardingGate } from '@/components/OnboardingGate'
import { TopBar } from '@/components/layout/TopBar'
import { ActiveClientProvider } from '@/lib/active-client-context'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ActiveClientProvider>
      <div className="flex h-full bg-[#F7F8FA] min-h-screen">
        <Sidebar />
        <main className="ml-64 flex-1 overflow-y-auto min-h-screen bg-[#F7F8FA]">
          <OnboardingGate>
            <TopBar />
            {children}
          </OnboardingGate>
        </main>
      </div>
    </ActiveClientProvider>
  )
}
