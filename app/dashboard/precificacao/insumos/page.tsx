'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL } from '@/lib/constants'
import { PricingCalculator } from '@/lib/pricing-calculator'
import { PageHeader, Loading, EmptyState, Field, Input, Select, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Trash2, Edit, Search } from 'lucide-react'

const UNIDADES_COMPRA = ['kg', 'g', 'l', 'ml', 'und', 'pacote', 'caixa', 'dúzia']
const UNIDADES_RECEITA = ['g', 'ml', 'und', 'kg', 'l', 'pacote']

export default function InsumosPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [insumos, setInsumos] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ name: '', purchase_unit: 'kg', purchase_quantity: '', purchase_price: '', recipe_unit: 'g' })

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('pricing_inputs').select('*').eq('filial_id', FILIAL_ID).eq('status', 'active').order('name')
    setInsumos(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() { setEditando(null); setForm({ name: '', purchase_unit: 'kg', purchase_quantity: '', purchase_price: '', recipe_unit: 'g' }); setModalOpen(true) }
  function abrirEdicao(i: any) {
    setEditando(i)
    setForm({ name: i.name, purchase_unit: i.purchase_unit, purchase_quantity: String(i.purchase_quantity), purchase_price: String(i.purchase_price), recipe_unit: i.recipe_unit })
    setModalOpen(true)
  }

  async function salvar() {
    if (!form.name.trim() || !form.purchase_quantity || !form.purchase_price) return
    setSalvando(true)
    const payload = {
      filial_id: FILIAL_ID,
      name: form.name.trim(),
      purchase_unit: form.purchase_unit,
      purchase_quantity: Number(form.purchase_quantity),
      purchase_price: Number(form.purchase_price),
      recipe_unit: form.recipe_unit,
    }
    if (editando) {
      await supabase.from('pricing_inputs').update(payload).eq('id', editando.id)
    } else {
      await supabase.from('pricing_inputs').insert(payload)
    }
    setSalvando(false); setModalOpen(false); load()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este insumo? Verifique se não está em uso em fichas técnicas.')) return
    await supabase.from('pricing_inputs').update({ status: 'inactive' }).eq('id', id)
    load()
  }

  const filtrados = insumos.filter(i => i.name.toLowerCase().includes(busca.toLowerCase()))

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Insumos / Matérias-Primas" subtitle="Banco de insumos com cálculo automático de custo por unidade de receita"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={16} /> Novo insumo</PrimaryButton>} />

      <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-2">
        <Search size={16} className="text-gray-400" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar insumo..." className="flex-1 outline-none text-sm" />
      </div>

      {filtrados.length === 0 ? <EmptyState message={busca ? 'Nenhum insumo encontrado.' : 'Nenhum insumo cadastrado. Clique em "Novo insumo" para começar.'} /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Insumo', 'Compra', 'Qtd / Valor', 'Uni. Receita', 'Custo por un.', 'Ações'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtrados.map(i => {
                  const unitCost = PricingCalculator.inputUnitCost(Number(i.purchase_price), Number(i.purchase_quantity), i.purchase_unit, i.recipe_unit)
                  return (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-bendito-verde-escuro">{i.name}</td>
                      <td className="px-4 py-3 text-gray-500">{i.purchase_unit}</td>
                      <td className="px-4 py-3">{i.purchase_quantity} · {formatBRL(i.purchase_price)}</td>
                      <td className="px-4 py-3 text-gray-500">{i.recipe_unit}</td>
                      <td className="px-4 py-3 font-bold text-bendito-verde">
                        {formatBRL(unitCost)}<span className="text-xs text-gray-400 font-normal">/{i.recipe_unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => abrirEdicao(i)} className="p-1.5 text-gray-400 hover:text-bendito-verde rounded"><Edit size={14} /></button>
                          <button onClick={() => excluir(i.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar insumo' : 'Novo insumo'}>
        <div className="space-y-4">
          <Field label="Nome do insumo" required><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Hambúrguer bovino, Queijo cheddar..." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unidade de compra"><Select value={form.purchase_unit} onChange={e => setForm({ ...form, purchase_unit: e.target.value })}>{UNIDADES_COMPRA.map(u => <option key={u} value={u}>{u}</option>)}</Select></Field>
            <Field label="Quantidade na embalagem" required><Input type="number" step="0.001" value={form.purchase_quantity} onChange={e => setForm({ ...form, purchase_quantity: e.target.value })} placeholder="Ex: 1" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor de compra (R$)" required><Input type="number" step="0.01" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} placeholder="0,00" /></Field>
            <Field label="Unidade na ficha técnica"><Select value={form.recipe_unit} onChange={e => setForm({ ...form, recipe_unit: e.target.value })}>{UNIDADES_RECEITA.map(u => <option key={u} value={u}>{u}</option>)}</Select></Field>
          </div>
          {form.purchase_price && form.purchase_quantity && (
            <div className="bg-bendito-creme rounded-lg p-3 text-sm">
              <p className="text-gray-600">Custo calculado por <strong>{form.recipe_unit}</strong>:</p>
              <p className="text-xl font-bold text-bendito-verde">
                {formatBRL(PricingCalculator.inputUnitCost(Number(form.purchase_price), Number(form.purchase_quantity), form.purchase_unit, form.recipe_unit))}/{form.recipe_unit}
              </p>
            </div>
          )}
          <div className="flex gap-3"><SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton><PrimaryButton onClick={salvar} disabled={salvando || !form.name || !form.purchase_quantity || !form.purchase_price} className="flex-1">{salvando ? 'Salvando...' : editando ? 'Salvar' : 'Adicionar'}</PrimaryButton></div>
        </div>
      </Modal>
    </div>
  )
}
