'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData, ALERTAS_CLIENTE, STATUS_PEDIDO } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, PrimaryButton } from '@/components/ui'
import { Users, ShoppingCart, DollarSign, TrendingUp, AlertTriangle, Plus } from 'lucide-react'

export default function VendedorDashboard() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ clientes: 0, pedidosMes: 0, faturadoMes: 0, comissaoPendente: 0 })
  const [alertas, setAlertas] = useState<any[]>([])
  const [pedidosRecentes, setPedidosRecentes] = useState<any[]>([])

  async function load() {
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const [cli, ped, com, alt] = await Promise.all([
      // RLS filtra automaticamente para o vendedor logado
      supabase.from('clientes').select('id', { count: 'exact', head: true }),
      supabase.from('pedidos').select('id, numero_pedido, status, valor_total, created_at, clientes(nome, nome_loja)')
        .gte('created_at', inicioMes).neq('status', 'cancelado').order('created_at', { ascending: false }).limit(20),
      supabase.from('comissoes').select('valor_comissao, status').eq('status', 'pendente'),
      supabase.from('vw_clientes_alertas').select('*').order('dias_sem_comprar', { ascending: false, nullsFirst: false }).limit(20),
    ])

    const pedidosArr = ped.data || []
    setStats({
      clientes: cli.count || 0,
      pedidosMes: pedidosArr.length,
      faturadoMes: pedidosArr.reduce((s, p) => s + Number(p.valor_total || 0), 0),
      comissaoPendente: (com.data || []).reduce((s, c) => s + Number(c.valor_comissao || 0), 0),
    })
    setPedidosRecentes(pedidosArr.slice(0, 6))
    setAlertas(alt.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Painel do Vendedor" subtitle="Sua carteira de clientes em tempo real"
        action={<Link href="/vendedor/pedidos/novo"><PrimaryButton className="flex items-center gap-2"><Plus size={20} /> Novo Pedido</PrimaryButton></Link>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card icon={Users}       cor="bg-blue-500"            titulo="Meus Clientes"        valor={stats.clientes} />
        <Card icon={ShoppingCart} cor="bg-purple-500"          titulo="Pedidos no Mês"       valor={stats.pedidosMes} />
        <Card icon={TrendingUp}  cor="bg-bendito-dourado"     titulo="Faturado no Mês"      valor={formatBRL(stats.faturadoMes)} />
        <Card icon={DollarSign}  cor="bg-green-500"           titulo="Comissão Pendente"    valor={formatBRL(stats.comissaoPendente)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-orange-500" size={22} />
            <h2 className="text-lg font-bold text-bendito-verde-escuro">Alertas Comerciais</h2>
          </div>
          {alertas.length === 0 ? <EmptyState message="Nenhum cliente com alerta." /> : (
            <div className="space-y-2">
              {alertas.slice(0, 10).map((a) => {
                const meta = ALERTAS_CLIENTE.find((x) => x.value === a.alerta)
                return (
                  <div key={a.cliente_id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.nome_loja || a.nome}</p>
                      <p className="text-xs text-gray-500">
                        {a.dias_sem_comprar != null ? `${a.dias_sem_comprar} dias sem comprar` : 'Sem histórico'}
                      </p>
                    </div>
                    {meta && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${meta.cor}`}>{meta.label}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="text-blue-500" size={22} />
            <h2 className="text-lg font-bold text-bendito-verde-escuro">Pedidos Recentes</h2>
          </div>
          {pedidosRecentes.length === 0 ? <EmptyState message="Nenhum pedido este mês." /> : (
            <div className="space-y-2">
              {pedidosRecentes.map((p) => {
                const st = STATUS_PEDIDO.find((s) => s.value === p.status)
                return (
                  <div key={p.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">#{p.numero_pedido}</p>
                      <p className="text-xs text-gray-500 truncate">{p.clientes?.nome_loja || p.clientes?.nome}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {st && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cor}`}>{st.label}</span>}
                      <span className="text-sm font-bold text-bendito-verde">{formatBRL(p.valor_total)}</span>
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
