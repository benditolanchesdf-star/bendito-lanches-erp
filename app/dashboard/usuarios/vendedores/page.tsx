'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader, Loading, EmptyState, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Eye, EyeOff, Check, X, ArrowLeft } from 'lucide-react'

const PAPEL = 'vendedor'
const TITULO = 'Vendedores'
const DESC = 'Carteira de clientes externos'

export default function VendedoresPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [form, setForm] = useState({ nome: '', email: '', filial_id: '' })

  async function load() {
    setLoading(true)
    const [{ data: us }, { data: fils }] = await Promise.all([
      supabase.from('profiles').select('id, nome, papel, ativo, filial_id, filiais(nome)').eq('papel', PAPEL).order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setUsuarios(us || [])
    setFiliais(fils || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function criarUsuario() {
    if (!form.nome || !form.email) { setErro('Preencha nome e email.'); return }
    setSalvando(true); setErro(''); setSucesso('')
    const { data, error } = await supabase.rpc('criar_usuario_admin', {
      p_email: form.email,
      p_nome: form.nome,
      p_papel: PAPEL,
      p_filial_id: form.filial_id || null,
    })
    if (error) { setErro(error.message); setSalvando(false); return }
    setSucesso(`Usuário criado com sucesso! Senha temporária: Mudar123!`)
    setSalvando(false)
    setForm({ nome: '', email: '', filial_id: '' })
    load()
  }

  async function toggleAtivo(u: any) {
    await supabase.from('profiles').update({ ativo: !u.ativo }).eq('id', u.id)
    load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/usuarios" className="flex items-center gap-1 text-sm text-gray-500 hover:text-bendito-verde transition">
          <ArrowLeft size={16} /> Voltar
        </Link>
      </div>

      <PageHeader title={TITULO} subtitle={DESC}
        action={
          <PrimaryButton onClick={() => { setErro(''); setSucesso(''); setModalOpen(true) }}
            className="flex items-center gap-2">
            <Plus size={16} /> Novo Vendedor
          </PrimaryButton>
        }
      />

      {usuarios.length === 0 ? <EmptyState message={`Nenhum ${TITULO.toLowerCase()} cadastrado.`} /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Nome', 'Filial', 'Status', 'Ações'].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              )}</tr>
            </thead>
            <tbody className="divide-y">
              {usuarios.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-bendito-verde-escuro">{u.nome}</td>
                  <td className="px-4 py-3 text-gray-500">{(u.filiais as any)?.nome || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleAtivo(u)}
                      className={`p-1.5 rounded text-gray-400 ${u.ativo ? 'hover:text-red-500' : 'hover:text-green-600'}`}
                      title={u.ativo ? 'Desativar' : 'Ativar'}>
                      {u.ativo ? <X size={15} /> : <Check size={15} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Novo Vendedor`}>
        <div className="space-y-4">
          <Field label="Nome completo" required>
            <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome completo" />
          </Field>
          <Field label="E-mail" required>
            <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@exemplo.com" />
          </Field>
          <Field label="Filial">
            <select value={form.filial_id} onChange={e => setForm({...form, filial_id: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
              <option value="">Selecione...</option>
              {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Field>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
            🔑 Senha inicial: <strong>Mudar123!</strong> — o usuário deverá alterá-la no primeiro acesso.
          </div>
          {erro && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{erro}</p>}
          {sucesso && <p className="text-xs text-green-700 bg-green-50 p-3 rounded font-semibold">{sucesso}</p>}
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Fechar</SecondaryButton>
            {!sucesso && (
              <PrimaryButton onClick={criarUsuario} disabled={salvando || !form.nome || !form.email} className="flex-1">
                {salvando ? 'Criando...' : 'Criar usuário'}
              </PrimaryButton>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
