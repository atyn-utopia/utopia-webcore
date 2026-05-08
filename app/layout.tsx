import type { Metadata } from 'next'
import { Noto_Sans, Nunito } from 'next/font/google'
import './globals.css'
import LoadingBar from '@/components/LoadingBar'

// Body font. Noto_Sans replaced Inter — wider language coverage (we serve EN
// and BM, Noto's pan-script design avoids fallback flashes for diacritics).
const noto = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
})
const nunito = Nunito({ subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'Utopia Webcore',
  description: 'Web & Content Operations Platform. For Internal Use Only.',
  // app/icon.png is auto-detected by Next.js as the favicon, so we don't
  // hard-code an icons map here. The Apple touch icon stays in <head> below
  // so iOS picks the higher-resolution PNG when added to the home screen.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WEBCORE',
  },
  openGraph: {
    title: 'Utopia Webcore',
    description: 'Web & Content Operations Platform. For Internal Use Only.',
    type: 'website',
    siteName: 'Utopia Webcore',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Utopia Webcore',
    description: 'Web & Content Operations Platform. For Internal Use Only.',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${noto.variable} ${nunito.variable}`}>
      <head>
        <meta name="theme-color" content="#1E5BFF" />
        <link rel="apple-touch-icon" sizes="180x180" href="/utopia-webcore-apple-touch.png" />
      </head>
      <body className="min-h-full">
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
