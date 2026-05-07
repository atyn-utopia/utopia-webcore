import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * OAuth callback for Supabase auth. Used by both:
 *   - "Sign in with Google" on /login
 *   - any future OAuth provider we wire through Supabase
 *
 * After exchanging the OAuth code for a session, we verify the resulting
 * auth user has a corresponding user_profiles row. If not, we sign them
 * out and bounce to /login with an error — otherwise getUserScope's
 * fallback would silently grant 'admin' to anyone who happened to land
 * on a working OAuth callback.
 *
 * For an existing password user with the same Google email to land in
 * their existing profile, enable "Confirm linked identities" in the
 * Supabase auth settings so Supabase auto-links the Google identity to
 * the existing auth.users row (same UUID).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const errorParam = searchParams.get('error_description') ?? searchParams.get('error')

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?auth_error=${encodeURIComponent(errorParam)}`)
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?auth_error=missing_code`)
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?auth_error=${encodeURIComponent(exchangeError.message)}`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login?auth_error=no_user`)
  }

  // Gate access to invited users only. user_profiles is keyed on
  // auth.users(id), so a successful match here means an admin created the
  // profile. Without this gate, the getUserScope fallback would treat any
  // signed-in user as 'admin'.
  const service = createServiceClient()
  const { data: profile } = await service
    .from('user_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?auth_error=not_invited`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
