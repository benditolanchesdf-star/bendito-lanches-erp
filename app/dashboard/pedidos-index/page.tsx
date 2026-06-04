'use client'

import Link from 'next/link'
import { ShoppingCart, ArrowLeftRight, ShoppingBag } from 'lucide-react'
import { PageHeader } from '@/components/ui'

const SUBMENUS = [
  {
    href: '/dashboard/pedidos',
    icon: ShoppingCart,
    cor: 'bg-blue-100',
    iconCor: 'text-blue-600',
    label: 'Pedidos de Clientes',
    desc: 'Pedidos externos de entrega',
  },
  {
    href: '/dashboard/pedidos-internos',
    icon: ArrowLeftRight,
    cor: 'bg-purple-100',
    iconCor: 'text-purple-600',
    label: 'Pedidos Internos',
    desc: 'Filial → Matriz',
  },
  {
    href: '/dashboard/pedidos-compra',
    icon: ShoppingBag,
    cor: 'bg-orange-100',
    iconCor: 'text-orange-600',
    label: 'Pedidos de Compra',
    desc: 'Compras de insumos e produtos',
  },
]

export default function PedidosIndexPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos" subtitle="Gerencie todos os tipos de pedidos do sistema" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SUBMENUS.map(item => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg hover:ring-2 hover:ring-bendito-dourado transition group">
              <div className={`${item.cor} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
                <Icon size={24} className={item.iconCor} />
              </div>
              <h3 className="font-bold text-bendito-verde-escuro">{item.label}</h3>
              <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
