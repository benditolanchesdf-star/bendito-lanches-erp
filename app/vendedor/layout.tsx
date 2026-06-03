import SidebarMenu from '@/components/SidebarMenu'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function VendedorLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
      .from('profiles').select('papel, nome').eq('id', user.id).maybeSingle()

    if (!profile || (profile.papel !== 'vendedor' && profile.papel !== 'admin' && profile.papel !== 'matriz')) {
      redirect('/cliente')
    }

    return (
      <div className="flex min-h-screen bg-bendito-creme">
        <SidebarMenu tipo="vendedor" titulo="Painel Vendedor" subtitulo={profile.nome || 'Vendedor'} />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-4 lg:p-8">{children}</div>
        </main>
      </div>
    )
  } catch {
    redirect('/login')
  }
}
