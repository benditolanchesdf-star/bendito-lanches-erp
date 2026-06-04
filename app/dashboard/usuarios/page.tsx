'use client'

import Link from 'next/link'
import { Shield, Users, Monitor, UserCog } from 'lucide-react'
import { PageHeader } from '@/components/ui'

const SUBMENUS = [
  {
    href: '/dashboard/usuarios/administradores',
    icon: Shield,
    cor: 'bg-red-100',
    iconCor: 'text-red-600',
    label: 'Administradores',
    desc: 'Acesso total ao sistema',
  },
  {
    href: '/dashboard/usuarios/gerentes',
    icon: UserCog,
    cor: 'bg-purple-100',
    iconCor: 'text-purple-600',
    label: 'Gerentes',
    desc: 'Gestão de filial',
  },
  {
    href: '/dashboard/usuarios/atendentes',
    icon: Monitor,
    cor: 'bg-orange-100',
    iconCor: 'text-orange-600',
    label: 'Atendentes PDV',
    desc: 'Frente de caixa',
  },
  {
    href: '/dashboard/usuarios/vendedores',
    icon: Users,
    cor: 'bg-blue-100',
    iconCor: 'text-blue-600',
    label: 'Vendedores',
    desc: 'Carteira de clientes',
  },
]

export default function UsuariosIndexPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Usuários" subtitle="Gerencie todos os perfis de acesso ao sistema" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
