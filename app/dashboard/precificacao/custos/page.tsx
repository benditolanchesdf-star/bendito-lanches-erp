'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, Select, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Trash2, Edit, Save } from 'lucide-react'

const CATEGORIAS = ['Despesas Fixas', 'Pessoas', 'Marketing', 'Outros']

export default function CustosPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [custos, setCustos] = useState<any[]>([])
  const [faturamento, setFaturamento] = useState('')
  const [salvandoFat, setSalvandoFat] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ description: '', amount: '', category: 'Despesas Fixas' })

  async function load() {
    setLoading(true)
    const [sett, costs] = await Promise.all([
      supabase.from('pricing_settings').select('estimated_monthly_revenue').eq('filial_id', FILIAL_ID).maybeSingle(),
      supabase.from('pricing_fixed_costs').select('*').eq('filial_id', FILIAL_ID).eq('status', 'active').order('category').order('description'),
    ])
    setFaturamento(String(sett.data?.estimated_monthly_revenue || ''))
    setCustos(costs.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const total = custos.reduce((s, c) => s + Number(c.amount || 0), 0)
  const taxa = Number(faturamento) > 0 ? (total / Number(faturamento) * 100).toFixed(2) : '—'

  async function salvarFaturamento() {
    setSalvandoFat(true)
    await supabase.from('pricing_settings').upsert(
      { filial_id: FILIAL_ID, estimated_monthly_revenue: Number(faturamento) || 0 },
      { onConflict: 'filial_id' }
    )
    setSalvandoFat(false)
  }

  function abrirNovo() { setEditando(null); setForm({ description: '', amount: '', category: 'Despesas Fixas' }); setModalOpen(true) }
  function abrirEdicao(c: any) { setEditando(c); setForm({ description: c.description, amount: String(c.amount), category: c.category }); setModalOpen(true) }

  async function salvar() {
    if (!form.description.trim() || !form.amount) return
    setSalvando(true)
    if (editando) {
      await supabase.from('pricing_fixed_costs').update({ description: form.description, amount: Number(form.amount), category: form.category }).eq('id', editando.id)
    } else {
      await supabase.from('pricing_fixed_costs').insert({ filial_id: FILIAL_ID, description: form.description, amount: Number(form.amount), category: form.category })
    }
    setSalvando(false); setModalOpen(false); load()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este custo?')) return
    await supabase.from('pricing_fixed_costs').update({ status: 'inactive' }).eq('id', id)
    load()
  }

  if (loading) return <Loading />

  // Agrupar por categoria
  const grupos = CATEGORIAS.map(cat => ({ cat, itens: custos.filter(c => c.category === cat) })).filter(g => g.itens.length > 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Custos Fixos" subtitle="Mapeie suas despesas mensais fixas para calcular a taxa de rateio"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={16} /> Adicionar custo</PrimaryButton>} />

      {/* Faturamento estimado */}
      <div className="bg-white rounded-xl shadow-md p-5">
        <h2 className="font-bold text-bendito-verde-escuro mb-4">Faturamento Médio Estimado</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
          <Field label="Faturamento mensal estimado (R$)">
            <Input type="number" step="0.01" value={faturamento} onChange={e => setFaturamento(e.target.value)} placeholder="Ex: 20000" />
          </Field>
          </div>
          <PrimaryButton onClick={salvarFaturamento} disabled={salvandoFat} className="flex items-center gap-2 mb-0.5">
            <Save size={15} /> {salvandoFat ? 'Salvando...' : 'Salvar'}
          </PrimaryButton>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-bendito-creme rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Total custos fixos</p>
            <p className="text-xl font-bold text-red-600">{formatBRL(total)}</p>
          </div>
          <div className="bg-bendito-creme rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Faturamento estimado</p>
            <p className="text-xl font-bold text-bendito-verde">{formatBRL(Number(faturamento) || 0)}</p>
          </div>
          <div className="bg-bendito-creme rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Taxa de custo fixo</p>
            <p className="text-xl font-bold text-orange-600">{taxa}%</p>
          </div>
        </div>
      </div>

      {custos.length === 0 ? <EmptyState message="Nenhum custo fixo cadastrado. Clique em 'Adicionar custo' para começar." /> : (
        <div className="space-y-4">
          {grupos.map(({ cat, itens }) => {
            const subtotal = itens.reduce((s, i) => s + Number(i.amount || 0), 0)
            return (
              <div key={cat} className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="flex justify-between items-center px-5 py-3 bg-gray-50 border-b">
                  <span className="font-bold text-bendito-verde-escuro">{cat}</span>
                  <span className="text-sm font-semibold text-gray-600">{formatBRL(subtotal)}</span>
                </div>
                <div className="divide-y">
                  {itens.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm text-gray-700">{c.description}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">{formatBRL(c.amount)}</span>
                        <button onClick={() => abrirEdicao(c)} className="p-1.5 text-gray-400 hover:text-bendito-verde rounded"><Edit size={14} /></button>
                        <button onClick={() => excluir(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          <div className="bg-bendito-verde text-white rounded-xl px-5 py-4 flex justify-between items-center">
            <span className="font-bold">TOTAL DE CUSTOS FIXOS</span>
            <span className="text-xl font-bold">{formatBRL(total)}</span>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar custo' : 'Novo custo fixo'}>
        <div className="space-y-4">
          <Field label="Descrição" required><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex: Aluguel, Energia, Pró-labore..." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)" required><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0,00" /></Field>
            <Field label="Categoria"><Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}</Select></Field>
          </div>
          <div className="flex gap-3"><SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton><PrimaryButton onClick={salvar} disabled={salvando || !form.description || !form.amount} className="flex-1">{salvando ? 'Salvando...' : editando ? 'Salvar' : 'Adicionar'}</PrimaryButton></div>
        </div>
      </Modal>
    </div>
  )
}
