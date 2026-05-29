'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, STATUS_PEDIDO } from '@/lib/constants'
import { Loading } from '@/components/ui'
import { ShoppingCart, DollarSign, Users, Package, AlertTriangle, TrendingUp } from 'lucide-react'

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({
    pedidosHoje: 0,
    faturamentoHoje: 0,
    faturamentoMes: 0,
    clientes: 0,
    produtos: 0,
  })
  const [pedidosRecentes, setPedidosRecentes] = useState<any[]>([])
  const [estoqueBaixo, setEstoqueBaixo] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const hoje = new Date().toISOString().split('T')[0]
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const [pedidos, clientes, produtos, insumos] = await Promise.all([
        supabase.from('pedidos').select('id, numero_pedido, valor_total, status, canal, created_at, clientes(nome)').order('created_at', { ascending: false }).limit(100),
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase.from('produtos').select('id', { count: 'exact', head: true }),
        supabase.from('insumos').select('nome, quantidade_estoque, estoque_minimo, unidade_medida').eq('ativo', true),
      ])

      const todosPedidos = pedidos.data || []
      const pedidosHoje = todosPedidos.filter((p) => p.created_at >= hoje)
      const pedidosMes = todosPedidos.filter((p) => p.created_at >= inicioMes)

      setKpis({
        pedidosHoje: pedidosHoje.length,
        faturamentoHoje: pedidosHoje.reduce((s, p) => s + (Number(p.valor_total) || 0), 0),
        faturamentoMes: pedidosMes.reduce((s, p) => s + (Number(p.valor_total) || 0), 0),
        clientes: clientes.count || 0,
        produtos: produtos.count || 0,
      })
      setPedidosRecentes(todosPedidos.slice(0, 6))
      setEstoqueBaixo((insumos.data || []).filter((i: any) => Number(i.quantidade_estoque) <= Number(i.estoque_minimo)))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Loading />

  const cards = [
    { title: 'Pedidos Hoje', value: kpis.pedidosHoje, icon: ShoppingCart, color: 'bg-blue-500' },
    { title: 'Faturamento Hoje', value: formatBRL(kpis.faturamentoHoje), icon: DollarSign, color: 'bg-green-500' },
    { title: 'Faturamento no Mês', value: formatBRL(kpis.faturamentoMes), icon: TrendingUp, color: 'bg-bendito-dourado' },
    { title: 'Clientes', value: kpis.clientes, icon: Users, color: 'bg-purple-500' },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-bendito-verde-escuro">Dashboard</h1>
        <p className="text-gray-600 mt-1">Visão geral do Bendito Lanches</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((c, i) => {
          const Icon = c.icon
          return (
            <div key={i} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">{c.title}</p>
                  <p className="text-2xl font-bold text-bendito-verde-escuro mt-2">{c.value}</p>
                </div>
                <div className={`${c.color} p-4 rounded-full`}>
                  <Icon size={26} className="text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="text-blue-500" size={22} />
            <h2 className="text-xl font-bold text-bendito-verde-escuro">Pedidos Recentes</h2>
          </div>
          {pedidosRecentes.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum pedido ainda.</p>
          ) : (
            <div className="space-y-2">
              {pedidosRecentes.map((p) => {
                const st = STATUS_PEDIDO.find((s) => s.value === p.status)
                return (
                  <div key={p.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <span className="text-sm font-medium">#{p.numero_pedido}</span>
                      <span className="text-xs text-gray-500 ml-2">{p.clientes?.nome || 'Sem cliente'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {st && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cor}`}>{st.label}</span>}
                      <span className="font-semibold text-bendito-verde text-sm">{formatBRL(p.valor_total)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-orange-500" size={22} />
            <h2 className="text-xl font-bold text-bendito-verde-escuro">Estoque Baixo (Insumos)</h2>
          </div>
          {estoqueBaixo.length === 0 ? (
            <p className="text-gray-500 text-sm">Todos os insumos com estoque adequado. 👍</p>
          ) : (
            <div className="space-y-2">
              {estoqueBaixo.map((i, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="text-sm">{i.nome}</span>
                  <span className="text-sm font-semibold text-red-600">
                    {Number(i.quantidade_estoque)} / min {Number(i.estoque_minimo)} {i.unidade_medida}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
