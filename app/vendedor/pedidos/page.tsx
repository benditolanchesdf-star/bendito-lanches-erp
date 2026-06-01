'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData, STATUS_PEDIDO } from '@/lib/constants'
import { PageHeader, PrimaryButton, Loading, EmptyState, StatusBadge } from '@/components/ui'
import { Plus, Search } from 'lucide-react'

export default function VendedorPedidosPage() {
  const supabase = createClient()
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('pedidos')
      .select('id, numero_pedido, status, valor_total, data_entrega, horario_entrega, created_at, clientes(nome, nome_loja)')
      .order('created_at', { ascending: false }).limit(200)
    setPedidos(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtrados = pedidos.filter((p) => {
    const ok1 = busca === '' || String(p.numero_pedido).includes(busca) ||
      (p.clientes?.nome_loja || p.clientes?.nome || '').toLowerCase().includes(busca.toLowerCase())
    const ok2 = filtroStatus === '' || p.status === filtroStatus
    return ok1 && ok2
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos dos meus clientes" subtitle="Histórico e acompanhamento"
        action={<Link href="/vendedor/pedidos/novo"><PrimaryButton className="flex items-center gap-2"><Plus size={20} /> Novo Pedido</PrimaryButton></Link>} />

      <div className="bg-white rounded-xl shadow-md p-4 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nº ou cliente..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-bendito-dourado" />
        </div>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bendito-dourado">
          <option value="">Todos os status</option>
          {STATUS_PEDIDO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : filtrados.length === 0 ? <EmptyState message="Nenhum pedido encontrado." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bendito-verde-escuro text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm">Nº</th>
                  <th className="px-4 py-3 text-left text-sm">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm">Valor</th>
                  <th className="px-4 py-3 text-left text-sm">Status</th>
                  <th className="px-4 py-3 text-left text-sm">Entrega</th>
                  <th className="px-4 py-3 text-left text-sm">Pedido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtrados.map((p) => {
                  const st = STATUS_PEDIDO.find((s) => s.value === p.status)
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm">#{p.numero_pedido}</td>
                      <td className="px-4 py-3 text-sm">{p.clientes?.nome_loja || p.clientes?.nome || '-'}</td>
                      <td className="px-4 py-3 font-semibold text-bendito-verde">{formatBRL(p.valor_total)}</td>
                      <td className="px-4 py-3">{st && <StatusBadge label={st.label} cor={st.cor} />}</td>
                      <td className="px-4 py-3 text-sm">
                        {p.data_entrega ? <>{formatData(p.data_entrega)}{p.horario_entrega ? ` ${p.horario_entrega.slice(0,5)}` : ''}</> : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{formatData(p.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
