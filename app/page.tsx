import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { dashboardPath } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('id', user.id)
    .maybeSingle()

  redirect(dashboardPath(profile?.papel ?? 'cliente'))
}
