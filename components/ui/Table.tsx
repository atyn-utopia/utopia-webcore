import type React from 'react'

/**
 * Lightweight table primitives.
 *
 * Style profile:
 *   - Hairline borders only between rows; no vertical dividers.
 *   - Header is uppercase tracking-wider 10px text on slate-50 background.
 *   - Rows hover into slate-50/40 — subtle, not distracting.
 *   - Wrap in <Card padding={false}> for a clean rounded panel look.
 *
 * Use cell `<td className="text-right">` or `<th className="text-right">`
 * for numeric / action-column alignment; nothing fancy needed.
 */

export function Table({ className = '', children, ...rest }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={`w-full text-xs border-collapse ${className}`} {...rest}>
      {children}
    </table>
  )
}

export function THead({ className = '', children, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-slate-50 ${className}`} {...rest}>
      {children}
    </thead>
  )
}

export function TBody({ className = '', children, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...rest}>{children}</tbody>
}

export function TR({ className = '', interactive = false, children, ...rest }: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={[
        'border-t border-slate-100',
        interactive ? 'hover:bg-slate-50/60 transition-colors cursor-pointer' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </tr>
  )
}

export function TH({ className = '', children, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-4 py-2 text-left ${className}`}
      {...rest}
    >
      {children}
    </th>
  )
}

export function TD({ className = '', children, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-2.5 text-slate-700 ${className}`} {...rest}>{children}</td>
  )
}

export function TableEmpty({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return (
    <TR>
      <TD colSpan={colSpan} className="!py-8 text-center text-slate-400">
        {children}
      </TD>
    </TR>
  )
}
