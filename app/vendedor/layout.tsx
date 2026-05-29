import SidebarMenu from '@/components/SidebarMenu'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LayoutDashboard, Users, ShoppingCart, DollarSign } from 'lucide-react'

const menuVendedor = [
  { icon: LayoutDashboard, label: 'Painel',      href: '/vendedor' },
  { icon: Users,           label: 'Meus Clientes', href: '/vendedor/clientes' },
  { icon: ShoppingCart,    label: 'Pedidos',     href: '/vendedor/pedidos' },
  { icon: DollarSign,      label: 'Comissões',   href: '/vendedor/comissoes' },
]

export default async function VendedorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('papel, nome').eq('id', user.id).maybeSingle()

  // Admin/matriz também podem usar a área de vendedor (vendo todos os clientes)
  if (!profile || (profile.papel !== 'vendedor' && profile.papel !== 'admin' && profile.papel !== 'matriz')) {
    redirect('/cliente')
  }

  return (
    <div className="flex min-h-screen bg-bendito-creme">
      <SidebarMenu titulo="Painel Vendedor" subtitulo={profile.nome || 'Vendedor'} itens={menuVendedor} />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-4 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
