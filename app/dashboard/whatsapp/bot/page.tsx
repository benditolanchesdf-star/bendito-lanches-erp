'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatData } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { MessageCircle, Users, ShoppingCart, RefreshCw, Eye, Send } from 'lucide-react'

const ESTADO_COR: Record<string, string> = {
  inicio:              'bg-gray-100 text-gray-600',
  menu:                'bg-gray-100 text-gray-600',
  cardapio:            'bg-blue-100 text-blue-700',
  pedindo:             'bg-yellow-100 text-yellow-700',
  confirmando:         'bg-orange-100 text-orange-700',
  suporte:             'bg-red-100 text-red-700',
  cancelando:          'bg-red-100 text-red-700',
  aguardando_nome:     'bg-purple-100 text-purple-700',
  aguardando_endereco: 'bg-purple-100 text-purple-700',
}

export default function WppBotMonitorPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [sessoes, setSessoes] = useState<any[]>([])
  const [sessaoSel, setSessaoSel] = useState<any>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [loadingHist, setLoadingHist] = useState(false)
  const [msgManual, setMsgManual] = useState('')
  const [enviandoManual, setEnviandoManual] = useState(false)
  const [stats, setStats] = useState({ total: 0, ativas: 0, pedidos_hoje: 0, suporte: 0 })

  async function load() {
    setLoading(true)
    const hoje = new Date().toISOString().split('T')[0]

    const [{ data: sess }, { data: pedidosHoje }] = await Promise.all([
      supabase.from('wpp_sessoes').select('*, clientes(nome, nome_loja)').order('ultima_msg_em', { ascending: false }).limit(50),
      supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('canal', 'whatsapp').gte('created_at', hoje),
    ])

    const sessArr = sess || []
    const agora = new Date()
    const ativas = sessArr.filter(s => {
      const diff = (agora.getTime() - new Date(s.ultima_msg_em).getTime()) / 60000
      return diff < 60 && s.estado !== 'inicio'
    })
    const suportePend = sessArr.filter(s => s.estado === 'suporte').length

    setSessoes(sessArr)
    setStats({
      total:        sessArr.length,
      ativas:       ativas.length,
      pedidos_hoje: (pedidosHoje as any)?.count || 0,
      suporte:      suportePend,
    })
    setLoading(false)
  }

  async function abrirHistorico(sess: any) {
    setSessaoSel(sess)
    setHistorico([])
    setModalOpen(true)
    setLoadingHist(true)
    const { data } = await supabase.from('wpp_historico')
      .select('*').eq('sessao_id', sess.id)
      .order('created_at', { ascending: true }).limit(50)
    setHistorico(data || [])
    setLoadingHist(false)
  }

  async function enviarMsgManual() {
    if (!msgManual.trim() || !sessaoSel) return
    setEnviandoManual(true)
    const zRes = await supabase.from('configuracoes').select('chave, valor')
      .eq('filial_id', sessaoSel.filial_id)
      .in('chave', ['zapi_instance_id', 'zapi_token', 'zapi_client_token'])
    const zMap = Object.fromEntries((zRes.data || []).map(r => [r.chave, r.valor]))

    if (zMap.zapi_instance_id && zMap.zapi_token) {
      await fetch(
        `https://api.z-api.io/instances/${zMap.zapi_instance_id}/token/${zMap.zapi_token}/send-text`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': zMap.zapi_client_token || '' },
          body: JSON.stringify({ phone: sessaoSel.telefone, message: msgManual }),
        }
      )
      await supabase.from('wpp_historico').insert({
        sessao_id: sessaoSel.id, telefone: sessaoSel.telefone,
        direcao: 'saida', mensagem: msgManual,
        processado_por: 'humano',
      })
      // Marcar como suporte resolvido
      await supabase.from('wpp_sessoes').update({ estado: 'inicio' }).eq('id', sessaoSel.id)
      setHistorico(prev => [...prev, {
        direcao: 'saida', mensagem: msgManual,
        created_at: new Date().toISOString(), processado_por: 'humano',
      }])
      setMsgManual('')
    }
    setEnviandoManual(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const interval = setInterval(load, 30000) // atualiza a cada 30s
    return () => clearInterval(interval)
  }, [])

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Monitor do Bot" subtitle="Conversas ativas, histórico e atendimento manual"
        action={
          <button onClick={load} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
            <RefreshCw size={15}/> Atualizar
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de sessões', valor: stats.total,        icon: Users,          cor: 'text-gray-700' },
          { label: 'Conversas ativas', valor: stats.ativas,       icon: MessageCircle,  cor: 'text-green-600' },
          { label: 'Pedidos hoje',     valor: stats.pedidos_hoje, icon: ShoppingCart,   cor: 'text-blue-600' },
          { label: '🆘 Suporte pend.', valor: stats.suporte,      icon: MessageCircle,  cor: 'text-red-600' },
        ].map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} className="bg-white rounded-xl shadow-md p-4 text-center">
              <Icon size={20} className={`${c.cor} mx-auto mb-1`}/>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-3xl font-bold ${c.cor} mt-1`}>{c.valor}</p>
            </div>
          )
        })}
      </div>

      {/* Lista de sessões */}
      {sessoes.length === 0 ? <EmptyState message="Nenhuma conversa registrada ainda." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50">
            <h2 className="font-bold text-bendito-verde-escuro">Conversas ({sessoes.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Telefone','Cliente','Estado','Último contato','Pedidos','Carrinho','Ação'].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y">
                {sessoes.map(s => {
                  const carrinho = s.contexto?.carrinho || []
                  const agora = new Date()
                  const diff = Math.floor((agora.getTime() - new Date(s.ultima_msg_em).getTime()) / 60000)
                  const ativa = diff < 60
                  return (
                    <tr key={s.id} className={`hover:bg-gray-50 ${s.estado === 'suporte' ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          {ativa && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0"/>}
                          {s.telefone}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.clientes?.nome_loja || s.clientes?.nome || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COR[s.estado] || 'bg-gray-100 text-gray-600'}`}>
                          {s.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {diff < 60 ? `${diff} min atrás` : formatData(s.ultima_msg_em)}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-bendito-verde">{s.total_pedidos || 0}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {carrinho.length > 0
                          ? carrinho.map((c: any) => `${c.quantidade}x ${c.nome}`).join(', ')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => abrirHistorico(s)}
                          className="flex items-center gap-1 text-xs bg-bendito-verde hover:bg-bendito-verde-escuro text-white px-3 py-1.5 rounded-lg transition">
                          <Eye size={12}/> Ver
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal histórico + atendimento manual */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Conversa — ${sessaoSel?.telefone}`}>
        {sessaoSel && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
              <span>Estado: <strong>{sessaoSel.estado}</strong></span>
              <span>Pedidos: <strong>{sessaoSel.total_pedidos || 0}</strong></span>
              <span>Cliente: <strong>{sessaoSel.clientes?.nome || '—'}</strong></span>
            </div>

            {/* Histórico */}
            <div className="max-h-80 overflow-y-auto space-y-2 p-2 bg-gray-50 rounded-xl">
              {loadingHist ? (
                <p className="text-center text-gray-400 py-4">Carregando...</p>
              ) : historico.length === 0 ? (
                <p className="text-center text-gray-400 py-4">Sem histórico.</p>
              ) : historico.map((h, i) => (
                <div key={i} className={`flex ${h.direcao === 'entrada' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-xl text-xs ${h.direcao === 'entrada'
                    ? 'bg-white border border-gray-200 text-gray-700'
                    : h.processado_por === 'humano'
                      ? 'bg-blue-500 text-white'
                      : 'bg-green-500 text-white'}`}>
                    <p className="whitespace-pre-wrap">{h.mensagem}</p>
                    <p className={`text-right mt-1 text-xs opacity-60`}>
                      {h.processado_por === 'humano' ? '👤 ' : '🤖 '}
                      {new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Envio manual */}
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">✍️ Resposta manual (aparece como humano)</p>
              <div className="flex gap-2">
                <textarea value={msgManual} onChange={e => setMsgManual(e.target.value)} rows={2}
                  placeholder="Digite sua resposta..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado resize-none"/>
                <button onClick={enviarMsgManual} disabled={enviandoManual || !msgManual.trim()}
                  className="flex items-center gap-1 bg-green-500 hover:bg-green-400 text-white px-4 rounded-lg text-sm font-semibold disabled:opacity-50">
                  <Send size={15}/>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
