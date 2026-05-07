import type React from 'react'

type Variant = 'default' | 'flat' | 'inset'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  // Pass `padding={false}` for headerful cards where rows manage their own padding.
  padding?: boolean
}

// `default`: hairline border + soft shadow — the workhorse for content panels.
// `flat`:    border only, no shadow — for nested or inline cards.
// `inset`:   no border, slate background — for muted callouts and tips.
const VARIANT: Record<Variant, string> = {
  default: 'bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  flat:    'bg-white border border-slate-200',
  inset:   'bg-slate-50 border border-slate-100',
}

export function Card({ variant = 'default', padding = true, className = '', children, ...rest }: CardProps) {
  const cls = ['rounded-xl', VARIANT[variant], padding ? 'p-5' : '', className].filter(Boolean).join(' ')
  return <div className={cls} {...rest}>{children}</div>
}

export function CardHeader({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-5 py-3 border-b border-slate-100 ${className}`} {...rest}>{children}</div>
  )
}

export function CardBody({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-5 py-4 ${className}`} {...rest}>{children}</div>
  )
}

export function CardFooter({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-5 py-3 border-t border-slate-100 bg-slate-50 ${className}`} {...rest}>{children}</div>
  )
}
