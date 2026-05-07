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
 * Brand logo. Renders the marketing PNG (cursive W with playful pink /
 * yellow / cyan accents on the Utopia electric blue) directly so the
 * mark always matches the brand sheet.
 *
 * The PNG bakes in its own rounded-square blue background, so this
 * component just sets dimensions + corner radius. Apply a different
 * `rounded` prop if you need a different corner style for a specific
 * surface (e.g. `md` in the dense top header, `xl` on the login screen).
 */
export function Logo({ size = 44, rounded = 'xl', className = '', style }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/utopia-webcore-logo.png"
      alt="Utopia Webcore"
      width={size}
      height={size}
      className={`flex-shrink-0 ${RADIUS[rounded]} ${className}`}
      style={{ width: size, height: size, objectFit: 'cover', ...style }}
      draggable={false}
    />
  )
}

/**
 * Small white-stroke variant of the mark, drawn in SVG. Used in the
 * favicon and anywhere we need the W shape without the blue tile.
 */
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
      <g transform="translate(0 4)">
        <path
          d="M 26 32 C 26 50, 30 64, 36 64 C 42 64, 46 54, 50 46 C 54 54, 58 64, 64 64 C 70 64, 74 50, 74 32"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M 74 32 c 4 -3, 8 1, 6 6 c -2 3, -5 1, -3 -2"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  )
}
