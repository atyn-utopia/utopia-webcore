import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string | ReactNode
  actions?: ReactNode
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  const isString = typeof description === 'string'
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>{title}</h1>
        {description && isString && (
          <p className="text-xs mt-1" style={{ color: '#64748b' }}>
            {description}
          </p>
        )}
        {description && !isString && <div className="mt-1 text-xs" style={{ color: '#64748b' }}>{description}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
