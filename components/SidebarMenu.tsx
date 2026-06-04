'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LogOut, Menu, X,
  LayoutDashboard, Users, ShoppingCart, DollarSign, CalendarDays, TrendingUp,
  Clock, Repeat, Star, Store, Package, BarChart2, Settings, Utensils,
  Truck, Calculator, Brain, Wallet, ArrowLeftRight,
  ShoppingBag, TrendingDown, Bell, UserCog, MessageCircle, LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface MenuItem {
  icon: LucideIcon
  label: string
  href: string
}

const MENUS: Record<string, MenuItem[]> = {
  vendedor: [
    { icon: LayoutDashboard, label: 'Painel',           href: '/vendedor' },
    { icon: Users,           label: 'Meus Clientes',    href: '/vendedor/clientes' },
    { icon: ShoppingCart,    label: 'Pedidos',          href: '/vendedor/pedidos' },
    { icon: CalendarDays,    label: 'Agenda Entregas',  href: '/vendedor/agenda' },
    { icon: TrendingUp,      label: 'Evolução Compras', href: '/vendedor/evolucao' },
    { icon: DollarSign,      label: 'Comissões',        href: '/vendedor/comissoes' },
  ],
  cliente: [
    { icon: ShoppingCart, label: 'Novo Pedido',    href: '/cliente/pedido-novo' },
    { icon: Clock,        label: 'Meus Pedidos',   href: '/cliente/pedidos' },
    { icon: Repeat,       label: 'Repetir Último', href: '/cliente/pedido-novo?repetir=true' },
    { icon: Star,         label: 'Favoritos',      href: '/cliente/favoritos' },
    { icon: Store,        label: 'Dados da Loja',  href: '/cliente/dados-loja' },
  ],
  admin: [
    { icon: LayoutDashboard, label: 'Dashboard',         href: '/dashboard' },
    { icon: Bell,            label: 'Aprovações',        href: '/dashboard/aprovacoes' },
    { icon: ShoppingCart,    label: 'Pedidos',           href: '/dashboard/pedidos-index' },
    { icon: Package,         label: 'Produtos',          href: '/dashboard/produtos' },
    { icon: Utensils,        label: 'Produção',          href: '/dashboard/producao' },
    { icon: Truck,           label: 'Agenda',            href: '/dashboard/agenda' },
    { icon: BarChart2,       label: 'Estoque',           href: '/dashboard/estoque' },
    { icon: Calculator,      label: 'Precificação',      href: '/dashboard/precificacao' },
    { icon: TrendingDown,    label: 'Despesas',          href: '/dashboard/despesas' },
    { icon: Wallet,          label: 'Financeiro',        href: '/dashboard/financeiro' },
    { icon: TrendingUp,      label: 'Relatórios',        href: '/dashboard/relatorios' },
    { icon: MessageCircle,   label: 'WhatsApp',          href: '/dashboard/whatsapp' },
    { icon: UserCog,         label: 'Usuários',          href: '/dashboard/usuarios' },
    { icon: Brain,           label: 'IA',                href: '/dashboard/ia' },
    { icon: Settings,        label: 'Configurações',     href: '/dashboard/configuracoes' },
  ],
}

interface SidebarMenuProps {
  tipo: 'vendedor' | 'cliente' | 'admin'
  titulo: string
  subtitulo: string
}

export default function SidebarMenu({ tipo, titulo, subtitulo }: SidebarMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const itens = MENUS[tipo] ?? MENUS.admin

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-bendito-dourado rounded-lg shadow-lg">
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-72 bg-bendito-verde-escuro text-white
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 z-40
        flex flex-col`}>

        <div className="p-6 border-b border-bendito-verde">
          <h1 className="text-2xl font-bold text-bendito-dourado">🍕 {titulo}</h1>
          <p className="text-xs text-bendito-creme mt-1">{subtitulo}</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {itens.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' &&
                  item.href !== '/vendedor' &&
                  item.href !== '/cliente' &&
                  pathname.startsWith(item.href))
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                      ${isActive
                        ? 'bg-bendito-dourado text-bendito-verde-escuro font-semibold'
                        : 'hover:bg-bendito-verde text-bendito-creme'}`}>
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-bendito-verde">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-600 text-bendito-creme transition-all">
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  )
}
