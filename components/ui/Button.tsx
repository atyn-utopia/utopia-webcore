'use client'

import Link from 'next/link'
import type React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface CommonProps {
  variant?: Variant
  size?: Size
  loading?: boolean
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
  fullWidth?: boolean
  className?: string
  children?: React.ReactNode
}

interface ButtonAsButton extends CommonProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> {
  href?: undefined
}
interface ButtonAsLink extends CommonProps, Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> {
  href: string
  external?: boolean
}

type Props = ButtonAsButton | ButtonAsLink

const SIZE = {
  sm: 'h-7 px-2.5 text-[11px]',
  md: 'h-8 px-3 text-xs',
  lg: 'h-9 px-4 text-sm',
}

// Style profile: solid primary uses brand blue with a darker hover; secondary
// is the neutral outline that handles 80% of admin actions; ghost is for low-
// emphasis inline actions; danger is reserved for destructive intent. Hover
// uses a gentle 1px outline on focus so the whole UI feels keyboard-coherent
// without the heavy "ring" look.
const VARIANT_CLASS: Record<Variant, string> = {
  primary:   'text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] focus-visible:outline-[var(--primary)]',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 focus-visible:outline-[var(--primary)]',
  ghost:     'bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:outline-[var(--primary)]',
  danger:    'bg-white text-red-700 border border-slate-200 hover:bg-red-50 hover:border-red-200 focus-visible:outline-red-500',
}

const BASE = [
  'inline-flex items-center justify-center gap-1.5',
  'font-medium tracking-tight rounded-md select-none whitespace-nowrap',
  'transition-colors duration-150',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2',
].join(' ')

function ButtonSpinner({ size }: { size: Size }) {
  // CSS spinner instead of the brand GIF here: button text colour drives the
  // spinner colour via currentColor, so it stays visible on every variant
  // (primary, secondary, ghost, danger). The brand GIF is reserved for
  // operation-area / page-level loading where we control the backdrop.
  const dim = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return (
    <span className={`${dim} rounded-full border-2 border-current border-t-transparent animate-spin opacity-70`} aria-hidden />
  )
}

export function Button(props: Props) {
  const {
    variant = 'primary',
    size = 'md',
    loading = false,
    iconLeft,
    iconRight,
    fullWidth = false,
    className = '',
    children,
  } = props as CommonProps & { children?: React.ReactNode }

  const cls = [BASE, SIZE[size], VARIANT_CLASS[variant], fullWidth ? 'w-full' : '', className].filter(Boolean).join(' ')
  const inner = (
    <>
      {loading ? <ButtonSpinner size={size} /> : iconLeft}
      {children}
      {iconRight}
    </>
  )

  if ('href' in props && props.href !== undefined) {
    const { href, external, variant: _v, size: _s, loading: _l, iconLeft: _il, iconRight: _ir, fullWidth: _fw, className: _c, children: _ch, ...rest } = props
    void _v; void _s; void _l; void _il; void _ir; void _fw; void _c; void _ch
    if (external) {
      return <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...rest}>{inner}</a>
    }
    return <Link href={href} className={cls} {...rest}>{inner}</Link>
  }
  const { variant: _v, size: _s, loading: _l, iconLeft: _il, iconRight: _ir, fullWidth: _fw, className: _c, children: _ch, ...rest } = props
  void _v; void _s; void _l; void _il; void _ir; void _fw; void _c; void _ch
  return (
    <button className={cls} disabled={loading || rest.disabled} {...rest}>
      {inner}
    </button>
  )
}
