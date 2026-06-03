'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader, Loading, EmptyState, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Shield, Eye, EyeOff, RefreshCw, Check } from 'lucide-react'

const PAPEIS = ['admin','gerente','vendedor','cliente','atendente_pdv'] as const
const PERMISSOES = ['pdv','compras','financeiro','relatorios','estoque'] as const
const PAPEL_LABEL: Record<string,string> = {
  admin:'Administrador', gerente:'Gerente', vendedor:'Vendedor',
  cliente:'Cliente', atendente_pdv:'Atendente PDV',
}
const PERM_LABEL: Record<string,string> = {
  pdv:'PDV / Caixa', compras:'Compras', financeiro:'Financeiro',
  relatorios:'Relatórios', estoque:'Estoque',
}
const PAPEL_COR: Record<string,string> = {
  admin:'bg-red-100 text-red-700', gerente:'bg-purple-100 text-purple-700',
  vendedor:'bg-blue-100 text-blue-700', cliente:'bg-green-100 text-green-700',
  atendente_pdv:'bg-orange-100 text-orange-700',
}

export default function UsuariosPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalPermOpen, setModalPermOpen] = useState(false)
  const [usuarioSel, setUsuarioSel] = useState<any>(null)
  const [papeisSel, setPapeisSel] = useState<any[]>([])
  const [permissoesSel, setPermissoesSel] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ nome:'', email:'', senha:'', papel:'vendedor', filial_id:'' })

  async function load() {
    setLoading(true)
    const [{ data: us }, { data: fils }] = await Promise.all([
      supabase.from('profiles').select(`
        id, nome, papel, ativo, filial_id,
        usuario_papeis(id, papel, filial_id, ativo, filiais(nome)),
        usuario_permissoes(id, permissao, filial_id, ativo)
      `).order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setUsuarios(us || [])
    setFiliais(fils || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function criarUsuario() {
    if (!form.email || !form.senha || !form.nome) { setErro('Preencha nome, email e senha.'); return }
    setSalvando(true); setErro('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/criar-usuario', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) { setErro(json.error || 'Erro ao criar usuário'); setSalvando(false); return }
    setSalvando(false); setModalOpen(false); load()
  }

  async function resetarSenha(u: any) {
    if (!confirm(`Enviar e-mail de redefinição de senha para ${u.nome}?`)) return
    const { data: authUsers } = await supabase.auth.admin?.listUsers() || { data: null }
    const authUser = authUsers?.users?.find((x: any) => x.id === u.id)
    if (authUser?.email) {
      const { error } = await supabase.auth.resetPasswordForEmail(authUser.email)
      if (error) alert('Erro: ' + error.message)
      else alert('E-mail de redefinição enviado!')
    } else {
      alert('Não foi possível encontrar o e-mail deste usuário.')
    }
  }

  async function abrirPermissoes(u: any) {
    setUsuarioSel(u)
    setPapeisSel(u.usuario_papeis || [])
    setPermissoesSel(u.usuario_permissoes || [])
    setModalPermOpen(true)
  }

  async function togglePapel(papel: string, filial_id: string | null) {
    const existe = papeisSel.find(p => p.papel === papel && p.filial_id === filial_id)
    if (existe) {
      await supabase.from('usuario_papeis').update({ ativo: !existe.ativo }).eq('id', existe.id)
    } else {
      await supabase.from('usuario_papeis').insert({ user_id: usuarioSel.id, papel, filial_id })
    }
    const { data } = await supabase.from('usuario_papeis')
      .select('id, papel, filial_id, ativo, filiais(nome)').eq('user_id', usuarioSel.id)
    setPapeisSel(data || [])
    load()
  }

  async function togglePermissao(permissao: string) {
    const existe = permissoesSel.find(p => p.permissao === permissao && !p.filial_id)
    if (existe) {
      await supabase.from('usuario_permissoes').update({ ativo: !existe.ativo }).eq('id', existe.id)
    } else {
      await supabase.from('usuario_permissoes').insert({ user_id: usuarioSel.id, permissao, filial_id: null })
    }
    const { data } = await supabase.from('usuario_permissoes')
      .select('id, permissao, filial_id, ativo').eq('user_id', usuarioSel.id)
    setPermissoesSel(data || [])
    load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Gestão de Usuários" subtitle="Crie usuários e defina papéis e permissões"
        action={
          <PrimaryButton onClick={() => {
            setForm({ nome:'', email:'', senha:'', papel:'vendedor', filial_id: filiais[0]?.id||'' })
            setErro(''); setModalOpen(true)
          }} className="flex items-center gap-2">
            <Plus size={16}/> Novo usuário
          </PrimaryButton>
        }
      />

      {usuarios.length === 0 ? <EmptyState message="Nenhum usuário encontrado." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Usuário','Papéis','Permissões Extras','Ações'].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              )}</tr>
            </thead>
            <tbody className="divide-y">
              {usuarios.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-bendito-verde-escuro">{u.nome}</p>
                    <p className="text-xs text-gray-400">{u.papel}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.usuario_papeis||[]).filter((p:any)=>p.ativo).map((p:any) => (
                        <span key={p.id} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PAPEL_COR[p.papel]||'bg-gray-100 text-gray-600'}`}>
                          {PAPEL_LABEL[p.papel]} {p.filiais?.nome ? `(${p.filiais.nome})` : '(Global)'}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.usuario_permissoes||[]).filter((p:any)=>p.ativo).map((p:any) => (
                        <span key={p.id} className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                          {PERM_LABEL[p.permissao]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => abrirPermissoes(u)} title="Gerenciar papéis"
                        className="p-1.5 text-gray-400 hover:text-purple-600 rounded"><Shield size={15}/></button>
                      <button onClick={() => resetarSenha(u)} title="Resetar senha"
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><RefreshCw size={15}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal criar usuário */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Novo Usuário">
        <div className="space-y-4">
          <Field label="Nome completo" required>
            <Input value={form.nome} onChange={e => setForm({...form,nome:e.target.value})} placeholder="Nome completo"/>
          </Field>
          <Field label="E-mail" required>
            <Input type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} placeholder="email@exemplo.com"/>
          </Field>
          <Field label="Senha provisória" required>
            <div className="relative">
              <Input type={showSenha?'text':'password'} value={form.senha}
                onChange={e => setForm({...form,senha:e.target.value})} placeholder="Mínimo 6 caracteres"/>
              <button type="button" onClick={()=>setShowSenha(!showSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showSenha ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Papel inicial">
              <select value={form.papel} onChange={e => setForm({...form,papel:e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {PAPEIS.map(p => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
              </select>
            </Field>
            <Field label="Filial">
              <select value={form.filial_id} onChange={e => setForm({...form,filial_id:e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="">Global</option>
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </Field>
          </div>
          {erro && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{erro}</p>}
          <div className="flex gap-3">
            <SecondaryButton onClick={()=>setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={criarUsuario} disabled={salvando} className="flex-1">
              {salvando ? 'Criando...' : 'Criar usuário'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* Modal papéis e permissões */}
      <Modal isOpen={modalPermOpen} onClose={()=>setModalPermOpen(false)} title={`Papéis — ${usuarioSel?.nome}`}>
        {usuarioSel && (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <p className="text-sm font-bold text-bendito-verde-escuro mb-3">Papéis por Filial</p>
              <div className="space-y-3">
                {filiais.map(f => (
                  <div key={f.id} className="border rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">🏢 {f.nome}</p>
                    <div className="flex flex-wrap gap-2">
                      {PAPEIS.filter(p=>p!=='admin').map(papel => {
                        const ativo = papeisSel.find(p=>p.papel===papel && p.filial_id===f.id && p.ativo)
                        return (
                          <button key={papel} onClick={()=>togglePapel(papel, f.id)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${ativo ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-white border-gray-300 text-gray-500 hover:border-bendito-verde'}`}>
                            {ativo && <Check size={10} className="inline mr-1"/>}{PAPEL_LABEL[papel]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                  <p className="text-xs font-semibold text-red-500 mb-2">🌐 Acesso Global</p>
                  <button onClick={()=>togglePapel('admin', null)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${papeisSel.find(p=>p.papel==='admin'&&!p.filial_id&&p.ativo) ? 'bg-red-500 text-white border-red-500' : 'bg-white border-red-300 text-red-500'}`}>
                    Administrador Global
                  </button>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-bendito-verde-escuro mb-3">⚡ Permissões Extras</p>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSOES.map(perm => {
                  const ativo = permissoesSel.find(p=>p.permissao===perm&&!p.filial_id&&p.ativo)
                  return (
                    <button key={perm} onClick={()=>togglePermissao(perm)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border transition text-left ${ativo ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white border-gray-300 text-gray-600 hover:border-indigo-400'}`}>
                      {ativo?'✓ ':''}{PERM_LABEL[perm]}
                    </button>
                  )
                })}
              </div>
            </div>
            <SecondaryButton onClick={()=>setModalPermOpen(false)} className="w-full">Fechar</SecondaryButton>
          </div>
        )}
      </Modal>
    </div>
  )
}
