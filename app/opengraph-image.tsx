import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Utopia Webcore — Internal Use Only'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #2979d6 100%)',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          padding: '80px',
          position: 'relative',
        }}
      >
        {/* Decorative rings */}
        <div
          style={{
            position: 'absolute',
            top: '-300px',
            right: '-300px',
            width: '700px',
            height: '700px',
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.06)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-200px',
            left: '-200px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.08)',
            display: 'flex',
          }}
        />

        {/* Logo card */}
        <div
          style={{
            width: '140px',
            height: '140px',
            borderRadius: '32px',
            background: 'linear-gradient(135deg, #2979d6, #1a3a6e)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            marginBottom: '44px',
          }}
        >
          {/* W-in-ring brand mark, scaled up from the app icon */}
          <svg width="92" height="92" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="6" />
            <path
              d="M28 33 L38 72 L50 48 L62 72 L72 33"
              stroke="white"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex' }}>
          Utopia Webcore
        </div>
        <div style={{ fontSize: 30, color: 'rgba(255,255,255,0.72)', marginTop: 18, display: 'flex' }}>
          Web &amp; Content Operations Platform
        </div>
        <div
          style={{
            marginTop: 44,
            padding: '12px 24px',
            borderRadius: 999,
            background: 'rgba(251, 191, 36, 0.18)',
            border: '1px solid rgba(251, 191, 36, 0.45)',
            color: '#fde68a',
            fontSize: 22,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fde68a" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0-10v4m-9 4a9 9 0 1118 0 9 9 0 01-18 0z" />
          </svg>
          For Internal Use Only
        </div>
      </div>
    ),
    { ...size },
  )
}
