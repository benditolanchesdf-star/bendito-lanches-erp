'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import usePWA from '@/lib/pwa-register'
import {
  ShoppingCart, Clock, Star, User, Download,
  RefreshCw, Bell, Home,
} from 'lucide-react'
import Link from 'next/link'

const BOTTOM_NAV = [
  { href: '/cliente',             icon: Home,         label: 'Início'    },
  { href: '/cliente/pedido-novo', icon: ShoppingCart, label: 'Pedir'     },
  { href: '/cliente/pedidos',     icon: Clock,        label: 'Pedidos'   },
  { href: '/cliente/favoritos',   icon: Star,         label: 'Favoritos' },
  { href: '/cliente/dados-loja',  icon: User,         label: 'Perfil'    },
]

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createClient()
  const [cliente, setCliente] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pedidosPendentes, setPedidosPendentes] = useState(0)
  const { instalavel, instalar, atualizacao, atualizarApp } = usePWA()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: profile } = await supabase
        .from('profiles').select('*, clientes(nome, nome_loja)')
        .eq('id', user.id).maybeSingle()
      if (profile?.papel !== 'cliente') { router.replace('/login'); return }
      setCliente(profile)

      // Contar pedidos ativos
      const { count } = await supabase.from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', profile.cliente_id)
        .in('status', ['confirmado', 'em_producao', 'saiu_para_entrega'])
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
    <div className="flex flex-col min-h-screen bg-gray-950 text-white">
      {/* Banner de instalação PWA */}
      {instalavel && (
        <div className="bg-yellow-400 text-gray-900 px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Download size={16}/>
            <span className="text-xs font-semibold">Instale o app para acesso rápido!</span>
          </div>
          <button onClick={instalar}
            className="bg-gray-900 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full">
            Instalar
          </button>
        </div>
      )}

      {/* Banner de atualização */}
      {atualizacao && (
        <div className="bg-blue-500 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <RefreshCw size={14}/>
            <span className="text-xs font-semibold">Nova versão disponível!</span>
          </div>
          <button onClick={atualizarApp} className="bg-white text-blue-600 text-xs font-bold px-3 py-1 rounded-full">
            Atualizar
          </button>
        </div>
      )}

      {/* Header mobile */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <span className="text-xl">🍕</span>
          <div>
            <p className="text-xs text-gray-400 leading-none">Olá,</p>
            <p className="text-sm font-bold text-yellow-400 leading-none">
              {cliente?.clientes?.nome_loja || cliente?.clientes?.nome || 'Cliente'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pedidosPendentes > 0 && (
            <Link href="/cliente/pedidos" className="relative">
              <Bell size={20} className="text-gray-400"/>
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                {pedidosPendentes}
              </span>
            </Link>
          )}
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-40 safe-area-pb">
        <div className="flex">
          {BOTTOM_NAV.map(item => {
            const Icon = item.icon
            const isActive = pathname === item.href ||
              (item.href !== '/cliente' && pathname.startsWith(item.href))
            const isPedido = item.href === '/cliente/pedido-novo'
            return (
              <Link key={item.href} href={item.href}
                className={`flex-1 flex flex-col items-center justify-center py-2 transition-all relative
                  ${isPedido ? '-mt-4' : ''}`}>
                {isPedido ? (
                  <div className="bg-yellow-400 rounded-full p-3.5 shadow-lg shadow-yellow-400/30 mb-1">
                    <Icon size={22} className="text-gray-900"/>
                  </div>
                ) : (
                  <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-yellow-400/10' : ''}`}>
                    <Icon size={22} className={isActive ? 'text-yellow-400' : 'text-gray-500'}/>
                  </div>
                )}
                <span className={`text-xs font-medium ${isPedido ? 'text-yellow-400' : isActive ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {item.label}
                </span>
                {isActive && !isPedido && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-yellow-400 rounded-full"/>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
