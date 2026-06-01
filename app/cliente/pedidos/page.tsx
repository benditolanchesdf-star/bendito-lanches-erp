'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData, STATUS_PEDIDO } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, StatusBadge, PrimaryButton, SecondaryButton } from '@/components/ui'
import { Repeat, XCircle, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'

// Status que permitem cancelamento pelo cliente
const CANCELAVEIS = ['rascunho', 'pendente']

export default function ClientePedidosPage() {
  const supabase = createClient()
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [itensCache, setItensCache] = useState<Record<string, any[]>>({})
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [vendedor, setVendedor] = useState<any>(null)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('cliente_id').eq('id', user!.id).maybeSingle()

    const [pedRes, cliRes] = await Promise.all([
      supabase.from('pedidos')
        .select('id, numero_pedido, status, valor_total, subtotal, taxa_entrega, desconto, forma_pagamento, observacoes, data_entrega, horario_entrega, created_at, pedido_origem')
        .order('created_at', { ascending: false }),
      profile?.cliente_id
        ? supabase.from('clientes').select('*, vendedores(nome, telefone)').eq('id', profile.cliente_id).single()
        : Promise.resolve({ data: null }),
    ])

    setPedidos(pedRes.data || [])
    setCliente(cliRes.data)
    setVendedor(cliRes.data?.vendedores || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleExpandir(pedidoId: string) {
    if (expandido === pedidoId) { setExpandido(null); return }
    setExpandido(pedidoId)
    if (!itensCache[pedidoId]) {
      const { data } = await supabase.from('pedido_itens')
        .select('quantidade, valor_unitario, valor_total, produtos(nome)').eq('pedido_id', pedidoId)
      setItensCache((c) => ({ ...c, [pedidoId]: data || [] }))
    }
  }

  async function cancelarPedido(p: any) {
    if (!confirm(`Cancelar o pedido #${p.numero_pedido}? Esta ação não pode ser desfeita.`)) return
    setCancelando(p.id)
    const { error } = await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', p.id)
    setCancelando(null)
    if (error) { alert('Erro ao cancelar: ' + error.message); return }
    setPedidos((prev) => prev.map((x) => x.id === p.id ? { ...x, status: 'cancelado' } : x))
  }

  function whatsAppVendedor(p: any) {
    if (!vendedor?.telefone) return
    const nomeLoja = cliente?.nome_loja || cliente?.nome || 'Cliente'
    const msg = `Olá ${vendedor.nome}, sou ${nomeLoja}. Tenho uma dúvida sobre o pedido #${p.numero_pedido} (${formatBRL(p.valor_total)}).`
    window.open(`https://wa.me/55${vendedor.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Meus Pedidos" subtitle="Histórico completo da sua loja" />

      {pedidos.length === 0 ? <EmptyState message="Você ainda não fez nenhum pedido." /> : (
        <div className="space-y-3">
          {pedidos.map((p) => {
            const st = STATUS_PEDIDO.find((s) => s.value === p.status)
            const isOpen = expandido === p.id
            const itens = itensCache[p.id] || []
            const podeCancelar = CANCELAVEIS.includes(p.status)
            return (
              <div key={p.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                <button onClick={() => toggleExpandir(p.id)} className="w-full p-5 text-left hover:bg-gray-50">
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <p className="font-bold text-bendito-verde-escuro">Pedido #{p.numero_pedido}</p>
                      <p className="text-xs text-gray-500">
                        Feito em {formatData(p.created_at)}
                        {p.data_entrega ? ` · Entrega ${formatData(p.data_entrega)}${p.horario_entrega ? ` às ${p.horario_entrega.slice(0, 5)}` : ''}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {st && <StatusBadge label={st.label} cor={st.cor} />}
                      <span className="font-bold text-bendito-verde">{formatBRL(p.valor_total)}</span>
                      {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t bg-bendito-creme/50 p-5 space-y-4">
                    {/* Itens */}
                    {itens.length === 0 ? <p className="text-sm text-gray-500">Carregando itens...</p> : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600 border-b">
                            <th className="py-1">Produto</th>
                            <th className="py-1 text-right">Qtd</th>
                            <th className="py-1 text-right">Unit.</th>
                            <th className="py-1 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itens.map((i: any, idx: number) => (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="py-2">{i.produtos?.nome || '-'}</td>
                              <td className="py-2 text-right">{i.quantidade}</td>
                              <td className="py-2 text-right">{formatBRL(i.valor_unitario)}</td>
                              <td className="py-2 text-right font-semibold">{formatBRL(i.valor_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Resumo financeiro */}
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <p>Subtotal: {formatBRL(p.subtotal)}</p>
                      {Number(p.taxa_entrega) > 0 && <p>Taxa entrega: {formatBRL(p.taxa_entrega)}</p>}
                      {Number(p.desconto) > 0 && <p>Desconto: − {formatBRL(p.desconto)}</p>}
                      {p.forma_pagamento && <p>Pagamento: {p.forma_pagamento}</p>}
                      {p.observacoes && <p>Obs: {p.observacoes}</p>}
                    </div>

                    {/* Ações */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link href={`/cliente/pedido-novo?repetir=${p.id}`}>
                        <PrimaryButton className="flex items-center gap-2 text-sm">
                          <Repeat size={15} /> Repetir pedido
                        </PrimaryButton>
                      </Link>

                      {vendedor?.telefone && (
                        <button
                          onClick={() => whatsAppVendedor(p)}
                          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg transition text-sm"
                        >
                          <MessageCircle size={15} /> Falar com vendedor
                        </button>
                      )}

                      {podeCancelar && (
                        <SecondaryButton
                          onClick={() => cancelarPedido(p)}
                          disabled={cancelando === p.id}
                          className="flex items-center gap-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <XCircle size={15} />
                          {cancelando === p.id ? 'Cancelando...' : 'Cancelar pedido'}
                        </SecondaryButton>
                      )}
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
