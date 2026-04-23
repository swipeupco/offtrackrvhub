import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SwipeUp Portal',
  description: 'Client portal powered by SwipeUp',
}

// Runs before React hydration so the page doesn't flash the wrong theme on
// refresh. Reads localStorage('swipeup-theme'); if missing, leaves the default
// (light) alone. Kept inline so there's no extra network round-trip.
const themeBootstrap = `
(function(){try{var t=localStorage.getItem('swipeup-theme');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="h-full bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  )
}
