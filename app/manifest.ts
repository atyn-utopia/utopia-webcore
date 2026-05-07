import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Utopia Webcore',
    short_name: 'WEBCORE',
    description: 'Web & Content Operations Platform. For Internal Use Only.',
    start_url: '/',
    display: 'standalone',
    background_color: '#1E5BFF',
    theme_color: '#1E5BFF',
    icons: [
      // The marketing PNG covers favicon (via app/icon.png), PWA icons
      // (here), and the Apple touch icon (set in app/layout.tsx head).
      // It already bakes in the rounded blue tile, so it works for both
      // 'any' and 'maskable' purposes — Android's adaptive-icon mask crops
      // to a safe zone and the W stays well within it.
      { src: '/utopia-webcore-logo.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/utopia-webcore-logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/utopia-webcore-logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/utopia-webcore-logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
