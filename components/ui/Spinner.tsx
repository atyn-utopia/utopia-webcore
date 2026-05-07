import type React from 'react'

type Size = 'sm' | 'md' | 'lg' | 'xl'

interface SpinnerProps {
  size?: Size | number
  className?: string
  /** Optional helper text rendered next to the spinner. */
  label?: string
  /**
   * Invert the GIF colours so the white animation appears black. Defaults
   * to true because most surfaces in the app have light backgrounds. Pass
   * `invert={false}` when placing the spinner on a dark / coloured surface
   * (e.g. inside a primary button) so the original white animation shows.
   */
  invert?: boolean
  style?: React.CSSProperties
}

const SIZE_MAP: Record<Size, number> = {
  sm: 16,
  md: 22,
  lg: 36,
  xl: 56,
}

/**
 * Branded loading indicator backed by /loading-animation.gif.
 *
 * The GIF ships as a white animation on a transparent background; we
 * apply a CSS invert by default so it reads as black on light surfaces.
 * For dark / branded surfaces, opt out with `invert={false}` to keep the
 * white animation.
 */
export function Spinner({ size = 'md', className = '', label, invert = true, style }: SpinnerProps) {
  const px = typeof size === 'number' ? size : SIZE_MAP[size]
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/loading-animation.gif"
        alt=""
        width={px}
        height={px}
        style={{
          width: px,
          height: px,
          display: 'inline-block',
          filter: invert ? 'invert(1)' : undefined,
        }}
        aria-hidden
        draggable={false}
      />
      {label && <span className="text-xs text-slate-500">{label}</span>}
    </span>
  )
}

/**
 * Full-area loading overlay. Place inside a `relative` container; the
 * backdrop dims whatever sits behind. The spinner inside stays white
 * (no invert) since the dark backdrop reads better with the original GIF.
 */
export function LoadingOverlay({ visible, label, blur = true }: { visible: boolean; label?: string; blur?: boolean }) {
  if (!visible) return null
  return (
    <div
      className={`absolute inset-0 z-10 flex flex-col items-center justify-center ${blur ? 'backdrop-blur-[2px]' : ''}`}
      style={{ background: 'rgba(15, 23, 42, 0.55)' }}
      aria-busy
    >
      <Spinner size="xl" invert={false} />
      {label && <p className="text-sm font-medium text-white mt-3">{label}</p>}
    </div>
  )
}

/**
 * Page-centred spinner for first-load states. Use when the whole page is
 * waiting on data.
 */
export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Spinner size="xl" />
      {label && <p className="text-sm text-slate-500 mt-3">{label}</p>}
    </div>
  )
}
