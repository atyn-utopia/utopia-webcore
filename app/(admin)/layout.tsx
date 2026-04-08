import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import AdminShell from '@/components/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const service = createServiceClient()
  const { data: profile } = await service
    .from('user_profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const userName = profile?.name || user.email?.split('@')[0] || 'User'
  const userRole = (profile?.role as 'admin' | 'designer' | 'writer') || 'admin'

  return (
    <AdminShell
      userEmail={user.email ?? ''}
      userName={userName}
      userRole={userRole}
    >
      {children}
    </AdminShell>
  )
}
