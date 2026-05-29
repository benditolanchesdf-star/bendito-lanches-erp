'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID } from '@/lib/constants'
import Modal from '@/components/Modal'
import { Field, Input, PrimaryButton, SecondaryButton, PageHeader, Loading } from '@/components/ui'
import { Plus, Trash2, Building2, User as UserIcon, Tag } from 'lucide-react'

export default function ConfiguracoesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [filial, setFilial] = useState<any>(null)
  const [categorias, setCategorias] = useState<any[]>([])
  const [novaCat, setNovaCat] = useState('')
  const [filialForm, setFilialForm] = useState<any>({})
  const [savingFilial, setSavingFilial] = useState(false)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    const [f, c] = await Promise.all([
      supabase.from('filiais').select('*').eq('id', FILIAL_ID).maybeSingle(),
      supabase.from('categorias').select('*').order('ordem').order('nome'),
    ])
    setFilial(f.data)
    setFilialForm(f.data || {})
    setCategorias(c.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function salvarFilial() {
    setSavingFilial(true)
    const { error } = await supabase.from('filiais').update({
      nome: filialForm.nome,
      cnpj: filialForm.cnpj || null,
      endereco: filialForm.endereco || null,
    }).eq('id', FILIAL_ID)
    setSavingFilial(false)
    if (error) { alert('Erro: ' + error.message); return }
    alert('Dados da filial atualizados.')
    load()
  }

  async function addCategoria() {
    if (!novaCat.trim()) return
    const { error } = await supabase.from('categorias').insert({
      filial_id: FILIAL_ID,
      nome: novaCat.trim(),
      ordem: categorias.length + 1,
    })
    if (error) { alert('Erro: ' + error.message); return }
    setNovaCat(''); load()
  }

  async function excluirCategoria(c: any) {
    if (!confirm(`Excluir categoria "${c.nome}"? (Produtos vinculados ficarão sem categoria)`)) return
    const { error } = await supabase.from('categorias').delete().eq('id', c.id)
    if (error) { alert('Erro: ' + error.message + ' — verifique se há produtos usando esta categoria.'); return }
    load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Filial, usuário e categorias" />

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserIcon className="text-bendito-dourado-escuro" size={22} />
          <h2 className="text-lg font-bold text-bendito-verde-escuro">Usuário Logado</h2>
        </div>
        <div className="bg-bendito-creme rounded-lg p-4">
          <p className="text-sm"><span className="text-gray-600">E-mail:</span> <span className="font-medium">{user?.email}</span></p>
          <p className="text-sm mt-1"><span className="text-gray-600">ID:</span> <span className="font-mono text-xs">{user?.id}</span></p>
        </div>
        <p className="text-xs text-gray-500 mt-3">Para alterar a senha, use o painel do Supabase (Authentication → Users) ou implemente o fluxo de "esqueci minha senha" via Supabase Auth.</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="text-bendito-dourado-escuro" size={22} />
          <h2 className="text-lg font-bold text-bendito-verde-escuro">Dados da Filial</h2>
        </div>
        <div className="space-y-4">
          <Field label="Nome" required><Input value={filialForm.nome || ''} onChange={(e) => setFilialForm({ ...filialForm, nome: e.target.value })} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="CNPJ"><Input value={filialForm.cnpj || ''} onChange={(e) => setFilialForm({ ...filialForm, cnpj: e.target.value })} /></Field>
          </div>
          <Field label="Endereço"><Input value={filialForm.endereco || ''} onChange={(e) => setFilialForm({ ...filialForm, endereco: e.target.value })} /></Field>
          <PrimaryButton onClick={salvarFilial} disabled={savingFilial || !filialForm.nome}>{savingFilial ? 'Salvando...' : 'Salvar Dados'}</PrimaryButton>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="text-bendito-dourado-escuro" size={22} />
          <h2 className="text-lg font-bold text-bendito-verde-escuro">Categorias de Produtos</h2>
        </div>
        <div className="flex gap-2 mb-4">
          <Input value={novaCat} onChange={(e) => setNovaCat(e.target.value)} placeholder="Nome da nova categoria..." onKeyDown={(e) => e.key === 'Enter' && addCategoria()} />
          <PrimaryButton onClick={addCategoria} disabled={!novaCat.trim()} className="flex items-center gap-1"><Plus size={18} /> Adicionar</PrimaryButton>
        </div>
        {categorias.length === 0 ? <p className="text-sm text-gray-500">Nenhuma categoria cadastrada.</p> : (
          <div className="space-y-2">
            {categorias.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-bendito-creme rounded-lg px-4 py-2">
                <span className="font-medium">{c.nome}</span>
                <button onClick={() => excluirCategoria(c)} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
