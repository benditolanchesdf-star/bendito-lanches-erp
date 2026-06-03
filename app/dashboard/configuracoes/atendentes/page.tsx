'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Trash2, Edit, Eye, EyeOff } from 'lucide-react'

export default function AtendentesPDVPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [atendentes, setAtendentes] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [form, setForm] = useState({ nome: '', senha_pdv: '', filial_id: FILIAL_ID })

  async function load() {
    setLoading(true)
    const [at, fil] = await Promise.all([
      supabase.from('atendentes_pdv').select('*, filiais(nome)').order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setAtendentes(at.data || [])
    setFiliais(fil.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', senha_pdv: '', filial_id: FILIAL_ID })
    setModalOpen(true)
  }

  function abrirEdicao(a: any) {
    setEditando(a)
    setForm({ nome: a.nome, senha_pdv: a.senha_pdv, filial_id: a.filial_id })
    setModalOpen(true)
  }

  async function salvar() {
    if (!form.nome.trim() || !form.senha_pdv.trim()) return
    setSalvando(true)
    if (editando) {
      await supabase.from('atendentes_pdv').update(form).eq('id', editando.id)
    } else {
      await supabase.from('atendentes_pdv').insert({ ...form, ativo: true })
    }
    setSalvando(false); setModalOpen(false); load()
  }

  async function toggleAtivo(a: any) {
    await supabase.from('atendentes_pdv').update({ ativo: !a.ativo }).eq('id', a.id)
    load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Atendentes PDV" subtitle="Gerencie os atendentes do frente de caixa"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={16} /> Novo atendente</PrimaryButton>} />

      {atendentes.length === 0 ? <EmptyState message="Nenhum atendente cadastrado." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Nome', 'Filial', 'Senha PDV', 'Status', 'Ações'].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              )}</tr>
            </thead>
            <tbody className="divide-y">
              {atendentes.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-bendito-verde-escuro">{a.nome}</td>
                  <td className="px-4 py-3 text-gray-500">{a.filiais?.nome}</td>
                  <td className="px-4 py-3 font-mono text-gray-400">{'•'.repeat(a.senha_pdv?.length || 4)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {a.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => abrirEdicao(a)} className="p-1.5 text-gray-400 hover:text-bendito-verde rounded"><Edit size={14} /></button>
                      <button onClick={() => toggleAtivo(a)} className={`p-1.5 rounded ${a.ativo ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-green-600'}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar atendente' : 'Novo atendente'}>
        <div className="space-y-4">
          <Field label="Nome" required><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome do atendente" /></Field>
          <Field label="Filial">
            <select value={form.filial_id} onChange={e => setForm({ ...form, filial_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
              {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Field>
          <Field label="Senha PDV (4-6 dígitos)" required>
            <div className="relative">
              <Input type={showSenha ? 'text' : 'password'} value={form.senha_pdv}
                onChange={e => setForm({ ...form, senha_pdv: e.target.value })} placeholder="1234" maxLength={6} />
              <button type="button" onClick={() => setShowSenha(!showSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.nome || !form.senha_pdv} className="flex-1">
              {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
