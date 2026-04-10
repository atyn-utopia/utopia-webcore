'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { useLanguage } from '@/contexts/LanguageContext'

type UserRole = 'admin' | 'designer' | 'writer' | 'indoor_sales' | 'manager'

interface CompanyRef { id: string; name: string }

interface UserProfile {
  id: string
  name: string
  role: UserRole
  created_at: string
  companies?: CompanyRef[]
}

interface Company { id: string; name: string }

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string; desc: string; access: string }> = {
  admin:        { label: 'Admin',            color: '#1e3a5f', bg: '#e0ecf5', desc: 'Full access to everything',         access: 'All pages, all companies' },
  designer:     { label: 'Designer',         color: '#7c3aed', bg: '#ede9fe', desc: 'Websites, phone numbers, blog',     access: 'All companies' },
  writer:       { label: 'Writer',           color: '#0369a1', bg: '#e0f2fe', desc: 'Blog content creation',             access: 'All blog posts' },
  indoor_sales: { label: 'Indoor Sales',     color: '#b45309', bg: '#fef3c7', desc: 'View websites & phone numbers',     access: 'Assigned companies only' },
  manager:      { label: 'Manager',          color: '#15803d', bg: '#dcfce7', desc: 'View websites & phone numbers',     access: 'Assigned companies only' },
}

const SCOPED_ROLES: UserRole[] = ['indoor_sales', 'manager']

function isScoped(r: UserRole) { return SCOPED_ROLES.includes(r) }

export default function UsersPage() {
  const { t } = useLanguage()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState<{ email: string; password: string; name: string; role: UserRole; company_ids: string[] }>({
    email: '', password: '', name: '', role: 'writer', company_ids: [],
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ name: string; role: UserRole; company_ids: string[] }>({ name: '', role: 'writer', company_ids: [] })
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [usersRes, compRes] = await Promise.all([
        fetch('/api/users').then(r => r.json()),
        fetch('/api/companies').then(r => r.json()),
      ])
      if (Array.isArray(usersRes)) setUsers(usersRes)
      if (Array.isArray(compRes)) setCompanies(compRes.map((c: Company) => ({ id: c.id, name: c.name })))
    } catch {}
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
    if (isScoped(form.role) && form.company_ids.length === 0) {
      setError('Assign at least one company for this role')
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
      setSuccess(`User "${data.name}" created as ${ROLE_META[data.role as UserRole]?.label ?? data.role}`)
      setForm({ email: '', password: '', name: '', role: 'writer', company_ids: [] })
      setShowForm(false)
      fetchAll()
    } else {
      setError(data.error ?? 'Failed to create user')
    }
  }

  function startEdit(u: UserProfile) {
    setEditingId(u.id)
    setEditDraft({ name: u.name, role: u.role, company_ids: (u.companies ?? []).map(c => c.id) })
    setError('')
    setSuccess('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({ name: '', role: 'writer', company_ids: [] })
  }

  async function saveEdit() {
    if (!editingId) return
    if (isScoped(editDraft.role) && editDraft.company_ids.length === 0) {
      setError('Assign at least one company for this role')
      return
    }
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, ...editDraft }),
    })
    setSaving(false)
    if (res.ok) {
      setSuccess('User updated')
      cancelEdit()
      fetchAll()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to update user')
    }
  }

  function toggleCompany(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter(c => c !== id) : [...list, id]
  }

  const filtered = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return u.name.toLowerCase().includes(q) || (u.companies ?? []).some(c => c.name.toLowerCase().includes(q))
    }
    return true
  })

  // Count by role for summary chips
  const roleCounts: Record<string, number> = {}
  users.forEach(u => { roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1 })

  return (
    <div>
      <PageHeader
        title={t('page.users.title')}
        description={t('page.users.description')}
        actions={
          <button
            onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
            className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 h-9 rounded-lg transition-opacity"
            style={{ background: 'var(--primary)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('button.addUser')}
          </button>
        }
      />

      {/* Success / Error banners */}
      {success && (
        <div className="mb-4 p-3 rounded-lg border text-sm flex items-center gap-2" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
          {success}
        </div>
      )}
      {error && !showForm && !editingId && (
        <div className="mb-4 p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>{error}</div>
      )}

      {/* Create user form */}
      {showForm && (
        <div className="mb-6 rounded-2xl border bg-white shadow-sm overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
          <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #e2e8f0' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#e0f2fe' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }} strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Create New User</h2>
              <p className="text-xs" style={{ color: '#94a3b8' }}>They&apos;ll be able to sign in immediately after creation</p>
            </div>
          </div>
          <form onSubmit={handleCreate} className="p-6 space-y-5">
            {error && (
              <div className="p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>{error}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Full Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Sarah Ahmad"
                  className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:border-[var(--primary)] transition-colors"
                  style={{ borderColor: '#cbd5e1' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="sarah@company.com"
                  className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:border-[var(--primary)] transition-colors"
                  style={{ borderColor: '#cbd5e1' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Password</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:border-[var(--primary)] transition-colors"
                  style={{ borderColor: '#cbd5e1' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Role</label>
                <div className="relative">
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole, company_ids: [] }))}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:border-[var(--primary)] transition-colors cursor-pointer pr-9"
                    style={{ borderColor: '#cbd5e1', appearance: 'none', WebkitAppearance: 'none' }}>
                    {(Object.keys(ROLE_META) as UserRole[]).map(r => (
                      <option key={r} value={r}>{ROLE_META[r].label} — {ROLE_META[r].desc}</option>
                    ))}
                  </select>
                  <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Company assignment for scoped roles */}
            {isScoped(form.role) && (
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#475569' }}>
                  Assigned Companies <span className="text-red-500">*</span>
                  <span className="ml-1 font-normal" style={{ color: '#94a3b8' }}>(user can only access these)</span>
                </label>
                <div className="flex flex-wrap gap-2 p-3 rounded-lg border max-h-48 overflow-y-auto" style={{ borderColor: '#cbd5e1', background: '#f8fafc' }}>
                  {companies.length === 0 ? (
                    <p className="text-xs" style={{ color: '#94a3b8' }}>No companies available — create one in Websites first.</p>
                  ) : companies.map(c => {
                    const checked = form.company_ids.includes(c.id)
                    return (
                      <button type="button" key={c.id}
                        onClick={() => setForm(f => ({ ...f, company_ids: toggleCompany(f.company_ids, c.id) }))}
                        className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
                        style={{
                          background: checked ? 'var(--primary)' : 'white',
                          borderColor: checked ? 'var(--primary)' : '#cbd5e1',
                          color: checked ? 'white' : '#475569',
                        }}>
                        {checked && <span className="mr-1">✓</span>}
                        {c.name}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: '#94a3b8' }}>Click to toggle. Selected: {form.company_ids.length}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setError('') }}
                className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-slate-50"
                style={{ borderColor: '#cbd5e1', color: '#475569' }}>Cancel</button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-opacity disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                {saving ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Role summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {(Object.keys(ROLE_META) as UserRole[]).map(r => (
          <button
            key={r}
            onClick={() => setRoleFilter(roleFilter === r ? '' : r)}
            className="rounded-xl border p-3 text-left transition-all hover:shadow-sm"
            style={{
              borderColor: roleFilter === r ? ROLE_META[r].color : '#e2e8f0',
              background: roleFilter === r ? ROLE_META[r].bg : 'white',
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold" style={{ color: ROLE_META[r].color }}>{ROLE_META[r].label}</span>
              <span className="text-lg font-bold" style={{ color: ROLE_META[r].color }}>{roleCounts[r] ?? 0}</span>
            </div>
            <p className="text-[11px] leading-tight" style={{ color: '#94a3b8' }}>{ROLE_META[r].access}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-5">
        <div className="relative max-w-md">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#cbd5e1' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users or companies…"
            className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border focus:outline-none"
            style={{ borderColor: '#cbd5e1', background: 'white' }} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors" style={{ background: '#e2e8f0', color: '#64748b' }}>
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Users list */}
      {loading ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-sm rounded-xl border" style={{ borderColor: '#e2e8f0', color: '#94a3b8' }}>
          {users.length === 0 ? 'No users yet. Create your first one above.' : 'No users match your filters.'}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden shadow-sm" style={{ borderColor: '#e2e8f0' }}>
          {filtered.map((user, i) => {
            const isEditing = editingId === user.id
            const meta = ROLE_META[user.role] ?? ROLE_META.admin
            return (
              <div key={user.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                {!isEditing ? (
                  <div className="px-5 py-4 flex items-center gap-4 hover:bg-[#f8fafc] transition-colors">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1a3a6e, #2979d6)' }}>
                      {user.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{user.name}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                      </div>
                      {/* Company chips for scoped users */}
                      {isScoped(user.role) && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {(user.companies ?? []).length === 0 ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#fef2f2', color: '#dc2626' }}>No companies assigned</span>
                          ) : (user.companies ?? []).map(c => (
                            <span key={c.id} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#f1f5f9', color: '#475569' }}>{c.name}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] mt-1" style={{ color: '#94a3b8' }}>
                        Joined {new Date(user.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(user)}
                      className="text-xs font-medium px-3 py-1.5 rounded-md border transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                      style={{ borderColor: '#e2e8f0', color: '#64748b' }}
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  /* Inline edit panel */
                  <div className="p-5" style={{ background: '#fafbfc' }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1a3a6e, #2979d6)' }}>
                        {user.name[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Editing {user.name}</p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>Update role, name, and company assignments</p>
                      </div>
                    </div>
                    {error && (
                      <div className="mb-3 p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}>{error}</div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Name</label>
                        <input type="text" value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                          className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:border-[var(--primary)] transition-colors"
                          style={{ borderColor: '#cbd5e1', background: 'white' }} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Role</label>
                        <div className="relative">
                          <select value={editDraft.role} onChange={e => setEditDraft(d => ({ ...d, role: e.target.value as UserRole, company_ids: isScoped(e.target.value as UserRole) ? d.company_ids : [] }))}
                            className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:border-[var(--primary)] transition-colors cursor-pointer pr-9"
                            style={{ borderColor: '#cbd5e1', background: 'white', appearance: 'none', WebkitAppearance: 'none' }}>
                            {(Object.keys(ROLE_META) as UserRole[]).map(r => (
                              <option key={r} value={r}>{ROLE_META[r].label} — {ROLE_META[r].desc}</option>
                            ))}
                          </select>
                          <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>
                    {isScoped(editDraft.role) && (
                      <div className="mb-4">
                        <label className="block text-xs font-medium mb-2" style={{ color: '#475569' }}>
                          Assigned Companies <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2 p-3 rounded-lg border max-h-48 overflow-y-auto" style={{ borderColor: '#cbd5e1', background: 'white' }}>
                          {companies.length === 0 ? (
                            <p className="text-xs" style={{ color: '#94a3b8' }}>No companies available</p>
                          ) : companies.map(c => {
                            const checked = editDraft.company_ids.includes(c.id)
                            return (
                              <button type="button" key={c.id}
                                onClick={() => setEditDraft(d => ({ ...d, company_ids: toggleCompany(d.company_ids, c.id) }))}
                                className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
                                style={{
                                  background: checked ? 'var(--primary)' : 'white',
                                  borderColor: checked ? 'var(--primary)' : '#cbd5e1',
                                  color: checked ? 'white' : '#475569',
                                }}>
                                {checked && <span className="mr-1">✓</span>}
                                {c.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={cancelEdit}
                        className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-white"
                        style={{ borderColor: '#cbd5e1', color: '#475569' }}>Cancel</button>
                      <button type="button" onClick={saveEdit} disabled={saving}
                        className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-opacity disabled:opacity-50"
                        style={{ background: 'var(--primary)' }}>
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <p className="mt-3 text-xs" style={{ color: '#94a3b8' }}>{filtered.length} of {users.length} users</p>
    </div>
  )
}
