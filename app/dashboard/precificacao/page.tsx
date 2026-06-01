'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL } from '@/lib/constants'
import { PricingCalculator } from '@/lib/pricing-calculator'
import { PageHeader, Loading } from '@/components/ui'
import { Package, DollarSign, TrendingUp, Target, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react'

export default function PrecificacaoDashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({
    totalProdutos: 0, precoMedio: 0, margemMedia: 0,
    totalCustos: 0, breakevenBRL: 0, breakevenUn: 0,
    taxaCustoFixo: 0,
  })
  const [produtos, setProdutos] = useState<any[]>([])
  const [diretos, setDiretos] = useState<any[]>([])
  const [custosPorCategoria, setCustosPorCategoria] = useState<{ cat: string; total: number }[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [settRes, costsRes, prodRes, dirRes] = await Promise.all([
      supabase.from('pricing_settings').select('estimated_monthly_revenue').eq('filial_id', FILIAL_ID).maybeSingle(),
      supabase.from('pricing_fixed_costs').select('*').eq('filial_id', FILIAL_ID).eq('status', 'active'),
      supabase.from('pricing_products').select('*, pricing_product_inputs(required_quantity, pricing_inputs(recipe_unit_cost_calc, name))').eq('filial_id', FILIAL_ID).eq('status', 'active'),
      supabase.from('pricing_direct_products').select('*').eq('filial_id', FILIAL_ID).eq('status', 'active'),
    ])

    const revenue = Number(settRes.data?.estimated_monthly_revenue || 0)
    const costs = costsRes.data || []
    const totalCustos = costs.reduce((s: number, c: any) => s + Number(c.amount || 0), 0)
    const taxaCustoFixo = revenue > 0 ? totalCustos / revenue : 0

    // Custos por categoria
    const catMap: Record<string, number> = {}
    for (const c of costs) {
      catMap[c.category] = (catMap[c.category] || 0) + Number(c.amount || 0)
    }
    setCustosPorCategoria(Object.entries(catMap).map(([cat, total]) => ({ cat, total })).sort((a, b) => b.total - a.total))

    // Calcular métricas dos produtos
    const prodData: any[] = []
    for (const p of prodRes.data || []) {
      const costBase = (p.pricing_product_inputs || []).reduce((s: number, i: any) => {
        const uc = Number(i.pricing_inputs?.recipe_unit_cost_calc || 0)
        return s + uc * Number(i.required_quantity || 0)
      }, 0) / Math.max(Number(p.yield || 1), 1)

      const result = PricingCalculator.calculate({
        costBase,
        fixedCostRate: taxaCustoFixo,
        packagingCost: Number(p.packaging_cost || 0),
        idealMarkup: Number(p.ideal_markup || 1),
        taxRate: Number(p.tax_rate || 0),
        cardRate: Number(p.card_rate || 0),
        deliveryRate: Number(p.delivery_rate || 0),
        appliedPrice: Number(p.applied_price || 0),
      })
      prodData.push({ ...p, ...result })
    }

    const dirData: any[] = []
    for (const d of dirRes.data || []) {
      const result = PricingCalculator.calculate({
        costBase: Number(d.purchase_price || 0),
        fixedCostRate: taxaCustoFixo,
        packagingCost: Number(d.packaging_cost || 0),
        idealMarkup: Number(d.ideal_markup || 1),
        taxRate: Number(d.tax_rate || 0),
        cardRate: Number(d.card_rate || 0),
        deliveryRate: Number(d.delivery_rate || 0),
        appliedPrice: Number(d.applied_price || 0),
      })
      dirData.push({ ...d, ...result })
    }

    setProdutos(prodData)
    setDiretos(dirData)

    const todos = [...prodData, ...dirData]
    const totalProdutos = todos.length
    const precoMedio = totalProdutos > 0 ? todos.reduce((s, p) => s + Number(p.applied_price || 0), 0) / totalProdutos : 0
    const margemMedia = totalProdutos > 0 ? todos.reduce((s, p) => s + (p.contributionMargin || 0), 0) / totalProdutos : 0
    const breakevenBRL = PricingCalculator.breakeven(totalCustos, margemMedia, precoMedio)
    const breakevenUn = PricingCalculator.breakevenUnits(totalCustos, margemMedia)

    setKpis({ totalProdutos, precoMedio, margemMedia, totalCustos, breakevenBRL, breakevenUn, taxaCustoFixo })
    setLoading(false)
  }

  if (loading) return <Loading />

  const totalBar = Math.max(...custosPorCategoria.map(c => c.total), 1)
  const cores: Record<string, string> = {
    'Despesas Fixas': 'bg-blue-500',
    'Pessoas': 'bg-purple-500',
    'Marketing': 'bg-orange-400',
    'Outros': 'bg-gray-400',
  }
  const foraMargin = [...produtos, ...diretos].filter(p => p.status === 'Ajustar').length

  return (
    <div className="space-y-6">
      <PageHeader title="Precificação" subtitle="Saúde financeira e análise de viabilidade do negócio" />

      {/* Atalhos de módulo */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { href: '/dashboard/precificacao/custos',    label: 'Custos Fixos',     emoji: '💸' },
          { href: '/dashboard/precificacao/insumos',   label: 'Insumos',          emoji: '🧂' },
          { href: '/dashboard/precificacao/produtos',  label: 'Ficha Técnica',    emoji: '📋' },
          { href: '/dashboard/precificacao/direta',    label: 'Precif. Direta',   emoji: '🏷️' },
          { href: '/dashboard/precificacao/orcamentos',label: 'Orçamentos',       emoji: '📄' },
        ].map(({ href, label, emoji }) => (
          <Link key={href} href={href}
            className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center gap-2 hover:shadow-lg hover:border-bendito-dourado border border-transparent transition text-center">
            <span className="text-2xl">{emoji}</span>
            <span className="text-xs font-semibold text-bendito-verde-escuro">{label}</span>
          </Link>
        ))}
        {foraMargin > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col items-center gap-1 text-center">
            <AlertTriangle size={22} className="text-red-500" />
            <span className="text-lg font-bold text-red-600">{foraMargin}</span>
            <span className="text-xs text-red-600 font-semibold">produto(s) para ajustar</span>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Produtos',              value: kpis.totalProdutos,                        icon: Package,    cor: 'bg-blue-500' },
          { label: 'Preço médio',           value: formatBRL(kpis.precoMedio),                icon: DollarSign, cor: 'bg-green-500' },
          { label: 'Margem média',          value: formatBRL(kpis.margemMedia),               icon: TrendingUp, cor: 'bg-bendito-dourado' },
          { label: 'Total custos fixos',    value: formatBRL(kpis.totalCustos),               icon: DollarSign, cor: 'bg-red-400' },
          { label: 'Breakeven (R$)',        value: formatBRL(kpis.breakevenBRL),              icon: Target,     cor: 'bg-purple-500' },
          { label: 'Breakeven (unid.)',     value: Math.ceil(kpis.breakevenUn).toString(),    icon: Target,     cor: 'bg-orange-500' },
        ].map((c, i) => {
          const Icon = c.icon
          return (
            <div key={i} className="bg-white rounded-xl shadow-md p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs text-gray-500">{c.label}</p>
                <div className={`${c.cor} p-1.5 rounded-lg`}><Icon size={13} className="text-white" /></div>
              </div>
              <p className="text-lg font-bold text-bendito-verde-escuro leading-tight">{c.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição de custos fixos */}
        <div className="bg-white rounded-xl shadow-md p-5">
          <h2 className="font-bold text-bendito-verde-escuro mb-1">Distribuição de Custos Fixos</h2>
          <p className="text-xs text-gray-400 mb-4">
            Taxa de custo fixo: {(kpis.taxaCustoFixo * 100).toFixed(1)}% · Total: {formatBRL(kpis.totalCustos)}
          </p>
          {custosPorCategoria.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum custo cadastrado. <Link href="/dashboard/precificacao/custos" className="text-bendito-verde underline">Cadastrar agora</Link></p>
          ) : (
            <div className="space-y-3">
              {custosPorCategoria.map(({ cat, total }) => {
                const pct = (total / totalBar) * 100
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{cat}</span>
                      <span className="text-gray-500">{formatBRL(total)} · {((total / kpis.totalCustos) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cores[cat] || 'bg-gray-400'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Link href="/dashboard/precificacao/custos" className="flex items-center gap-1 text-xs text-bendito-verde font-semibold mt-4 hover:underline">
            Gerenciar custos <ChevronRight size={13} />
          </Link>
        </div>

        {/* Top produtos por margem */}
        <div className="bg-white rounded-xl shadow-md p-5">
          <h2 className="font-bold text-bendito-verde-escuro mb-4">Top Produtos por Margem</h2>
          {[...produtos, ...diretos].length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum produto cadastrado. <Link href="/dashboard/precificacao/produtos" className="text-bendito-verde underline">Cadastrar agora</Link></p>
          ) : (
            <div className="space-y-2">
              {[...produtos, ...diretos]
                .sort((a, b) => (b.contributionMargin || 0) - (a.contributionMargin || 0))
                .slice(0, 6)
                .map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
                      <span className="text-sm font-medium text-gray-700 truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-bendito-verde">{formatBRL(p.contributionMargin)}</span>
                      {p.status === 'Dentro da margem'
                        ? <CheckCircle size={14} className="text-green-500" />
                        : <AlertTriangle size={14} className="text-red-500" />}
                    </div>
                  </div>
                ))}
            </div>
          )}
          <Link href="/dashboard/precificacao/produtos" className="flex items-center gap-1 text-xs text-bendito-verde font-semibold mt-4 hover:underline">
            Ver todos os produtos <ChevronRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  )
}
