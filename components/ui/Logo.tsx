import type React from 'react'

interface LogoProps {
  size?: number
  className?: string
  rounded?: 'md' | 'lg' | 'xl' | '2xl'
  /** Set to false to hide the playful pink/yellow/cyan accents (use for tiny sizes). */
  accents?: boolean
  style?: React.CSSProperties
}

const RADIUS: Record<NonNullable<LogoProps['rounded']>, string> = {
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
}

/**
 * Brand logo: a stylised cursive "W" on the Utopia electric blue, with a few
 * playful accents (pink curve, yellow curve, cyan dot) borrowed from the
 * marketing mark. Used in the top header, login screen, OG image, and PWA
 * icons. Keep this component as the single source of truth so future tweaks
 * propagate everywhere.
 */
export function Logo({ size = 44, rounded = 'xl', accents = true, className = '', style }: LogoProps) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 overflow-hidden ${RADIUS[rounded]} ${className}`}
      style={{
        width: size,
        height: size,
        background: '#1E5BFF',
        ...style,
      }}
      aria-label="Utopia Webcore"
    >
      <LogoMark size={size} accents={accents} />
    </div>
  )
}

/**
 * The mark itself, drawn at the requested pixel size. Background is
 * transparent — the parent container provides the blue tile if you want
 * the full app icon look. Pass accents={false} for very small sizes
 * (favicon at 16px) where the accents become illegible noise.
 */
export function LogoMark({ size = 28, accents = true }: { size?: number; accents?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {accents && (
        <>
          {/* Pink curve, lower-left */}
          <path
            d="M 22 60 Q 26 70 32 72"
            stroke="#FF4D6D"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Yellow curve, upper-right */}
          <path
            d="M 76 26 Q 82 32 80 42"
            stroke="#FFC83D"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Cyan dot, mid-right */}
          <circle cx="83" cy="56" r="3.5" fill="#22D3EE" />
        </>
      )}

      {/* Cursive W — three dips with a small loop at the right end. */}
      <g transform="translate(0 4)">
        <path
          d="M 26 32
             C 26 50, 30 64, 36 64
             C 42 64, 46 54, 50 46
             C 54 54, 58 64, 64 64
             C 70 64, 74 50, 74 32"
          stroke="white"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Tiny flourish at the end of the W */}
        <path
          d="M 74 32 c 4 -3, 8 1, 6 6 c -2 3, -5 1, -3 -2"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  )
}
