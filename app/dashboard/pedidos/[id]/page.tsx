'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Search, Package, PenLine, Check, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader, Loading, EmptyState, PrimaryButton, SecondaryButton, Field, Input } from '@/components/ui'
import { formatBRL, formatData } from '@/lib/constants'

// ─── tipos ────────────────────────────────────────────────────
type Status = 'pendente' | 'confirmado' | 'em_producao' | 'pronto' | 'saiu_entrega' | 'entregue' | 'cancelado'

interface Produto {
  id: string
  nome: string
  preco_venda: number
  unidade: string | null
}

interface Item {
  id: string
  produto_id: string | null
  descricao_livre: string | null
  quantidade: number
  preco_unitario: number
  desconto_item: number
  subtotal: number
  observacao: string | null
  produtos: { nome: string; unidade: string | null } | null
}

interface Pedido {
  id: string
  numero: string
  status: Status
  tipo_entrega: string
  canal: string | null
  forma_pagamento: string | null
  subtotal: number
  desconto: number
  taxa_entrega: number
  total: number
  observacoes: string | null
  created_at: string
  clientes: { nome: string; telefone: string | null } | null
  vendedor: { full_name: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', confirmado: 'Confirmado', em_producao: 'Em produção',
  pronto: 'Pronto', saiu_entrega: 'Saiu p/ entrega', entregue: 'Entregue', cancelado: 'Cancelado',
}

const STATUS_COLOR: Record<string, string> = {
  pendente:     'bg-yellow-100 text-yellow-800',
  confirmado:   'bg-blue-100 text-blue-800',
  em_producao:  'bg-purple-100 text-purple-800',
  pronto:       'bg-green-100 text-green-800',
  saiu_entrega: 'bg-orange-100 text-orange-800',
  entregue:     'bg-gray-100 text-gray-600',
  cancelado:    'bg-red-100 text-red-700',
}

const PODE_EDITAR: Status[] = ['pendente', 'confirmado']

// ─── componente ───────────────────────────────────────────────
export default function PedidoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [pedido, setPedido]     = useState<Pedido | null>(null)
  const [itens, setItens]       = useState<Item[]>([])
  const [loading, setLoading]   = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')

  // busca produto
  const [busca, setBusca]               = useState('')
  const [produtos, setProdutos]         = useState<Produto[]>([])
  const [buscando, setBuscando]         = useState(false)
  const [mostrarBusca, setMostrarBusca] = useState(false)

  // modo item livre
  const [modoLivre, setModoLivre] = useState(false)

  // form adição
  const [formItem, setFormItem] = useState({
    produto_id:      '',
    produto_nome:    '',
    descricao_livre: '',
    quantidade:      '1',
    preco_unitario:  '',
    desconto_item:   '0',
    observacao:      '',
  })

  // ─── carregar pedido + itens ──────────────────────────────
  const carregarPedido = useCallback(async () => {
    const [{ data: p }, { data: i }] = await Promise.all([
      supabase
        .from('pedidos')
        .select(`
          id, numero, status, tipo_entrega, canal, forma_pagamento,
          subtotal, desconto, taxa_entrega, total, observacoes, created_at,
          clientes (nome, telefone),
          vendedor:profiles!pedidos_vendedor_id_fkey (full_name)
        `)
        .eq('id', id)
        .single(),
      supabase
        .from('pedido_itens')
        .select(`
          id, produto_id, descricao_livre,
          quantidade, preco_unitario, desconto_item, subtotal, observacao,
          produtos (nome, unidade)
        `)
        .eq('pedido_id', id)
        .order('created_at'),
    ])
    if (p) setPedido(p as unknown as Pedido)
    if (i) setItens(i as unknown as Item[])
    setLoading(false)
  }, [id])

  useEffect(() => { carregarPedido() }, [carregarPedido])

  // ─── buscar produtos com debounce ─────────────────────────
  useEffect(() => {
    if (!busca || busca.length < 2) { setProdutos([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      const { data } = await supabase
        .from('produtos')
        .select('id, nome, preco_venda, unidade')
        .ilike('nome', `%${busca}%`)
        .eq('ativo', true)
        .limit(10)
      setProdutos(data ?? [])
      setBuscando(false)
    }, 300)
    return () => clearTimeout(t)
  }, [busca])

  // ─── selecionar produto ───────────────────────────────────
  function selecionarProduto(p: Produto) {
    setFormItem(f => ({
      ...f,
      produto_id:     p.id,
      produto_nome:   p.nome,
      preco_unitario: String(p.preco_venda ?? ''),
    }))
    setBusca(p.nome)
    setProdutos([])
    setMostrarBusca(false)
  }

  // ─── recalcular subtotal do pedido ────────────────────────
  async function recalcularSubtotal() {
    const { data } = await supabase
      .from('pedido_itens')
      .select('subtotal')
      .eq('pedido_id', id)
    const total = (data ?? []).reduce((s, r) => s + (r.subtotal ?? 0), 0)
    await supabase.from('pedidos').update({ subtotal: total }).eq('id', id)
  }

  // ─── adicionar item ───────────────────────────────────────
  async function adicionarItem() {
    setErro('')
    const qtd   = parseFloat(formItem.quantidade)
    const preco = parseFloat(formItem.preco_unitario)
    const desc  = parseFloat(formItem.desconto_item || '0')

    if (!modoLivre && !formItem.produto_id) { setErro('Selecione um produto.'); return }
    if (modoLivre && !formItem.descricao_livre.trim()) { setErro('Informe a descrição do item.'); return }
    if (isNaN(qtd) || qtd <= 0) { setErro('Quantidade inválida.'); return }
    if (isNaN(preco) || preco < 0) { setErro('Preço inválido.'); return }

    setSalvando(true)
    const { error } = await supabase
      .from('pedido_itens')
      .insert({
        pedido_id:       id,
        produto_id:      modoLivre ? null : formItem.produto_id,
        descricao_livre: modoLivre ? formItem.descricao_livre.trim() : null,
        quantidade:      qtd,
        preco_unitario:  preco,
        desconto_item:   desc,
        observacao:      formItem.observacao.trim() || null,
      })
      .select()

    if (error) { setErro('Erro ao adicionar item.'); setSalvando(false); return }

    await recalcularSubtotal()
    setFormItem({ produto_id: '', produto_nome: '', descricao_livre: '', quantidade: '1', preco_unitario: '', desconto_item: '0', observacao: '' })
    setBusca('')
    setModoLivre(false)
    await carregarPedido()
    setSalvando(false)
  }

  // ─── remover item ─────────────────────────────────────────
  async function removerItem(itemId: string) {
    await supabase.from('pedido_itens').delete().eq('id', itemId)
    await recalcularSubtotal()
    await carregarPedido()
  }

  // ─── confirmar pedido ─────────────────────────────────────
  async function confirmarPedido() {
    if (itens.length === 0) { setErro('Adicione ao menos um item antes de confirmar.'); return }
    setSalvando(true)
    await supabase.from('pedidos').update({ status: 'confirmado' }).eq('id', id)
    await carregarPedido()
    setSalvando(false)
  }

  const podeEditar = pedido ? PODE_EDITAR.includes(pedido.status) : false

  // ─── render ───────────────────────────────────────────────
  if (loading) return <Loading />
  if (!pedido) return (
    <EmptyState message="Pedido não encontrado. Verifique o número e tente novamente." />
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Cabeçalho */}
      <div className="flex items-start gap-4 flex-wrap">
        <button
          onClick={() => router.back()}
          className="mt-1 p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <PageHeader
            title={pedido.numero}
            subtitle={`Criado em ${formatData(pedido.created_at)}${pedido.clientes ? ` · ${pedido.clientes.nome}` : ''}`}
          />
        </div>
        <span className={`self-start mt-1 px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[pedido.status]}`}>
          {STATUS_LABEL[pedido.status]}
        </span>
      </div>

      {/* Info resumida */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Cliente</p>
            <p className="font-medium text-gray-800">{pedido.clientes?.nome ?? '—'}</p>
            {pedido.clientes?.telefone && (
              <p className="text-xs text-gray-400">{pedido.clientes.telefone}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Vendedor</p>
            <p className="font-medium text-gray-800">{pedido.vendedor?.full_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Entrega</p>
            <p className="font-medium text-gray-800 capitalize">{pedido.tipo_entrega.replace('_', ' ')}</p>
            <p className="text-xs text-gray-400 capitalize">{pedido.canal}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Pagamento</p>
            <p className="font-medium text-gray-800 capitalize">{pedido.forma_pagamento?.replace('_', ' ') ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Adicionar item */}
      {podeEditar && (
        <div className="bg-white rounded-xl border border-bendito-dourado/30 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-bendito-verde-escuro text-sm">Adicionar item</h3>
            <div className="flex gap-2">
              <button
                onClick={() => { setModoLivre(false); setFormItem(f => ({ ...f, descricao_livre: '' })) }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition
                  ${!modoLivre
                    ? 'bg-bendito-verde text-white border-bendito-verde'
                    : 'border-gray-200 text-gray-500 hover:border-bendito-dourado'
                  }`}
              >
                <Package size={12} /> Produto
              </button>
              <button
                onClick={() => { setModoLivre(true); setFormItem(f => ({ ...f, produto_id: '', produto_nome: '' })); setBusca('') }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition
                  ${modoLivre
                    ? 'bg-bendito-dourado text-white border-bendito-dourado'
                    : 'border-gray-200 text-gray-500 hover:border-bendito-dourado'
                  }`}
              >
                <PenLine size={12} /> Item livre
              </button>
            </div>
          </div>

          {/* Busca de produto */}
          {!modoLivre && (
            <div className="relative">
              <Field label="Produto">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={busca}
                    onChange={e => {
                      setBusca(e.target.value)
                      setMostrarBusca(true)
                      setFormItem(f => ({ ...f, produto_id: '', produto_nome: '' }))
                    }}
                    onFocus={() => setMostrarBusca(true)}
                    placeholder="Digite o nome do produto…"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bendito-dourado"
                  />
                </div>
              </Field>
              {mostrarBusca && (buscando || produtos.length > 0) && (
                <div className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                  {buscando && <p className="text-xs text-gray-400 px-4 py-3">Buscando…</p>}
                  {produtos.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selecionarProduto(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-bendito-creme transition flex items-center justify-between"
                    >
                      <span className="text-sm text-gray-800">{p.nome}</span>
                      <span className="text-xs text-bendito-verde font-medium ml-3 shrink-0">
                        {formatBRL(p.preco_venda)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {formItem.produto_nome && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <Check size={11} /> {formItem.produto_nome} selecionado
                </p>
              )}
            </div>
          )}

          {/* Item livre */}
          {modoLivre && (
            <Field label="Descrição do item">
              <Input
                value={formItem.descricao_livre}
                onChange={e => setFormItem(f => ({ ...f, descricao_livre: e.target.value }))}
                placeholder="Ex: Refrigerante lata, Embalagem extra…"
              />
            </Field>
          )}

          {/* Qtd / Preço / Desconto */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Quantidade">
              <Input
                type="number"
                min="0.001"
                step="1"
                value={formItem.quantidade}
                onChange={e => setFormItem(f => ({ ...f, quantidade: e.target.value }))}
              />
            </Field>
            <Field label="Preço unitário (R$)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formItem.preco_unitario}
                onChange={e => setFormItem(f => ({ ...f, preco_unitario: e.target.value }))}
                placeholder="0,00"
              />
            </Field>
            <Field label="Desconto (R$)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formItem.desconto_item}
                onChange={e => setFormItem(f => ({ ...f, desconto_item: e.target.value }))}
                placeholder="0,00"
              />
            </Field>
          </div>

          <Field label="Observação do item (opcional)">
            <Input
              value={formItem.observacao}
              onChange={e => setFormItem(f => ({ ...f, observacao: e.target.value }))}
              placeholder="Ex: sem cebola, bem passado…"
            />
          </Field>

          {/* Preview subtotal */}
          {formItem.preco_unitario && formItem.quantidade && (
            <div className="bg-bendito-creme rounded-lg px-4 py-2 text-sm flex items-center justify-between">
              <span className="text-gray-600">Subtotal do item</span>
              <span className="font-bold text-bendito-verde-escuro">
                {formatBRL(
                  Math.max(0,
                    parseFloat(formItem.quantidade || '0') *
                    parseFloat(formItem.preco_unitario || '0') -
                    parseFloat(formItem.desconto_item || '0')
                  )
                )}
              </span>
            </div>
          )}

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle size={14} /> {erro}
            </p>
          )}

          <PrimaryButton onClick={adicionarItem} disabled={salvando} className="w-full">
            <Plus size={15} className="mr-1" />
            {salvando ? 'Adicionando…' : 'Adicionar item'}
          </PrimaryButton>
        </div>
      )}

      {/* Lista de itens */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-bendito-verde-escuro text-sm">
            Itens do pedido
            <span className="ml-2 text-xs font-normal text-gray-400">({itens.length})</span>
          </h3>
          {pedido.subtotal > 0 && (
            <span className="text-sm font-bold text-bendito-verde-escuro">{formatBRL(pedido.subtotal)}</span>
          )}
        </div>

        {itens.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-400">Nenhum item adicionado ainda.</p>
            {podeEditar && <p className="text-xs text-gray-300 mt-1">Use o formulário acima para adicionar.</p>}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {itens.map((item, i) => {
              const nome = item.produtos?.nome ?? item.descricao_livre ?? '—'
              const isLivre = !item.produto_id
              return (
                <div key={item.id} className="px-5 py-3 flex items-center gap-4">
                  <span className="text-xs text-gray-300 w-5 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium truncate">
                      {nome}
                      {isLivre && (
                        <span className="ml-2 text-xs bg-bendito-dourado/20 text-bendito-dourado-escuro px-1.5 py-0.5 rounded">
                          livre
                        </span>
                      )}
                    </p>
                    {item.observacao && (
                      <p className="text-xs text-gray-400 truncate">{item.observacao}</p>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 text-right shrink-0 min-w-20">
                    <p>{item.quantidade} × {formatBRL(item.preco_unitario)}</p>
                    {item.desconto_item > 0 && (
                      <p className="text-red-400">-{formatBRL(item.desconto_item)}</p>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-bendito-verde-escuro shrink-0 min-w-20 text-right">
                    {formatBRL(item.subtotal)}
                  </p>
                  {podeEditar && (
                    <button
                      onClick={() => removerItem(item.id)}
                      className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Totais */}
        {itens.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span>{formatBRL(pedido.subtotal)}</span>
            </div>
            {pedido.desconto > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>Desconto</span><span>-{formatBRL(pedido.desconto)}</span>
              </div>
            )}
            {pedido.taxa_entrega > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Taxa de entrega</span><span>{formatBRL(pedido.taxa_entrega)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-bendito-verde-escuro pt-1 border-t border-gray-200">
              <span>Total</span><span>{formatBRL(pedido.total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Confirmar pedido */}
      {pedido.status === 'pendente' && itens.length > 0 && (
        <div className="flex justify-end">
          <PrimaryButton onClick={confirmarPedido} disabled={salvando}>
            <Check size={15} className="mr-1" />
            {salvando ? 'Confirmando…' : 'Confirmar pedido'}
          </PrimaryButton>
        </div>
      )}

      {/* Observações */}
      {pedido.observacoes && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-1">Observações</p>
          <p className="text-sm text-gray-700">{pedido.observacoes}</p>
        </div>
      )}
    </div>
  )
}
