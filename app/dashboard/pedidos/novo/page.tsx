'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL, CANAIS, FORMAS_PAGAMENTO } from '@/lib/constants'
import { Field, Input, Select, Textarea, PrimaryButton, SecondaryButton, PageHeader, Loading } from '@/components/ui'
import { Plus, Minus, Trash2, ShoppingCart } from 'lucide-react'

type ItemCarrinho = { produto_id: string; nome: string; valor_unitario: number; quantidade: number }

export default function NovoPedidoPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [produtos, setProdutos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [vendedores, setVendedores] = useState<any[]>([])

  const [clienteId, setClienteId] = useState('')
  const [vendedorId, setVendedorId] = useState('')
  const [canal, setCanal] = useState('balcao')
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [taxaEntrega, setTaxaEntrega] = useState(0)
  const [desconto, setDesconto] = useState(0)
  const [observacoes, setObservacoes] = useState('')
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [buscaProduto, setBuscaProduto] = useState('')

  useEffect(() => {
    async function load() {
      const [prod, cli, vend] = await Promise.all([
        supabase.from('produtos').select('id, nome, preco_varejo, preco_atacado').eq('ativo', true).order('nome'),
        supabase.from('clientes').select('id, nome, tipo').eq('ativo', true).order('nome'),
        supabase.from('vendedores').select('id, nome').eq('ativo', true).order('nome'),
      ])
      setProdutos(prod.data || [])
      setClientes(cli.data || [])
      setVendedores(vend.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const clienteSelecionado = clientes.find((c) => c.id === clienteId)
  const usarAtacado = canal === 'atacado' || canal === 'representante' || clienteSelecionado?.tipo === 'atacado'

  function precoProduto(p: any) {
    return usarAtacado && p.preco_atacado ? Number(p.preco_atacado) : Number(p.preco_varejo)
  }

  function addProduto(p: any) {
    setCarrinho((prev) => {
      const existe = prev.find((i) => i.produto_id === p.id)
      if (existe) return prev.map((i) => i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...prev, { produto_id: p.id, nome: p.nome, valor_unitario: precoProduto(p), quantidade: 1 }]
    })
  }
  function mudarQtd(id: string, delta: number) {
    setCarrinho((prev) => prev.map((i) => i.produto_id === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i))
  }
  function removerItem(id: string) {
    setCarrinho((prev) => prev.filter((i) => i.produto_id !== id))
  }

  const subtotal = carrinho.reduce((s, i) => s + i.valor_unitario * i.quantidade, 0)
  const valorTotal = Math.max(0, subtotal + Number(taxaEntrega) - Number(desconto))

  async function salvarPedido() {
    if (carrinho.length === 0) { alert('Adicione ao menos um produto.'); return }
    setSalvando(true)

    // 1. cria o pedido
    const { data: pedido, error: errPedido } = await supabase
      .from('pedidos')
      .insert({
        filial_id: FILIAL_ID,
        cliente_id: clienteId || null,
        vendedor_id: vendedorId || null,
        canal,
        status: 'pendente',
        subtotal,
        desconto: Number(desconto) || 0,
        taxa_entrega: Number(taxaEntrega) || 0,
        valor_total: valorTotal,
        forma_pagamento: formaPagamento,
        observacoes: observacoes || null,
      })
      .select('id')
      .single()

    if (errPedido || !pedido) { setSalvando(false); alert('Erro ao criar pedido: ' + errPedido?.message); return }

    // 2. cria os itens
    const itens = carrinho.map((i) => ({
      filial_id: FILIAL_ID,
      pedido_id: pedido.id,
      produto_id: i.produto_id,
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
      valor_total: i.valor_unitario * i.quantidade,
    }))
    const { error: errItens } = await supabase.from('pedido_itens').insert(itens)

    setSalvando(false)
    if (errItens) { alert('Pedido criado, mas houve erro nos itens: ' + errItens.message); return }
    router.push('/dashboard/pedidos')
    router.refresh()
  }

  if (loading) return <Loading />

  const produtosFiltrados = produtos.filter((p) => p.nome.toLowerCase().includes(buscaProduto.toLowerCase()))

  return (
    <div className="space-y-6">
      <PageHeader title="Novo Pedido" subtitle="Monte o pedido e finalize" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Catálogo */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-md p-4">
            <input value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)} placeholder="Buscar produto..." className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-bendito-dourado" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {produtosFiltrados.map((p) => (
              <button key={p.id} onClick={() => addProduto(p)} className="bg-white rounded-xl shadow-md p-4 text-left hover:shadow-lg hover:ring-2 hover:ring-bendito-dourado transition">
                <div className="text-3xl mb-2">🍕</div>
                <p className="font-semibold text-sm text-bendito-verde-escuro leading-tight">{p.nome}</p>
                <p className="text-bendito-verde font-bold mt-1">{formatBRL(precoProduto(p))}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Carrinho + dados */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="text-bendito-dourado-escuro" size={20} />
              <h3 className="font-bold text-bendito-verde-escuro">Carrinho ({carrinho.length})</h3>
            </div>
            {carrinho.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Toque nos produtos para adicionar.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {carrinho.map((i) => (
                  <div key={i.produto_id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{i.nome}</p>
                      <p className="text-xs text-gray-500">{formatBRL(i.valor_unitario)} cada</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => mudarQtd(i.produto_id, -1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Minus size={14} /></button>
                      <span className="w-6 text-center text-sm">{i.quantidade}</span>
                      <button onClick={() => mudarQtd(i.produto_id, 1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Plus size={14} /></button>
                      <button onClick={() => removerItem(i.produto_id)} className="p-1 text-red-500 hover:bg-red-50 rounded ml-1"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md p-5 space-y-3">
            <Field label="Cliente">
              <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Consumidor (sem cadastro)</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>)}
              </Select>
            </Field>
            <Field label="Vendedor">
              <Select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
                <option value="">Nenhum</option>
                {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Canal"><Select value={canal} onChange={(e) => setCanal(e.target.value)}>{CANAIS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
              <Field label="Pagamento"><Select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>{FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</Select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Taxa entrega"><Input type="number" step="0.01" value={taxaEntrega} onChange={(e) => setTaxaEntrega(Number(e.target.value))} /></Field>
              <Field label="Desconto"><Input type="number" step="0.01" value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} /></Field>
            </div>
            <Field label="Observações"><Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></Field>
          </div>

          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{formatBRL(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Taxa entrega</span><span>{formatBRL(taxaEntrega)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Desconto</span><span>- {formatBRL(desconto)}</span></div>
              <div className="flex justify-between text-lg font-bold text-bendito-verde-escuro pt-2 border-t mt-2"><span>Total</span><span>{formatBRL(valorTotal)}</span></div>
            </div>
            <div className="flex gap-3 mt-4">
              <SecondaryButton onClick={() => router.push('/dashboard/pedidos')} className="flex-1">Cancelar</SecondaryButton>
              <PrimaryButton onClick={salvarPedido} disabled={salvando || carrinho.length === 0} className="flex-1">{salvando ? 'Salvando...' : 'Finalizar'}</PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
