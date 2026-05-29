'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL } from '@/lib/constants'
import Modal from '@/components/Modal'
import { Field, Input, Select, Textarea, PrimaryButton, SecondaryButton, PageHeader, Loading, EmptyState } from '@/components/ui'
import { Plus, Edit, Trash2, Search } from 'lucide-react'

type Produto = any

export default function ProdutosPage() {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({})

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

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', codigo: '', categoria_id: '', preco_varejo: '', preco_atacado: '', custo_producao: '', estoque_atual: 0, estoque_minimo: 0, unidade_medida: 'unidade', descricao: '' })
    setModalOpen(true)
  }
  function abrirEdicao(p: Produto) {
    setEditando(p)
    setForm({ ...p, categoria_id: p.categoria_id || '' })
    setModalOpen(true)
  }

  async function salvar() {
    setSalvando(true)
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
    }
    let error
    if (editando) {
      ({ error } = await supabase.from('produtos').update(payload).eq('id', editando.id))
    } else {
      ({ error } = await supabase.from('produtos').insert(payload))
    }
    setSalvando(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    setModalOpen(false)
    load()
  }

  async function excluir(p: Produto) {
    if (!confirm(`Excluir o produto "${p.nome}"?`)) return
    const { error } = await supabase.from('produtos').delete().eq('id', p.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    load()
  }

  const filtrados = produtos.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        subtitle="Catálogo de produtos"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={20} /> Novo Produto</PrimaryButton>}
      />

      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produtos..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bendito-dourado outline-none" />
        </div>
      </div>

      {loading ? <Loading /> : filtrados.length === 0 ? <EmptyState message="Nenhum produto encontrado." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtrados.map((p) => (
            <div key={p.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition">
              <div className="h-28 bg-gradient-to-br from-bendito-verde to-bendito-dourado flex items-center justify-center text-5xl">🍕</div>
              <div className="p-4">
                <span className="text-xs text-gray-500 uppercase">{p.categorias?.nome || 'Sem categoria'}</span>
                <h3 className="font-bold text-bendito-verde-escuro">{p.nome}</h3>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Varejo</span><span className="font-semibold text-bendito-verde">{formatBRL(p.preco_varejo)}</span></div>
                  {p.preco_atacado && <div className="flex justify-between"><span className="text-gray-600">Atacado</span><span className="font-semibold text-bendito-dourado-escuro">{formatBRL(p.preco_atacado)}</span></div>}
                  <div className="flex justify-between pt-1 border-t"><span className="text-gray-600">Estoque</span><span className={`font-semibold ${p.estoque_atual <= p.estoque_minimo ? 'text-red-600' : 'text-green-600'}`}>{p.estoque_atual} {p.unidade_medida}</span></div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => abrirEdicao(p)} className="flex-1 flex items-center justify-center gap-1 bg-bendito-dourado hover:bg-bendito-dourado-escuro text-bendito-verde-escuro font-semibold py-2 rounded-lg text-sm transition"><Edit size={15} /> Editar</button>
                  <button onClick={() => excluir(p)} className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar Produto' : 'Novo Produto'}>
        <div className="space-y-4">
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
