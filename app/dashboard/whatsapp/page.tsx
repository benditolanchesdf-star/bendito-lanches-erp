'use client'

import Link from 'next/link'
import { MessageCircle, List, Settings, Bot } from 'lucide-react'
import { PageHeader } from '@/components/ui'

export default function WhatsAppIndexPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp" subtitle="Bot de pedidos, notificações automáticas e gestão de mensagens" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            href: '/dashboard/whatsapp/bot',
            icon: Bot,
            cor: 'bg-green-100',
            iconCor: 'text-green-600',
            label: 'Monitor do Bot',
            desc: 'Conversas ativas, histórico e atendimento manual',
            badge: '🤖 Novo',
          },
          {
            href: '/dashboard/whatsapp/configuracoes',
            icon: Settings,
            cor: 'bg-blue-100',
            iconCor: 'text-blue-600',
            label: 'Configurações',
            desc: 'Templates, Z-API, notificações por evento',
            badge: null,
          },
          {
            href: '/dashboard/whatsapp/fila',
            icon: List,
            cor: 'bg-purple-100',
            iconCor: 'text-purple-600',
            label: 'Fila de Mensagens',
            desc: 'Histórico de envios, pendentes e erros',
            badge: null,
          },
        ].map(item => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg hover:ring-2 hover:ring-bendito-dourado transition group relative">
              {item.badge && (
                <span className="absolute top-3 right-3 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-semibold">
                  {item.badge}
                </span>
              )}
              <div className={`${item.cor} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
                <Icon size={24} className={item.iconCor} />
              </div>
              <h3 className="font-bold text-bendito-verde-escuro">{item.label}</h3>
              <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
            </Link>
          )
        })}
      </div>

      {/* Instruções de setup */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-bold text-blue-700 mb-3">📋 Como configurar o Bot de Pedidos</h3>
        <ol className="space-y-2 text-sm text-blue-700">
          <li><strong>1.</strong> Certifique-se que a instância Z-API está ativa em <strong>Configurações → WhatsApp Z-API</strong></li>
          <li><strong>2.</strong> Faça deploy da Edge Function no Supabase:
            <code className="block bg-blue-100 px-3 py-1 rounded mt-1 text-xs font-mono">
              supabase functions deploy wpp-webhook --project-ref upzwgohtaybgycyigwlw
            </code>
          </li>
          <li><strong>3.</strong> Configure as variáveis de ambiente na Edge Function:
            <code className="block bg-blue-100 px-3 py-1 rounded mt-1 text-xs font-mono">
              ANTHROPIC_API_KEY, ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN
            </code>
          </li>
          <li><strong>4.</strong> Configure o Webhook na Z-API apontando para:
            <code className="block bg-blue-100 px-3 py-1 rounded mt-1 text-xs font-mono">
              https://upzwgohtaybgycyigwlw.supabase.co/functions/v1/wpp-webhook
            </code>
          </li>
          <li><strong>5.</strong> Pronto! Clientes podem pedir diretamente pelo WhatsApp 🎉</li>
        </ol>
      </div>
    </div>
  )
}
