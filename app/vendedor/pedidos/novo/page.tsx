'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL, FORMAS_PAGAMENTO } from '@/lib/constants'
import { Field, Input, Select, Textarea, PrimaryButton, SecondaryButton, PageHeader, Loading } from '@/components/ui'
import { Plus, Minus, Trash2, ShoppingCart, AlertTriangle } from 'lucide-react'

type Item = { produto_id: string; nome: string; valor_unitario: number; quantidade: number }

function VendedorNovoPedidoInner() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const clientePreSelecionado = params.get('cliente')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [vendedorId, setVendedorId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [produtos, setProdutos] = useState<any[]>([])

  const [clienteId, setClienteId] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('a_prazo')
  const [taxaEntrega, setTaxaEntrega] = useState(0)
  const [desconto, setDesconto] = useState(0)
  const [observacoes, setObservacoes] = useState('')
  const [dataEntrega, setDataEntrega] = useState('')
  const [horarioEntrega, setHorarioEntrega] = useState('')
  const [carrinho, setCarrinho] = useState<Item[]>([])
  const [buscaProd, setBuscaProd] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('vendedor_id').eq('id', user!.id).maybeSingle()
      setVendedorId(profile?.vendedor_id || null)

      const [cli, prod] = await Promise.all([
        supabase.from('clientes').select('id, nome, nome_loja, tipo, pedido_minimo, status_financeiro').order('nome'),
        supabase.from('produtos').select('id, nome, preco_varejo, preco_atacado').eq('ativo', true).order('nome'),
      ])
      setClientes(cli.data || [])
      setProdutos(prod.data || [])
      if (clientePreSelecionado) setClienteId(clientePreSelecionado)
      setLoading(false)
    }
    load()
  }, [])

  const cliente = clientes.find((c) => c.id === clienteId)
  const usarAtacado = cliente?.tipo !== 'varejo'

  function preco(p: any) {
    return usarAtacado && p.preco_atacado ? Number(p.preco_atacado) : Number(p.preco_varejo)
  }
  function addItem(p: any) {
    setCarrinho((prev) => {
      const ex = prev.find((i) => i.produto_id === p.id)
      if (ex) return prev.map((i) => i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...prev, { produto_id: p.id, nome: p.nome, valor_unitario: preco(p), quantidade: 1 }]
    })
  }
  function mudarQtd(id: string, delta: number) {
    setCarrinho((prev) => prev.map((i) => i.produto_id === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i))
  }
  function removerItem(id: string) { setCarrinho((prev) => prev.filter((i) => i.produto_id !== id)) }

  const subtotal = carrinho.reduce((s, i) => s + i.valor_unitario * i.quantidade, 0)
  const valorTotal = Math.max(0, subtotal + Number(taxaEntrega) - Number(desconto))
  const abaixoMinimo = cliente && Number(cliente.pedido_minimo) > 0 && valorTotal < Number(cliente.pedido_minimo)
  const bloqueado = cliente?.status_financeiro === 'bloqueado'

  async function salvar() {
    if (!clienteId) { alert('Selecione um cliente.'); return }
    if (carrinho.length === 0) { alert('Adicione produtos.'); return }
    if (bloqueado) { alert('Cliente bloqueado financeiramente. Solicite liberação à matriz.'); return }
    if (abaixoMinimo && !confirm(`Pedido abaixo do mínimo (${formatBRL(cliente.pedido_minimo)}). Continuar mesmo assim?`)) return

    setSalvando(true)
    const { data: pedido, error } = await supabase.from('pedidos').insert({
      filial_id: FILIAL_ID, cliente_id: clienteId, vendedor_id: vendedorId,
      canal: 'representante', status: 'pendente',
      subtotal, desconto: Number(desconto) || 0, taxa_entrega: Number(taxaEntrega) || 0, valor_total: valorTotal,
      forma_pagamento: formaPagamento, observacoes: observacoes || null,
      data_entrega: dataEntrega || null, horario_entrega: horarioEntrega || null,
      pedido_origem: 'vendedor',
    }).select('id').single()

    if (error || !pedido) { setSalvando(false); alert('Erro: ' + error?.message); return }

    const itens = carrinho.map((i) => ({
      filial_id: FILIAL_ID, pedido_id: pedido.id, produto_id: i.produto_id,
      quantidade: i.quantidade, valor_unitario: i.valor_unitario, valor_total: i.valor_unitario * i.quantidade,
    }))
    const { error: errItens } = await supabase.from('pedido_itens').insert(itens)
    setSalvando(false)
    if (errItens) { alert('Pedido criado, erro nos itens: ' + errItens.message); return }
    router.push('/vendedor/pedidos')
  }

  if (loading) return <Loading />

  const prodFiltrados = produtos.filter((p) => p.nome.toLowerCase().includes(buscaProd.toLowerCase()))

  return (
    <div className="space-y-6">
      <PageHeader title="Novo Pedido" subtitle="Em nome de um cliente da sua carteira" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-md p-4">
            <input value={buscaProd} onChange={(e) => setBuscaProd(e.target.value)} placeholder="Buscar produto..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-bendito-dourado" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {prodFiltrados.map((p) => (
              <button key={p.id} onClick={() => addItem(p)}
                className="bg-white rounded-xl shadow-md p-4 text-left hover:shadow-lg hover:ring-2 hover:ring-bendito-dourado transition">
                <div className="text-3xl mb-2">🍕</div>
                <p className="font-semibold text-sm text-bendito-verde-escuro leading-tight">{p.nome}</p>
                <p className="text-bendito-verde font-bold mt-1">{formatBRL(preco(p))}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-md p-5">
            <Field label="Cliente" required>
              <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Selecione um cliente...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome_loja || c.nome}</option>)}
              </Select>
            </Field>
            {bloqueado && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 flex gap-2">
                <AlertTriangle size={14} /> Cliente bloqueado financeiramente
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="text-bendito-dourado-escuro" size={20} />
              <h3 className="font-bold text-bendito-verde-escuro">Carrinho ({carrinho.length})</h3>
            </div>
            {carrinho.length === 0 ? <p className="text-sm text-gray-500 py-4 text-center">Adicione produtos.</p> : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {carrinho.map((i) => (
                  <div key={i.produto_id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{i.nome}</p>
                      <p className="text-xs text-gray-500">{formatBRL(i.valor_unitario)} cada</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => mudarQtd(i.produto_id, -1)} className="p-1 bg-gray-100 rounded"><Minus size={14} /></button>
                      <span className="w-6 text-center text-sm">{i.quantidade}</span>
                      <button onClick={() => mudarQtd(i.produto_id, 1)} className="p-1 bg-gray-100 rounded"><Plus size={14} /></button>
                      <button onClick={() => removerItem(i.produto_id)} className="p-1 text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md p-5 space-y-3">
            <Field label="Pagamento"><Select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>{FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data entrega"><Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} /></Field>
              <Field label="Horário"><Input type="time" value={horarioEntrega} onChange={(e) => setHorarioEntrega(e.target.value)} /></Field>
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
              <div className="flex justify-between"><span className="text-gray-600">Taxa</span><span>{formatBRL(taxaEntrega)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Desconto</span><span>- {formatBRL(desconto)}</span></div>
              <div className="flex justify-between text-lg font-bold text-bendito-verde-escuro pt-2 border-t mt-2"><span>Total</span><span>{formatBRL(valorTotal)}</span></div>
            </div>
            {abaixoMinimo && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded p-2 text-xs text-orange-700">
                Pedido abaixo do mínimo deste cliente ({formatBRL(cliente.pedido_minimo)}).
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <SecondaryButton onClick={() => router.push('/vendedor/pedidos')} className="flex-1">Cancelar</SecondaryButton>
              <PrimaryButton onClick={salvar} disabled={salvando || carrinho.length === 0 || !clienteId} className="flex-1">{salvando ? 'Salvando...' : 'Finalizar'}</PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VendedorNovoPedidoPage() {
  return <Suspense fallback={<Loading />}><VendedorNovoPedidoInner /></Suspense>
}
