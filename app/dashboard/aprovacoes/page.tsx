'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData } from '@/lib/constants'
import { PageHeader, Loading, EmptyState } from '@/components/ui'
import { CheckCircle, XCircle, Eye, Clock, ShoppingBag, ArrowLeftRight, RefreshCw } from 'lucide-react'

const TIPO_CONFIG: Record<string, { label: string; icon: any; cor: string }> = {
  pedido_interno:       { label: 'Pedido Interno',    icon: ArrowLeftRight, cor: 'bg-blue-100 text-blue-700' },
  pedido_compra_matriz: { label: 'Compra (Matriz)',    icon: ShoppingBag,    cor: 'bg-purple-100 text-purple-700' },
  pedido_compra_admin:  { label: 'Compra (Admin)',     icon: ShoppingBag,    cor: 'bg-red-100 text-red-700' },
}

export default function AprovacoesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [aprovacoes, setAprovacoes] = useState<any[]>([])
  const [salvando, setSalvando] = useState<string | null>(null)
  const [obsMap, setObsMap] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('vw_aprovacoes_pendentes').select('*')
    setAprovacoes(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function aprovar(item: any) {
    setSalvando(item.id)
    if (item.tipo === 'pedido_interno') {
      await supabase.from('pedidos_internos').update({ status: 'aprovado' }).eq('id', item.id)
    } else if (item.tipo === 'pedido_compra_matriz') {
      await supabase.from('pedidos_compra').update({ status: 'aprovado_matriz' }).eq('id', item.id)
    } else if (item.tipo === 'pedido_compra_admin') {
      await supabase.from('pedidos_compra').update({ status: 'aprovado_admin' }).eq('id', item.id)
    }
    setSalvando(null); load()
  }

  async function recusar(item: any) {
    const obs = obsMap[item.id] || ''
    if (!confirm(`Recusar ${item.categoria} #${item.numero}?`)) return
    setSalvando(item.id)
    if (item.tipo === 'pedido_interno') {
      await supabase.from('pedidos_internos').update({ status: 'cancelado' }).eq('id', item.id)
    } else {
      await supabase.from('pedidos_compra').update({ status: 'recusado', observacao_admin: obs || null }).eq('id', item.id)
    }
    setSalvando(null); load()
  }

  const pendentesUrgentes = aprovacoes.filter(a => {
    const diasAtraso = Math.floor((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24))
    return diasAtraso >= 2
  })

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Aprovações"
        subtitle="Todas as solicitações pendentes de aprovação"
        action={
          <button onClick={load} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
            <RefreshCw size={15}/> Atualizar
          </button>
        }
      />

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md p-4 text-center">
          <p className="text-xs text-gray-500">Total pendente</p>
          <p className="text-3xl font-bold text-orange-500 mt-1">{aprovacoes.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center">
          <p className="text-xs text-gray-500">Pedidos internos</p>
          <p className="text-3xl font-bold text-blue-500 mt-1">
            {aprovacoes.filter(a => a.tipo === 'pedido_interno').length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center">
          <p className="text-xs text-gray-500">⚠️ Com atraso (+2 dias)</p>
          <p className="text-3xl font-bold text-red-500 mt-1">{pendentesUrgentes.length}</p>
        </div>
      </div>

      {aprovacoes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-3"/>
          <p className="text-lg font-bold text-gray-700">Tudo em dia!</p>
          <p className="text-sm text-gray-500 mt-1">Nenhuma solicitação pendente de aprovação.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {aprovacoes.map(a => {
            const cfg = TIPO_CONFIG[a.tipo]
            const Icon = cfg?.icon || Clock
            const diasAtraso = Math.floor((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24))
            const urgente = diasAtraso >= 2
            return (
              <div key={a.id} className={`bg-white rounded-xl shadow-md p-5 border-l-4 ${urgente ? 'border-red-400' : 'border-bendito-dourado'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${cfg?.cor || 'bg-gray-100 text-gray-600'} shrink-0`}>
                      <Icon size={16}/>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-bendito-verde-escuro">
                          {a.categoria} #{a.numero}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg?.cor}`}>
                          {cfg?.label}
                        </span>
                        {urgente && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
                            ⚠️ {diasAtraso} dias em espera
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">{a.origem}</span>
                        {a.destino && <> → <span className="font-medium">{a.destino}</span></>}
                      </p>
                      {a.observacoes && (
                        <p className="text-xs text-gray-500 mt-1 bg-gray-50 px-2 py-1 rounded">
                          📝 {a.observacoes}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span><Clock size={11} className="inline mr-1"/>{formatData(a.created_at)}</span>
                        {a.valor && <span className="font-semibold text-bendito-verde">{formatBRL(a.valor)}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => aprovar(a)} disabled={salvando === a.id}
                      className="flex items-center gap-1 bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50">
                      <CheckCircle size={13}/> Aprovar
                    </button>
                    <button onClick={() => recusar(a)} disabled={salvando === a.id}
                      className="flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50">
                      <XCircle size={13}/> Recusar
                    </button>
                  </div>
                </div>

                {/* Campo obs recusa */}
                <div className="mt-3">
                  <input
                    value={obsMap[a.id] || ''}
                    onChange={e => setObsMap(prev => ({ ...prev, [a.id]: e.target.value }))}
                    placeholder="Motivo da recusa (opcional)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-bendito-dourado"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
