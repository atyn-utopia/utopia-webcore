'use client'

import { useState, useEffect } from 'react'
import PageHeader from '@/components/PageHeader'

interface Ticket {
  id: string
  user_name: string
  user_role: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'closed'
  created_at: string
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  open: { bg: '#fef3c7', color: '#92400e', label: 'Open' },
  in_progress: { bg: '#e0f2fe', color: '#0369a1', label: 'In Progress' },
  closed: { bg: '#f1f5f9', color: '#64748b', label: 'Closed' },
}

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  admin: { bg: '#e0ecf5', color: '#1e3a5f' },
  designer: { bg: '#ede9fe', color: '#7c3aed' },
  writer: { bg: '#e0f2fe', color: '#0369a1' },
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [betaOn, setBetaOn] = useState(false)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    fetch('/api/tickets').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTickets(data)
      setLoading(false)
    }).catch(() => setLoading(false))

    fetch('/api/settings?key=beta_banner').then(r => r.json()).then(data => {
      setBetaOn(data.value === 'on')
    }).catch(() => {})
  }, [])

  async function toggleBeta() {
    setToggling(true)
    const newValue = betaOn ? 'off' : 'on'
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'beta_banner', value: newValue }),
    })
    setBetaOn(!betaOn)
    setToggling(false)
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: status as Ticket['status'] } : t))
  }

  const openCount = tickets.filter(t => t.status === 'open').length
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length

  return (
    <div>
      <PageHeader title="Tickets" description="Manage bug reports and feedback from team members" />

      {/* Beta banner toggle */}
      <div className="mb-6 rounded-xl border bg-white p-5 flex items-center justify-between" style={{ borderColor: '#cbd5e1' }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Beta Banner</h2>
          <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Show a beta testing banner to designers and writers.</p>
        </div>
        <button
          onClick={toggleBeta}
          disabled={toggling}
          className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
          style={{ background: betaOn ? '#16a34a' : '#cbd5e1' }}
        >
          <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ left: betaOn ? '22px' : '2px' }} />
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-5">
        <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: '#fef3c7', color: '#92400e' }}>
          <span className="font-semibold">{openCount}</span> Open
        </div>
        <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: '#e0f2fe', color: '#0369a1' }}>
          <span className="font-semibold">{inProgressCount}</span> In Progress
        </div>
        <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: '#f1f5f9', color: '#64748b' }}>
          <span className="font-semibold">{tickets.length}</span> Total
        </div>
      </div>

      {/* Tickets list */}
      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>No tickets yet.</div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#cbd5e1' }}>
          {tickets.map((ticket, i) => {
            const s = STATUS_STYLE[ticket.status] ?? STATUS_STYLE.open
            const r = ROLE_STYLE[ticket.user_role] ?? ROLE_STYLE.writer
            return (
              <div key={ticket.id} className="px-4 sm:px-5 py-4 hover:bg-[#f8fafc] transition-colors" style={{ borderBottom: i < tickets.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{ticket.subject}</p>
                    </div>
                    {ticket.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#475569' }}>{ticket.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #1a3a6e, #2979d6)' }}>
                          {ticket.user_name[0]?.toUpperCase()}
                        </div>
                        <span className="text-[10px]" style={{ color: '#475569' }}>{ticket.user_name}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize" style={{ background: r.bg, color: r.color }}>{ticket.user_role}</span>
                      <span className="text-[10px]" style={{ color: '#94a3b8' }}>
                        {new Date(ticket.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={ticket.status}
                      onChange={e => updateStatus(ticket.id, e.target.value)}
                      className="text-[10px] font-medium px-2 py-1 rounded-full cursor-pointer border-0 outline-none"
                      style={{ background: s.bg, color: s.color, appearance: 'none', WebkitAppearance: 'none', paddingRight: '0.75rem' }}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
