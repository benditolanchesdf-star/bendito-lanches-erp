'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID } from '@/lib/constants'
import { Field, Input, PrimaryButton, SecondaryButton, PageHeader, Loading } from '@/components/ui'
import { Plus, Trash2, Building2, User as UserIcon, Tag, MessageCircle, CheckCircle, XCircle, Users, Shield, ChevronRight, Package } from 'lucide-react'
import { enviarWhatsApp, carregarConfigZAPI } from '@/lib/zapi'

export default function ConfiguracoesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [filial, setFilial] = useState<any>(null)
  const [categorias, setCategorias] = useState<any[]>([])
  const [novaCat, setNovaCat] = useState('')
  const [filialForm, setFilialForm] = useState<any>({})
  const [savingFilial, setSavingFilial] = useState(false)
  const [totalUsuarios, setTotalUsuarios] = useState(0)
  const [totalAtendentes, setTotalAtendentes] = useState(0)
  const [totalFiliais, setTotalFiliais] = useState(0)

  const [zapConfig, setZapConfig] = useState({
    zapi_instance_id: '', zapi_token: '', zapi_client_token: '', zapi_ativo: 'false',
    wpp_msg_confirmado: '', wpp_msg_producao: '', wpp_msg_saiu: '', wpp_msg_entregue: '',
  })
  const [savingZap, setSavingZap] = useState(false)
  const [testeFone, setTesteFone] = useState('')
  const [testando, setTestando] = useState(false)
  const [testeResult, setTesteResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [logsWpp, setLogsWpp] = useState<any[]>([])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    const [f, c, cfgs, logs, totalU, totalA, totalF] = await Promise.all([
      supabase.from('filiais').select('*').eq('id', FILIAL_ID).maybeSingle(),
      supabase.from('categorias').select('*').order('ordem').order('nome'),
      supabase.from('configuracoes').select('chave, valor').eq('filial_id', FILIAL_ID),
      supabase.from('whatsapp_logs').select('*').eq('filial_id', FILIAL_ID).order('created_at', { ascending: false }).limit(10),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('atendentes_pdv').select('id', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('filiais').select('id', { count: 'exact', head: true }).eq('ativo', true),
    ])
    setFilial(f.data)
    setFilialForm(f.data || {})
    setCategorias(c.data || [])
    setLogsWpp(logs.data || [])
    setTotalUsuarios(totalU.count || 0)
    setTotalAtendentes(totalA.count || 0)
    setTotalFiliais(totalF.count || 0)
    const map: Record<string, string> = {}
    for (const r of cfgs.data || []) map[r.chave] = r.valor || ''
    setZapConfig((prev) => ({ ...prev, ...map }))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function salvarZAPI() {
    setSavingZap(true)
    for (const [chave, valor] of Object.entries(zapConfig)) {
      await supabase.from('configuracoes').upsert(
        { filial_id: FILIAL_ID, chave, valor, updated_at: new Date().toISOString() },
        { onConflict: 'filial_id,chave' }
      )
    }
    setSavingZap(false)
    alert('Configurações salvas!')
    load()
  }

  async function testarWhatsApp() {
    if (!testeFone.trim()) { alert('Informe um número para teste.'); return }
    setTestando(true); setTesteResult(null)
    const { config } = await carregarConfigZAPI()
    const result = await enviarWhatsApp(
      { ...config, ativo: true }, testeFone,
      `🧪 Teste de conexão Z-API — Bendito Lanches ERP. Se você recebeu esta mensagem, a integração está funcionando! ✅`
    )
    setTesteResult({ ok: result.ok, msg: result.ok ? 'Mensagem enviada com sucesso!' : (result.erro || 'Erro desconhecido') })
    setTestando(false)
  }

  async function salvarFilial() {
    setSavingFilial(true)
    const { error } = await supabase.from('filiais').update({
      nome: filialForm.nome, cnpj: filialForm.cnpj || null, endereco: filialForm.endereco || null,
    }).eq('id', FILIAL_ID)
    setSavingFilial(false)
    if (error) { alert('Erro: ' + error.message); return }
    alert('Dados da filial atualizados.')
    load()
  }

  async function addCategoria() {
    if (!novaCat.trim()) return
    const { error } = await supabase.from('categorias').insert({
      filial_id: FILIAL_ID, nome: novaCat.trim(), ordem: categorias.length + 1,
    })
    if (error) { alert('Erro: ' + error.message); return }
    setNovaCat(''); load()
  }

  async function excluirCategoria(c: any) {
    if (!confirm(`Excluir categoria "${c.nome}"?`)) return
    const { error } = await supabase.from('categorias').delete().eq('id', c.id)
    if (error) { alert('Erro: ' + error.message); return }
    load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Filial, usuários e integrações" />

      {/* Acesso rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: '/dashboard/configuracoes/usuarios',         icon: Shield,   cor: 'bg-purple-100', iconCor: 'text-purple-600', label: 'Gestão de Usuários',    sub: `${totalUsuarios} usuário(s)` },
          { href: '/dashboard/configuracoes/atendentes',        icon: Users,    cor: 'bg-orange-100', iconCor: 'text-orange-600', label: 'Atendentes PDV',        sub: `${totalAtendentes} atendente(s)` },
          { href: '/dashboard/configuracoes/filiais',           icon: Building2,cor: 'bg-blue-100',   iconCor: 'text-blue-600',   label: 'Filiais',               sub: `${totalFiliais} unidade(s)` },
          { href: '/dashboard/configuracoes/produtos-filiais',  icon: Package,  cor: 'bg-green-100',  iconCor: 'text-green-600',  label: 'Produtos por Filial',   sub: 'Preços e estoques' },
        ].map(item => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className="bg-white rounded-xl shadow-md p-5 flex items-center justify-between hover:shadow-lg hover:ring-2 hover:ring-bendito-dourado transition group">
              <div className="flex items-center gap-3">
                <div className={`${item.cor} p-3 rounded-xl`}>
                  <Icon size={22} className={item.iconCor}/>
                </div>
                <div>
                  <p className="font-bold text-bendito-verde-escuro text-sm">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.sub}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:text-bendito-verde transition"/>
            </Link>
          )
        })}
      </div>

      {/* Usuário logado */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserIcon className="text-bendito-dourado-escuro" size={22}/>
          <h2 className="text-lg font-bold text-bendito-verde-escuro">Usuário Logado</h2>
        </div>
        <div className="bg-bendito-creme rounded-lg p-4">
          <p className="text-sm"><span className="text-gray-600">E-mail:</span> <span className="font-medium">{user?.email}</span></p>
          <p className="text-sm mt-1"><span className="text-gray-600">ID:</span> <span className="font-mono text-xs">{user?.id}</span></p>
        </div>
        <p className="text-xs text-gray-500 mt-3">Para alterar a senha, use o fluxo de "esqueci minha senha" via Supabase Auth.</p>
      </div>

      {/* Dados da Matriz */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="text-bendito-dourado-escuro" size={22}/>
          <h2 className="text-lg font-bold text-bendito-verde-escuro">Dados da Matriz</h2>
        </div>
        <div className="space-y-4">
          <Field label="Nome" required><Input value={filialForm.nome || ''} onChange={(e) => setFilialForm({ ...filialForm, nome: e.target.value })}/></Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="CNPJ"><Input value={filialForm.cnpj || ''} onChange={(e) => setFilialForm({ ...filialForm, cnpj: e.target.value })}/></Field>
          </div>
          <Field label="Endereço"><Input value={filialForm.endereco || ''} onChange={(e) => setFilialForm({ ...filialForm, endereco: e.target.value })}/></Field>
          <PrimaryButton onClick={salvarFilial} disabled={savingFilial || !filialForm.nome}>
            {savingFilial ? 'Salvando...' : 'Salvar Dados'}
          </PrimaryButton>
        </div>
      </div>

      {/* Categorias */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="text-bendito-dourado-escuro" size={22}/>
          <h2 className="text-lg font-bold text-bendito-verde-escuro">Categorias de Produtos</h2>
        </div>
        <div className="flex gap-2 mb-4">
          <Input value={novaCat} onChange={(e) => setNovaCat(e.target.value)} placeholder="Nome da nova categoria..."
            onKeyDown={(e) => e.key === 'Enter' && addCategoria()}/>
          <PrimaryButton onClick={addCategoria} disabled={!novaCat.trim()} className="flex items-center gap-1">
            <Plus size={18}/> Adicionar
          </PrimaryButton>
        </div>
        {categorias.length === 0 ? <p className="text-sm text-gray-500">Nenhuma categoria cadastrada.</p> : (
          <div className="space-y-2">
            {categorias.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-bendito-creme rounded-lg px-4 py-2">
                <span className="font-medium">{c.nome}</span>
                <button onClick={() => excluirCategoria(c)} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded"><Trash2 size={14}/></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp Z-API */}
      <div className="bg-white rounded-xl shadow-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="text-green-500" size={22}/>
            <h2 className="text-lg font-bold text-bendito-verde-escuro">WhatsApp — Z-API</h2>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600">Ativo</span>
            <div onClick={() => setZapConfig((z) => ({ ...z, zapi_ativo: z.zapi_ativo === 'true' ? 'false' : 'true' }))}
              className={`w-11 h-6 rounded-full transition-colors ${zapConfig.zapi_ativo === 'true' ? 'bg-green-500' : 'bg-gray-300'} relative cursor-pointer`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${zapConfig.zapi_ativo === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`}/>
            </div>
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Configure as credenciais da sua instância Z-API.
          Acesse <a href="https://app.z-api.io" target="_blank" className="text-blue-600 underline">app.z-api.io</a>.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Instance ID"><Input value={zapConfig.zapi_instance_id} onChange={(e) => setZapConfig((z) => ({ ...z, zapi_instance_id: e.target.value }))} placeholder="Ex: 3F270655F5F201F43..."/></Field>
          <Field label="Token"><Input value={zapConfig.zapi_token} onChange={(e) => setZapConfig((z) => ({ ...z, zapi_token: e.target.value }))} type="password" placeholder="Token da instância"/></Field>
          <Field label="Client Token"><Input value={zapConfig.zapi_client_token} onChange={(e) => setZapConfig((z) => ({ ...z, zapi_client_token: e.target.value }))} type="password" placeholder="Client Token"/></Field>
        </div>
        <div className="border-t pt-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Mensagens automáticas</p>
          <p className="text-xs text-gray-500 mb-3">
            Variáveis: <code className="bg-gray-100 px-1 rounded">{`{{nome_loja}}`}</code> <code className="bg-gray-100 px-1 rounded">{`{{numero_pedido}}`}</code> <code className="bg-gray-100 px-1 rounded">{`{{data_entrega}}`}</code> <code className="bg-gray-100 px-1 rounded">{`{{horario}}`}</code>
          </p>
          <div className="space-y-3">
            {[
              { key: 'wpp_msg_confirmado', label: '✅ Pedido Confirmado' },
              { key: 'wpp_msg_producao',   label: '👨‍🍳 Em Produção' },
              { key: 'wpp_msg_saiu',       label: '🚗 Saiu para Entrega' },
              { key: 'wpp_msg_entregue',   label: '📦 Entregue' },
            ].map(({ key, label }) => (
              <Field key={key} label={label}>
                <textarea rows={2} value={(zapConfig as any)[key]}
                  onChange={(e) => setZapConfig((z) => ({ ...z, [key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado resize-none"/>
              </Field>
            ))}
          </div>
        </div>
        <div className="border-t pt-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Testar conexão</p>
          <div className="flex gap-3 items-end">
            <Field label="Número de teste (com DDD)">
              <Input value={testeFone} onChange={(e) => setTesteFone(e.target.value)} placeholder="(61) 9xxxx-xxxx"/>
            </Field>
            <SecondaryButton onClick={testarWhatsApp} disabled={testando} className="flex items-center gap-2 whitespace-nowrap">
              <MessageCircle size={16}/>{testando ? 'Enviando...' : 'Enviar teste'}
            </SecondaryButton>
          </div>
          {testeResult && (
            <div className={`mt-3 flex items-center gap-2 text-sm font-semibold ${testeResult.ok ? 'text-green-600' : 'text-red-600'}`}>
              {testeResult.ok ? <CheckCircle size={16}/> : <XCircle size={16}/>}
              {testeResult.msg}
            </div>
          )}
        </div>
        <PrimaryButton onClick={salvarZAPI} disabled={savingZap} className="flex items-center gap-2">
          <MessageCircle size={16}/>{savingZap ? 'Salvando...' : 'Salvar configurações WhatsApp'}
        </PrimaryButton>
      </div>

      {/* Log WhatsApp */}
      {logsWpp.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-bold text-bendito-verde-escuro mb-4 flex items-center gap-2">
            <MessageCircle size={18}/> Últimas mensagens enviadas
          </h2>
          <div className="space-y-2">
            {logsWpp.map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 py-2 border-b last:border-0 text-sm">
                <div className="min-w-0">
                  <p className="text-gray-700 truncate">{l.mensagem}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{l.telefone} · {new Date(l.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${l.status === 'enviado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {l.status === 'enviado' ? '✓ Enviado' : '✗ Erro'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
