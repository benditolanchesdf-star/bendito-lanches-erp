'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL } from '@/lib/constants'
import Modal from '@/components/Modal'
import { Field, Input, Select, Textarea, PrimaryButton, SecondaryButton, PageHeader, Loading, EmptyState } from '@/components/ui'
import { Plus, Edit, Search, AlertTriangle, CheckCircle2, Power, PowerOff, Upload, X, Image as ImageIcon } from 'lucide-react'

type Produto = any

type Feedback = { type: 'success' | 'error'; text: string } | null

export default function ProdutosPage() {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({})
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [debug, setDebug] = useState<string>('')
  const [uploadando, setUploadando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const [prod, cat] = await Promise.all([
      supabase.from('produtos').select('*, categorias(nome)').order('nome'),
      supabase.from('categorias').select('id, nome').order('nome'),
    ])
    setProdutos(prod.data || [])
    setCategorias(cat.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 6000)
    return () => clearTimeout(t)
  }, [feedback])

  function abrirNovo() {
    setEditando(null)
    setFeedback(null)
    setDebug('')
    setForm({
      nome: '', codigo: '', categoria_id: '',
      preco_varejo: '', preco_atacado: '', custo_producao: '',
      estoque_atual: 0, estoque_minimo: 0, unidade_medida: 'unidade',
      descricao: '', imagem_url: ''
    })
    setModalOpen(true)
  }
  function abrirEdicao(p: Produto) {
    setEditando(p)
    setFeedback(null)
    setDebug('')
    setForm({ ...p, categoria_id: p.categoria_id || '', imagem_url: p.imagem_url || '' })
    setModalOpen(true)
  }

  async function diagnosticarSessao(): Promise<string> {
    const { data: sessionData } = await supabase.auth.getSession()
    const { data: userData } = await supabase.auth.getUser()
    const session = sessionData.session
    const user = userData.user

    let papel: string | null = null
    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('papel, nome, ativo').eq('id', user.id).maybeSingle()
      papel = profile?.papel ?? null
    }

    const info = {
      tem_session: !!session,
      tem_user: !!user,
      email: user?.email ?? null,
      uid: user?.id ?? null,
      papel,
      token_expira_em_seg: session ? (session.expires_at ?? 0) - Math.floor(Date.now() / 1000) : null
    }
    console.log('[DIAGNÓSTICO SESSÃO]', info)
    return JSON.stringify(info, null, 2)
  }

  // -------------------- UPLOAD DE IMAGEM --------------------
  async function handleUploadImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validações
    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', text: 'Arquivo precisa ser uma imagem.' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'Imagem maior que 5 MB.' })
      return
    }

    setUploadando(true)
    setFeedback(null)

    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const path = `produtos/${filename}`

      const { error: upErr } = await supabase.storage
        .from('produtos')
        .upload(path, file, { cacheControl: '3600', upsert: false })

      if (upErr) {
        console.error('[UPLOAD] erro =', upErr)
        setFeedback({ type: 'error', text: `Erro ao enviar imagem: ${upErr.message}` })
        return
      }

      const { data: publicData } = supabase.storage.from('produtos').getPublicUrl(path)
      const url = publicData.publicUrl
      console.log('[UPLOAD] OK url =', url)

      setForm({ ...form, imagem_url: url })
      setFeedback({ type: 'success', text: 'Imagem enviada.' })
    } finally {
      setUploadando(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removerImagem() {
    setForm({ ...form, imagem_url: '' })
  }

  // -------------------- SALVAR --------------------
  async function salvar() {
    setSalvando(true)
    setFeedback(null)
    setDebug('')

    const payload = {
      filial_id: FILIAL_ID,
      nome: form.nome,
      codigo: form.codigo || null,
      categoria_id: form.categoria_id || null,
      preco_varejo: Number(form.preco_varejo) || 0,
      preco_atacado: form.preco_atacado ? Number(form.preco_atacado) : null,
      custo_producao: Number(form.custo_producao) || 0,
      estoque_atual: Number(form.estoque_atual) || 0,
      estoque_minimo: Number(form.estoque_minimo) || 0,
      unidade_medida: form.unidade_medida || 'unidade',
      descricao: form.descricao || null,
      imagem_url: form.imagem_url || null,
    }

    console.log('[SALVAR] modo =', editando ? 'UPDATE' : 'INSERT', 'payload =', payload)

    try {
      if (editando) {
        const { data, error, status } = await supabase
          .from('produtos').update(payload).eq('id', editando.id).select()

        console.log('[UPDATE] resposta =', { data, error, status })

        if (error) {
          setFeedback({ type: 'error', text: `Erro ao atualizar: ${error.message} (code: ${error.code})` })
          setDebug(JSON.stringify({ data, error, status }, null, 2))
          return
        }
        if (!data || data.length === 0) {
          const sessao = await diagnosticarSessao()
          setFeedback({ type: 'error', text: 'Nenhuma linha foi atualizada. RLS provavelmente bloqueou. Veja o diagnóstico abaixo.' })
          setDebug(sessao)
          return
        }
        setFeedback({ type: 'success', text: `Produto "${data[0].nome}" atualizado.` })
      } else {
        const { data, error, status } = await supabase
          .from('produtos').insert(payload).select()

        console.log('[INSERT] resposta =', { data, error, status })

        if (error) {
          setFeedback({ type: 'error', text: `Erro ao inserir: ${error.message} (code: ${error.code})` })
          setDebug(JSON.stringify({ data, error, status }, null, 2))
          return
        }
        if (!data || data.length === 0) {
          const sessao = await diagnosticarSessao()
          setFeedback({ type: 'error', text: 'O registro não foi criado. RLS provavelmente bloqueou. Veja o diagnóstico abaixo.' })
          setDebug(sessao)
          return
        }
        setFeedback({ type: 'success', text: `Produto "${data[0].nome}" criado.` })
      }

      setModalOpen(false)
      load()
    } catch (err: any) {
      console.error('[SALVAR] exception =', err)
      setFeedback({ type: 'error', text: `Exceção: ${err.message}` })
    } finally {
      setSalvando(false)
    }
  }

  // -------------------- DESATIVAR / REATIVAR (soft delete) --------------------
  async function toggleAtivo(p: Produto) {
    const novoAtivo = !p.ativo
    const acao = novoAtivo ? 'reativar' : 'desativar'

    if (!confirm(`Deseja ${acao} o produto "${p.nome}"?`)) return

    setFeedback(null)
    setDebug('')
    console.log(`[${acao.toUpperCase()}] id =`, p.id)

    try {
      const { data, error, status } = await supabase
        .from('produtos').update({ ativo: novoAtivo }).eq('id', p.id).select()

      console.log(`[${acao.toUpperCase()}] resposta =`, { data, error, status })

      if (error) {
        setFeedback({ type: 'error', text: `Erro ao ${acao}: ${error.message} (code: ${error.code})` })
        setDebug(JSON.stringify({ data, error, status }, null, 2))
        return
      }
      if (!data || data.length === 0) {
        const sessao = await diagnosticarSessao()
        setFeedback({ type: 'error', text: `Nenhuma linha alterada — RLS pode estar bloqueando.` })
        setDebug(sessao)
        return
      }
      setFeedback({ type: 'success', text: `Produto "${p.nome}" ${novoAtivo ? 'reativado' : 'desativado'}.` })
      load()
    } catch (err: any) {
      console.error('[TOGGLE-ATIVO] exception =', err)
      setFeedback({ type: 'error', text: `Exceção: ${err.message}` })
    }
  }

  // -------------------- RENDER --------------------
  const filtrados = produtos
    .filter((p) => mostrarInativos ? true : p.ativo !== false)
    .filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        subtitle="Catálogo de produtos"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={20} /> Novo Produto</PrimaryButton>}
      />

      {feedback && (
        <div className={`rounded-xl p-4 border ${feedback.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className="flex items-start gap-2">
            {feedback.type === 'success'
              ? <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" />
              : <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />}
            <p className="text-sm">{feedback.text}</p>
          </div>
          {debug && (
            <pre className="mt-3 text-xs bg-white/60 rounded p-2 overflow-auto max-h-48">{debug}</pre>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produtos..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bendito-dourado outline-none" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 px-3">
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
          Mostrar inativos
        </label>
      </div>

      {loading ? <Loading /> : filtrados.length === 0 ? <EmptyState message="Nenhum produto encontrado." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtrados.map((p) => {
            const inativo = p.ativo === false
            return (
              <div key={p.id} className={`bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition ${inativo ? 'opacity-60' : ''}`}>
                <div className="h-28 bg-gradient-to-br from-bendito-verde to-bendito-dourado flex items-center justify-center text-5xl overflow-hidden">
                  {p.imagem_url
                    ? <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                    : '🍕'}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs text-gray-500 uppercase">{p.categorias?.nome || 'Sem categoria'}</span>
                      <h3 className="font-bold text-bendito-verde-escuro truncate">{p.nome}</h3>
                    </div>
                    {inativo && <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">inativo</span>}
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">Varejo</span><span className="font-semibold text-bendito-verde">{formatBRL(p.preco_varejo)}</span></div>
                    {p.preco_atacado && <div className="flex justify-between"><span className="text-gray-600">Atacado</span><span className="font-semibold text-bendito-dourado-escuro">{formatBRL(p.preco_atacado)}</span></div>}
                    <div className="flex justify-between pt-1 border-t"><span className="text-gray-600">Estoque</span><span className={`font-semibold ${p.estoque_atual <= p.estoque_minimo ? 'text-red-600' : 'text-green-600'}`}>{p.estoque_atual} {p.unidade_medida}</span></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => abrirEdicao(p)} className="flex-1 flex items-center justify-center gap-1 bg-bendito-dourado hover:bg-bendito-dourado-escuro text-bendito-verde-escuro font-semibold py-2 rounded-lg text-sm transition"><Edit size={15} /> Editar</button>
                    <button
                      onClick={() => toggleAtivo(p)}
                      title={inativo ? 'Reativar produto' : 'Desativar produto'}
                      className={`p-2 rounded-lg transition ${inativo ? 'bg-green-100 hover:bg-green-200 text-green-700' : 'bg-red-100 hover:bg-red-200 text-red-600'}`}
                    >
                      {inativo ? <Power size={15} /> : <PowerOff size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar Produto' : 'Novo Produto'}>
        <div className="space-y-4">
          {/* Imagem */}
          <Field label="Imagem do produto">
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-lg bg-gray-100 border border-gray-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                {form.imagem_url
                  ? <img src={form.imagem_url} alt="preview" className="w-full h-full object-cover" />
                  : <ImageIcon size={32} className="text-gray-400" />}
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadImagem}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadando}
                  className="flex items-center justify-center gap-2 bg-bendito-verde hover:opacity-90 text-white text-sm py-2 px-3 rounded-lg disabled:opacity-50"
                >
                  <Upload size={16} /> {uploadando ? 'Enviando...' : (form.imagem_url ? 'Trocar imagem' : 'Enviar imagem')}
                </button>
                {form.imagem_url && (
                  <button
                    type="button"
                    onClick={removerImagem}
                    className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm py-2 px-3 rounded-lg"
                  >
                    <X size={16} /> Remover
                  </button>
                )}
                <span className="text-xs text-gray-500">PNG/JPG até 5 MB</span>
              </div>
            </div>
          </Field>

          <Field label="Nome" required><Input value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Código"><Input value={form.codigo || ''} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></Field>
            <Field label="Categoria">
              <Select value={form.categoria_id || ''} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
                <option value="">Selecione...</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Preço Varejo" required><Input type="number" step="0.01" value={form.preco_varejo ?? ''} onChange={(e) => setForm({ ...form, preco_varejo: e.target.value })} /></Field>
            <Field label="Preço Atacado"><Input type="number" step="0.01" value={form.preco_atacado ?? ''} onChange={(e) => setForm({ ...form, preco_atacado: e.target.value })} /></Field>
            <Field label="Custo"><Input type="number" step="0.01" value={form.custo_producao ?? ''} onChange={(e) => setForm({ ...form, custo_producao: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Estoque Atual"><Input type="number" value={form.estoque_atual ?? 0} onChange={(e) => setForm({ ...form, estoque_atual: e.target.value })} /></Field>
            <Field label="Estoque Mínimo"><Input type="number" value={form.estoque_minimo ?? 0} onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })} /></Field>
            <Field label="Unidade"><Input value={form.unidade_medida || ''} onChange={(e) => setForm({ ...form, unidade_medida: e.target.value })} /></Field>
          </div>
          <Field label="Descrição"><Textarea rows={2} value={form.descricao || ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Field>
          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.nome} className="flex-1">{salvando ? 'Salvando...' : 'Salvar'}</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
