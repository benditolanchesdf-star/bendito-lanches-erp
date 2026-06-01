'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData } from '@/lib/constants'
import { PageHeader, Loading, EmptyState } from '@/components/ui'
import { DollarSign, Clock, CheckCircle } from 'lucide-react'

export default function ComissoesPage() {
  const supabase = createClient()
  const [comissoes, setComissoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('comissoes')
      .select('*, pedidos(numero_pedido, clientes(nome, nome_loja))')
      .order('created_at', { ascending: false })
    setComissoes(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const pendentes = comissoes.filter((c) => c.status === 'pendente')
  const pagas = comissoes.filter((c) => c.status === 'paga')
  const totalPendente = pendentes.reduce((s, c) => s + Number(c.valor_comissao || 0), 0)
  const totalPago = pagas.reduce((s, c) => s + Number(c.valor_comissao || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Minhas Comissões" subtitle="Geradas automaticamente quando o pedido é entregue/baixado" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card icon={Clock}       cor="bg-yellow-500" titulo="Pendentes" valor={formatBRL(totalPendente)} />
        <Card icon={CheckCircle} cor="bg-green-500"  titulo="Pagas"     valor={formatBRL(totalPago)} />
        <Card icon={DollarSign}  cor="bg-bendito-dourado" titulo="Total" valor={formatBRL(totalPendente + totalPago)} />
      </div>

      {loading ? <Loading /> : comissoes.length === 0 ? <EmptyState message="Nenhuma comissão registrada ainda." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bendito-verde-escuro text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm">Pedido</th>
                  <th className="px-4 py-3 text-left text-sm">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm">Valor Pedido</th>
                  <th className="px-4 py-3 text-left text-sm">%</th>
                  <th className="px-4 py-3 text-left text-sm">Comissão</th>
                  <th className="px-4 py-3 text-left text-sm">Status</th>
                  <th className="px-4 py-3 text-left text-sm">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {comissoes.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">#{c.pedidos?.numero_pedido || '-'}</td>
                    <td className="px-4 py-3 text-sm">{c.pedidos?.clientes?.nome_loja || c.pedidos?.clientes?.nome || '-'}</td>
                    <td className="px-4 py-3 text-sm">{formatBRL(c.valor_pedido)}</td>
                    <td className="px-4 py-3 text-sm">{Number(c.percentual_comissao)}%</td>
                    <td className="px-4 py-3 font-bold text-bendito-verde">{formatBRL(c.valor_comissao)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.status === 'paga' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {c.status === 'paga' ? 'Paga' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{formatData(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ icon: Icon, cor, titulo, valor }: any) {
  return (
    <div className="bg-white rounded-xl shadow-md p-5 flex items-center justify-between">
      <div><p className="text-xs text-gray-600">{titulo}</p><p className="text-xl lg:text-2xl font-bold text-bendito-verde-escuro mt-1">{valor}</p></div>
      <div className={`${cor} p-3 rounded-full`}><Icon size={22} className="text-white" /></div>
    </div>
  )
}
