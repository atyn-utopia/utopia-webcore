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
      // SVG fallback for browsers that prefer vector icons
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      // High-res PNG for PWA installs. The marketing PNG already includes
      // the rounded blue background, so it works for both 'any' and
      // 'maskable' purposes (Android's adaptive-icon mask crops to a safe
      // zone, and the W mark is centred well within that zone).
      { src: '/utopia-webcore-logo.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/utopia-webcore-logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/utopia-webcore-logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/utopia-webcore-logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
