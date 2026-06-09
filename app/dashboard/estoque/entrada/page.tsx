'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PackagePlus, AlertTriangle, RefreshCw, History, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader, Loading, EmptyState, PrimaryButton } from '@/components/ui'
import { FILIAL_ID, formatData } from '@/lib/constants'

// ─── tipos ────────────────────────────────────────────────────
interface ItemEstoque {
  input_id: string
  name: string
  saldo: number
  unidade: string
  purchase_unit: string
  estoque_minimo: number | null
  status_alerta: 'ok' | 'baixo' | 'critico' | 'zerado'
}

interface Movimentacao {
  id: string
  tipo: string
  quantidade: number
  saldo_antes: number
  saldo_depois: number
  origem: string | null
  observacao: string | null
  criado_em: string
  pricing_inputs: { name: string; recipe_unit: string } | null
}

const TIPO_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  entrada:   { label: 'Entrada',   color: 'text-green-600',  icon: TrendingUp },
  saida:     { label: 'Saída',     color: 'text-red-500',    icon: TrendingDown },
  ajuste:    { label: 'Ajuste',    color: 'text-blue-500',   icon: Minus },
  perda:     { label: 'Perda',     color: 'text-orange-500', icon: TrendingDown },
}

const ORIGEM_LABEL: Record<string, string> = {
  entrada_manual: 'Entrada manual',
  pdv_venda:      'Venda PDV',
  ajuste_manual:  'Ajuste manual',
  perda:          'Perda registrada',
}

function alertaClass(status: string) {
  if (status === 'zerado')  return 'border-red-300 bg-red-50'
  if (status === 'critico') return 'border-orange-300 bg-orange-50'
  if (status === 'baixo')   return 'border-yellow-200 bg-yellow-50'
  return 'border-gray-100 bg-white'
}

function alertaBadge(status: string) {
  if (status === 'zerado')  return 'bg-red-100 text-red-700'
  if (status === 'critico') return 'bg-orange-100 text-orange-700'
  if (status === 'baixo')   return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

function alertaLabel(status: string) {
  if (status === 'zerado')  return 'Zerado'
  if (status === 'critico') return 'Crítico'
  if (status === 'baixo')   return 'Baixo'
  return 'OK'
}

// ─── componente ───────────────────────────────────────────────
export default function EstoquePage() {
  const router = useRouter()
  const supabase = createClient()

  const [itens, setItens]             = useState<ItemEstoque[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [abaAtiva, setAbaAtiva]       = useState<'estoque' | 'historico'>('estoque')
  const [filtroAlerta, setFiltroAlerta] = useState<string>('todos')

  // ─── carregar dados ──────────────────────────────────────
  const carregarDados = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    else setRefreshing(true)

    const [{ data: estoques }, { data: inputs }, { data: movs }] = await Promise.all([
      supabase
        .from('estoque_insumos')
        .select('input_id, saldo, unidade')
        .eq('filial_id', FILIAL_ID),

      supabase
        .from('pricing_inputs')
        .select('id, name, purchase_unit, recipe_unit')
        .eq('filial_id', FILIAL_ID)
        .eq('status', 'active')
        .order('name'),

      supabase
        .from('estoque_movimentacoes')
        .select(`
          id, tipo, quantidade, saldo_antes, saldo_depois,
          origem, observacao, criado_em,
          pricing_inputs (name, recipe_unit)
        `)
        .eq('filial_id', FILIAL_ID)
        .order('criado_em', { ascending: false })
        .limit(100),
    ])

    // montar mapa de saldos
    const saldoMap: Record<string, { saldo: number; unidade: string }> = {}
    for (const e of estoques ?? []) {
      saldoMap[e.input_id] = { saldo: e.saldo, unidade: e.unidade }
    }

    // montar itens com alerta
    const lista: ItemEstoque[] = (inputs ?? []).map(inp => {
      const est = saldoMap[inp.id]
      const saldo = est?.saldo ?? 0
      const min = 0 // estoque_minimo será calculado a partir de um padrão futuro

      let status_alerta: ItemEstoque['status_alerta'] = 'ok'
      if (saldo === 0)        status_alerta = 'zerado'
      else if (saldo < 100)   status_alerta = 'critico'
      else if (saldo < 500)   status_alerta = 'baixo'

      return {
        input_id:       inp.id,
        name:           inp.name,
        saldo,
        unidade:        est?.unidade ?? inp.recipe_unit,
        purchase_unit:  inp.purchase_unit,
        estoque_minimo: min,
        status_alerta,
      }
    })

    // insumos sem registro de estoque ainda (saldo implícito = 0)
    const comEstoque = new Set((estoques ?? []).map(e => e.input_id))
    for (const inp of inputs ?? []) {
      if (!comEstoque.has(inp.id)) {
        lista.push({
          input_id:      inp.id,
          name:          inp.name,
          saldo:         0,
          unidade:       inp.recipe_unit,
          purchase_unit: inp.purchase_unit,
          estoque_minimo: null,
          status_alerta: 'zerado',
        })
      }
    }

    // ordenar: zerado → crítico → baixo → ok
    const ORDEM = { zerado: 0, critico: 1, baixo: 2, ok: 3 }
    lista.sort((a, b) => ORDEM[a.status_alerta] - ORDEM[b.status_alerta] || a.name.localeCompare(b.name))

    setItens(lista)
    if (movs) setMovimentacoes(movs as unknown as Movimentacao[])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { carregarDados() }, [carregarDados])

  // ─── contadores de alerta ─────────────────────────────────
  const contadores = itens.reduce((acc, i) => {
    acc[i.status_alerta] = (acc[i.status_alerta] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const itensFiltrados = filtroAlerta === 'todos'
    ? itens
    : itens.filter(i => i.status_alerta === filtroAlerta)

  // ─── render ───────────────────────────────────────────────
  if (loading) return <Loading />

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title="Estoque de Insumos"
          subtitle="Saldo atual por insumo · atualizado em tempo real"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => carregarDados(true)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
            title="Atualizar"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <PrimaryButton onClick={() => router.push('/dashboard/estoque/entrada')}>
            <PackagePlus size={15} className="mr-1" /> Entrada
          </PrimaryButton>
        </div>
      </div>

      {/* KPIs de alerta */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'zerado',  label: 'Zerados',   color: 'bg-red-50 border-red-200 text-red-700' },
          { key: 'critico', label: 'Críticos',  color: 'bg-orange-50 border-orange-200 text-orange-700' },
          { key: 'baixo',   label: 'Baixos',    color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          { key: 'ok',      label: 'OK',        color: 'bg-green-50 border-green-200 text-green-700' },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setFiltroAlerta(filtroAlerta === item.key ? 'todos' : item.key)}
            className={`rounded-xl border p-4 text-left transition
              ${filtroAlerta === item.key ? item.color + ' ring-2 ring-current ring-offset-1' : 'bg-white border-gray-100 hover:border-gray-200'}
            `}
          >
            <p className={`text-2xl font-bold ${filtroAlerta === item.key ? '' : 'text-bendito-verde-escuro'}`}>
              {contadores[item.key] ?? 0}
            </p>
            <p className={`text-xs mt-0.5 ${filtroAlerta === item.key ? '' : 'text-gray-400'}`}>
              {item.label}
            </p>
          </button>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['estoque', 'historico'] as const).map(aba => (
          <button
            key={aba}
            onClick={() => setAbaAtiva(aba)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition
              ${abaAtiva === aba ? 'bg-white shadow-sm text-bendito-verde-escuro' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {aba === 'estoque' ? 'Saldo atual' : 'Histórico'}
          </button>
        ))}
      </div>

      {/* ─── ABA: Saldo atual ─── */}
      {abaAtiva === 'estoque' && (
        <>
          {itensFiltrados.length === 0 ? (
            <EmptyState
              title="Nenhum insumo encontrado"
              description="Cadastre insumos no módulo de precificação."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {itensFiltrados.map(item => (
                <div
                  key={item.input_id}
                  className={`rounded-xl border shadow-sm p-4 transition ${alertaClass(item.status_alerta)}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-sm font-semibold text-bendito-verde-escuro leading-tight">
                      {item.name}
                    </p>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${alertaBadge(item.status_alerta)}`}>
                      {alertaLabel(item.status_alerta)}
                    </span>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-bendito-verde-escuro">
                        {item.saldo % 1 === 0 ? item.saldo.toFixed(0) : item.saldo.toFixed(3)}
                      </p>
                      <p className="text-xs text-gray-400">{item.unidade}</p>
                    </div>
                    {item.status_alerta !== 'ok' && (
                      <AlertTriangle
                        size={20}
                        className={
                          item.status_alerta === 'zerado'  ? 'text-red-400' :
                          item.status_alerta === 'critico' ? 'text-orange-400' :
                          'text-yellow-400'
                        }
                      />
                    )}
                  </div>

                  {/* Barra de saldo visual */}
                  <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.status_alerta === 'zerado'  ? 'bg-red-400 w-0' :
                        item.status_alerta === 'critico' ? 'bg-orange-400' :
                        item.status_alerta === 'baixo'   ? 'bg-yellow-400' :
                        'bg-green-400'
                      }`}
                      style={{
                        width: item.status_alerta === 'zerado' ? '2px' :
                               item.status_alerta === 'critico' ? '20%' :
                               item.status_alerta === 'baixo'   ? '50%' : '100%'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── ABA: Histórico ─── */}
      {abaAtiva === 'historico' && (
        <>
          {movimentacoes.length === 0 ? (
            <EmptyState
              title="Nenhuma movimentação"
              description="As entradas e saídas de insumos aparecerão aqui."
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-50">
                {movimentacoes.map(mov => {
                  const cfg = TIPO_CONFIG[mov.tipo] ?? TIPO_CONFIG['ajuste']
                  const Icon = cfg.icon
                  return (
                    <div key={mov.id} className="px-5 py-3 flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        mov.tipo === 'entrada' ? 'bg-green-50' :
                        mov.tipo === 'saida'   ? 'bg-red-50' :
                        'bg-blue-50'
                      }`}>
                        <Icon size={15} className={cfg.color} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {mov.pricing_inputs?.name ?? '—'}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {ORIGEM_LABEL[mov.origem ?? ''] ?? mov.origem ?? 'Manual'}
                          {mov.observacao ? ` · ${mov.observacao}` : ''}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${cfg.color}`}>
                          {mov.tipo === 'entrada' ? '+' : '-'}
                          {mov.quantidade % 1 === 0
                            ? mov.quantidade.toFixed(0)
                            : mov.quantidade.toFixed(3)
                          } {mov.pricing_inputs?.recipe_unit}
                        </p>
                        <p className="text-xs text-gray-400">
                          {mov.saldo_antes.toFixed(0)} → {mov.saldo_depois.toFixed(0)}
                        </p>
                      </div>

                      <p className="text-xs text-gray-300 shrink-0 hidden sm:block min-w-16 text-right">
                        {formatData(mov.criado_em)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

    </div>
  )
}
