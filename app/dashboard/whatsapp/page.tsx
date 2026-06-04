'use client'

import Link from 'next/link'
import { MessageCircle, List, Settings } from 'lucide-react'
import { PageHeader } from '@/components/ui'

export default function WhatsAppIndexPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp" subtitle="Notificações automáticas e gestão de mensagens" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            href: '/dashboard/whatsapp/configuracoes',
            icon: Settings,
            cor: 'bg-green-100',
            iconCor: 'text-green-600',
            label: 'Configurações',
            desc: 'Templates de mensagem por evento, Z-API e notificações internas',
          },
          {
            href: '/dashboard/whatsapp/fila',
            icon: List,
            cor: 'bg-blue-100',
            iconCor: 'text-blue-600',
            label: 'Fila de Mensagens',
            desc: 'Histórico de envios, pendentes, erros e reenvio manual',
          },
        ].map(item => {
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
