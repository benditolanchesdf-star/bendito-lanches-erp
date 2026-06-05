'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, Textarea, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import {
  Plus, Edit, Trash2, Search, RefreshCw,
  Package, Upload, X, Image as ImageIcon, CheckCircle,
} from 'lucide-react'

const FILIAL_MATRIZ = '11111111-1111-1111-1111-111111111111'

export default function ProdutosPage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading]       = useState(true)
  const [produtos, setProdutos]     = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [busca, setBusca]           = useState('')
  const [modalOpen, setModalOpen]   = useState(false)
  const [editando, setEditando]     = useState<any>(null)
  const [salvando, setSalvando]     = useState(false)

  // Upload de imagem
  const [imagemFile, setImagemFile]       = useState<File | null>(null)
  const [imagemPreview, setImagemPreview] = useState<string | null>(null)
  const [uploadando, setUploadando]       = useState(false)
  const [imagemAtual, setImagemAtual]     = useState<string | null>(null)

  const [form, setForm] = useState<any>({
    nome: '', descricao: '', categoria_id: '',
    preco_custo: '', preco_varejo: '',
    unidade_medida: 'UN', estoque_minimo: '',
    ativo: true,
  })

  async function load() {
    setLoading(true)
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('produtos')
        .select('*, categorias(nome)')
        .eq('filial_id', FILIAL_MATRIZ)
        .order('nome'),
      supabase.from('categorias')
        .select('id, nome')
        .order('nome'),
    ])
    setProdutos(prods || [])
    setCategorias(cats || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({
      nome: '', descricao: '', categoria_id: '',
      preco_custo: '', preco_varejo: '',
      unidade_medida: 'UN', estoque_minimo: '',
      ativo: true,
    })
    setImagemFile(null)
    setImagemPreview(null)
    setImagemAtual(null)
    setModalOpen(true)
  }

  function abrirEdicao(p: any) {
    setEditando(p)
    setForm({
      nome:           p.nome || '',
      descricao:      p.descricao || '',
      categoria_id:   p.categoria_id || '',
      preco_custo:    p.preco_custo != null ? String(p.preco_custo) : '',
      preco_varejo:   p.preco_varejo != null ? String(p.preco_varejo) : '',
      unidade_medida: p.unidade_medida || 'UN',
      estoque_minimo: p.estoque_minimo != null ? String(p.estoque_minimo) : '',
      ativo:          p.ativo ?? true,
    })
    setImagemFile(null)
    setImagemPreview(null)
    setImagemAtual(p.imagem_url || null)
    setModalOpen(true)
  }

  // Selecionar imagem
  function onSelecionarImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Imagem muito grande. Máximo 5MB.')
      return
    }

    setImagemFile(file)
    const reader = new FileReader()
    reader.onload = ev => setImagemPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function removerImagemSelecionada() {
    setImagemFile(null)
    setImagemPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function removerImagemAtual() {
    if (!editando?.imagem_url) return
    // Extrair path do arquivo da URL
    const url = editando.imagem_url as string
    const path = url.split('/storage/v1/object/public/produtos/')[1]
    if (path) {
      await supabase.storage.from('produtos').remove([path])
    }
    await supabase.from('produtos').update({ imagem_url: null }).eq('id', editando.id)
    setImagemAtual(null)
    setEditando({ ...editando, imagem_url: null })
  }

  // Upload da imagem para o Storage
  async function uploadImagem(produtoId: string): Promise<string | null> {
    if (!imagemFile) return null
    setUploadando(true)

    const ext  = imagemFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${produtoId}/foto.${ext}`

    const { error } = await supabase.storage
      .from('produtos')
      .upload(path, imagemFile, { upsert: true, contentType: imagemFile.type })

    if (error) {
      console.error('Erro no upload:', error)
      setUploadando(false)
      return null
    }

    const { data } = supabase.storage.from('produtos').getPublicUrl(path)
    setUploadando(false)
    return data.publicUrl
  }

  async function salvar() {
    if (!form.nome.trim()) return
    setSalvando(true)

    const payload = {
      filial_id:      FILIAL_MATRIZ,
      nome:           form.nome.trim(),
      descricao:      form.descricao || null,
      categoria_id:   form.categoria_id || null,
      preco_custo:    form.preco_custo   ? Number(form.preco_custo)   : null,
      preco_varejo:   form.preco_varejo  ? Number(form.preco_varejo)  : null,
      unidade_medida: form.unidade_medida || 'UN',
      estoque_minimo: form.estoque_minimo ? Number(form.estoque_minimo) : null,
      ativo:          form.ativo,
      updated_at:     new Date().toISOString(),
    }

    if (editando) {
      // Atualizar produto
      await supabase.from('produtos').update(payload).eq('id', editando.id)

      // Upload imagem se selecionada
      if (imagemFile) {
        const url = await uploadImagem(editando.id)
        if (url) {
          await supabase.from('produtos').update({ imagem_url: url }).eq('id', editando.id)
        }
      }
    } else {
      // Criar produto
      const { data: novo } = await supabase.from('produtos')
        .insert({ ...payload, imagem_url: null })
        .select('id').single()

      // Upload imagem se selecionada
      if (novo && imagemFile) {
        const url = await uploadImagem(novo.id)
        if (url) {
          await supabase.from('produtos').update({ imagem_url: url }).eq('id', novo.id)
        }
      }
    }

    setSalvando(false)
    setModalOpen(false)
    load()
  }

  async function toggleAtivo(p: any) {
    await supabase.from('produtos').update({ ativo: !p.ativo }).eq('id', p.id)
    load()
  }

  async function excluir(p: any) {
    if (!confirm(`Excluir "${p.nome}"? Esta ação não pode ser desfeita.`)) return
    // Remover imagem do storage se existir
    if (p.imagem_url) {
      const path = (p.imagem_url as string).split('/storage/v1/object/public/produtos/')[1]
      if (path) await supabase.storage.from('produtos').remove([path])
    }
    await supabase.from('produtos').delete().eq('id', p.id)
    load()
  }

  const prodFiltrados = produtos.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.categorias?.nome || '').toLowerCase().includes(busca.toLowerCase())
  )

  const comImagem    = produtos.filter(p => p.imagem_url).length
  const semImagem    = produtos.filter(p => !p.imagem_url && p.ativo).length

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        subtitle="Catálogo da Matriz — com imagens para PDV, cliente e vendedor"
        action={
          <PrimaryButton onClick={abrirNovo} className="flex items-center gap-2">
            <Plus size={16}/> Novo produto
          </PrimaryButton>
        }
      />

      {/* Stats de imagens */}
      {produtos.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full bg-green-500"/>
            <span className="text-gray-600">{comImagem} produto(s) com imagem</span>
          </div>
          {semImagem > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-orange-400"/>
              <span className="text-orange-600">{semImagem} produto(s) sem imagem</span>
            </div>
          )}
          <div className="text-xs text-gray-400 ml-auto">
            Imagens aparecem no PDV, portal do cliente e portal do vendedor
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="bg-white rounded-xl shadow-md p-4 flex gap-3 items-center">
        <Search size={16} className="text-gray-400 shrink-0"/>
        <input
          value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou categoria..."
          className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400"
        />
        {busca && <button onClick={() => setBusca('')}><X size={14} className="text-gray-400"/></button>}
        <button onClick={load} className="text-gray-400 hover:text-bendito-verde ml-2">
          <RefreshCw size={15}/>
        </button>
      </div>

      {/* Grid de produtos */}
      {prodFiltrados.length === 0 ? (
        <EmptyState message="Nenhum produto encontrado."/>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {prodFiltrados.map(p => (
            <div key={p.id}
              className={`bg-white rounded-xl shadow-md overflow-hidden border transition hover:shadow-lg
                ${!p.ativo ? 'opacity-60 border-gray-200' : 'border-gray-100'}`}>

              {/* Imagem do produto */}
              <div className="relative h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                {p.imagem_url ? (
                  <img
                    src={p.imagem_url}
                    alt={p.nome}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-300">
                    <Package size={36}/>
                    <span className="text-xs">Sem imagem</span>
                  </div>
                )}
                {/* Badge ativo/inativo */}
                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold
                  ${p.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                  {p.ativo ? 'Ativo' : 'Inativo'}
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <p className="font-bold text-bendito-verde-escuro truncate">{p.nome}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.categorias?.nome || 'Sem categoria'} · {p.unidade_medida || 'UN'}
                </p>
                {p.preco_varejo && (
                  <p className="text-lg font-bold text-bendito-verde mt-1">{formatBRL(p.preco_varejo)}</p>
                )}

                {/* Ações */}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => abrirEdicao(p)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-bendito-verde hover:bg-bendito-verde-escuro text-white py-1.5 rounded-lg text-xs font-semibold transition">
                    <Edit size={12}/> Editar
                  </button>
                  <button onClick={() => toggleAtivo(p)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition
                      ${p.ativo ? 'bg-gray-100 hover:bg-gray-200 text-gray-600' : 'bg-green-100 hover:bg-green-200 text-green-700'}`}>
                    {p.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                  <button onClick={() => excluir(p)}
                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition">
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal novo/editar produto */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? `Editar — ${editando.nome}` : 'Novo Produto'}
      >
        <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">

          {/* ── UPLOAD DE IMAGEM ── */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <ImageIcon size={16} className="text-bendito-verde"/>
              Foto do produto
            </label>

            {/* Imagem atual (modo edição) */}
            {imagemAtual && !imagemPreview && (
              <div className="relative mb-3">
                <img
                  src={imagemAtual}
                  alt="Imagem atual"
                  className="w-full h-48 object-cover rounded-xl border border-gray-200"
                />
                <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <CheckCircle size={10}/> Foto atual
                </div>
                <button
                  onClick={removerImagemAtual}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full transition"
                  title="Remover foto">
                  <X size={14}/>
                </button>
              </div>
            )}

            {/* Preview da nova imagem */}
            {imagemPreview && (
              <div className="relative mb-3">
                <img
                  src={imagemPreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-xl border-2 border-bendito-dourado"
                />
                <div className="absolute top-2 left-2 bg-yellow-400 text-gray-900 text-xs px-2 py-0.5 rounded-full font-semibold">
                  Nova foto
                </div>
                <button
                  onClick={removerImagemSelecionada}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full transition">
                  <X size={14}/>
                </button>
              </div>
            )}

            {/* Área de upload */}
            {!imagemPreview && (
              <label
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition
                  ${imagemAtual
                    ? 'border-gray-300 hover:border-bendito-verde bg-gray-50 hover:bg-green-50'
                    : 'border-bendito-verde/40 hover:border-bendito-verde bg-green-50/30 hover:bg-green-50'
                  }`}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={onSelecionarImagem}
                />
                <Upload size={24} className="text-bendito-verde opacity-60"/>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-600">
                    {imagemAtual ? 'Trocar foto' : 'Clique para adicionar foto'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">JPG, PNG ou WebP · Máximo 5MB</p>
                </div>
              </label>
            )}
          </div>

          <hr className="border-gray-100"/>

          {/* ── DADOS DO PRODUTO ── */}
          <Field label="Nome do produto" required>
            <Input
              value={form.nome}
              onChange={e => setForm({...form, nome: e.target.value})}
              placeholder="Ex: X-Burguer, Combo Duplo..."
            />
          </Field>

          <Field label="Descrição">
            <Textarea
              rows={2}
              value={form.descricao}
              onChange={e => setForm({...form, descricao: e.target.value})}
              placeholder="Ingredientes, observações..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <select
                value={form.categoria_id}
                onChange={e => setForm({...form, categoria_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="">Sem categoria</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Field>
            <Field label="Unidade">
              <select
                value={form.unidade_medida}
                onChange={e => setForm({...form, unidade_medida: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {['UN','KG','G','L','ML','PCT','CX'].map(u =>
                  <option key={u} value={u}>{u}</option>
                )}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço de custo (R$)">
              <Input
                type="number" step="0.01" min="0"
                value={form.preco_custo}
                onChange={e => setForm({...form, preco_custo: e.target.value})}
                placeholder="0,00"
              />
            </Field>
            <Field label="Preço de venda (R$)">
              <Input
                type="number" step="0.01" min="0"
                value={form.preco_varejo}
                onChange={e => setForm({...form, preco_varejo: e.target.value})}
                placeholder="0,00"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Estoque mínimo">
              <Input
                type="number" min="0"
                value={form.estoque_minimo}
                onChange={e => setForm({...form, estoque_minimo: e.target.value})}
                placeholder="0"
              />
            </Field>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition">
                <div
                  onClick={() => setForm({...form, ativo: !form.ativo})}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer
                    ${form.ativo ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                    ${form.ativo ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {form.ativo ? 'Produto ativo' : 'Produto inativo'}
                </span>
              </label>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </SecondaryButton>
            <PrimaryButton
              onClick={salvar}
              disabled={salvando || uploadando || !form.nome.trim()}
              className="flex-1 flex items-center justify-center gap-2">
              {(salvando || uploadando) ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  {uploadando ? 'Enviando foto...' : 'Salvando...'}
                </>
              ) : (
                editando ? '💾 Salvar produto' : '✅ Criar produto'
              )}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
