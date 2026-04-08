'use client'

import { useEffect, useState } from 'react'

interface UserProfile {
  id: string
  name: string
  role: 'admin' | 'designer' | 'writer'
  created_at: string
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: 'Admin', color: '#1e3a5f', bg: '#e0ecf5' },
  designer: { label: 'Designer', color: '#7c3aed', bg: '#ede9fe' },
  writer: { label: 'Writer', color: '#0369a1', bg: '#e0f2fe' },
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'writer' })

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    const res = await fetch('/api/users')
    const data = await res.json()
    if (Array.isArray(data)) setUsers(data)
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.email || !form.password || !form.name) {
      setError('All fields are required')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setSuccess(`User "${data.name}" created as ${data.role}`)
      setForm({ email: '', password: '', name: '', role: 'writer' })
      setShowForm(false)
      fetchUsers()
    } else {
      setError(data.error ?? 'Failed to create user')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Users</h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: '#475569' }}>Manage team members and their access roles.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
          className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity mt-3 sm:mt-0"
          style={{ background: 'var(--primary)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {/* Success message */}
      {success && (
        <div className="mb-4 p-3 rounded-lg border text-sm" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}>{success}</div>
      )}

      {/* Create user form */}
      {showForm && (
        <div className="mb-6 rounded-xl border bg-white p-5" style={{ borderColor: '#cbd5e1' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Create New User</h2>
          {error && (
            <div className="mb-4 p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>{error}</div>
          )}
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Sarah Ahmad"
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-[var(--primary)] transition-colors"
                  style={{ borderColor: '#e2e8f0' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="sarah@company.com"
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-[var(--primary)] transition-colors"
                  style={{ borderColor: '#e2e8f0' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-[var(--primary)] transition-colors"
                  style={{ borderColor: '#e2e8f0' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-[var(--primary)] transition-colors cursor-pointer"
                  style={{ borderColor: '#e2e8f0' }}
                >
                  <option value="admin">Admin — Full access</option>
                  <option value="designer">Designer — Websites, Phone Numbers, Blog</option>
                  <option value="writer">Writer — Websites, Blog only</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px]" style={{ color: '#94a3b8' }}>User will be able to sign in immediately after creation.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-xs rounded-lg border transition-colors hover:bg-slate-50"
                  style={{ borderColor: '#cbd5e1', color: '#475569' }}
                >Cancel</button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-white rounded-lg transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >{saving ? 'Creating...' : 'Create User'}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Role guide */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          { role: 'admin', desc: 'Full access to everything', access: 'Websites, Phone Numbers, Blog, Users' },
          { role: 'designer', desc: 'UI/UX and content management', access: 'Websites, Phone Numbers, Blog' },
          { role: 'writer', desc: 'Blog content creation only', access: 'Websites, Blog' },
        ].map(r => (
          <div key={r.role} className="rounded-lg border p-3" style={{ borderColor: '#e2e8f0' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: ROLE_LABELS[r.role].bg, color: ROLE_LABELS[r.role].color }}>
                {ROLE_LABELS[r.role].label}
              </span>
            </div>
            <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{r.desc}</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>{r.access}</p>
          </div>
        ))}
      </div>

      {/* Users list */}
      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>Loading...</div>
      ) : users.length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#cbd5e1', color: '#475569' }}>
          No users found. Create your admin profile in Supabase first.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#cbd5e1' }}>
          {users.map((user, i) => (
            <div
              key={user.id}
              className="px-4 sm:px-5 py-4 flex items-center gap-3 hover:bg-[#f8fafc] transition-colors"
              style={{ borderBottom: i < users.length - 1 ? '1px solid #e2e8f0' : 'none' }}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1a3a6e, #2979d6)' }}>
                {user.name[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{user.name}</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: ROLE_LABELS[user.role]?.bg, color: ROLE_LABELS[user.role]?.color }}>
                    {ROLE_LABELS[user.role]?.label ?? user.role}
                  </span>
                </div>
                <p className="text-xs mt-0.5 truncate" style={{ color: '#94a3b8' }}>
                  Joined {new Date(user.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
