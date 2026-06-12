'use client'

import { useEffect, useState } from 'react'
import { ShoppingBag, Users, TrendingUp, Clock, CheckCircle2, Truck, XCircle, Package, RefreshCw, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui'
import { FILIAL_ID, formatBRL } from '@/lib/constants'

// ─── tipos ────────────────────────────────────────────────────
interface KPI {
  pedidos_hoje: number
  faturamento_hoje: number
  ticket_medio: number
  pedidos_pendentes: number
  pedidos_em_producao: number
  pedidos_prontos: number
  pedidos_saiu_entrega: number
  pedidos_entregues_hoje: number
  pedidos_cancelados_hoje: number
  clientes_novos_mes: number
  faturamento_mes: number
  pedidos_mes: number
}

interface PedidoRecente {
  id: string
  numero: string
  status: string
  total: number
  canal: string | null
  created_at: string
  clientes: { nome: string } | null
}

interface TopProduto {
  nome: string
  quantidade: number
  total: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pendente:     { label: 'Pendente',        color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: Clock },
  confirmado:   { label: 'Confirmado',      color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     icon: CheckCircle2 },
  em_producao:  { label: 'Em produção',     color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Package },
  pronto:       { label: 'Pronto',          color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   icon: CheckCircle2 },
  saiu_entrega: { label: 'Saiu p/ entrega', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: Truck },
  entregue:     { label: 'Entregue',        color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200',     icon: CheckCircle2 },
  cancelado:    { label: 'Cancelado',       color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       icon: XCircle },
}

const CANAL_LABEL: Record<string, string> = {
  balcao: 'Balcão', whatsapp: 'WhatsApp', telefone: 'Telefone', app: 'App', ifood: 'iFood',
}

function hojeInicio() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString()
}
function mesInicio() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString()
}
function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function formatDataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ─── componente ───────────────────────────────────────────────
export default function DashboardPage() {
  const supabase = createClient()

  const [kpi, setKpi]                     = useState<KPI | null>(null)
  const [pedidosRecentes, setPedidosRecentes] = useState<PedidoRecente[]>([])
  const [topProdutos, setTopProdutos]     = useState<TopProduto[]>([])
  const [loading, setLoading]             = useState(true)
  const [refreshing, setRefreshing]       = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(new Date())

  async function carregarDados(silencioso = false) {
    if (!silencioso) setLoading(true)
    else setRefreshing(true)

    const hoje  = hojeInicio()
    const mes   = mesInicio()
    const agora = new Date().toISOString()

    const [
      { data: pedidosHoje },
      { data: pedidosMes },
      { data: ativos },
      { data: recentes },
      { data: itensMes },
      { count: clientesMes },
    ] = await Promise.all([
      // pedidos de hoje
      supabase
        .from('pedidos')
        .select('status, total')
        .eq('filial_id', FILIAL_ID)
        .gte('created_at', hoje)
        .lte('created_at', agora),

      // pedidos do mês
      supabase
        .from('pedidos')
        .select('total, status')
        .eq('filial_id', FILIAL_ID)
        .gte('created_at', mes)
        .lte('created_at', agora)
        .neq('status', 'cancelado'),

      // pedidos ativos (pipeline)
      supabase
        .from('pedidos')
        .select('status')
        .eq('filial_id', FILIAL_ID)
        .in('status', ['pendente', 'confirmado', 'em_producao', 'pronto', 'saiu_entrega']),

      // últimos 10 pedidos
      supabase
        .from('pedidos')
        .select('id, numero, status, total, canal, created_at, clientes(nome)')
        .eq('filial_id', FILIAL_ID)
        .order('created_at', { ascending: false })
        .limit(10),

      // itens do mês para top produtos
      supabase
        .from('pedido_itens')
        .select('quantidade, subtotal, produto_id, produtos(nome), pedidos!inner(filial_id, status, created_at)')
        .eq('pedidos.filial_id', FILIAL_ID)
        .neq('pedidos.status', 'cancelado')
        .gte('pedidos.created_at', mes)
        .not('produto_id', 'is', null),

      // clientes novos no mês
      supabase
        .from('clientes')
        .select('id', { count: 'exact', head: true })
        .eq('filial_id', FILIAL_ID)
        .gte('created_at', mes),
    ])

    // ─── calcular KPIs ───────────────────────────────────────
    const ph = pedidosHoje ?? []
    const pm = pedidosMes ?? []
    const pa = ativos ?? []

    const pedidos_hoje            = ph.length
    const faturamento_hoje        = ph.filter(p => p.status !== 'cancelado').reduce((s, p) => s + (p.total ?? 0), 0)
    const entregues_hoje          = ph.filter(p => p.status === 'entregue').length
    const cancelados_hoje         = ph.filter(p => p.status === 'cancelado').length
    const faturamento_mes         = pm.reduce((s, p) => s + (p.total ?? 0), 0)
    const pedidos_mes             = pm.length
    const ticket_medio            = pedidos_mes > 0 ? faturamento_mes / pedidos_mes : 0
    const pendentes               = pa.filter(p => p.status === 'pendente').length
    const em_producao             = pa.filter(p => p.status === 'em_producao' || p.status === 'confirmado').length
    const prontos                 = pa.filter(p => p.status === 'pronto').length
    const saiu_entrega            = pa.filter(p => p.status === 'saiu_entrega').length

    setKpi({
      pedidos_hoje,
      faturamento_hoje,
      ticket_medio,
      pedidos_pendentes:      pendentes,
      pedidos_em_producao:    em_producao,
      pedidos_prontos:        prontos,
      pedidos_saiu_entrega:   saiu_entrega,
      pedidos_entregues_hoje: entregues_hoje,
      pedidos_cancelados_hoje: cancelados_hoje,
      clientes_novos_mes:     clientesMes ?? 0,
      faturamento_mes,
      pedidos_mes,
    })

    // ─── pedidos recentes ────────────────────────────────────
    if (recentes) setPedidosRecentes(recentes as unknown as PedidoRecente[])

    // ─── top produtos ────────────────────────────────────────
    if (itensMes) {
      const mapa: Record<string, TopProduto> = {}
      for (const item of itensMes as any[]) {
        const nome = item.produtos?.nome
        if (!nome) continue
        if (!mapa[nome]) mapa[nome] = { nome, quantidade: 0, total: 0 }
        mapa[nome].quantidade += item.quantidade ?? 0
        mapa[nome].total      += item.subtotal ?? 0
      }
      setTopProdutos(
        Object.values(mapa)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)
      )
    }

    setUltimaAtualizacao(new Date())
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { carregarDados() }, [])

  // realtime — atualiza ao mudar pedidos
  useEffect(() => {
    const ch = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        carregarDados(true)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bendito-verde" />
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-bendito-verde-escuro">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Atualizado às {formatHora(ultimaAtualizacao.toISOString())}
          </p>
        </div>
        <button
          onClick={() => carregarDados(true)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-bendito-verde px-3 py-2 rounded-lg hover:bg-gray-100 transition"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* ─── KPIs principais — hoje ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Faturamento hoje</p>
            <div className="w-8 h-8 rounded-lg bg-bendito-verde/10 flex items-center justify-center">
              <TrendingUp size={16} className="text-bendito-verde" />
            </div>
          </div>
          <p className="text-2xl font-bold text-bendito-verde-escuro">{formatBRL(kpi?.faturamento_hoje ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">{kpi?.pedidos_hoje ?? 0} pedidos · {kpi?.pedidos_entregues_hoje ?? 0} entregues</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Faturamento mês</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <TrendingUp size={16} className="text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-bendito-verde-escuro">{formatBRL(kpi?.faturamento_mes ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">{kpi?.pedidos_mes ?? 0} pedidos no mês</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Ticket médio</p>
            <div className="w-8 h-8 rounded-lg bg-bendito-dourado/10 flex items-center justify-center">
              <ShoppingBag size={16} className="text-bendito-dourado-escuro" />
            </div>
          </div>
          <p className="text-2xl font-bold text-bendito-verde-escuro">{formatBRL(kpi?.ticket_medio ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">no mês</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Clientes novos</p>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Users size={16} className="text-purple-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-bendito-verde-escuro">{kpi?.clientes_novos_mes ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">cadastrados este mês</p>
        </div>
      </div>

      {/* ─── Pipeline de pedidos ─── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-bendito-verde-escuro mb-4">Pipeline de pedidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Pendentes',    value: kpi?.pedidos_pendentes,    status: 'pendente',     urgente: (kpi?.pedidos_pendentes ?? 0) > 3 },
            { label: 'Em produção',  value: kpi?.pedidos_em_producao,  status: 'em_producao',  urgente: false },
            { label: 'Prontos',      value: kpi?.pedidos_prontos,      status: 'pronto',       urgente: (kpi?.pedidos_prontos ?? 0) > 0 },
            { label: 'Em entrega',   value: kpi?.pedidos_saiu_entrega, status: 'saiu_entrega', urgente: false },
            { label: 'Cancelados',   value: kpi?.pedidos_cancelados_hoje, status: 'cancelado', urgente: false },
          ].map(item => {
            const cfg = STATUS_CONFIG[item.status]
            const Icon = cfg.icon
            return (
              <div key={item.status}
                className={`rounded-xl border p-4 text-center ${cfg.bg} ${item.urgente ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
                <Icon size={20} className={`mx-auto mb-2 ${cfg.color}`} />
                <p className={`text-2xl font-bold ${cfg.color}`}>{item.value ?? 0}</p>
                <p className={`text-xs mt-0.5 ${cfg.color} opacity-80`}>{item.label}</p>
                {item.urgente && (
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    <span className="text-xs opacity-70">atenção</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Pedidos recentes + Top produtos ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pedidos recentes */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-bendito-verde-escuro">Pedidos recentes</h2>
            <a href="/dashboard/pedidos" className="text-xs text-bendito-dourado-escuro hover:underline">
              Ver todos →
            </a>
          </div>
          {pedidosRecentes.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-gray-400">Nenhum pedido ainda.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pedidosRecentes.map(p => {
                const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG['pendente']
                const Icon = cfg.icon
                return (
                  <a key={p.id} href={`/dashboard/pedidos/${p.id}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition group">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-bendito-verde-escuro group-hover:underline truncate">
                        {p.numero}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {p.clientes?.nome ?? 'Sem cliente'}
                        {p.canal ? ` · ${CANAL_LABEL[p.canal] ?? p.canal}` : ''}
                      </p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.bg} ${cfg.color}`}>
                      <Icon size={11} />{cfg.label}
                    </span>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-bendito-verde-escuro">{formatBRL(p.total)}</p>
                      <p className="text-xs text-gray-400">{formatDataCurta(p.created_at)}</p>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>

        {/* Top produtos */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-bendito-verde-escuro">Top produtos — mês</h2>
          </div>
          {topProdutos.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-gray-400">Sem dados ainda.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {topProdutos.map((p, i) => {
                const maxTotal = topProdutos[0]?.total ?? 1
                const pct = Math.round((p.total / maxTotal) * 100)
                return (
                  <div key={p.nome} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-gray-300 w-4 shrink-0">{i + 1}</span>
                        <p className="text-sm text-gray-800 truncate">{p.nome}</p>
                      </div>
                      <p className="text-sm font-bold text-bendito-verde-escuro shrink-0 ml-2">
                        {formatBRL(p.total)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-bendito-verde h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{p.quantidade}x</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
