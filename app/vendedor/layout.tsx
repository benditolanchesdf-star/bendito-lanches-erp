'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import usePWA from '@/lib/pwa-register'
import {
  LayoutDashboard, Users, ShoppingCart, CalendarDays,
  TrendingUp, DollarSign, Download, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'

const BOTTOM_NAV = [
  { href: '/vendedor',           icon: LayoutDashboard, label: 'Painel'   },
  { href: '/vendedor/clientes',  icon: Users,           label: 'Clientes' },
  { href: '/vendedor/pedidos',   icon: ShoppingCart,    label: 'Pedidos'  },
  { href: '/vendedor/agenda',    icon: CalendarDays,    label: 'Agenda'   },
  { href: '/vendedor/comissoes', icon: DollarSign,      label: 'Comissão' },
]

export default function VendedorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [vendedor, setVendedor] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pedidosPendentes, setPedidosPendentes] = useState(0)
  const { instalavel, instalar, atualizacao, atualizarApp } = usePWA()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: profile } = await supabase
        .from('profiles').select('*, vendedores(nome)')
        .eq('id', user.id).maybeSingle()
      if (!['vendedor','admin','matriz'].includes(profile?.papel || '')) {
        router.replace('/login'); return
      }
      setVendedor(profile)

      const { count } = await supabase.from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('vendedor_id', profile.vendedor_id)
        .in('status', ['confirmado', 'em_producao'])
      setPedidosPendentes(count || 0)
      setLoading(false)
    }
    init()
  }, [pathname])

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-bounce">🍕</div>
        <p className="text-yellow-400 text-sm font-semibold">Carregando...</p>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {instalavel && (
        <div className="bg-bendito-verde text-white px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Download size={16}/>
            <span className="text-xs font-semibold">Instale o app Bendito!</span>
          </div>
          <button onClick={instalar} className="bg-white text-bendito-verde text-xs font-bold px-3 py-1 rounded-full">
            Instalar
          </button>
        </div>
      )}
      {atualizacao && (
        <div className="bg-blue-500 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold flex items-center gap-2"><RefreshCw size={14}/> Atualização disponível</span>
          <button onClick={atualizarApp} className="bg-white text-blue-600 text-xs font-bold px-3 py-1 rounded-full">Atualizar</button>
        </div>
      )}

      {/* Header */}
      <header className="bg-bendito-verde-escuro text-white px-4 py-3 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-xl">🍕</span>
          <div>
            <p className="text-xs text-white/60 leading-none">Vendedor</p>
            <p className="text-sm font-bold text-bendito-dourado leading-none">
              {vendedor?.vendedores?.nome || 'Vendedor'}
            </p>
          </div>
        </div>
        {pedidosPendentes > 0 && (
          <Link href="/vendedor/pedidos"
            className="flex items-center gap-1.5 bg-yellow-400/20 border border-yellow-400/30 text-yellow-300 text-xs font-bold px-3 py-1.5 rounded-full">
            <ShoppingCart size={13}/> {pedidosPendentes} ativos
          </Link>
        )}
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 shadow-lg">
        <div className="flex">
          {BOTTOM_NAV.map(item => {
            const Icon = item.icon
            const isActive = pathname === item.href ||
              (item.href !== '/vendedor' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                className="flex-1 flex flex-col items-center justify-center py-2.5 transition-all relative">
                <Icon size={22} className={isActive ? 'text-bendito-verde' : 'text-gray-400'}/>
                <span className={`text-xs font-medium mt-0.5 ${isActive ? 'text-bendito-verde' : 'text-gray-400'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-bendito-verde rounded-full"/>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
