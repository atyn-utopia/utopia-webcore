import type React from 'react'

type Size = 'sm' | 'md' | 'lg' | 'xl'

interface SpinnerProps {
  size?: Size | number
  className?: string
  /** Optional helper text rendered next to the spinner. */
  label?: string
  style?: React.CSSProperties
}

const SIZE_MAP: Record<Size, number> = {
  sm: 18,
  md: 26,
  lg: 40,
  xl: 64,
}

/**
 * Branded loading indicator. Wraps /loading-animation.gif in a dark
 * circular backdrop so the white animation inside the GIF is always
 * legible — the GIF on its own is mostly white-on-transparent and
 * disappears against the white card backgrounds we use everywhere.
 */
export function Spinner({ size = 'md', className = '', label, style }: SpinnerProps) {
  const outer = typeof size === 'number' ? size : SIZE_MAP[size]
  // Inner GIF fills the backdrop with a slight inset so the animation
  // doesn't crop against the circle edge.
  const inner = Math.round(outer * 0.92)
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} style={style}>
      <span
        className="inline-flex items-center justify-center rounded-full overflow-hidden"
        style={{
          width: outer,
          height: outer,
          background: '#0F172A',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/loading-animation.gif"
          alt=""
          width={inner}
          height={inner}
          style={{ width: inner, height: inner, display: 'block' }}
          aria-hidden
          draggable={false}
        />
      </span>
      {label && <span className="text-xs text-slate-500">{label}</span>}
    </span>
  )
}

/**
 * Full-area loading overlay. Place inside a `relative` container; renders a
 * dim backdrop with the brand spinner centred on top. Use during operations
 * where multiple inputs would otherwise need their own spinners (saving a
 * brand profile, uploading an image, running an audit).
 */
export function LoadingOverlay({ visible, label, blur = true }: { visible: boolean; label?: string; blur?: boolean }) {
  if (!visible) return null
  return (
    <div
      className={`absolute inset-0 z-10 flex flex-col items-center justify-center ${blur ? 'backdrop-blur-[2px]' : ''}`}
      style={{ background: 'rgba(15, 23, 42, 0.55)' }}
      aria-busy
    >
      <Spinner size="xl" />
      {label && <p className="text-sm font-medium text-white mt-3">{label}</p>}
    </div>
  )
}

/**
 * Page-centred spinner for first-load states. Use when the whole page is
 * waiting on data (no need to dim — there's nothing to dim yet).
 */
export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Spinner size="xl" />
      {label && <p className="text-sm text-slate-500 mt-3">{label}</p>}
    </div>
  )
}
