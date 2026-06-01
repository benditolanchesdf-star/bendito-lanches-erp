'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, CANAIS } from '@/lib/constants'
import { PageHeader, Loading, EmptyState } from '@/components/ui'
import { BarChart3, ShoppingCart, DollarSign, Users } from 'lucide-react'

export default function RelatoriosPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'7' | '30' | '90'>('30')
  const [pedidos, setPedidos] = useState<any[]>([])
  const [itens, setItens] = useState<any[]>([])

  async function load() {
    setLoading(true)
    const dias = Number(periodo)
    const desde = new Date(); desde.setDate(desde.getDate() - dias)
    const desdeISO = desde.toISOString()

    const [ped, it] = await Promise.all([
      supabase.from('pedidos').select('id, canal, valor_total, status, created_at').gte('created_at', desdeISO).neq('status', 'cancelado'),
      supabase.from('pedido_itens').select('quantidade, valor_total, produtos(nome), pedidos!inner(created_at, status)').gte('pedidos.created_at', desdeISO).neq('pedidos.status', 'cancelado'),
    ])
    setPedidos(ped.data || [])
    setItens(it.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [periodo])

  const totalPedidos = pedidos.length
  const faturamento = pedidos.reduce((s, p) => s + Number(p.valor_total || 0), 0)
  const ticketMedio = totalPedidos > 0 ? faturamento / totalPedidos : 0

  const porCanal = CANAIS.map((c) => {
    const ps = pedidos.filter((p) => p.canal === c.value)
    return { label: c.label, valor: ps.reduce((s, p) => s + Number(p.valor_total || 0), 0), pedidos: ps.length }
  }).filter((c) => c.pedidos > 0).sort((a, b) => b.valor - a.valor)

  const maxCanal = Math.max(...porCanal.map((c) => c.valor), 1)

  const porProduto: Record<string, { nome: string; qtd: number; total: number }> = {}
  for (const it of itens) {
    const nome = (it as any).produtos?.nome || 'Sem nome'
    if (!porProduto[nome]) porProduto[nome] = { nome, qtd: 0, total: 0 }
    porProduto[nome].qtd += Number(it.quantidade || 0)
    porProduto[nome].total += Number(it.valor_total || 0)
  }
  const topProdutos = Object.values(porProduto).sort((a, b) => b.total - a.total).slice(0, 10)
  const maxProd = Math.max(...topProdutos.map((p) => p.total), 1)

  const canalDestaque = porCanal[0]?.label || '-'

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" subtitle="BI e analytics" />

      <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-2">
        {[
          { v: '7', l: 'Últimos 7 dias' },
          { v: '30', l: 'Últimos 30 dias' },
          { v: '90', l: 'Últimos 90 dias' },
        ].map((p) => (
          <button key={p.v} onClick={() => setPeriodo(p.v as any)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${periodo === p.v ? 'bg-bendito-verde text-white' : 'bg-gray-100 text-gray-700'}`}>{p.l}</button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card icon={ShoppingCart} cor="bg-blue-500" titulo="Pedidos" valor={totalPedidos} />
            <Card icon={DollarSign} cor="bg-green-500" titulo="Faturamento" valor={formatBRL(faturamento)} />
            <Card icon={BarChart3} cor="bg-bendito-dourado" titulo="Ticket Médio" valor={formatBRL(ticketMedio)} />
            <Card icon={Users} cor="bg-purple-500" titulo="Canal Destaque" valor={canalDestaque} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-bold text-bendito-verde-escuro mb-4">Vendas por Canal</h2>
              {porCanal.length === 0 ? <EmptyState message="Sem vendas no período." /> : (
                <div className="space-y-3">
                  {porCanal.map((c) => (
                    <div key={c.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{c.label} <span className="text-xs text-gray-500">({c.pedidos})</span></span>
                        <span className="font-semibold text-bendito-verde">{formatBRL(c.valor)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-bendito-dourado" style={{ width: `${(c.valor / maxCanal) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-bold text-bendito-verde-escuro mb-4">Top 10 Produtos</h2>
              {topProdutos.length === 0 ? <EmptyState message="Sem vendas no período." /> : (
                <div className="space-y-3">
                  {topProdutos.map((p) => (
                    <div key={p.nome}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate pr-2">{p.nome} <span className="text-xs text-gray-500">({p.qtd}un)</span></span>
                        <span className="font-semibold text-bendito-verde">{formatBRL(p.total)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-bendito-verde" style={{ width: `${(p.total / maxProd) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Card({ icon: Icon, cor, titulo, valor }: any) {
  return (
    <div className="bg-white rounded-xl shadow-md p-5">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs text-gray-600">{titulo}</p>
          <p className="text-xl lg:text-2xl font-bold text-bendito-verde-escuro mt-1 truncate">{valor}</p>
        </div>
        <div className={`${cor} p-3 rounded-full shrink-0`}><Icon size={22} className="text-white" /></div>
      </div>
    </div>
  )
}
