'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL, formatData } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, Textarea, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Eye, CheckCircle, XCircle, ShoppingBag, Trash2 } from 'lucide-react'

const STATUS: Record<string, { label: string; cor: string }> = {
  pendente:          { label: 'Pendente',           cor: 'bg-yellow-100 text-yellow-700' },
  aprovado_matriz:   { label: 'Aprovado Matriz',     cor: 'bg-blue-100 text-blue-700' },
  aprovado_admin:    { label: 'Aprovado Admin',      cor: 'bg-indigo-100 text-indigo-700' },
  em_compra:         { label: 'Em Compra',           cor: 'bg-purple-100 text-purple-700' },
  concluido:         { label: 'Concluído',           cor: 'bg-green-100 text-green-700' },
  recusado:          { label: 'Recusado',            cor: 'bg-red-100 text-red-700' },
}

type Item = { descricao: string; quantidade: number; unidade: string; valor_unitario_est: number }

export default function PedidosCompraPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMatriz, setIsMatriz] = useState(false)
  const [filialAtual, setFilialAtual] = useState(FILIAL_ID)
  const [modalOpen, setModalOpen] = useState(false)
  const [detalheOpen, setDetalheOpen] = useState(false)
  const [pedidoSel, setPedidoSel] = useState<any>(null)
  const [itensSel, setItensSel] = useState<any[]>([])
  const [historico, setHistorico] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [obsRecusa, setObsRecusa] = useState('')
  const [form, setForm] = useState({
    tipo: 'filial_para_matriz', fornecedor: '', valor_estimado: '', observacoes: '',
  })
  const [itens, setItens] = useState<Item[]>([])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('papel, filial_id').eq('id', user!.id).maybeSingle()
    const admin = profile?.papel === 'admin' || profile?.papel === 'matriz'
    const matriz = profile?.filial_id === FILIAL_ID || admin
    setIsAdmin(admin); setIsMatriz(matriz)

    const [peds, fils] = await Promise.all([
      supabase.from('pedidos_compra')
        .select('*, filiais(nome)')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setPedidos(peds.data || [])
    setFiliais(fils.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function addItem() {
    setItens(prev => [...prev, { descricao: '', quantidade: 1, unidade: 'un', valor_unitario_est: 0 }])
  }

  function updateItem(idx: number, field: string, value: any) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  async function salvar() {
    if (!itens.length || itens.every(i => !i.descricao)) return
    setSalvando(true)
    const valorTotal = itens.reduce((s, i) => s + (i.quantidade * i.valor_unitario_est), 0)
    const { data: ped } = await supabase.from('pedidos_compra').insert({
      filial_id: filialAtual,
      tipo: form.tipo,
      fornecedor: form.fornecedor || null,
      valor_estimado: valorTotal || Number(form.valor_estimado) || null,
      observacoes: form.observacoes || null,
    }).select('id').single()

    if (ped) {
      await supabase.from('pedido_compra_itens').insert(
        itens.filter(i => i.descricao).map(i => ({
          pedido_compra_id: ped.id,
          descricao: i.descricao,
          quantidade: i.quantidade,
          unidade: i.unidade,
          valor_unitario_est: i.valor_unitario_est || null,
        }))
      )
    }
    setSalvando(false); setModalOpen(false)
    setItens([]); setForm({ tipo: 'filial_para_matriz', fornecedor: '', valor_estimado: '', observacoes: '' })
    load()
  }

  async function verDetalhe(p: any) {
    const [{ data: its }, { data: hist }] = await Promise.all([
      supabase.from('pedido_compra_itens').select('*').eq('pedido_compra_id', p.id),
      supabase.from('pedido_compra_historico').select('*').eq('pedido_compra_id', p.id).order('created_at'),
    ])
    setPedidoSel(p); setItensSel(its || []); setHistorico(hist || [])
    setObsRecusa(''); setDetalheOpen(true)
  }

  async function mudarStatus(id: string, status: string, obs?: string) {
    await supabase.from('pedidos_compra').update({
      status,
      ...(status === 'aprovado_matriz' ? { observacao_matriz: obs || null } : {}),
      ...(status === 'aprovado_admin'  ? { observacao_admin: obs || null } : {}),
      ...(status === 'recusado'        ? { observacao_admin: obs || null } : {}),
    }).eq('id', id)
    load()
    const { data } = await supabase.from('pedidos_compra').select('*, filiais(nome)').eq('id', id).maybeSingle()
    if (data) setPedidoSel(data)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos de Compra"
        subtitle="Solicite compras de insumos e produtos — aprovação em cascata"
        action={
          <PrimaryButton onClick={() => { setItens([{ descricao:'',quantidade:1,unidade:'un',valor_unitario_est:0 }]); setModalOpen(true) }}
            className="flex items-center gap-2"><Plus size={16}/> Novo pedido</PrimaryButton>
        } />

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
        📋 <strong>Fluxo:</strong> Filial solicita → Matriz aprova → Admin aprova → Compra realizada
      </div>

      {pedidos.length === 0 ? <EmptyState message="Nenhum pedido de compra ainda." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Nº','Filial','Tipo','Fornecedor','Valor Est.','Status','Data','Ações'].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y">
                {pedidos.map(p => {
                  const st = STATUS[p.status] || STATUS.pendente
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-bendito-verde-escuro">#{p.numero}</td>
                      <td className="px-4 py-3">{p.filiais?.nome}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {p.tipo === 'filial_para_matriz' ? 'Filial→Matriz' : 'Matriz→Admin'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{p.fornecedor || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-bendito-verde">{p.valor_estimado ? formatBRL(p.valor_estimado) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cor}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatData(p.created_at)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => verDetalhe(p)}
                          className="p-1.5 text-gray-400 hover:text-bendito-verde rounded"><Eye size={14}/></button>
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
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Novo Pedido de Compra">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="filial_para_matriz">Filial → Matriz</option>
                {isMatriz && <option value="matriz_para_admin">Matriz → Admin</option>}
              </select>
            </Field>
            {(isAdmin || isMatriz) && filiais.length > 1 && (
              <Field label="Filial solicitante">
                <select value={filialAtual} onChange={e => setFilialAtual(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                  {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </Field>
            )}
          </div>
          <Field label="Fornecedor sugerido (opcional)">
            <Input value={form.fornecedor} onChange={e => setForm({...form, fornecedor: e.target.value})} placeholder="Ex: Atacadão, Distribuidora X..." />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Itens</p>
              <button onClick={addItem} className="text-xs text-bendito-verde font-semibold hover:underline flex items-center gap-1">
                <Plus size={12}/> Adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <input value={it.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)}
                      placeholder="Descrição do item"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min={1} step="0.01" value={it.quantidade}
                      onChange={e => updateItem(idx, 'quantidade', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none text-center" />
                  </div>
                  <div className="col-span-2">
                    <input value={it.unidade} onChange={e => updateItem(idx, 'unidade', e.target.value)}
                      placeholder="un"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none text-center" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" step="0.01" value={it.valor_unitario_est || ''}
                      onChange={e => updateItem(idx, 'valor_unitario_est', Number(e.target.value))}
                      placeholder="R$"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none text-right" />
                  </div>
                  <div className="col-span-1">
                    <button onClick={() => setItens(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600"><Trash2 size={13}/></button>
                  </div>
                </div>
              ))}
              {itens.length > 0 && (
                <div className="flex justify-end pt-1 text-xs font-semibold text-bendito-verde">
                  Total est.: {formatBRL(itens.reduce((s, i) => s + (i.quantidade * i.valor_unitario_est), 0))}
                </div>
              )}
            </div>
          </div>

          <Field label="Observações">
            <Textarea rows={2} value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})}
              placeholder="Urgência, prazo, justificativa..." />
          </Field>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !itens.some(i => i.descricao)} className="flex-1">
              {salvando ? 'Enviando...' : 'Enviar Pedido'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* Modal detalhe */}
      <Modal isOpen={detalheOpen} onClose={() => setDetalheOpen(false)} title={`Pedido de Compra #${pedidoSel?.numero}`}>
        {pedidoSel && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <p>Filial: <strong>{pedidoSel.filiais?.nome}</strong></p>
              <p>Tipo: <strong>{pedidoSel.tipo === 'filial_para_matriz' ? 'Filial→Matriz' : 'Matriz→Admin'}</strong></p>
              <p>Status: <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS[pedidoSel.status]?.cor}`}>{STATUS[pedidoSel.status]?.label}</span></p>
              <p>Data: <strong>{formatData(pedidoSel.created_at)}</strong></p>
              {pedidoSel.fornecedor && <p>Fornecedor: <strong>{pedidoSel.fornecedor}</strong></p>}
              {pedidoSel.valor_estimado && <p>Valor est.: <strong className="text-bendito-verde">{formatBRL(pedidoSel.valor_estimado)}</strong></p>}
            </div>

            {pedidoSel.observacoes && (
              <p className="text-xs bg-yellow-50 border border-yellow-200 p-2 rounded">📝 {pedidoSel.observacoes}</p>
            )}

            {/* Itens */}
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-500 border-b">
                {['Item','Qtd','Un','Valor Est.'].map(h => <th key={h} className="text-left pb-1">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y">
                {itensSel.map(i => (
                  <tr key={i.id}>
                    <td className="py-1.5">{i.descricao}</td>
                    <td className="py-1.5">{i.quantidade}</td>
                    <td className="py-1.5">{i.unidade}</td>
                    <td className="py-1.5">{i.valor_unitario_est ? formatBRL(i.valor_unitario_est) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Histórico */}
            {historico.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Histórico</p>
                <div className="space-y-1">
                  {historico.map(h => (
                    <div key={h.id} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="text-gray-300">{formatData(h.created_at)}</span>
                      <span>{STATUS[h.status_anterior]?.label || h.status_anterior}</span>
                      <span>→</span>
                      <span className={`px-1.5 py-0.5 rounded font-semibold ${STATUS[h.status_novo]?.cor}`}>{STATUS[h.status_novo]?.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ações de aprovação */}
            {isAdmin || isMatriz ? (
              <div className="border-t pt-3 space-y-3">
                {/* Matriz aprova pedidos filial_para_matriz pendentes */}
                {isMatriz && pedidoSel.tipo === 'filial_para_matriz' && pedidoSel.status === 'pendente' && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-600">Aprovação da Matriz:</p>
                    <div className="flex gap-2">
                      <PrimaryButton onClick={() => mudarStatus(pedidoSel.id, 'aprovado_matriz')} className="flex-1 flex items-center justify-center gap-1">
                        <CheckCircle size={14}/> Aprovar
                      </PrimaryButton>
                      <SecondaryButton onClick={() => mudarStatus(pedidoSel.id, 'recusado', obsRecusa)} className="flex-1 text-red-600 flex items-center justify-center gap-1">
                        <XCircle size={14}/> Recusar
                      </SecondaryButton>
                    </div>
                    <input value={obsRecusa} onChange={e => setObsRecusa(e.target.value)}
                      placeholder="Motivo da recusa (opcional)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs outline-none" />
                  </div>
                )}
                {/* Admin aprova matriz_para_admin pendentes */}
                {isAdmin && pedidoSel.tipo === 'matriz_para_admin' && pedidoSel.status === 'pendente' && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-600">Aprovação do Admin:</p>
                    <div className="flex gap-2">
                      <PrimaryButton onClick={() => mudarStatus(pedidoSel.id, 'aprovado_admin')} className="flex-1 flex items-center justify-center gap-1">
                        <CheckCircle size={14}/> Aprovar
                      </PrimaryButton>
                      <SecondaryButton onClick={() => mudarStatus(pedidoSel.id, 'recusado', obsRecusa)} className="flex-1 text-red-600 flex items-center justify-center gap-1">
                        <XCircle size={14}/> Recusar
                      </SecondaryButton>
                    </div>
                    <input value={obsRecusa} onChange={e => setObsRecusa(e.target.value)}
                      placeholder="Motivo (opcional)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs outline-none" />
                  </div>
                )}
                {/* Marcar como em compra / concluído */}
                {isAdmin && ['aprovado_matriz','aprovado_admin'].includes(pedidoSel.status) && (
                  <div className="flex gap-2">
                    <PrimaryButton onClick={() => mudarStatus(pedidoSel.id, 'em_compra')} className="flex-1">
                      🛒 Iniciar Compra
                    </PrimaryButton>
                  </div>
                )}
                {isAdmin && pedidoSel.status === 'em_compra' && (
                  <PrimaryButton onClick={() => mudarStatus(pedidoSel.id, 'concluido')} className="w-full">
                    ✅ Marcar como Concluído
                  </PrimaryButton>
                )}
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  )
}
