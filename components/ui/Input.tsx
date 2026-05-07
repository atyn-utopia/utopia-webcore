import type React from 'react'
import { forwardRef } from 'react'

type Size = 'sm' | 'md' | 'lg'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: Size
  invalid?: boolean
}

const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-xs',
  lg: 'h-9 px-3 text-sm',
}

const BASE = [
  'block w-full rounded-md bg-white text-slate-900',
  'border border-slate-200',
  'transition-colors duration-150',
  'placeholder:text-slate-400',
  'focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15',
  'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
].join(' ')

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', invalid = false, className = '', ...rest },
  ref,
) {
  const cls = [BASE, SIZE[size], invalid ? '!border-red-300 focus:!border-red-500 focus:!ring-red-500/15' : '', className].filter(Boolean).join(' ')
  return <input ref={ref} className={cls} {...rest} />
})

interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid = false, className = '', ...rest },
  ref,
) {
  const base = [
    'block w-full rounded-md bg-white text-slate-900 px-3 py-2 text-xs',
    'border border-slate-200',
    'transition-colors duration-150 resize-y',
    'placeholder:text-slate-400',
    'focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15',
    'disabled:bg-slate-50 disabled:text-slate-500',
  ].join(' ')
  const cls = [base, invalid ? '!border-red-300 focus:!border-red-500 focus:!ring-red-500/15' : '', className].filter(Boolean).join(' ')
  return <textarea ref={ref} className={cls} {...rest} />
})
