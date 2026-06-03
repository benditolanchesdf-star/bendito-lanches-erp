'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatData, formatBRL } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, Textarea, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Trash2, Eye, CheckCircle, XCircle, Send, Package } from 'lucide-react'

const STATUS: Record<string, { label: string; cor: string }> = {
  pendente:   { label: 'Pendente',   cor: 'bg-yellow-100 text-yellow-700' },
  aprovado:   { label: 'Aprovado',   cor: 'bg-blue-100 text-blue-700' },
  separando:  { label: 'Separando',  cor: 'bg-purple-100 text-purple-700' },
  enviado:    { label: 'Enviado',    cor: 'bg-orange-100 text-orange-700' },
  recebido:   { label: 'Recebido',   cor: 'bg-green-100 text-green-700' },
  cancelado:  { label: 'Cancelado',  cor: 'bg-red-100 text-red-700' },
}

export default function PedidosInternosPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [produtos, setProdutos] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [filialAtual, setFilialAtual] = useState<string>(FILIAL_ID)
  const [modalOpen, setModalOpen] = useState(false)
  const [detalheOpen, setDetalheOpen] = useState(false)
  const [pedidoDetalhe, setPedidoDetalhe] = useState<any>(null)
  const [itensDetalhe, setItensDetalhe] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [obs, setObs] = useState('')
  const [itens, setItens] = useState<{ produto_id: string; nome: string; quantidade: number; unidade: string }[]>([])
  const [prodSel, setProdSel] = useState('')
  const [qtdSel, setQtdSel] = useState(1)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('papel').eq('id', user!.id).maybeSingle()
    const admin = profile?.papel === 'admin' || profile?.papel === 'matriz'
    setIsAdmin(admin)

    const [peds, prods, fils] = await Promise.all([
      supabase.from('pedidos_internos')
        .select('*, filiais_origem:filial_origem(nome), filiais_destino:filial_destino(nome)')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('produtos').select('id, nome, unidade').eq('ativo', true).order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setPedidos(peds.data || [])
    setProdutos(prods.data || [])
    setFiliais(fils.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function addItem() {
    if (!prodSel) return
    const p = produtos.find(x => x.id === prodSel)
    if (!p) return
    setItens(prev => [...prev.filter(i => i.produto_id !== prodSel), {
      produto_id: prodSel, nome: p.nome, quantidade: qtdSel, unidade: p.unidade || 'un'
    }])
    setProdSel(''); setQtdSel(1)
  }

  async function salvar() {
    if (itens.length === 0) return
    setSalvando(true)
    const matrizId = FILIAL_ID
    const { data: pedido } = await supabase.from('pedidos_internos').insert({
      filial_origem: filialAtual,
      filial_destino: matrizId,
      observacoes: obs || null,
    }).select('id').single()

    if (pedido) {
      await supabase.from('pedido_interno_itens').insert(
        itens.map(i => ({
          pedido_interno_id: pedido.id,
          produto_id: i.produto_id,
          quantidade_pedida: i.quantidade,
          unidade: i.unidade,
        }))
      )
    }
    setSalvando(false); setModalOpen(false); setItens([]); setObs(''); load()
  }

  async function verDetalhe(p: any) {
    const { data } = await supabase.from('pedido_interno_itens')
      .select('*, produtos(nome)').eq('pedido_interno_id', p.id)
    setPedidoDetalhe(p); setItensDetalhe(data || []); setDetalheOpen(true)
  }

  async function mudarStatus(id: string, status: string, obsMatriz?: string) {
    await supabase.from('pedidos_internos').update({ status, observacao_matriz: obsMatriz || null }).eq('id', id)
    load()
    if (detalheOpen) {
      const { data } = await supabase.from('pedidos_internos')
        .select('*, filiais_origem:filial_origem(nome), filiais_destino:filial_destino(nome)').eq('id', id).maybeSingle()
      setPedidoDetalhe(data)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos Internos"
        subtitle="Solicitações de produtos da Filial para a Matriz"
        action={
          <PrimaryButton onClick={() => { setItens([]); setObs(''); setModalOpen(true) }} className="flex items-center gap-2">
            <Plus size={16} /> Novo Pedido Interno
          </PrimaryButton>
        }
      />

      {pedidos.length === 0 ? <EmptyState message="Nenhum pedido interno ainda." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Nº', 'Filial', 'Destino', 'Data', 'Status', 'Ações'].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y">
                {pedidos.map(p => {
                  const st = STATUS[p.status] || STATUS.pendente
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-bendito-verde-escuro">#{p.numero}</td>
                      <td className="px-4 py-3">{p.filiais_origem?.nome}</td>
                      <td className="px-4 py-3 text-gray-500">{p.filiais_destino?.nome}</td>
                      <td className="px-4 py-3 text-gray-500">{formatData(p.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cor}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => verDetalhe(p)} className="p-1.5 text-gray-400 hover:text-bendito-verde rounded" title="Ver"><Eye size={14} /></button>
                          {isAdmin && p.status === 'pendente' && <>
                            <button onClick={() => mudarStatus(p.id, 'aprovado')} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Aprovar"><CheckCircle size={14} /></button>
                            <button onClick={() => mudarStatus(p.id, 'cancelado')} className="p-1.5 text-gray-400 hover:text-red-500 rounded" title="Cancelar"><XCircle size={14} /></button>
                          </>}
                          {isAdmin && p.status === 'aprovado' && (
                            <button onClick={() => mudarStatus(p.id, 'separando')} className="p-1.5 text-gray-400 hover:text-purple-600 rounded" title="Separando"><Package size={14} /></button>
                          )}
                          {isAdmin && p.status === 'separando' && (
                            <button onClick={() => mudarStatus(p.id, 'enviado')} className="p-1.5 text-gray-400 hover:text-orange-500 rounded" title="Enviar"><Send size={14} /></button>
                          )}
                          {!isAdmin && p.status === 'enviado' && (
                            <button onClick={() => mudarStatus(p.id, 'recebido')} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Confirmar recebimento"><CheckCircle size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal novo pedido */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Novo Pedido Interno">
        <div className="space-y-4">
          {isAdmin && filiais.length > 1 && (
            <Field label="Filial solicitante">
              <select value={filialAtual} onChange={e => setFilialAtual(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </Field>
          )}

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Produtos solicitados</p>
            <div className="flex gap-2 mb-3">
              <select value={prodSel} onChange={e => setProdSel(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="">Selecione um produto...</option>
                {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <input type="number" min={1} value={qtdSel} onChange={e => setQtdSel(Number(e.target.value))}
                className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none" />
              <SecondaryButton onClick={addItem}>Add</SecondaryButton>
            </div>
            {itens.length === 0
              ? <p className="text-xs text-gray-400">Nenhum item adicionado.</p>
              : <div className="space-y-1">
                {itens.map(i => (
                  <div key={i.produto_id} className="flex justify-between items-center bg-bendito-creme rounded px-3 py-2 text-sm">
                    <span>{i.nome}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{i.quantidade} {i.unidade}</span>
                      <button onClick={() => setItens(prev => prev.filter(x => x.produto_id !== i.produto_id))}
                        className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>

          <Field label="Observações">
            <Textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder="Urgência, prazo, observações..." />
          </Field>

          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || itens.length === 0} className="flex-1">
              {salvando ? 'Enviando...' : 'Enviar Pedido'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* Modal detalhe */}
      <Modal isOpen={detalheOpen} onClose={() => setDetalheOpen(false)} title={`Pedido Interno #${pedidoDetalhe?.numero}`}>
        {pedidoDetalhe && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <p>De: <strong>{pedidoDetalhe.filiais_origem?.nome}</strong></p>
              <p>Para: <strong>{pedidoDetalhe.filiais_destino?.nome}</strong></p>
              <p>Data: <strong>{formatData(pedidoDetalhe.created_at)}</strong></p>
              <p>Status: <strong>{STATUS[pedidoDetalhe.status]?.label}</strong></p>
            </div>
            {pedidoDetalhe.observacoes && (
              <p className="text-xs bg-yellow-50 border border-yellow-200 p-2 rounded">Obs: {pedidoDetalhe.observacoes}</p>
            )}
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-500 border-b">
                {['Produto', 'Pedido', 'Enviado'].map(h => <th key={h} className="text-left pb-1">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y">
                {itensDetalhe.map(i => (
                  <tr key={i.id}>
                    <td className="py-2">{i.produtos?.nome}</td>
                    <td className="py-2">{i.quantidade_pedida} {i.unidade}</td>
                    <td className="py-2 text-green-600">{i.quantidade_enviada ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {isAdmin && ['pendente','aprovado','separando'].includes(pedidoDetalhe.status) && (
              <div className="flex gap-2 pt-2 border-t flex-wrap">
                {pedidoDetalhe.status === 'pendente' && <>
                  <PrimaryButton onClick={() => mudarStatus(pedidoDetalhe.id, 'aprovado')} className="flex-1">✅ Aprovar</PrimaryButton>
                  <SecondaryButton onClick={() => mudarStatus(pedidoDetalhe.id, 'cancelado')} className="flex-1 text-red-600">❌ Cancelar</SecondaryButton>
                </>}
                {pedidoDetalhe.status === 'aprovado' && (
                  <PrimaryButton onClick={() => mudarStatus(pedidoDetalhe.id, 'separando')} className="flex-1">📦 Iniciar Separação</PrimaryButton>
                )}
                {pedidoDetalhe.status === 'separando' && (
                  <PrimaryButton onClick={() => mudarStatus(pedidoDetalhe.id, 'enviado')} className="flex-1">🚚 Marcar como Enviado</PrimaryButton>
                )}
              </div>
            )}
            {!isAdmin && pedidoDetalhe.status === 'enviado' && (
              <PrimaryButton onClick={() => { mudarStatus(pedidoDetalhe.id, 'recebido'); setDetalheOpen(false) }} className="w-full">
                ✅ Confirmar Recebimento
              </PrimaryButton>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
