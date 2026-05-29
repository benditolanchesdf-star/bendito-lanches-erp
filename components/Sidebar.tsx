'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  DollarSign,
  BarChart3,
  Brain,
  Settings,
  LogOut,
  Menu,
  X,
  Factory,
  Box,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: ShoppingCart, label: 'Pedidos', href: '/dashboard/pedidos' },
  { icon: Factory, label: 'Produção', href: '/dashboard/producao' },
  { icon: Box, label: 'Estoque', href: '/dashboard/estoque' },
  { icon: Package, label: 'Produtos', href: '/dashboard/produtos' },
  { icon: Users, label: 'Clientes', href: '/dashboard/clientes' },
  { icon: TrendingUp, label: 'Vendedores', href: '/dashboard/vendedores' },
  { icon: DollarSign, label: 'Financeiro', href: '/dashboard/financeiro' },
  { icon: BarChart3, label: 'Relatórios', href: '/dashboard/relatorios' },
  { icon: Brain, label: 'IA - Previsões', href: '/dashboard/ia' },
]

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-bendito-dourado rounded-lg shadow-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen
          w-72 bg-bendito-verde-escuro text-white
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 z-40
          flex flex-col
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-bendito-verde">
          <h1 className="text-2xl font-bold text-bendito-dourado">
            🍕 Bendito Lanches
          </h1>
          <p className="text-xs text-bendito-creme mt-1">Sistema ERP v1.0</p>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg
                      transition-all duration-200
                      ${
                        isActive
                          ? 'bg-bendito-dourado text-bendito-verde-escuro font-semibold'
                          : 'hover:bg-bendito-verde text-bendito-creme'
                      }
                    `}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-bendito-verde space-y-2">
          <Link
            href="/dashboard/configuracoes"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-bendito-verde text-bendito-creme transition-all"
          >
            <Settings size={20} />
            <span>Configurações</span>
          </Link>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-600 text-bendito-creme transition-all"
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  )
}
