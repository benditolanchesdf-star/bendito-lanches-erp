'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Edit, RefreshCw, Eye, EyeOff } from 'lucide-react'

export default function AtendentesPDVPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [atendentes, setAtendentes] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [form, setForm] = useState({ nome:'', filial_id: FILIAL_ID })

  async function load() {
    setLoading(true)
    const [{ data: at }, { data: fils }] = await Promise.all([
      supabase.from('atendentes_pdv').select('*, filiais(nome)').order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setAtendentes(at || [])
    setFiliais(fils || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome:'', filial_id: FILIAL_ID })
    setModalOpen(true)
  }

  function abrirEdicao(a: any) {
    setEditando(a)
    setForm({ nome: a.nome, filial_id: a.filial_id })
    setModalOpen(true)
  }

  async function salvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    if (editando) {
      await supabase.from('atendentes_pdv').update({
        nome: form.nome, filial_id: form.filial_id,
      }).eq('id', editando.id)
    } else {
      // Senha inicial padrão 1234, primeiro_acesso = true
      await supabase.from('atendentes_pdv').insert({
        nome: form.nome,
        filial_id: form.filial_id,
        senha_pdv: '1234',
        primeiro_acesso: true,
        ativo: true,
      })
    }
    setSalvando(false); setModalOpen(false); load()
  }

  async function resetarSenha(a: any) {
    if (!confirm(`Resetar a senha de ${a.nome} para 1234?`)) return
    await supabase.from('atendentes_pdv').update({
      senha_pdv: '1234', primeiro_acesso: true,
    }).eq('id', a.id)
    alert(`Senha de ${a.nome} resetada para 1234. No próximo acesso ao PDV será solicitada nova senha.`)
    load()
  }

  async function toggleAtivo(a: any) {
    await supabase.from('atendentes_pdv').update({ ativo: !a.ativo }).eq('id', a.id)
    load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Atendentes PDV" subtitle="Gerencie os atendentes do frente de caixa — senha inicial: 1234"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={16}/> Novo atendente</PrimaryButton>} />

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
        💡 Ao criar um atendente, a senha inicial é <strong>1234</strong>. No primeiro acesso ao PDV, o atendente será obrigado a cadastrar uma senha pessoal.
        Para resetar a senha de qualquer atendente, clique em <strong>Resetar Senha</strong>.
      </div>

      {atendentes.length === 0 ? <EmptyState message="Nenhum atendente cadastrado." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Nome','Filial','Primeiro Acesso','Status','Ações'].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              )}</tr>
            </thead>
            <tbody className="divide-y">
              {atendentes.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-bendito-verde-escuro">{a.nome}</td>
                  <td className="px-4 py-3 text-gray-500">{(a.filiais as any)?.nome}</td>
                  <td className="px-4 py-3">
                    {a.primeiro_acesso
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Pendente</span>
                      : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Senha definida</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleAtivo(a)}
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {a.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => abrirEdicao(a)} title="Editar" className="p-1.5 text-gray-400 hover:text-bendito-verde rounded"><Edit size={14}/></button>
                      <button onClick={() => resetarSenha(a)} title="Resetar senha para 1234" className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><RefreshCw size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar atendente' : 'Novo atendente PDV'}>
        <div className="space-y-4">
          <Field label="Nome do atendente" required>
            <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome completo" />
          </Field>
          <Field label="Filial">
            <select value={form.filial_id} onChange={e => setForm({...form, filial_id: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
              {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Field>
          {!editando && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
              🔑 A senha inicial será <strong>1234</strong>. O atendente deverá alterá-la no primeiro acesso ao PDV.
            </div>
          )}
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.nome} className="flex-1">
              {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar atendente'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
