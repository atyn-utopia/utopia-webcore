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

        {/* Logo card — solid electric blue with the cursive W mark */}
        <div
          style={{
            width: '160px',
            height: '160px',
            borderRadius: '36px',
            background: '#1E5BFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 60px rgba(15, 91, 255, 0.45)',
            marginBottom: '44px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <svg width="160" height="160" viewBox="0 0 100 100" fill="none">
            {/* Playful accents */}
            <path d="M 22 60 Q 26 70 32 72" stroke="#FF4D6D" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M 76 26 Q 82 32 80 42" stroke="#FFC83D" strokeWidth="5" strokeLinecap="round" fill="none" />
            <circle cx="83" cy="56" r="3.5" fill="#22D3EE" />
            {/* Cursive W */}
            <g transform="translate(0 4)">
              <path
                d="M 26 32 C 26 50, 30 64, 36 64 C 42 64, 46 54, 50 46 C 54 54, 58 64, 64 64 C 70 64, 74 50, 74 32"
                stroke="white"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M 74 32 c 4 -3, 8 1, 6 6 c -2 3, -5 1, -3 -2"
                stroke="white"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
            </g>
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
