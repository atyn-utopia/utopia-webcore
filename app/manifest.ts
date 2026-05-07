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
      // Real-pixel exports of the marketing PNG. Chrome rejects icons whose
      // declared `sizes` don't match the actual image — that's why the
      // Install prompt was missing (the master file is 6250x6250). Blue tile
      // is baked in, so the same files cover both 'any' and 'maskable'.
      { src: '/utopia-webcore-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/utopia-webcore-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/utopia-webcore-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/utopia-webcore-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
