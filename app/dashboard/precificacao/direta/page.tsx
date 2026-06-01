'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL } from '@/lib/constants'
import { PricingCalculator } from '@/lib/pricing-calculator'
import { PageHeader, Loading, EmptyState, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Trash2, Edit, CheckCircle, AlertTriangle } from 'lucide-react'

export default function PrecificacaoDiretaPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [produtos, setProdutos] = useState<any[]>([])
  const [taxaCF, setTaxaCF] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ name: '', purchase_price: '', packaging_cost: '0', ideal_markup: '1', tax_rate: '0', card_rate: '0', delivery_rate: '0', applied_price: '' })

  async function load() {
    setLoading(true)
    const [sett, costs, prod] = await Promise.all([
      supabase.from('pricing_settings').select('estimated_monthly_revenue').eq('filial_id', FILIAL_ID).maybeSingle(),
      supabase.from('pricing_fixed_costs').select('amount').eq('filial_id', FILIAL_ID).eq('status', 'active'),
      supabase.from('pricing_direct_products').select('*').eq('filial_id', FILIAL_ID).eq('status', 'active').order('name'),
    ])
    const rev = Number(sett.data?.estimated_monthly_revenue || 0)
    const totalCF = (costs.data || []).reduce((s: number, c: any) => s + Number(c.amount || 0), 0)
    const taxa = rev > 0 ? totalCF / rev : 0
    setTaxaCF(taxa)

    const result = (prod.data || []).map(p => {
      const calc = PricingCalculator.calculate({
        costBase: Number(p.purchase_price || 0), fixedCostRate: taxa,
        packagingCost: Number(p.packaging_cost || 0),
        idealMarkup: Number(p.ideal_markup || 1),
        taxRate: Number(p.tax_rate || 0), cardRate: Number(p.card_rate || 0), deliveryRate: Number(p.delivery_rate || 0),
        appliedPrice: Number(p.applied_price || 0),
      })
      return { ...p, ...calc }
    })
    setProdutos(result); setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() { setEditando(null); setForm({ name: '', purchase_price: '', packaging_cost: '0', ideal_markup: '1', tax_rate: '0', card_rate: '0', delivery_rate: '0', applied_price: '' }); setModalOpen(true) }
  function abrirEdicao(p: any) {
    setEditando(p)
    setForm({ name: p.name, purchase_price: String(p.purchase_price), packaging_cost: String(p.packaging_cost), ideal_markup: String(p.ideal_markup), tax_rate: String(p.tax_rate), card_rate: String(p.card_rate), delivery_rate: String(p.delivery_rate), applied_price: String(p.applied_price) })
    setModalOpen(true)
  }
  async function salvar() {
    if (!form.name.trim() || !form.purchase_price) return
    setSalvando(true)
    const payload = { filial_id: FILIAL_ID, name: form.name.trim(), purchase_price: Number(form.purchase_price), packaging_cost: Number(form.packaging_cost) || 0, ideal_markup: Number(form.ideal_markup) || 1, tax_rate: Number(form.tax_rate) || 0, card_rate: Number(form.card_rate) || 0, delivery_rate: Number(form.delivery_rate) || 0, applied_price: Number(form.applied_price) || 0 }
    if (editando) { await supabase.from('pricing_direct_products').update(payload).eq('id', editando.id) }
    else { await supabase.from('pricing_direct_products').insert(payload) }
    setSalvando(false); setModalOpen(false); load()
  }
  async function excluir(id: string) {
    if (!confirm('Excluir produto?')) return
    await supabase.from('pricing_direct_products').update({ status: 'inactive' }).eq('id', id); load()
  }

  // Preview em tempo real no modal
  const preview = form.purchase_price ? PricingCalculator.calculate({ costBase: Number(form.purchase_price), fixedCostRate: taxaCF, packagingCost: Number(form.packaging_cost) || 0, idealMarkup: Number(form.ideal_markup) || 1, taxRate: Number(form.tax_rate) || 0, cardRate: Number(form.card_rate) || 0, deliveryRate: Number(form.delivery_rate) || 0, appliedPrice: Number(form.applied_price) || 0 }) : null

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Precificação Direta / Revenda" subtitle="Produtos comprados prontos — sem necessidade de ficha técnica"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={16} /> Novo produto</PrimaryButton>} />

      {produtos.length === 0 ? <EmptyState message="Nenhum produto de revenda cadastrado." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{['Produto', 'Compra', 'Custo total', 'Preço sugerido', 'Preço praticado', 'Markup', 'Margem', 'Status', ''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {produtos.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-bendito-verde-escuro">{p.name}</td>
                    <td className="px-4 py-3">{formatBRL(p.purchase_price)}</td>
                    <td className="px-4 py-3 font-semibold">{formatBRL(p.totalCost)}</td>
                    <td className="px-4 py-3 text-blue-600 font-semibold">{formatBRL(p.suggestedPrice)}</td>
                    <td className="px-4 py-3 font-bold text-bendito-verde">{formatBRL(p.applied_price)}</td>
                    <td className="px-4 py-3">{(p.appliedMarkup * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-green-600 font-semibold">{formatBRL(p.contributionMargin)}</td>
                    <td className="px-4 py-3">{p.status === 'Dentro da margem' ? <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle size={11} /> OK</span> : <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><AlertTriangle size={11} /> Ajustar</span>}</td>
                    <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => abrirEdicao(p)} className="p-1.5 text-gray-400 hover:text-bendito-verde rounded"><Edit size={14} /></button><button onClick={() => excluir(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 size={14} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar produto' : 'Novo produto de revenda'}>
        <div className="space-y-4">
          <Field label="Nome do produto" required><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Refrigerante Lata 350ml" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor de compra (R$)" required><Input type="number" step="0.01" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} /></Field>
            <Field label="Embalagem (R$)"><Input type="number" step="0.01" value={form.packaging_cost} onChange={e => setForm({ ...form, packaging_cost: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Markup ideal (1.0 = 100%)"><Input type="number" step="0.01" value={form.ideal_markup} onChange={e => setForm({ ...form, ideal_markup: e.target.value })} /></Field>
            <Field label="Preço praticado (R$)"><Input type="number" step="0.01" value={form.applied_price} onChange={e => setForm({ ...form, applied_price: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Impostos"><Input type="number" step="0.001" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: e.target.value })} /></Field>
            <Field label="Cartão"><Input type="number" step="0.001" value={form.card_rate} onChange={e => setForm({ ...form, card_rate: e.target.value })} /></Field>
            <Field label="Delivery"><Input type="number" step="0.001" value={form.delivery_rate} onChange={e => setForm({ ...form, delivery_rate: e.target.value })} /></Field>
          </div>
          {preview && (
            <div className="bg-bendito-creme rounded-lg p-3 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xs text-gray-500">Custo total</p><p className="font-bold text-sm">{formatBRL(preview.totalCost)}</p></div>
              <div><p className="text-xs text-gray-500">Preço sugerido</p><p className="font-bold text-sm text-blue-600">{formatBRL(preview.suggestedPrice)}</p></div>
              <div><p className="text-xs text-gray-500">Margem</p><p className={`font-bold text-sm ${preview.contributionMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatBRL(preview.contributionMargin)}</p></div>
            </div>
          )}
          <div className="flex gap-3"><SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton><PrimaryButton onClick={salvar} disabled={salvando || !form.name || !form.purchase_price} className="flex-1">{salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar'}</PrimaryButton></div>
        </div>
      </Modal>
    </div>
  )
}
