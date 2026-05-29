'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL, TIPO_CLIENTE } from '@/lib/constants'
import Modal from '@/components/Modal'
import { Field, Input, Select, Textarea, PrimaryButton, SecondaryButton, PageHeader, Loading, EmptyState } from '@/components/ui'
import { Plus, Edit, Trash2, Search } from 'lucide-react'

export default function ClientesPage() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({})

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nome')
    setClientes(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', cpf_cnpj: '', telefone: '', email: '', tipo: 'varejo', cidade: 'Brasília', uf: 'DF', limite_credito: 0, observacoes: '' })
    setModalOpen(true)
  }
  function abrirEdicao(c: any) { setEditando(c); setForm({ ...c }); setModalOpen(true) }

  async function salvar() {
    setSalvando(true)
    const payload = {
      filial_id: FILIAL_ID,
      nome: form.nome,
      cpf_cnpj: form.cpf_cnpj || null,
      telefone: form.telefone,
      email: form.email || null,
      tipo: form.tipo,
      cidade: form.cidade || null,
      uf: form.uf || null,
      limite_credito: Number(form.limite_credito) || 0,
      observacoes: form.observacoes || null,
    }
    let error
    if (editando) ({ error } = await supabase.from('clientes').update(payload).eq('id', editando.id))
    else ({ error } = await supabase.from('clientes').insert(payload))
    setSalvando(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    setModalOpen(false); load()
  }

  async function excluir(c: any) {
    if (!confirm(`Excluir o cliente "${c.nome}"?`)) return
    const { error } = await supabase.from('clientes').delete().eq('id', c.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    load()
  }

  const filtrados = clientes.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.telefone || '').includes(busca))

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" subtitle="CRM de clientes varejo e atacado"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={20} /> Novo Cliente</PrimaryButton>} />

      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-bendito-dourado" />
        </div>
      </div>

      {loading ? <Loading /> : filtrados.length === 0 ? <EmptyState message="Nenhum cliente encontrado." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bendito-verde-escuro text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm">Nome</th>
                  <th className="px-4 py-3 text-left text-sm">Tipo</th>
                  <th className="px-4 py-3 text-left text-sm">Telefone</th>
                  <th className="px-4 py-3 text-left text-sm">Cidade</th>
                  <th className="px-4 py-3 text-left text-sm">Limite Créd.</th>
                  <th className="px-4 py-3 text-left text-sm">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtrados.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{c.nome}</td>
                    <td className="px-4 py-3 text-sm capitalize">{c.tipo}</td>
                    <td className="px-4 py-3 text-sm">{c.telefone}</td>
                    <td className="px-4 py-3 text-sm">{c.cidade || '-'}/{c.uf || '-'}</td>
                    <td className="px-4 py-3 text-sm">{formatBRL(c.limite_credito)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => abrirEdicao(c)} className="p-2 bg-bendito-dourado/20 hover:bg-bendito-dourado/40 text-bendito-verde-escuro rounded-lg"><Edit size={15} /></button>
                        <button onClick={() => excluir(c)} className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar Cliente' : 'Novo Cliente'}>
        <div className="space-y-4">
          <Field label="Nome" required><Input value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="CPF/CNPJ"><Input value={form.cpf_cnpj || ''} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></Field>
            <Field label="Telefone" required><Input value={form.telefone || ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
          </div>
          <Field label="E-mail"><Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Tipo"><Select value={form.tipo || 'varejo'} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{TIPO_CLIENTE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
            <Field label="Cidade"><Input value={form.cidade || ''} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></Field>
            <Field label="UF"><Input maxLength={2} value={form.uf || ''} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></Field>
          </div>
          <Field label="Limite de Crédito"><Input type="number" step="0.01" value={form.limite_credito ?? 0} onChange={(e) => setForm({ ...form, limite_credito: e.target.value })} /></Field>
          <Field label="Observações"><Textarea rows={2} value={form.observacoes || ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field>
          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.nome || !form.telefone} className="flex-1">{salvando ? 'Salvando...' : 'Salvar'}</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
