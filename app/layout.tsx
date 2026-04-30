import type { Metadata } from 'next'
import { Inter, Nunito } from 'next/font/google'
import './globals.css'
import LoadingBar from '@/components/LoadingBar'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'Utopia Webcore',
  description: 'Web & Content Operations Platform — For Internal Use Only',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WEBCORE',
  },
  openGraph: {
    title: 'Utopia Webcore',
    description: 'Web & Content Operations Platform — For Internal Use Only',
    type: 'website',
    siteName: 'Utopia Webcore',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Utopia Webcore',
    description: 'Web & Content Operations Platform — For Internal Use Only',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${nunito.variable}`}>
      <head>
        <meta name="theme-color" content="#14181f" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full font-inter">
        <LoadingBar />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`,
          }}
        />
      </body>
    </html>
  )
}
