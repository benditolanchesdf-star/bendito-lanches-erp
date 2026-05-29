'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL, formatData } from '@/lib/constants'
import Modal from '@/components/Modal'
import { Field, Input, Select, PrimaryButton, SecondaryButton, PageHeader, Loading, EmptyState } from '@/components/ui'
import { Plus, Edit, Trash2, AlertTriangle } from 'lucide-react'

const UNIDADES = ['kg', 'g', 'l', 'ml', 'unidade', 'duzia']

export default function EstoquePage() {
  const supabase = createClient()
  const [insumos, setInsumos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({})

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('insumos').select('*').order('nome')
    setInsumos(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', codigo: '', unidade_medida: 'kg', quantidade_estoque: 0, estoque_minimo: 0, custo_unitario: 0, fornecedor: '', data_validade: '' })
    setModalOpen(true)
  }
  function abrirEdicao(i: any) { setEditando(i); setForm({ ...i, data_validade: i.data_validade || '' }); setModalOpen(true) }

  async function salvar() {
    setSalvando(true)
    const payload = {
      filial_id: FILIAL_ID,
      nome: form.nome,
      codigo: form.codigo || null,
      unidade_medida: form.unidade_medida,
      quantidade_estoque: Number(form.quantidade_estoque) || 0,
      estoque_minimo: Number(form.estoque_minimo) || 0,
      custo_unitario: Number(form.custo_unitario) || 0,
      fornecedor: form.fornecedor || null,
      data_validade: form.data_validade || null,
    }
    let error
    if (editando) ({ error } = await supabase.from('insumos').update(payload).eq('id', editando.id))
    else ({ error } = await supabase.from('insumos').insert(payload))
    setSalvando(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    setModalOpen(false); load()
  }

  async function excluir(i: any) {
    if (!confirm(`Excluir o insumo "${i.nome}"?`)) return
    const { error } = await supabase.from('insumos').delete().eq('id', i.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    load()
  }

  const baixos = insumos.filter((i) => Number(i.quantidade_estoque) <= Number(i.estoque_minimo)).length

  return (
    <div className="space-y-6">
      <PageHeader title="Estoque" subtitle="Controle de insumos"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={20} /> Novo Insumo</PrimaryButton>} />

      {baixos > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-orange-500" size={22} />
          <span className="text-orange-800 text-sm font-medium">{baixos} insumo(s) com estoque no mínimo ou abaixo.</span>
        </div>
      )}

      {loading ? <Loading /> : insumos.length === 0 ? <EmptyState message="Nenhum insumo cadastrado." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bendito-verde-escuro text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm">Insumo</th>
                  <th className="px-4 py-3 text-left text-sm">Estoque</th>
                  <th className="px-4 py-3 text-left text-sm">Mínimo</th>
                  <th className="px-4 py-3 text-left text-sm">Custo Unit.</th>
                  <th className="px-4 py-3 text-left text-sm">Validade</th>
                  <th className="px-4 py-3 text-left text-sm">Fornecedor</th>
                  <th className="px-4 py-3 text-left text-sm">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {insumos.map((i) => {
                  const baixo = Number(i.quantidade_estoque) <= Number(i.estoque_minimo)
                  return (
                    <tr key={i.id} className={`hover:bg-gray-50 ${baixo ? 'bg-red-50/50' : ''}`}>
                      <td className="px-4 py-3 text-sm font-medium">{i.nome}</td>
                      <td className={`px-4 py-3 text-sm font-semibold ${baixo ? 'text-red-600' : 'text-green-600'}`}>{Number(i.quantidade_estoque)} {i.unidade_medida}</td>
                      <td className="px-4 py-3 text-sm">{Number(i.estoque_minimo)} {i.unidade_medida}</td>
                      <td className="px-4 py-3 text-sm">{formatBRL(i.custo_unitario)}</td>
                      <td className="px-4 py-3 text-sm">{formatData(i.data_validade)}</td>
                      <td className="px-4 py-3 text-sm">{i.fornecedor || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => abrirEdicao(i)} className="p-2 bg-bendito-dourado/20 hover:bg-bendito-dourado/40 text-bendito-verde-escuro rounded-lg"><Edit size={15} /></button>
                          <button onClick={() => excluir(i)} className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg"><Trash2 size={15} /></button>
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar Insumo' : 'Novo Insumo'}>
        <div className="space-y-4">
          <Field label="Nome" required><Input value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Código"><Input value={form.codigo || ''} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></Field>
            <Field label="Unidade"><Select value={form.unidade_medida || 'kg'} onChange={(e) => setForm({ ...form, unidade_medida: e.target.value })}>{UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Estoque" required><Input type="number" step="0.001" value={form.quantidade_estoque ?? 0} onChange={(e) => setForm({ ...form, quantidade_estoque: e.target.value })} /></Field>
            <Field label="Mínimo"><Input type="number" step="0.001" value={form.estoque_minimo ?? 0} onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })} /></Field>
            <Field label="Custo Unit."><Input type="number" step="0.01" value={form.custo_unitario ?? 0} onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fornecedor"><Input value={form.fornecedor || ''} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} /></Field>
            <Field label="Validade"><Input type="date" value={form.data_validade || ''} onChange={(e) => setForm({ ...form, data_validade: e.target.value })} /></Field>
          </div>
          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.nome} className="flex-1">{salvando ? 'Salvando...' : 'Salvar'}</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
