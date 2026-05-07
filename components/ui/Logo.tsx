import type React from 'react'

interface LogoProps {
  size?: number
  className?: string
  rounded?: 'md' | 'lg' | 'xl' | '2xl'
  style?: React.CSSProperties
}

const RADIUS: Record<NonNullable<LogoProps['rounded']>, string> = {
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
}

/**
 * Brand logo: a stylised "W" inside a ring, on the Utopia blue gradient.
 *
 * Used in the top header, login screen, OG image, and PWA icons. Keep this
 * component as the single source of truth for the mark so future tweaks
 * propagate everywhere.
 */
export function Logo({ size = 44, rounded = 'xl', className = '', style }: LogoProps) {
  const innerSize = Math.round(size * 0.62)
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${RADIUS[rounded]} ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #1a3a6e, #2979d6)',
        ...style,
      }}
      aria-label="Utopia Webcore"
    >
      <LogoMark size={innerSize} />
    </div>
  )
}

/** The mark itself, without a background. White strokes by default. */
export function LogoMark({ size = 28, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="50" cy="50" r="40" stroke={color} strokeWidth="6" />
      <path
        d="M28 33 L38 72 L50 48 L62 72 L72 33"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
