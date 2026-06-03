'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Edit, RefreshCw, Building2, Check } from 'lucide-react'

export default function AtendentesPDVPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [atendentes, setAtendentes] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalFiliaisOpen, setModalFiliaisOpen] = useState(false)
  const [atendenteSel, setAtendenteSel] = useState<any>(null)
  const [filiaisAtendente, setFiliaisAtendente] = useState<string[]>([])
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvandoFiliais, setSalvandoFiliais] = useState(false)
  const [form, setForm] = useState({ nome: '', filial_id: FILIAL_ID })

  async function load() {
    setLoading(true)
    const [{ data: at }, { data: fils }] = await Promise.all([
      supabase.from('atendentes_pdv').select(`
        *, filiais(nome),
        atendente_filiais(filial_id, ativo, filiais(nome))
      `).order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setAtendentes(at || [])
    setFiliais(fils || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', filial_id: FILIAL_ID })
    setModalOpen(true)
  }

  function abrirEdicao(a: any) {
    setEditando(a)
    setForm({ nome: a.nome, filial_id: a.filial_id })
    setModalOpen(true)
  }

  async function abrirFiliais(a: any) {
    setAtendenteSel(a)
    const ativas = (a.atendente_filiais || [])
      .filter((af: any) => af.ativo)
      .map((af: any) => af.filial_id)
    setFiliaisAtendente(ativas)
    setModalFiliaisOpen(true)
  }

  async function salvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    if (editando) {
      await supabase.from('atendentes_pdv').update({ nome: form.nome }).eq('id', editando.id)
    } else {
      const { data: novoAt } = await supabase.from('atendentes_pdv').insert({
        nome: form.nome, filial_id: form.filial_id,
        senha_pdv: '1234', primeiro_acesso: true, ativo: true,
      }).select('id').single()
      // Vincular à filial selecionada automaticamente
      if (novoAt) {
        await supabase.from('atendente_filiais').insert({
          atendente_id: novoAt.id, filial_id: form.filial_id, ativo: true,
        })
      }
    }
    setSalvando(false); setModalOpen(false); load()
  }

  async function salvarFiliais() {
    if (!atendenteSel) return
    setSalvandoFiliais(true)
    // Remover todas as vinculações existentes
    await supabase.from('atendente_filiais').delete().eq('atendente_id', atendenteSel.id)
    // Recriar com as selecionadas
    if (filiaisAtendente.length > 0) {
      await supabase.from('atendente_filiais').insert(
        filiaisAtendente.map(fid => ({
          atendente_id: atendenteSel.id, filial_id: fid, ativo: true,
        }))
      )
    }
    setSalvandoFiliais(false); setModalFiliaisOpen(false); load()
  }

  function toggleFilial(filialId: string) {
    setFiliaisAtendente(prev =>
      prev.includes(filialId) ? prev.filter(id => id !== filialId) : [...prev, filialId]
    )
  }

  async function resetarSenha(a: any) {
    if (!confirm(`Resetar a senha de ${a.nome} para 1234?`)) return
    await supabase.from('atendentes_pdv').update({ senha_pdv: '1234', primeiro_acesso: true }).eq('id', a.id)
    alert(`Senha de ${a.nome} resetada para 1234.`)
    load()
  }

  async function toggleAtivo(a: any) {
    await supabase.from('atendentes_pdv').update({ ativo: !a.ativo }).eq('id', a.id)
    load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Atendentes PDV"
        subtitle="Gerencie atendentes e defina em quais unidades cada um pode operar"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={16}/> Novo atendente</PrimaryButton>} />

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
        💡 Senha inicial: <strong>1234</strong>. O atendente define sua senha pessoal no primeiro acesso ao PDV.
        Use <strong>Resetar Senha</strong> para enviar de volta para 1234 em caso de esquecimento.
        Use <strong>Unidades</strong> para definir em quais filiais o atendente pode operar.
      </div>

      {atendentes.length === 0 ? <EmptyState message="Nenhum atendente cadastrado." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Nome','Unidades Autorizadas','1º Acesso','Status','Ações'].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              )}</tr>
            </thead>
            <tbody className="divide-y">
              {atendentes.map(a => {
                const filiaisAtivas = (a.atendente_filiais || []).filter((af: any) => af.ativo)
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-bendito-verde-escuro">{a.nome}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {filiaisAtivas.length === 0
                          ? <span className="text-xs text-gray-400 italic">Nenhuma unidade</span>
                          : filiaisAtivas.map((af: any) => (
                            <span key={af.filial_id} className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 flex items-center gap-1">
                              <Building2 size={10}/> {af.filiais?.nome}
                            </span>
                          ))
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.primeiro_acesso ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                        {a.primeiro_acesso ? 'Pendente' : 'Senha definida'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleAtivo(a)}
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {a.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => abrirEdicao(a)} title="Editar nome"
                          className="p-1.5 text-gray-400 hover:text-bendito-verde rounded"><Edit size={14}/></button>
                        <button onClick={() => abrirFiliais(a)} title="Gerenciar unidades"
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Building2 size={14}/></button>
                        <button onClick={() => resetarSenha(a)} title="Resetar senha para 1234"
                          className="p-1.5 text-gray-400 hover:text-orange-500 rounded"><RefreshCw size={14}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal criar/editar atendente */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar atendente' : 'Novo atendente PDV'}>
        <div className="space-y-4">
          <Field label="Nome do atendente" required>
            <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome completo" />
          </Field>
          {!editando && (
            <>
              <Field label="Unidade principal">
                <select value={form.filial_id} onChange={e => setForm({...form, filial_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                  {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </Field>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                🔑 Senha inicial: <strong>1234</strong>. O atendente deverá alterá-la no primeiro acesso.
                Após criar, use o botão <strong>Unidades</strong> para autorizar mais filiais.
              </div>
            </>
          )}
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.nome} className="flex-1">
              {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar atendente'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* Modal gerenciar filiais do atendente */}
      <Modal isOpen={modalFiliaisOpen} onClose={() => setModalFiliaisOpen(false)} title={`Unidades — ${atendenteSel?.nome}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Selecione em quais unidades este atendente pode operar. Ele poderá ser realocado a qualquer momento.
          </p>
          <div className="space-y-2">
            {filiais.map(f => {
              const ativo = filiaisAtendente.includes(f.id)
              return (
                <button key={f.id} onClick={() => toggleFilial(f.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition ${ativo ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-white border-gray-200 text-gray-700 hover:border-bendito-verde'}`}>
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className={ativo ? 'text-white' : 'text-gray-400'}/>
                    <span className="font-medium text-sm">{f.nome}</span>
                  </div>
                  {ativo && <Check size={16} className="text-white"/>}
                </button>
              )
            })}
          </div>
          {filiaisAtendente.length === 0 && (
            <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
              ⚠️ Sem nenhuma unidade selecionada, o atendente não conseguirá fazer login no PDV.
            </p>
          )}
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalFiliaisOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvarFiliais} disabled={salvandoFiliais} className="flex-1">
              {salvandoFiliais ? 'Salvando...' : 'Salvar unidades'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
