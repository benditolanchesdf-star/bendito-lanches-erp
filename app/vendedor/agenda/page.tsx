'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, STATUS_PEDIDO, ROTAS_ENTREGA } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, StatusBadge } from '@/components/ui'
import { CalendarDays, MapPin, Clock, Phone, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'

type Filtro = { data: string; rota: string; status: string }

function hoje() { return new Date().toISOString().split('T')[0] }
function amanha() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}
function semana() {
  const d = new Date(); d.setDate(d.getDate() + 6)
  return d.toISOString().split('T')[0]
}

export default function VendedorAgendaPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)
  const [itensCache, setItensCache] = useState<Record<string, any[]>>({})
  const [filtro, setFiltro] = useState<Filtro>({ data: hoje(), rota: '', status: '' })
  const [atalho, setAtalho] = useState<'hoje' | 'amanha' | 'semana'>('hoje')

  async function load(f: Filtro) {
    setLoading(true)
    let q = supabase
      .from('pedidos')
      .select(`
        id, numero_pedido, status, valor_total, data_entrega,
        horario_entrega, rota_entrega, observacoes,
        clientes(nome, nome_loja, telefone, logradouro, numero, bairro, cidade, observacao_entrega)
      `)
      .not('data_entrega', 'is', null)
      .neq('status', 'cancelado')
      .order('horario_entrega', { ascending: true, nullsFirst: false })
      .order('data_entrega', { ascending: true })

    // Filtro de data
    if (atalho === 'semana') {
      q = q.gte('data_entrega', hoje()).lte('data_entrega', semana())
    } else {
      q = q.eq('data_entrega', f.data)
    }

    if (f.rota) q = q.eq('rota_entrega', f.rota)
    if (f.status) q = q.eq('status', f.status)

    const { data } = await q
    setPedidos(data || [])
    setLoading(false)
  }

  useEffect(() => { load(filtro) }, [filtro, atalho])

  async function toggleExpandir(id: string) {
    if (expandido === id) { setExpandido(null); return }
    setExpandido(id)
    if (!itensCache[id]) {
      const { data } = await supabase
        .from('pedido_itens')
        .select('quantidade, produtos(nome)')
        .eq('pedido_id', id)
      setItensCache((c) => ({ ...c, [id]: data || [] }))
    }
  }

  function setAtalhoFiltro(a: 'hoje' | 'amanha' | 'semana') {
    setAtalho(a)
    if (a === 'hoje')   setFiltro((f) => ({ ...f, data: hoje() }))
    if (a === 'amanha') setFiltro((f) => ({ ...f, data: amanha() }))
  }

  // Agrupamento por data (para visão semana)
  const porData = pedidos.reduce((acc, p) => {
    const d = p.data_entrega || 'Sem data'
    if (!acc[d]) acc[d] = []
    acc[d].push(p)
    return acc
  }, {} as Record<string, any[]>)

  const datasOrdenadas = Object.keys(porData).sort()

  const totais = {
    pedidos: pedidos.length,
    valor: pedidos.reduce((s, p) => s + Number(p.valor_total || 0), 0),
    entregues: pedidos.filter((p) => p.status === 'entregue' || p.status === 'baixado').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda de Entregas"
        subtitle="Pedidos dos seus clientes com data de entrega programada"
      />

      {/* Atalhos de data */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-end">
        <div className="flex gap-2">
          {(['hoje', 'amanha', 'semana'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAtalhoFiltro(a)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                atalho === a
                  ? 'bg-bendito-verde text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {a === 'hoje' ? 'Hoje' : a === 'amanha' ? 'Amanhã' : 'Esta semana'}
            </button>
          ))}
        </div>

        {atalho !== 'semana' && (
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-gray-400" />
            <input
              type="date"
              value={filtro.data}
              onChange={(e) => { setAtalho('hoje'); setFiltro((f) => ({ ...f, data: e.target.value })) }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"
            />
          </div>
        )}

        <select
          value={filtro.rota}
          onChange={(e) => setFiltro((f) => ({ ...f, rota: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"
        >
          <option value="">Todas as rotas</option>
          {ROTAS_ENTREGA.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        <select
          value={filtro.status}
          onChange={(e) => setFiltro((f) => ({ ...f, status: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"
        >
          <option value="">Todos os status</option>
          {STATUS_PEDIDO.filter((s) => !['rascunho', 'cancelado'].includes(s.value)).map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md p-4 text-center">
          <p className="text-2xl font-bold text-bendito-verde-escuro">{totais.pedidos}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pedidos</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center">
          <p className="text-2xl font-bold text-bendito-verde">{formatBRL(totais.valor)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Valor total</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{totais.entregues}</p>
          <p className="text-xs text-gray-500 mt-0.5">Entregues</p>
        </div>
      </div>

      {loading ? <Loading /> : pedidos.length === 0 ? (
        <EmptyState message="Nenhuma entrega encontrada para os filtros selecionados." />
      ) : (
        <div className="space-y-6">
          {datasOrdenadas.map((data) => (
            <div key={data}>
              {atalho === 'semana' && (
                <div className="flex items-center gap-3 mb-3">
                  <CalendarDays size={16} className="text-bendito-dourado-escuro" />
                  <h2 className="font-bold text-bendito-verde-escuro">
                    {new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </h2>
                  <span className="text-xs text-gray-400">{porData[data].length} pedido(s)</span>
                </div>
              )}

              <div className="space-y-3">
                {porData[data].map((p: any) => {
                  const st = STATUS_PEDIDO.find((s) => s.value === p.status)
                  const rota = ROTAS_ENTREGA.find((r) => r.value === p.rota_entrega)
                  const cli = p.clientes
                  const isOpen = expandido === p.id
                  const itens = itensCache[p.id] || []
                  const enderecoCompleto = [cli?.logradouro, cli?.numero, cli?.bairro, cli?.cidade].filter(Boolean).join(', ')

                  return (
                    <div key={p.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                      <button
                        onClick={() => toggleExpandir(p.id)}
                        className="w-full p-4 text-left hover:bg-gray-50 transition"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            {/* Horário */}
                            <div className="bg-bendito-verde text-white rounded-lg px-3 py-2 text-center flex-shrink-0 min-w-[56px]">
                              <p className="text-sm font-bold">
                                {p.horario_entrega ? p.horario_entrega.slice(0, 5) : '--:--'}
                              </p>
                            </div>

                            <div>
                              <p className="font-bold text-bendito-verde-escuro">
                                {cli?.nome_loja || cli?.nome || 'Cliente'}
                              </p>
                              {cli?.nome_loja && <p className="text-xs text-gray-500">{cli.nome}</p>}
                              {enderecoCompleto && (
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  <MapPin size={11} /> {enderecoCompleto}
                                </p>
                              )}
                              {rota && (
                                <span className="inline-block text-xs bg-bendito-creme text-bendito-verde-escuro px-2 py-0.5 rounded-full mt-1">
                                  {rota.label}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            {st && <StatusBadge label={st.label} cor={st.cor} />}
                            <span className="font-bold text-bendito-verde">{formatBRL(p.valor_total)}</span>
                            {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t bg-bendito-creme/40 p-4 space-y-3">
                          {/* Itens do pedido */}
                          {itens.length > 0 && (
                            <div className="text-sm space-y-1">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Itens</p>
                              {itens.map((i: any, idx: number) => (
                                <p key={idx} className="text-gray-700">{i.quantidade}× {i.produtos?.nome}</p>
                              ))}
                            </div>
                          )}

                          {/* Obs de entrega */}
                          {(p.observacoes || cli?.observacao_entrega) && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                              <p className="font-semibold mb-0.5">⚠ Observações</p>
                              {cli?.observacao_entrega && <p>{cli.observacao_entrega}</p>}
                              {p.observacoes && <p>{p.observacoes}</p>}
                            </div>
                          )}

                          {/* Ações */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {cli?.telefone && (
                              <>
                                <a
                                  href={`tel:${cli.telefone}`}
                                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-3 py-1.5 rounded-lg transition"
                                >
                                  <Phone size={14} /> Ligar
                                </a>
                                <a
                                  href={`https://wa.me/55${cli.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                    `Olá ${cli.nome_loja || cli.nome}, tudo bem? Pedido #${p.numero_pedido} está previsto para entrega hoje${p.horario_entrega ? ` às ${p.horario_entrega.slice(0,5)}` : ''}. Bendito Lanches.`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition"
                                >
                                  <MessageCircle size={14} /> WhatsApp
                                </a>
                                {enderecoCompleto && (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold px-3 py-1.5 rounded-lg transition"
                                  >
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
          ))}
        </div>
      )}
    </div>
  )
}
