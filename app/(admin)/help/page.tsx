'use client'

import { useState, useEffect } from 'react'
import PageHeader from '@/components/PageHeader'
import { useLanguage } from '@/contexts/LanguageContext'

interface Ticket {
  id: string
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

export default function HelpPage() {
  const { t } = useLanguage()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { fetchTickets() }, [])

  async function fetchTickets() {
    setLoading(true)
    const res = await fetch('/api/tickets')
    const data = await res.json()
    if (Array.isArray(data)) setTickets(data)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim()) { setError('Subject is required'); return }
    setError('')
    setSaving(true)
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subject.trim(), description: description.trim() }),
    })
    setSaving(false)
    if (res.ok) {
      setSuccess('Ticket submitted! We\'ll look into it.')
      setSubject('')
      setDescription('')
      setShowForm(false)
      fetchTickets()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to submit')
    }
  }

  return (
    <div>
      <PageHeader
        title={t('page.help.title')}
        description={t('page.help.description')}
        actions={
          <button onClick={() => { setShowForm(!showForm); setSuccess(''); setError('') }}
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 h-9 rounded-lg transition-opacity"
            style={{ background: 'var(--primary)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {t('button.newTicket')}
          </button>
        }
      />

      {success && (
        <div className="mb-4 p-3 rounded-lg border text-sm" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}>{success}</div>
      )}

      {/* Submit form */}
      {showForm && (
        <div className="mb-6 rounded-xl border bg-white p-5" style={{ borderColor: '#cbd5e1' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Submit a Ticket</h2>
          {error && (
            <div className="mb-4 p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Subject <span className="text-red-500">*</span></label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description of the issue"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-[var(--primary)] transition-colors" style={{ borderColor: '#e2e8f0' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                placeholder="Steps to reproduce, expected behavior, screenshots, etc."
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-[var(--primary)] transition-colors resize-y" style={{ borderColor: '#e2e8f0' }} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs rounded-lg border transition-colors hover:bg-slate-50" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Cancel</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white rounded-lg transition-opacity disabled:opacity-50" style={{ background: 'var(--primary)' }}>
                {saving ? 'Submitting…' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* My tickets */}
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>My Tickets</h2>
      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>
          No tickets yet. Submit one if you find any issues!
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#cbd5e1' }}>
          {tickets.map((ticket, i) => {
            const s = STATUS_STYLE[ticket.status] ?? STATUS_STYLE.open
            return (
              <div key={ticket.id} className="px-4 sm:px-5 py-4" style={{ borderBottom: i < tickets.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{ticket.subject}</p>
                    {ticket.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#475569' }}>{ticket.description}</p>}
                    <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>
                      {new Date(ticket.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ background: s.bg, color: s.color }}>
                    {s.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
