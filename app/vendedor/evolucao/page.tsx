'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData, ALERTAS_CLIENTE } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, StatusBadge } from '@/components/ui'
import { TrendingUp, TrendingDown, Minus, Phone, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'

type Periodo = 'mes' | '3meses' | 'ano'

export default function VendedorEvolucaoPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<any[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)
  const [historicos, setHistoricos] = useState<Record<string, any[]>>({})
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [ordenar, setOrdenar] = useState<'variacao' | 'valor' | 'nome'>('variacao')
  const [busca, setBusca] = useState('')

  async function load() {
    setLoading(true)

    // Carrega todos os clientes do vendedor com dados da view de alertas
    const [cliRes, alertRes] = await Promise.all([
      supabase.from('clientes').select('id, nome, nome_loja, telefone, tipo').order('nome'),
      supabase.from('vw_clientes_alertas').select('*'),
    ])

    const alertaMap: Record<string, any> = {}
    for (const a of alertRes.data || []) alertaMap[a.cliente_id] = a

    // Para cada cliente, busca os últimos pedidos agrupados por mês
    const ids = (cliRes.data || []).map((c: any) => c.id)
    if (ids.length === 0) { setClientes([]); setLoading(false); return }

    const mesesAtras = periodo === 'mes' ? 2 : periodo === '3meses' ? 6 : 13
    const dataInicio = new Date()
    dataInicio.setMonth(dataInicio.getMonth() - mesesAtras)

    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, cliente_id, valor_total, created_at, status')
      .in('cliente_id', ids)
      .neq('status', 'cancelado')
      .gte('created_at', dataInicio.toISOString())
      .order('created_at', { ascending: true })

    // Agrupa por cliente e calcula períodos
    const agora = new Date()
    const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1)
    const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)

    const porCliente: Record<string, any> = {}
    for (const p of pedidos || []) {
      if (!porCliente[p.cliente_id]) porCliente[p.cliente_id] = { mesAtual: 0, mesAnterior: 0, todos: [] }
      const d = new Date(p.created_at)
      const v = Number(p.valor_total || 0)
      porCliente[p.cliente_id].todos.push(p)
      if (d >= inicioMesAtual) porCliente[p.cliente_id].mesAtual += v
      else if (d >= inicioMesAnterior) porCliente[p.cliente_id].mesAnterior += v
    }

    const resultado = (cliRes.data || []).map((c: any) => {
      const dados = porCliente[c.id] || { mesAtual: 0, mesAnterior: 0, todos: [] }
      const alerta = alertaMap[c.id]
      const variacao = dados.mesAnterior === 0
        ? (dados.mesAtual > 0 ? 100 : 0)
        : ((dados.mesAtual - dados.mesAnterior) / dados.mesAnterior) * 100

      return {
        ...c,
        mesAtual: dados.mesAtual,
        mesAnterior: dados.mesAnterior,
        variacao,
        totalPedidos: dados.todos.length,
        ultimoPedido: dados.todos.length > 0 ? dados.todos[dados.todos.length - 1] : null,
        alerta: alerta?.alerta || 'nunca_comprou',
        diasSemComprar: alerta?.dias_sem_comprar ?? null,
      }
    })

    // Ordenação
    resultado.sort((a, b) => {
      if (ordenar === 'variacao') return a.variacao - b.variacao  // piores primeiro
      if (ordenar === 'valor') return b.mesAtual - a.mesAtual
      return a.nome.localeCompare(b.nome)
    })

    setClientes(resultado)
    setLoading(false)
  }

  useEffect(() => { load() }, [periodo, ordenar])

  async function carregarHistorico(clienteId: string) {
    if (historicos[clienteId]) return
    const dataInicio = new Date()
    dataInicio.setMonth(dataInicio.getMonth() - 6)

    const { data } = await supabase
      .from('pedidos')
      .select('id, numero_pedido, valor_total, status, created_at, data_entrega')
      .eq('cliente_id', clienteId)
      .neq('status', 'cancelado')
      .gte('created_at', dataInicio.toISOString())
      .order('created_at', { ascending: false })
      .limit(20)

    setHistoricos((h) => ({ ...h, [clienteId]: data || [] }))
  }

  async function toggleExpandir(id: string) {
    if (expandido === id) { setExpandido(null); return }
    setExpandido(id)
    await carregarHistorico(id)
  }

  const filtrados = clientes.filter((c) =>
    busca === '' ||
    (c.nome_loja || c.nome || '').toLowerCase().includes(busca.toLowerCase())
  )

  const totalMesAtual = clientes.reduce((s, c) => s + c.mesAtual, 0)
  const totalMesAnterior = clientes.reduce((s, c) => s + c.mesAnterior, 0)
  const variacaoTotal = totalMesAnterior === 0 ? 0 : ((totalMesAtual - totalMesAnterior) / totalMesAnterior) * 100
  const clientesAtivos = clientes.filter((c) => c.mesAtual > 0).length
  const clientesRisco = clientes.filter((c) => ['queda', 'risco_perda'].includes(c.alerta)).length

  return (
    <div className="space-y-6">
      <PageHeader title="Evolução de Compras" subtitle="Acompanhe o crescimento ou queda de cada cliente" />

      {/* Resumo geral */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-xs text-gray-500">Faturado este mês</p>
          <p className="text-xl font-bold text-bendito-verde">{formatBRL(totalMesAtual)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-xs text-gray-500">Mês anterior</p>
          <p className="text-xl font-bold text-gray-600">{formatBRL(totalMesAnterior)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-xs text-gray-500">Variação geral</p>
          <VariacaoBadge valor={variacaoTotal} grande />
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-xs text-gray-500">Clientes ativos / em risco</p>
          <p className="text-xl font-bold text-bendito-verde-escuro">
            {clientesAtivos} <span className="text-red-500 text-sm">/ {clientesRisco} ⚠</span>
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado flex-1 min-w-[180px]"
        />

        <div className="flex gap-2">
          {([
            { value: 'mes', label: 'Este mês' },
            { value: '3meses', label: '3 meses' },
            { value: 'ano', label: '12 meses' },
          ] as { value: Periodo; label: string }[]).map((p) => (
            <button key={p.value} onClick={() => setPeriodo(p.value)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${periodo === p.value ? 'bg-bendito-verde text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p.label}
            </button>
          ))}
        </div>

        <select value={ordenar} onChange={(e) => setOrdenar(e.target.value as any)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
          <option value="variacao">Ordenar: piores primeiro</option>
          <option value="valor">Ordenar: maior valor</option>
          <option value="nome">Ordenar: A-Z</option>
        </select>
      </div>

      {loading ? <Loading /> : filtrados.length === 0 ? (
        <EmptyState message="Nenhum cliente encontrado." />
      ) : (
        <div className="space-y-3">
          {filtrados.map((c) => {
            const alerta = ALERTAS_CLIENTE.find((a) => a.value === c.alerta)
            const isOpen = expandido === c.id
            const hist = historicos[c.id] || []

            return (
              <div key={c.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                <button onClick={() => toggleExpandir(c.id)} className="w-full p-4 text-left hover:bg-gray-50 transition">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Indicador visual de tendência */}
                      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                        c.variacao > 10 ? 'bg-green-500' :
                        c.variacao > 0 ? 'bg-green-300' :
                        c.variacao === 0 && c.mesAtual === 0 ? 'bg-gray-300' :
                        c.variacao > -20 ? 'bg-yellow-400' : 'bg-red-500'
                      }`} />

                      <div className="min-w-0">
                        <p className="font-bold text-bendito-verde-escuro truncate">
                          {c.nome_loja || c.nome}
                        </p>
                        {c.nome_loja && <p className="text-xs text-gray-500">{c.nome}</p>}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {alerta && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${alerta.cor}`}>{alerta.label}</span>}
                          {c.diasSemComprar !== null && (
                            <span className="text-xs text-gray-400">{c.diasSemComprar} dias sem comprar</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Mês anterior</p>
                        <p className="text-sm font-semibold text-gray-600">{formatBRL(c.mesAnterior)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Este mês</p>
                        <p className="text-sm font-bold text-bendito-verde-escuro">{formatBRL(c.mesAtual)}</p>
                      </div>
                      <VariacaoBadge valor={c.variacao} />
                      {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t bg-bendito-creme/40 p-4 space-y-4">
                    {/* Mini gráfico de barras por mês */}
                    <MiniGrafico clienteId={c.id} supabase={supabase} />

                    {/* Últimos pedidos */}
                    {hist.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum pedido nos últimos 6 meses.</p>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Últimos pedidos</p>
                        <div className="space-y-1">
                          {hist.slice(0, 8).map((p: any) => {
                            const statusMap: Record<string, string> = { rascunho: 'Rascunho', pendente: 'Recebido', em_analise: 'Em análise', confirmado: 'Confirmado', producao: 'Em produção', separado: 'Separado', pronto: 'Pronto', saiu_entrega: 'Saiu', entregue: 'Entregue', baixado: 'Baixado', cancelado: 'Cancelado' }
                            const st = statusMap[p.status as string] || p.status
                            return (
                              <div key={p.id} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                                <div>
                                  <span className="font-medium">#{p.numero_pedido}</span>
                                  <span className="text-gray-500 text-xs ml-2">{formatData(p.created_at)}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-gray-500">{st}</span>
                                  <span className="font-semibold text-bendito-verde">{formatBRL(p.valor_total)}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Ações */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {c.telefone && (
                        <>
                          <a href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            c.alerta === 'risco_perda' || c.alerta === 'queda'
                              ? `Olá ${c.nome_loja || c.nome}, tudo bem? Notei que faz um tempo que não fazemos negócios. Posso te apresentar algumas novidades da Bendito Lanches?`
                              : `Olá ${c.nome_loja || c.nome}, tudo bem? Passando para saber se precisa de algo da Bendito Lanches.`
                          )}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition">
                            <MessageCircle size={14} />
                            {c.alerta === 'risco_perda' ? 'Reativar cliente' : 'WhatsApp'}
                          </a>
                          <a href={`tel:${c.telefone}`}
                            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-3 py-1.5 rounded-lg transition">
                            <Phone size={14} /> Ligar
                          </a>
                        </>
                      )}
                      <a href={`/vendedor/pedidos/novo?cliente=${c.id}`}
                        className="flex items-center gap-1.5 bg-bendito-dourado hover:bg-bendito-dourado-escuro text-bendito-verde-escuro text-sm font-semibold px-3 py-1.5 rounded-lg transition">
                        + Novo pedido
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function VariacaoBadge({ valor, grande }: { valor: number; grande?: boolean }) {
  const abs = Math.abs(valor)
  const txt = valor === 0 ? '0%' : `${valor > 0 ? '+' : ''}${abs.toFixed(0)}%`
  const tamanho = grande ? 'text-xl font-bold' : 'text-sm font-semibold'

  if (valor > 10) return (
    <span className={`flex items-center gap-1 text-green-600 ${tamanho}`}>
      <TrendingUp size={grande ? 20 : 14} /> {txt}
    </span>
  )
  if (valor > 0) return (
    <span className={`flex items-center gap-1 text-green-500 ${tamanho}`}>
      <TrendingUp size={grande ? 20 : 14} /> {txt}
    </span>
  )
  if (valor === 0) return (
    <span className={`flex items-center gap-1 text-gray-400 ${tamanho}`}>
      <Minus size={grande ? 20 : 14} /> {txt}
    </span>
  )
  if (valor > -20) return (
    <span className={`flex items-center gap-1 text-yellow-600 ${tamanho}`}>
      <TrendingDown size={grande ? 20 : 14} /> {txt}
    </span>
  )
  return (
    <span className={`flex items-center gap-1 text-red-600 ${tamanho}`}>
      <TrendingDown size={grande ? 20 : 14} /> {txt}
    </span>
  )
}

// Mini gráfico de barras dos últimos 6 meses
function MiniGrafico({ clienteId, supabase }: { clienteId: string; supabase: any }) {
  const [dados, setDados] = useState<{ mes: string; valor: number }[]>([])

  useEffect(() => {
    const inicio = new Date()
    inicio.setMonth(inicio.getMonth() - 5)
    inicio.setDate(1)

    supabase
      .from('pedidos')
      .select('valor_total, created_at')
      .eq('cliente_id', clienteId)
      .neq('status', 'cancelado')
      .gte('created_at', inicio.toISOString())
      .then(({ data }: any) => {
        // Agrupa por mês
        const meses: Record<string, number> = {}
        for (let i = 5; i >= 0; i--) {
          const d = new Date()
          d.setMonth(d.getMonth() - i)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          meses[key] = 0
        }
        for (const p of data || []) {
          const d = new Date(p.created_at)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (key in meses) meses[key] += Number(p.valor_total || 0)
        }
        setDados(Object.entries(meses).map(([mes, valor]) => ({
          mes: new Date(mes + '-15').toLocaleDateString('pt-BR', { month: 'short' }),
          valor,
        })))
      })
  }, [clienteId])

  if (dados.length === 0) return null

  const max = Math.max(...dados.map((d) => d.valor), 1)

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Últimos 6 meses</p>
      <div className="flex items-end gap-2 h-16">
        {dados.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-t transition-all ${d.valor > 0 ? 'bg-bendito-verde' : 'bg-gray-200'}`}
              style={{ height: `${Math.max((d.valor / max) * 48, d.valor > 0 ? 4 : 2)}px` }}
              title={formatBRL(d.valor)}
            />
            <span className="text-xs text-gray-400">{d.mes}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
