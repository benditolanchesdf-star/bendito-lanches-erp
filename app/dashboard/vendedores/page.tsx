'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL } from '@/lib/constants'
import Modal from '@/components/Modal'
import { Field, Input, Textarea, PrimaryButton, SecondaryButton, PageHeader, Loading, EmptyState } from '@/components/ui'
import { Plus, Edit, Trash2 } from 'lucide-react'

export default function VendedoresPage() {
  const supabase = createClient()
  const [vendedores, setVendedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({})

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('vendedores').select('*').order('nome')
    setVendedores(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', cpf: '', telefone: '', email: '', percentual_comissao: 5, meta_mensal: 0, observacoes: '' })
    setModalOpen(true)
  }
  function abrirEdicao(v: any) { setEditando(v); setForm({ ...v }); setModalOpen(true) }

  async function salvar() {
    setSalvando(true)
    const payload = {
      filial_id: FILIAL_ID,
      nome: form.nome,
      cpf: form.cpf,
      telefone: form.telefone,
      email: form.email || null,
      percentual_comissao: Number(form.percentual_comissao) || 0,
      meta_mensal: Number(form.meta_mensal) || 0,
      observacoes: form.observacoes || null,
    }
    let error
    if (editando) ({ error } = await supabase.from('vendedores').update(payload).eq('id', editando.id))
    else ({ error } = await supabase.from('vendedores').insert(payload))
    setSalvando(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    setModalOpen(false); load()
  }

  async function excluir(v: any) {
    if (!confirm(`Excluir o vendedor "${v.nome}"?`)) return
    const { error } = await supabase.from('vendedores').delete().eq('id', v.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    load()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Vendedores" subtitle="Equipe de vendas, comissões e metas"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={20} /> Novo Vendedor</PrimaryButton>} />

      {loading ? <Loading /> : vendedores.length === 0 ? <EmptyState message="Nenhum vendedor cadastrado." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {vendedores.map((v) => (
            <div key={v.id} className="bg-white rounded-xl shadow-md p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-bendito-verde text-white flex items-center justify-center font-bold text-lg">{v.nome.charAt(0)}</div>
                  <div>
                    <h3 className="font-bold text-bendito-verde-escuro">{v.nome}</h3>
                    <p className="text-xs text-gray-500">{v.telefone}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrirEdicao(v)} className="p-2 bg-bendito-dourado/20 hover:bg-bendito-dourado/40 text-bendito-verde-escuro rounded-lg"><Edit size={15} /></button>
                  <button onClick={() => excluir(v)} className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-bendito-creme rounded-lg p-2">
                  <p className="text-gray-500 text-xs">Comissão</p>
                  <p className="font-bold text-bendito-verde-escuro">{Number(v.percentual_comissao)}%</p>
                </div>
                <div className="bg-bendito-creme rounded-lg p-2">
                  <p className="text-gray-500 text-xs">Meta Mensal</p>
                  <p className="font-bold text-bendito-verde-escuro">{formatBRL(v.meta_mensal)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar Vendedor' : 'Novo Vendedor'}>
        <div className="space-y-4">
          <Field label="Nome" required><Input value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="CPF" required><Input value={form.cpf || ''} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></Field>
            <Field label="Telefone" required><Input value={form.telefone || ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
          </div>
          <Field label="E-mail"><Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Comissão (%)"><Input type="number" step="0.1" value={form.percentual_comissao ?? 0} onChange={(e) => setForm({ ...form, percentual_comissao: e.target.value })} /></Field>
            <Field label="Meta Mensal"><Input type="number" step="0.01" value={form.meta_mensal ?? 0} onChange={(e) => setForm({ ...form, meta_mensal: e.target.value })} /></Field>
          </div>
          <Field label="Observações"><Textarea rows={2} value={form.observacoes || ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field>
          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.nome || !form.cpf || !form.telefone} className="flex-1">{salvando ? 'Salvando...' : 'Salvar'}</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
