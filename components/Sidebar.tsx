'use client'

import SidebarMenu from './SidebarMenu'
import {
  LayoutDashboard, ShoppingCart, Package, Users, TrendingUp,
  DollarSign, BarChart3, Brain, Settings, Factory, Box,
  CalendarDays, Tag,
} from 'lucide-react'

const menuAdmin = [
  { icon: LayoutDashboard, label: 'Dashboard',        href: '/dashboard' },
  { icon: ShoppingCart,    label: 'Pedidos',          href: '/dashboard/pedidos' },
  { icon: CalendarDays,    label: 'Agenda Entregas',  href: '/dashboard/agenda' },
  { icon: Factory,         label: 'Produção',         href: '/dashboard/producao' },
  { icon: Box,             label: 'Estoque',          href: '/dashboard/estoque' },
  { icon: Package,         label: 'Produtos',         href: '/dashboard/produtos' },
  { icon: Tag,             label: 'Precificação',     href: '/dashboard/precificacao' },
  { icon: Users,           label: 'Clientes',         href: '/dashboard/clientes' },
  { icon: TrendingUp,      label: 'Vendedores',       href: '/dashboard/vendedores' },
  { icon: DollarSign,      label: 'Financeiro',       href: '/dashboard/financeiro' },
  { icon: BarChart3,       label: 'Relatórios',       href: '/dashboard/relatorios' },
  { icon: Brain,           label: 'IA - Previsões',   href: '/dashboard/ia' },
  { icon: Settings,        label: 'Configurações',    href: '/dashboard/configuracoes' },
]

export default function Sidebar() {
  return <SidebarMenu titulo="Bendito Lanches" subtitulo="Admin / Matriz" itens={menuAdmin} />
}
