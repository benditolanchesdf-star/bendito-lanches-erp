'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, STATUS_PEDIDO, ROTAS_ENTREGA } from '@/lib/constants'
import { notificarStatusPedido } from '@/lib/zapi'
import { PageHeader, Loading, EmptyState, StatusBadge } from '@/components/ui'
import {
  CalendarDays, MapPin, Phone, MessageCircle,
  ChevronDown, ChevronUp, Truck, RefreshCw,
} from 'lucide-react'

function hoje() { return new Date().toISOString().split('T')[0] }
function amanha() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}
function semana() {
  const d = new Date(); d.setDate(d.getDate() + 6)
  return d.toISOString().split('T')[0]
}

export default function DashboardAgendaPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [entregadores, setEntregadores] = useState<any[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)
  const [itensCache, setItensCache] = useState<Record<string, any[]>>({})
  const [atalho, setAtalho] = useState<'hoje' | 'amanha' | 'semana'>('hoje')
  const [filtroData, setFiltroData] = useState(hoje())
  const [filtroRota, setFiltroRota] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroVendedor, setFiltroVendedor] = useState('')
  const [vendedores, setVendedores] = useState<any[]>([])
  const [salvandoRota, setSalvandoRota] = useState<string | null>(null)

  async function load() {
    setLoading(true)

    let q = supabase
      .from('pedidos')
      .select(`
        id, numero_pedido, status, valor_total, data_entrega,
        horario_entrega, rota_entrega, observacoes,
        vendedor_id,
        clientes(nome, nome_loja, telefone, logradouro, numero, bairro, cidade, observacao_entrega),
        vendedores(nome)
      `)
      .not('data_entrega', 'is', null)
      .neq('status', 'cancelado')
      .order('rota_entrega', { ascending: true, nullsFirst: false })
      .order('horario_entrega', { ascending: true, nullsFirst: false })

    if (atalho === 'semana') {
      q = q.gte('data_entrega', hoje()).lte('data_entrega', semana())
    } else {
      q = q.eq('data_entrega', filtroData)
    }

    if (filtroRota) q = q.eq('rota_entrega', filtroRota)
    if (filtroStatus) q = q.eq('status', filtroStatus)
    if (filtroVendedor) q = q.eq('vendedor_id', filtroVendedor)

    const [pedRes, vendRes, entRes] = await Promise.all([
      q,
      supabase.from('vendedores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('entregadores').select('id, nome').eq('ativo', true).order('nome').limit(50),
    ])

    setPedidos(pedRes.data || [])
    setVendedores(vendRes.data || [])
    setEntregadores(entRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [atalho, filtroData, filtroRota, filtroStatus, filtroVendedor])

  async function toggleExpandir(id: string) {
    if (expandido === id) { setExpandido(null); return }
    setExpandido(id)
    if (!itensCache[id]) {
      const { data } = await supabase
        .from('pedido_itens')
        .select('quantidade, valor_total, produtos(nome)')
        .eq('pedido_id', id)
      setItensCache((c) => ({ ...c, [id]: data || [] }))
    }
  }

  async function atualizarRota(pedidoId: string, rota: string) {
    setSalvandoRota(pedidoId)
    await supabase.from('pedidos').update({ rota_entrega: rota || null }).eq('id', pedidoId)
    setPedidos((prev) => prev.map((p) => p.id === pedidoId ? { ...p, rota_entrega: rota } : p))
    setSalvandoRota(null)
  }

  async function atualizarStatus(pedidoId: string, status: string) {
    await supabase.from('pedidos').update({ status }).eq('id', pedidoId)
    setPedidos((prev) => prev.map((p) => p.id === pedidoId ? { ...p, status } : p))
    // Notificação WhatsApp assíncrona
    const pedido = pedidos.find((p) => p.id === pedidoId)
    if (pedido) notificarStatusPedido({ ...pedido, status }).catch(() => {})
  }

  function setAtalhoFiltro(a: 'hoje' | 'amanha' | 'semana') {
    setAtalho(a)
    if (a === 'hoje')   setFiltroData(hoje())
    if (a === 'amanha') setFiltroData(amanha())
  }

  // Agrupamento por rota
  const porRota = pedidos.reduce((acc, p) => {
    const r = p.rota_entrega || 'sem_rota'
    if (!acc[r]) acc[r] = []
    acc[r].push(p)
    return acc
  }, {} as Record<string, any[]>)

  const rotasOrdenadas = Object.keys(porRota).sort((a, b) => {
    if (a === 'sem_rota') return 1
    if (b === 'sem_rota') return -1
    return a.localeCompare(b)
  })

  const totais = {
    pedidos: pedidos.length,
    valor: pedidos.reduce((s, p) => s + Number(p.valor_total || 0), 0),
    confirmados: pedidos.filter((p) => ['confirmado', 'producao', 'separado', 'pronto', 'saiu_entrega'].includes(p.status)).length,
    entregues: pedidos.filter((p) => ['entregue', 'baixado'].includes(p.status)).length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda de Entregas"
        subtitle="Gerencie as entregas do dia por rota e status"
        action={
          <button onClick={load} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-lg transition text-sm">
            <RefreshCw size={15} /> Atualizar
          </button>
        }
      />

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-end">
        <div className="flex gap-2">
          {(['hoje', 'amanha', 'semana'] as const).map((a) => (
            <button key={a} onClick={() => setAtalhoFiltro(a)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${atalho === a ? 'bg-bendito-verde text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {a === 'hoje' ? 'Hoje' : a === 'amanha' ? 'Amanhã' : 'Esta semana'}
            </button>
          ))}
        </div>

        {atalho !== 'semana' && (
          <input type="date" value={filtroData}
            onChange={(e) => { setAtalho('hoje'); setFiltroData(e.target.value) }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado" />
        )}

        <select value={filtroRota} onChange={(e) => setFiltroRota(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
          <option value="">Todas as rotas</option>
          {ROTAS_ENTREGA.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
          <option value="">Todos os status</option>
          {STATUS_PEDIDO.filter((s) => !['rascunho', 'cancelado'].includes(s.value)).map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
          <option value="">Todos os vendedores</option>
          {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
        </select>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de pedidos',  valor: totais.pedidos,              cor: 'text-bendito-verde-escuro' },
          { label: 'Valor total',        valor: formatBRL(totais.valor),     cor: 'text-bendito-verde' },
          { label: 'Em andamento',       valor: totais.confirmados,          cor: 'text-orange-600' },
          { label: 'Entregues',          valor: totais.entregues,            cor: 'text-green-600' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl shadow-md p-4 text-center">
            <p className={`text-2xl font-bold ${c.cor}`}>{c.valor}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {loading ? <Loading /> : pedidos.length === 0 ? (
        <EmptyState message="Nenhuma entrega encontrada para os filtros selecionados." />
      ) : (
        <div className="space-y-8">
          {rotasOrdenadas.map((rotaKey) => {
            const rotaLabel = ROTAS_ENTREGA.find((r) => r.value === rotaKey)?.label || 'Sem rota definida'
            const pedidosDaRota = porRota[rotaKey]
            const totalRota = pedidosDaRota.reduce((s: number, p: any) => s + Number(p.valor_total || 0), 0)

            return (
              <div key={rotaKey}>
                {/* Header da rota */}
                <div className="flex items-center gap-3 mb-3 pb-2 border-b-2 border-bendito-dourado/30">
                  <div className="flex items-center gap-2">
                    <MapPin size={18} className="text-bendito-dourado-escuro" />
                    <h2 className="font-bold text-bendito-verde-escuro text-lg">{rotaLabel}</h2>
                  </div>
                  <span className="text-sm text-gray-500">{pedidosDaRota.length} pedido(s) · {formatBRL(totalRota)}</span>
                </div>

                <div className="space-y-3">
                  {pedidosDaRota.map((p: any) => {
                    const st = STATUS_PEDIDO.find((s) => s.value === p.status)
                    const cli = p.clientes
                    const isOpen = expandido === p.id
                    const itens = itensCache[p.id] || []
                    const enderecoCompleto = [cli?.logradouro, cli?.numero, cli?.bairro].filter(Boolean).join(', ')

                    return (
                      <div key={p.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                        <button onClick={() => toggleExpandir(p.id)} className="w-full p-4 text-left hover:bg-gray-50 transition">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="bg-bendito-verde text-white rounded-lg px-3 py-2 text-center flex-shrink-0 min-w-[56px]">
                                <p className="text-sm font-bold">{p.horario_entrega ? p.horario_entrega.slice(0, 5) : '--:--'}</p>
                              </div>
                              <div>
                                <p className="font-bold text-bendito-verde-escuro">{cli?.nome_loja || cli?.nome}</p>
                                {cli?.nome_loja && <p className="text-xs text-gray-500">{cli.nome}</p>}
                                {enderecoCompleto && (
                                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                    <MapPin size={11} /> {enderecoCompleto}
                                  </p>
                                )}
                                {p.vendedores?.nome && (
                                  <p className="text-xs text-blue-600 mt-0.5">Vendedor: {p.vendedores.nome}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {st && <StatusBadge label={st.label} cor={st.cor} />}
                              <span className="font-bold text-bendito-verde">{formatBRL(p.valor_total)}</span>
                              {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                            </div>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t bg-bendito-creme/40 p-4 space-y-4">
                            {/* Itens */}
                            {itens.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Itens do pedido</p>
                                <div className="space-y-0.5">
                                  {itens.map((i: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                      <span>{i.quantidade}× {i.produtos?.nome}</span>
                                      <span className="text-gray-500">{formatBRL(i.valor_total)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(p.observacoes || cli?.observacao_entrega) && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                                <p className="font-semibold mb-0.5">⚠ Observações de entrega</p>
                                {cli?.observacao_entrega && <p>{cli.observacao_entrega}</p>}
                                {p.observacoes && <p>{p.observacoes}</p>}
                              </div>
                            )}

                            {/* Editar rota */}
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Truck size={14} className="text-gray-500" />
                                <span className="text-xs text-gray-500">Rota:</span>
                                <select
                                  value={p.rota_entrega || ''}
                                  onChange={(e) => atualizarRota(p.id, e.target.value)}
                                  disabled={salvandoRota === p.id}
                                  className="border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-bendito-dourado"
                                >
                                  <option value="">Sem rota</option>
                                  {ROTAS_ENTREGA.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                                {salvandoRota === p.id && <span className="text-xs text-gray-400">Salvando...</span>}
                              </div>

                              {/* Avançar status rápido */}
                              {p.status === 'pronto' && (
                                <button
                                  onClick={() => atualizarStatus(p.id, 'saiu_entrega')}
                                  className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                                >
                                  <Truck size={13} /> Saiu para entrega
                                </button>
                              )}
                              {p.status === 'saiu_entrega' && (
                                <button
                                  onClick={() => atualizarStatus(p.id, 'entregue')}
                                  className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                                >
                                  ✓ Marcar como entregue
                                </button>
                              )}
                            </div>

                            {/* Ações de contato */}
                            <div className="flex flex-wrap gap-2">
                              {cli?.telefone && (
                                <>
                                  <a href={`tel:${cli.telefone}`}
                                    className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-3 py-1.5 rounded-lg transition">
                                    <Phone size={14} /> Ligar
                                  </a>
                                  <a
                                    href={`https://wa.me/55${cli.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                      `Olá ${cli.nome_loja || cli.nome}! Pedido #${p.numero_pedido} ${p.status === 'saiu_entrega' ? 'saiu para entrega' : 'está confirmado para entrega'} hoje${p.horario_entrega ? ` às ${p.horario_entrega.slice(0,5)}` : ''}. Bendito Lanches.`
                                    )}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition">
                                    <MessageCircle size={14} /> WhatsApp
                                  </a>
                                  {enderecoCompleto && (
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`}
                                      target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold px-3 py-1.5 rounded-lg transition">
                                      <MapPin size={14} /> Mapa
                                    </a>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
