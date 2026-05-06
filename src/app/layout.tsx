import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'SwipeUp Portal',
    template: '%s — SwipeUp',
  },
  description: 'Your marketing command centre. Review briefs, track campaigns, manage your brand — all in one place.',
  metadataBase: new URL('https://portal.swipeupco.com'),
  openGraph: {
    title: 'SwipeUp Portal',
    description: 'Your marketing command centre. Review briefs, track campaigns, manage your brand — all in one place.',
    url: 'https://portal.swipeupco.com',
    siteName: 'SwipeUp',
    images: [
      {
        url: '/SwipeUp_Email.png',
        width: 1200,
        height: 630,
        alt: 'SwipeUp Portal',
      },
    ],
    locale: 'en_AU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SwipeUp Portal',
    description: 'Your marketing command centre. Review briefs, track campaigns, manage your brand — all in one place.',
    images: ['/SwipeUp_Email.png'],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  )
}
