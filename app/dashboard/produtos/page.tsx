'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL } from '@/lib/constants'
import Modal from '@/components/Modal'
import { Field, Input, Select, Textarea, PrimaryButton, SecondaryButton, PageHeader, Loading, EmptyState } from '@/components/ui'
import { Plus, Edit, Trash2, Search, Link, LinkIcon } from 'lucide-react'

type Produto = any

export default function ProdutosPage() {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [pricingProdutos, setPricingProdutos] = useState<any[]>([])
  const [pricingDiretos, setPricingDiretos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({})

  async function load() {
    setLoading(true)
    const [prod, cat, pp, pd] = await Promise.all([
      supabase.from('produtos')
        .select('*, categorias(nome), pricing_products(name, applied_price), pricing_direct_products(name, applied_price)')
        .order('nome'),
      supabase.from('categorias').select('id, nome').order('nome'),
      supabase.from('pricing_products').select('id, name, applied_price').eq('filial_id', FILIAL_ID).eq('status', 'active').order('name'),
      supabase.from('pricing_direct_products').select('id, name, applied_price').eq('filial_id', FILIAL_ID).eq('status', 'active').order('name'),
    ])
    setProdutos(prod.data || [])
    setCategorias(cat.data || [])
    setPricingProdutos(pp.data || [])
    setPricingDiretos(pd.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Resolve o preço efetivo: se vinculado à precificação usa applied_price, senão usa preco_varejo manual
  function precoEfetivo(p: Produto): number {
    if (p.pricing_products?.applied_price) return Number(p.pricing_products.applied_price)
    if (p.pricing_direct_products?.applied_price) return Number(p.pricing_direct_products.applied_price)
    return Number(p.preco_varejo || 0)
  }

  function isVinculado(p: Produto): boolean {
    return !!(p.pricing_product_id || p.pricing_direct_product_id)
  }

  function abrirNovo() {
    setEditando(null)
    setForm({
      nome: '', codigo: '', categoria_id: '',
      preco_varejo: '', preco_atacado: '', custo_producao: '',
      estoque_atual: 0, estoque_minimo: 0, unidade_medida: 'unidade', descricao: '',
      pricing_product_id: '', pricing_direct_product_id: '',
      tipo_vinculo: 'manual',
    })
    setModalOpen(true)
  }

  function abrirEdicao(p: Produto) {
    setEditando(p)
    const tipoVinculo = p.pricing_product_id ? 'ficha' : p.pricing_direct_product_id ? 'direta' : 'manual'
    setForm({
      ...p,
      categoria_id: p.categoria_id || '',
      pricing_product_id: p.pricing_product_id || '',
      pricing_direct_product_id: p.pricing_direct_product_id || '',
      tipo_vinculo: tipoVinculo,
    })
    setModalOpen(true)
  }

  async function salvar() {
    setSalvando(true)
    const payload: any = {
      filial_id: FILIAL_ID,
      nome: form.nome,
      codigo: form.codigo || null,
      categoria_id: form.categoria_id || null,
      custo_producao: Number(form.custo_producao) || 0,
      estoque_atual: Number(form.estoque_atual) || 0,
      estoque_minimo: Number(form.estoque_minimo) || 0,
      unidade_medida: form.unidade_medida || 'unidade',
      descricao: form.descricao || null,
    }

    // Vínculo de precificação
    if (form.tipo_vinculo === 'ficha' && form.pricing_product_id) {
      payload.pricing_product_id = form.pricing_product_id
      payload.pricing_direct_product_id = null
      // Sincroniza preco_varejo com o applied_price da precificação
      const pp = pricingProdutos.find(p => p.id === form.pricing_product_id)
      payload.preco_varejo = pp ? Number(pp.applied_price) : Number(form.preco_varejo) || 0
      payload.preco_atacado = form.preco_atacado ? Number(form.preco_atacado) : null
    } else if (form.tipo_vinculo === 'direta' && form.pricing_direct_product_id) {
      payload.pricing_direct_product_id = form.pricing_direct_product_id
      payload.pricing_product_id = null
      const pd = pricingDiretos.find(p => p.id === form.pricing_direct_product_id)
      payload.preco_varejo = pd ? Number(pd.applied_price) : Number(form.preco_varejo) || 0
      payload.preco_atacado = form.preco_atacado ? Number(form.preco_atacado) : null
    } else {
      // Manual — sem vínculo
      payload.pricing_product_id = null
      payload.pricing_direct_product_id = null
      payload.preco_varejo = Number(form.preco_varejo) || 0
      payload.preco_atacado = form.preco_atacado ? Number(form.preco_atacado) : null
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

  // Nome do vínculo para exibir no card
  function labelVinculo(p: Produto): string | null {
    if (p.pricing_products?.name) return `Ficha: ${p.pricing_products.name}`
    if (p.pricing_direct_products?.name) return `Direta: ${p.pricing_direct_products.name}`
    return null
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        subtitle="Catálogo de produtos — vincule à precificação para preço automático"
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
              <div className="h-28 bg-gradient-to-br from-bendito-verde to-bendito-dourado flex items-center justify-center text-5xl relative">
                🍕
                {isVinculado(p) && (
                  <span className="absolute top-2 right-2 bg-white/90 text-bendito-verde rounded-full p-1" title="Preço vinculado à precificação">
                    <LinkIcon size={13} />
                  </span>
                )}
              </div>
              <div className="p-4">
                <span className="text-xs text-gray-500 uppercase">{p.categorias?.nome || 'Sem categoria'}</span>
                <h3 className="font-bold text-bendito-verde-escuro">{p.nome}</h3>

                {labelVinculo(p) && (
                  <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                    <LinkIcon size={10} /> {labelVinculo(p)}
                  </p>
                )}

                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Varejo</span>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-bendito-verde">{formatBRL(precoEfetivo(p))}</span>
                      {isVinculado(p) && <span className="text-xs text-blue-500">(auto)</span>}
                    </div>
                  </div>
                  {p.preco_atacado && <div className="flex justify-between"><span className="text-gray-600">Atacado</span><span className="font-semibold text-bendito-dourado-escuro">{formatBRL(p.preco_atacado)}</span></div>}
                  <div className="flex justify-between pt-1 border-t">
                    <span className="text-gray-600">Estoque</span>
                    <span className={`font-semibold ${p.estoque_atual <= p.estoque_minimo ? 'text-red-600' : 'text-green-600'}`}>{p.estoque_atual} {p.unidade_medida}</span>
                  </div>
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
          <Field label="Nome" required>
            <Input value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Código">
              <Input value={form.codigo || ''} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </Field>
            <Field label="Categoria">
              <Select value={form.categoria_id || ''} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
                <option value="">Selecione...</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Field>
          </div>

          {/* Vínculo de precificação */}
          <div className="border rounded-xl p-4 space-y-3 bg-blue-50/50">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <LinkIcon size={15} className="text-blue-500" /> Precificação
            </p>

            <Field label="Tipo de preço">
              <Select value={form.tipo_vinculo || 'manual'} onChange={(e) => setForm({ ...form, tipo_vinculo: e.target.value, pricing_product_id: '', pricing_direct_product_id: '' })}>
                <option value="manual">Manual — informar preço manualmente</option>
                <option value="ficha">Vinculado — Ficha Técnica (precificação)</option>
                <option value="direta">Vinculado — Precificação Direta (revenda)</option>
              </Select>
            </Field>

            {form.tipo_vinculo === 'ficha' && (
              <Field label="Produto da Ficha Técnica">
                <Select value={form.pricing_product_id || ''} onChange={(e) => setForm({ ...form, pricing_product_id: e.target.value })}>
                  <option value="">Selecione...</option>
                  {pricingProdutos.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {formatBRL(p.applied_price)}</option>
                  ))}
                </Select>
                {form.pricing_product_id && (
                  <p className="text-xs text-blue-600 mt-1">
                    ✓ Preço varejo será sincronizado automaticamente: {formatBRL(pricingProdutos.find(p => p.id === form.pricing_product_id)?.applied_price || 0)}
                  </p>
                )}
              </Field>
            )}

            {form.tipo_vinculo === 'direta' && (
              <Field label="Produto de Revenda">
                <Select value={form.pricing_direct_product_id || ''} onChange={(e) => setForm({ ...form, pricing_direct_product_id: e.target.value })}>
                  <option value="">Selecione...</option>
                  {pricingDiretos.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {formatBRL(p.applied_price)}</option>
                  ))}
                </Select>
                {form.pricing_direct_product_id && (
                  <p className="text-xs text-blue-600 mt-1">
                    ✓ Preço varejo será sincronizado automaticamente: {formatBRL(pricingDiretos.find(p => p.id === form.pricing_direct_product_id)?.applied_price || 0)}
                  </p>
                )}
              </Field>
            )}

            {form.tipo_vinculo === 'manual' && (
              <div className="grid grid-cols-3 gap-4">
                <Field label="Preço Varejo" required>
                  <Input type="number" step="0.01" value={form.preco_varejo ?? ''} onChange={(e) => setForm({ ...form, preco_varejo: e.target.value })} />
                </Field>
                <Field label="Preço Atacado">
                  <Input type="number" step="0.01" value={form.preco_atacado ?? ''} onChange={(e) => setForm({ ...form, preco_atacado: e.target.value })} />
                </Field>
                <Field label="Custo">
                  <Input type="number" step="0.01" value={form.custo_producao ?? ''} onChange={(e) => setForm({ ...form, custo_producao: e.target.value })} />
                </Field>
              </div>
            )}

            {form.tipo_vinculo !== 'manual' && (
              <Field label="Preço Atacado (opcional — manual)">
                <Input type="number" step="0.01" value={form.preco_atacado ?? ''} onChange={(e) => setForm({ ...form, preco_atacado: e.target.value })} placeholder="Deixe vazio para usar o mesmo do varejo" />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Estoque Atual">
              <Input type="number" value={form.estoque_atual ?? 0} onChange={(e) => setForm({ ...form, estoque_atual: e.target.value })} />
            </Field>
            <Field label="Estoque Mínimo">
              <Input type="number" value={form.estoque_minimo ?? 0} onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })} />
            </Field>
            <Field label="Unidade">
              <Input value={form.unidade_medida || ''} onChange={(e) => setForm({ ...form, unidade_medida: e.target.value })} />
            </Field>
          </div>

          <Field label="Descrição">
            <Textarea rows={2} value={form.descricao || ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </Field>

          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.nome} className="flex-1">
              {salvando ? 'Salvando...' : 'Salvar'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
