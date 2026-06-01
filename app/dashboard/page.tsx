'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, STATUS_PEDIDO, ROTAS_ENTREGA } from '@/lib/constants'
import { Loading, StatusBadge } from '@/components/ui'
import {
  ShoppingCart, DollarSign, Users, TrendingUp, AlertTriangle,
  Clock, MapPin, Factory, RefreshCw, ChevronRight,
} from 'lucide-react'

function hoje() { return new Date().toISOString().split('T')[0] }
function amanha() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] }

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({
    pedidosHoje: 0, faturamentoHoje: 0, faturamentoMes: 0,
    clientes: 0, emProducao: 0, atrasados: 0,
  })
  const [pedidosHoje, setPedidosHoje] = useState<any[]>([])
  const [pedidosAmanha, setPedidosAmanha] = useState<any[]>([])
  const [porHorario, setPorHorario] = useState<{ hora: string; count: number; valor: number }[]>([])
  const [porRota, setPorRota] = useState<{ rota: string; count: number; valor: number }[]>([])
  const [producaoAmanha, setProducaoAmanha] = useState<{ nome: string; total: number; unidade: string }[]>([])
  const [clientesSemComprar, setClientesSemComprar] = useState<any[]>([])
  const [estoqueBaixo, setEstoqueBaixo] = useState<any[]>([])

  async function load() {
    setLoading(true)
    const hj = hoje()
    const am = amanha()
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const [pedHoje, pedAmanha, clientes, insumos, alertas] = await Promise.all([
      supabase.from('pedidos')
        .select('id, numero_pedido, status, valor_total, horario_entrega, rota_entrega, clientes(nome, nome_loja)')
        .eq('data_entrega', hj).neq('status', 'cancelado').order('horario_entrega'),
      supabase.from('pedidos')
        .select(`id, numero_pedido, status, valor_total, horario_entrega, rota_entrega,
          pedido_itens(quantidade, produtos(nome, unidade_medida)),
          clientes(nome, nome_loja)`)
        .eq('data_entrega', am).neq('status', 'cancelado').order('horario_entrega'),
      supabase.from('clientes').select('id', { count: 'exact', head: true }),
      supabase.from('insumos').select('nome, quantidade_estoque, estoque_minimo, unidade_medida').eq('ativo', true),
      supabase.from('vw_clientes_alertas').select('*').in('alerta', ['risco_perda', 'queda']).order('dias_sem_comprar', { ascending: false }).limit(5),
    ])

    // KPIs
    const todosHoje = pedHoje.data || []
    const emProducaoCount = todosHoje.filter((p) => ['producao', 'separado', 'pronto'].includes(p.status)).length
    const atrasadosCount = todosHoje.filter((p) => ['pendente', 'em_analise', 'confirmado'].includes(p.status)).length

    // Faturamento mês (query separada)
    const { data: pedMes } = await supabase
      .from('pedidos').select('valor_total').gte('created_at', inicioMes).neq('status', 'cancelado')

    setKpis({
      pedidosHoje: todosHoje.length,
      faturamentoHoje: todosHoje.reduce((s, p) => s + Number(p.valor_total || 0), 0),
      faturamentoMes: (pedMes || []).reduce((s: number, p: any) => s + Number(p.valor_total || 0), 0),
      clientes: clientes.count || 0,
      emProducao: emProducaoCount,
      atrasados: atrasadosCount,
    })

    setPedidosHoje(todosHoje)

    // Pedidos de amanhã
    const am_data = pedAmanha.data || []
    setPedidosAmanha(am_data)

    // Por horário (hoje)
    const horMap: Record<string, { count: number; valor: number }> = {}
    for (const p of todosHoje) {
      const h = p.horario_entrega ? p.horario_entrega.slice(0, 5) : 'S/H'
      if (!horMap[h]) horMap[h] = { count: 0, valor: 0 }
      horMap[h].count++
      horMap[h].valor += Number(p.valor_total || 0)
    }
    setPorHorario(Object.entries(horMap).sort().map(([hora, v]) => ({ hora, ...v })))

    // Por rota (hoje)
    const rotMap: Record<string, { count: number; valor: number }> = {}
    for (const p of todosHoje) {
      const r = p.rota_entrega || 'sem_rota'
      if (!rotMap[r]) rotMap[r] = { count: 0, valor: 0 }
      rotMap[r].count++
      rotMap[r].valor += Number(p.valor_total || 0)
    }
    setPorRota(Object.entries(rotMap).map(([rota, v]) => ({ rota, ...v })).sort((a, b) => b.count - a.count))

    // Produção necessária para amanhã (soma por produto)
    const prodMap: Record<string, { total: number; unidade: string }> = {}
    for (const p of am_data) {
      for (const item of (p.pedido_itens || []) as any[]) {
        const nome = item.produtos?.nome || 'Produto'
        const unidade = item.produtos?.unidade_medida || 'un'
        if (!prodMap[nome]) prodMap[nome] = { total: 0, unidade }
        prodMap[nome].total += Number(item.quantidade || 0)
      }
    }
    setProducaoAmanha(Object.entries(prodMap).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.total - a.total))

    // Alertas de clientes
    setClientesSemComprar(alertas.data || [])

    // Estoque baixo
    setEstoqueBaixo((insumos.data || []).filter((i: any) => Number(i.quantidade_estoque) <= Number(i.estoque_minimo)).slice(0, 5))

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bendito-verde-escuro">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
          <RefreshCw size={15} /> Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { title: 'Pedidos hoje',      value: kpis.pedidosHoje,                 icon: ShoppingCart, color: 'bg-blue-500' },
          { title: 'Faturamento hoje',  value: formatBRL(kpis.faturamentoHoje),  icon: DollarSign,   color: 'bg-green-500' },
          { title: 'Faturamento mês',   value: formatBRL(kpis.faturamentoMes),   icon: TrendingUp,   color: 'bg-bendito-dourado' },
          { title: 'Clientes',          value: kpis.clientes,                    icon: Users,        color: 'bg-purple-500' },
          { title: 'Em produção',       value: kpis.emProducao,                  icon: Factory,      color: 'bg-orange-500' },
          { title: 'Pendentes hoje',    value: kpis.atrasados,                   icon: AlertTriangle,color: kpis.atrasados > 0 ? 'bg-red-500' : 'bg-gray-400' },
        ].map((c, i) => {
          const Icon = c.icon
          return (
            <div key={i} className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">{c.title}</p>
                <div className={`${c.color} p-1.5 rounded-lg`}><Icon size={14} className="text-white" /></div>
              </div>
              <p className="text-xl font-bold text-bendito-verde-escuro">{c.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pedidos de hoje por horário */}
        <div className="bg-white rounded-xl shadow-md p-5">
          <h2 className="font-bold text-bendito-verde-escuro mb-4 flex items-center gap-2">
            <Clock size={18} className="text-bendito-dourado-escuro" /> Entregas hoje por horário
          </h2>
          {porHorario.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma entrega programada para hoje.</p>
          ) : (
            <div className="space-y-2">
              {porHorario.map((h) => {
                const pct = (h.count / Math.max(...porHorario.map((x) => x.count))) * 100
                return (
                  <div key={h.hora} className="flex items-center gap-3">
                    <span className="text-sm font-mono font-semibold text-gray-700 w-12 flex-shrink-0">{h.hora}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div className="bg-bendito-verde h-full rounded-full flex items-center px-2 transition-all"
                        style={{ width: `${Math.max(pct, 8)}%` }}>
                        <span className="text-xs text-white font-semibold">{h.count}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 w-20 text-right flex-shrink-0">{formatBRL(h.valor)}</span>
                  </div>
                )
              })}
            </div>
          )}
          <Link href="/dashboard/agenda" className="flex items-center gap-1 text-xs text-bendito-verde font-semibold mt-4 hover:underline">
            Ver agenda completa <ChevronRight size={14} />
          </Link>
        </div>

        {/* Pedidos de hoje por rota */}
        <div className="bg-white rounded-xl shadow-md p-5">
          <h2 className="font-bold text-bendito-verde-escuro mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-bendito-dourado-escuro" /> Entregas hoje por rota
          </h2>
          {porRota.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma entrega hoje.</p>
          ) : (
            <div className="space-y-2">
              {porRota.map((r) => {
                const label = ROTAS_ENTREGA.find((x) => x.value === r.rota)?.label || 'Sem rota'
                const pct = (r.count / Math.max(...porRota.map((x) => x.count))) * 100
                return (
                  <div key={r.rota} className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-700 w-28 flex-shrink-0 truncate">{label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div className="bg-bendito-dourado h-full rounded-full flex items-center px-2 transition-all"
                        style={{ width: `${Math.max(pct, 8)}%` }}>
                        <span className="text-xs text-bendito-verde-escuro font-semibold">{r.count}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 w-20 text-right flex-shrink-0">{formatBRL(r.valor)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Produção necessária amanhã */}
        <div className="bg-white rounded-xl shadow-md p-5">
          <h2 className="font-bold text-bendito-verde-escuro mb-1 flex items-center gap-2">
            <Factory size={18} className="text-bendito-dourado-escuro" /> Produção necessária amanhã
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            {pedidosAmanha.length} pedido(s) confirmado(s) para {new Date(amanha() + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}
          </p>
          {producaoAmanha.length === 0 ? (
            <p className="text-sm text-gray-500">Sem pedidos confirmados para amanhã.</p>
          ) : (
            <div className="space-y-2">
              {producaoAmanha.map((p, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="text-sm font-medium text-gray-700">{p.nome}</span>
                  <span className="text-sm font-bold text-bendito-verde bg-bendito-creme px-3 py-0.5 rounded-full">
                    {p.total} {p.unidade}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link href="/dashboard/producao" className="flex items-center gap-1 text-xs text-bendito-verde font-semibold mt-4 hover:underline">
            Ver tela de produção <ChevronRight size={14} />
          </Link>
        </div>

        {/* Pedidos de hoje — status rápido */}
        <div className="bg-white rounded-xl shadow-md p-5">
          <h2 className="font-bold text-bendito-verde-escuro mb-4 flex items-center gap-2">
            <ShoppingCart size={18} className="text-bendito-dourado-escuro" /> Pedidos hoje
          </h2>
          {pedidosHoje.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum pedido com entrega hoje.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {pedidosHoje.map((p) => {
                const st = STATUS_PEDIDO.find((s) => s.value === p.status)
                const rota = ROTAS_ENTREGA.find((r) => r.value === p.rota_entrega)
                return (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{p.clientes?.nome_loja || p.clientes?.nome}</p>
                      <p className="text-xs text-gray-400">
                        #{p.numero_pedido}{p.horario_entrega ? ` · ${p.horario_entrega.slice(0,5)}` : ''}{rota ? ` · ${rota.label}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {st && <StatusBadge label={st.label} cor={st.cor} />}
                      <span className="text-xs font-bold text-bendito-verde">{formatBRL(p.valor_total)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Link href="/dashboard/agenda" className="flex items-center gap-1 text-xs text-bendito-verde font-semibold mt-4 hover:underline">
            Ver agenda de entregas <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clientes em risco */}
        {clientesSemComprar.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-5">
            <h2 className="font-bold text-bendito-verde-escuro mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" /> Clientes em risco
            </h2>
            <div className="space-y-2">
              {clientesSemComprar.map((a) => (
                <div key={a.cliente_id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <p className="text-sm font-medium">{a.nome_loja || a.nome}</p>
                  <span className="text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
                    {a.dias_sem_comprar} dias sem comprar
                  </span>
                </div>
              ))}
            </div>
            <Link href="/dashboard/clientes" className="flex items-center gap-1 text-xs text-bendito-verde font-semibold mt-4 hover:underline">
              Ver todos os clientes <ChevronRight size={14} />
            </Link>
          </div>
        )}

        {/* Estoque baixo */}
        {estoqueBaixo.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-5">
            <h2 className="font-bold text-bendito-verde-escuro mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-orange-500" /> Estoque abaixo do mínimo
            </h2>
            <div className="space-y-2">
              {estoqueBaixo.map((i: any) => (
                <div key={i.nome} className="flex items-center justify-between py-2 border-b last:border-0">
                  <p className="text-sm font-medium">{i.nome}</p>
                  <span className="text-xs text-orange-600 font-semibold bg-orange-50 px-2 py-0.5 rounded-full">
                    {i.quantidade_estoque} / mín {i.estoque_minimo} {i.unidade_medida}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/dashboard/estoque" className="flex items-center gap-1 text-xs text-bendito-verde font-semibold mt-4 hover:underline">
              Ver estoque completo <ChevronRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
