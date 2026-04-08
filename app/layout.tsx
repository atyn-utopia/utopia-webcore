import type { Metadata } from 'next'
import { Inter, Nunito } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'Utopia Webcore',
  description: 'Web & Content Operations, Reporting Engine',
  icons: {
    icon: '/icon.svg',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WEBCORE',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${nunito.variable}`}>
      <head>
        <meta name="theme-color" content="#1e293b" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full font-inter">
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
