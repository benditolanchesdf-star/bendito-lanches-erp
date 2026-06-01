'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL, formatData } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, Textarea, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Trash2, Eye, FileText, CheckCircle, XCircle } from 'lucide-react'

type Item = { description: string; quantity: number; unit_price: number; product_id?: string; direct_product_id?: string }

export default function OrcamentosPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [orcamentos, setOrcamentos] = useState<any[]>([])
  const [produtos, setProdutos] = useState<any[]>([])
  const [diretos, setDiretos] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [detalheOpen, setDetalheOpen] = useState(false)
  const [orcamentoDetalhe, setOrcamentoDetalhe] = useState<any>(null)
  const [itensDetalhe, setItensDetalhe] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ client_name: '', client_phone: '', client_address: '', issue_date: new Date().toISOString().split('T')[0], delivery_date: '', observations: '' })
  const [itens, setItens] = useState<Item[]>([])

  async function load() {
    setLoading(true)
    const [orcRes, prodRes, dirRes] = await Promise.all([
      supabase.from('pricing_budgets').select('*').eq('filial_id', FILIAL_ID).order('created_at', { ascending: false }).limit(50),
      supabase.from('pricing_products').select('id, name, applied_price').eq('filial_id', FILIAL_ID).eq('status', 'active').order('name'),
      supabase.from('pricing_direct_products').select('id, name, applied_price').eq('filial_id', FILIAL_ID).eq('status', 'active').order('name'),
    ])
    setOrcamentos(orcRes.data || [])
    setProdutos(prodRes.data || [])
    setDiretos(dirRes.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function addItem() { setItens(prev => [...prev, { description: '', quantity: 1, unit_price: 0 }]) }

  function updateItem(idx: number, field: string, value: string | number) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function selecionarProduto(idx: number, produtoStr: string) {
    if (!produtoStr) return
    const [tipo, id] = produtoStr.split(':')
    const lista = tipo === 'p' ? produtos : diretos
    const p = lista.find((x: any) => x.id === id)
    if (!p) return
    setItens(prev => prev.map((it, i) => i === idx ? {
      ...it, description: p.name, unit_price: Number(p.applied_price || 0),
      product_id: tipo === 'p' ? id : undefined,
      direct_product_id: tipo === 'd' ? id : undefined,
    } : it))
  }

  function removerItem(idx: number) { setItens(prev => prev.filter((_, i) => i !== idx)) }

  const totalOrcamento = itens.reduce((s, i) => s + (i.quantity * i.unit_price), 0)

  async function salvar() {
    if (!form.client_name.trim() || itens.length === 0) return
    setSalvando(true)
    const { data: orc } = await supabase.from('pricing_budgets').insert({
      filial_id: FILIAL_ID,
      client_name: form.client_name,
      client_phone: form.client_phone || null,
      client_address: form.client_address || null,
      issue_date: form.issue_date,
      delivery_date: form.delivery_date || null,
      observations: form.observations || null,
      total_amount: totalOrcamento,
    }).select('id').single()

    if (orc) {
      await supabase.from('pricing_budget_items').insert(
        itens.filter(i => i.description).map(i => ({
          budget_id: orc.id,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total_price: i.quantity * i.unit_price,
          product_id: i.product_id || null,
          direct_product_id: i.direct_product_id || null,
        }))
      )
    }
    setSalvando(false); setModalOpen(false)
    setForm({ client_name: '', client_phone: '', client_address: '', issue_date: new Date().toISOString().split('T')[0], delivery_date: '', observations: '' })
    setItens([])
    load()
  }

  async function verDetalhe(orc: any) {
    const { data } = await supabase.from('pricing_budget_items').select('*').eq('budget_id', orc.id)
    setOrcamentoDetalhe(orc)
    setItensDetalhe(data || [])
    setDetalheOpen(true)
  }

  async function mudarStatus(id: string, status: string) {
    await supabase.from('pricing_budgets').update({ status }).eq('id', id)
    load()
  }

  const statusLabel: Record<string, { label: string; cor: string }> = {
    pending:   { label: 'Pendente',  cor: 'bg-yellow-100 text-yellow-700' },
    approved:  { label: 'Aprovado',  cor: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelado', cor: 'bg-red-100 text-red-700' },
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Orçamentos" subtitle="Crie propostas comerciais com os preços dos produtos cadastrados"
        action={<PrimaryButton onClick={() => { setForm({ client_name: '', client_phone: '', client_address: '', issue_date: new Date().toISOString().split('T')[0], delivery_date: '', observations: '' }); setItens([]); setModalOpen(true) }} className="flex items-center gap-2"><Plus size={16} /> Novo orçamento</PrimaryButton>} />

      {orcamentos.length === 0 ? <EmptyState message="Nenhum orçamento emitido ainda." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{['Cliente', 'Emissão', 'Entrega', 'Total', 'Status', 'Ações'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {orcamentos.map(o => {
                const st = statusLabel[o.status] || statusLabel['pending']
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-bendito-verde-escuro">{o.client_name}</td>
                    <td className="px-4 py-3 text-gray-500">{formatData(o.issue_date)}</td>
                    <td className="px-4 py-3 text-gray-500">{o.delivery_date ? formatData(o.delivery_date) : '—'}</td>
                    <td className="px-4 py-3 font-bold text-bendito-verde">{formatBRL(o.total_amount)}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cor}`}>{st.label}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => verDetalhe(o)} className="p-1.5 text-gray-400 hover:text-bendito-verde rounded" title="Ver detalhes"><Eye size={14} /></button>
                        {o.status === 'pending' && <>
                          <button onClick={() => mudarStatus(o.id, 'approved')} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Aprovar"><CheckCircle size={14} /></button>
                          <button onClick={() => mudarStatus(o.id, 'cancelled')} className="p-1.5 text-gray-400 hover:text-red-500 rounded" title="Cancelar"><XCircle size={14} /></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal novo orçamento */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Novo orçamento">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente" required><Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} /></Field>
            <Field label="Telefone"><Input value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })} /></Field>
          </div>
          <Field label="Endereço"><Input value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data emissão"><Input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} /></Field>
            <Field label="Data entrega"><Input type="date" value={form.delivery_date} onChange={e => setForm({ ...form, delivery_date: e.target.value })} /></Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Itens do orçamento</p>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-bendito-verde font-semibold hover:underline"><Plus size={13} /> Adicionar item</button>
            </div>
            {itens.length === 0 ? <p className="text-xs text-gray-400 py-2">Clique em "Adicionar item" para começar.</p> : (
              <div className="space-y-2">
                {itens.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <select onChange={e => selecionarProduto(idx, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-bendito-dourado mb-1">
                        <option value="">Selecionar produto...</option>
                        <optgroup label="Ficha Técnica">{produtos.map((p: any) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}</optgroup>
                        <optgroup label="Revenda">{diretos.map((p: any) => <option key={p.id} value={`d:${p.id}`}>{p.name}</option>)}</optgroup>
                      </select>
                      <input value={it.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Descrição" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none" />
                    </div>
                    <div className="col-span-2"><input type="number" step="0.01" value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} placeholder="Qtd" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none" /></div>
                    <div className="col-span-3"><input type="number" step="0.01" value={it.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} placeholder="Valor unit." className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none" /></div>
                    <div className="col-span-1 text-xs font-semibold text-bendito-verde">{formatBRL(it.quantity * it.unit_price)}</div>
                    <div className="col-span-1"><button onClick={() => removerItem(idx)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={13} /></button></div>
                  </div>
                ))}
                <div className="flex justify-end pt-2 border-t">
                  <span className="font-bold text-bendito-verde">{formatBRL(totalOrcamento)}</span>
                </div>
              </div>
            )}
          </div>

          <Field label="Observações"><Textarea rows={2} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} /></Field>
          <div className="flex gap-3"><SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton><PrimaryButton onClick={salvar} disabled={salvando || !form.client_name || itens.length === 0} className="flex-1">{salvando ? 'Salvando...' : 'Salvar orçamento'}</PrimaryButton></div>
        </div>
      </Modal>

      {/* Modal detalhe */}
      <Modal isOpen={detalheOpen} onClose={() => setDetalheOpen(false)} title={`Orçamento — ${orcamentoDetalhe?.client_name}`}>
        {orcamentoDetalhe && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <p>Emissão: <strong>{formatData(orcamentoDetalhe.issue_date)}</strong></p>
              {orcamentoDetalhe.delivery_date && <p>Entrega: <strong>{formatData(orcamentoDetalhe.delivery_date)}</strong></p>}
              {orcamentoDetalhe.client_phone && <p>Tel: <strong>{orcamentoDetalhe.client_phone}</strong></p>}
              {orcamentoDetalhe.client_address && <p>End: <strong>{orcamentoDetalhe.client_address}</strong></p>}
            </div>
            <table className="w-full">
              <thead><tr className="text-xs text-gray-500 border-b">{['Item', 'Qtd', 'Unit.', 'Total'].map(h => <th key={h} className="text-left pb-1">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {itensDetalhe.map((i: any) => (
                  <tr key={i.id}><td className="py-1.5">{i.description}</td><td>{i.quantity}</td><td>{formatBRL(i.unit_price)}</td><td className="font-bold text-bendito-verde">{formatBRL(i.total_price)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t font-bold"><td colSpan={3} className="pt-2 text-right">Total:</td><td className="pt-2 text-bendito-verde text-base">{formatBRL(orcamentoDetalhe.total_amount)}</td></tr></tfoot>
            </table>
            {orcamentoDetalhe.observations && <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">Obs: {orcamentoDetalhe.observations}</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
