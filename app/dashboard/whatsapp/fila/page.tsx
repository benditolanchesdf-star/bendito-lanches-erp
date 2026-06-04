'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatData } from '@/lib/constants'
import { PageHeader, Loading, EmptyState } from '@/components/ui'
import { CheckCircle, XCircle, Clock, RefreshCw, Send, Building2 } from 'lucide-react'
import { processarFilaPendente } from '@/lib/wpp-service'

const STATUS_COR: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-700',
  enviado:  'bg-green-100 text-green-700',
  erro:     'bg-red-100 text-red-700',
  cancelado:'bg-gray-100 text-gray-500',
}

export default function WppFilaPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [mensagens, setMensagens] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [filialSel, setFilialSel] = useState('todas')
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [processando, setProcessando] = useState(false)
  const [processResult, setProcessResult] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    let query = supabase.from('wpp_fila')
      .select('*, filiais(nome)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filtroStatus !== 'todas') query = query.eq('status', filtroStatus)
    if (filialSel !== 'todas') query = query.eq('filial_id', filialSel)

    const [msgs, fils] = await Promise.all([
      query,
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setMensagens(msgs.data || [])
    setFiliais(fils.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filtroStatus, filialSel])

  async function processarPendentes() {
    setProcessando(true); setProcessResult(null)
    const fils = filialSel === 'todas' ? filiais : filiais.filter(f => f.id === filialSel)
    let total = 0
    for (const f of fils) {
      total += await processarFilaPendente(f.id)
    }
    setProcessResult(`${total} mensagem(s) enviada(s) com sucesso.`)
    setProcessando(false)
    load()
  }

  const pendentes = mensagens.filter(m => m.status === 'pendente').length
  const erros     = mensagens.filter(m => m.status === 'erro').length
  const enviados  = mensagens.filter(m => m.status === 'enviado').length

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Fila de Mensagens" subtitle="Histórico e status de todas as notificações WhatsApp"
        action={
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
              <RefreshCw size={15}/> Atualizar
            </button>
            {pendentes > 0 && (
              <button onClick={processarPendentes} disabled={processando}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                <Send size={15}/> {processando ? 'Enviando...' : `Enviar ${pendentes} pendente(s)`}
              </button>
            )}
          </div>
        }
      />

      {processResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-green-700 text-sm font-semibold">
          <CheckCircle size={16}/> {processResult}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <p className="text-xs text-yellow-600">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{pendentes}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-xs text-green-600">Enviados</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{enviados}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-xs text-red-600">Erros</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{erros}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-center">
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
          <option value="todas">Todos os status</option>
          <option value="pendente">Pendentes</option>
          <option value="enviado">Enviados</option>
          <option value="erro">Com erro</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <select value={filialSel} onChange={e => setFilialSel(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
          <option value="todas">Todas as unidades</option>
          {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>

      {mensagens.length === 0 ? <EmptyState message="Nenhuma mensagem encontrada." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Evento','Telefone','Mensagem','Status','Tentativas','Data','Unidade'].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y">
                {mensagens.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{m.evento || '—'}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{m.telefone}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-gray-600 line-clamp-2">{m.mensagem}</p>
                      {m.erro_msg && <p className="text-xs text-red-500 mt-0.5">⚠️ {m.erro_msg}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COR[m.status]||'bg-gray-100'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">{m.tentativas}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {m.agendado_para
                        ? <span className="text-blue-600">⏰ {formatData(m.agendado_para)}</span>
                        : formatData(m.created_at)
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-500">{m.filiais?.nome || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
