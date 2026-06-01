'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL, FORMAS_PAGAMENTO } from '@/lib/constants'
import { Field, Input, Select, Textarea, PrimaryButton, SecondaryButton, PageHeader, Loading } from '@/components/ui'
import { Plus, Minus, Trash2, ShoppingCart, AlertTriangle, Repeat } from 'lucide-react'

type Item = { produto_id: string; nome: string; valor_unitario: number; quantidade: number }

function NovoPedidoCliente() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const repetirId = params.get('repetir')
  const favoritoId = params.get('favorito')

  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [cliente, setCliente] = useState<any>(null)
  const [produtos, setProdutos] = useState<any[]>([])
  const [carrinho, setCarrinho] = useState<Item[]>([])
  const [buscaProd, setBuscaProd] = useState('')

  const [formaPagamento, setFormaPagamento] = useState('a_prazo')
  const [observacoes, setObservacoes] = useState('')
  const [dataEntrega, setDataEntrega] = useState('')
  const [horarioEntrega, setHorarioEntrega] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('cliente_id').eq('id', user!.id).maybeSingle()

      const promises: any[] = [
        supabase.from('produtos').select('id, nome, preco_varejo, preco_atacado').eq('ativo', true).order('nome'),
      ]
      if (profile?.cliente_id) {
        promises.push(supabase.from('clientes').select('*').eq('id', profile.cliente_id).single())
      }
      const [prodRes, cliRes] = await Promise.all(promises)
      setProdutos(prodRes.data || [])
      const c = cliRes?.data
      setCliente(c)

      // Se veio com ?favorito=ID → carrega itens do pedido favorito
      if (favoritoId && c) {
        const { data: itens } = await supabase
          .from('pedidos_favoritos_itens')
          .select('quantidade, valor_unitario, produtos(id, nome)')
          .eq('pedido_favorito_id', favoritoId)
          .limit(50)
        if (itens && itens.length) {
          setCarrinho(itens.map((i: any) => ({
            produto_id: i.produtos.id,
            nome: i.produtos.nome,
            valor_unitario: Number(i.valor_unitario),
            quantidade: i.quantidade,
          })))
        }
        setLoading(false)
        return
      }

      // Se veio com ?repetir=ID ou ?repetir=true → carrega último pedido
      if (repetirId && c) {
        let q = supabase.from('pedido_itens').select('quantidade, valor_unitario, produtos(id, nome)').limit(50)
        if (repetirId === 'true') {
          const { data: ult } = await supabase.from('pedidos')
            .select('id').eq('cliente_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (ult?.id) q = q.eq('pedido_id', ult.id)
          else { setLoading(false); return }
        } else {
          q = q.eq('pedido_id', repetirId)
        }
        const { data: itens } = await q
        if (itens && itens.length) {
          setCarrinho(itens.map((i: any) => ({
            produto_id: i.produtos.id,
            nome: i.produtos.nome,
            valor_unitario: Number(i.valor_unitario),
            quantidade: i.quantidade,
          })))
        }
      }
      setLoading(false)
    }
    load()
  }, [repetirId, favoritoId])

  const usarAtacado = cliente?.tipo !== 'varejo'
  function preco(p: any) { return usarAtacado && p.preco_atacado ? Number(p.preco_atacado) : Number(p.preco_varejo) }
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
  const valorTotal = subtotal
  const abaixoMinimo = cliente && Number(cliente.pedido_minimo) > 0 && valorTotal < Number(cliente.pedido_minimo)
  const bloqueado = cliente?.status_financeiro === 'bloqueado'

  async function salvar() {
    if (carrinho.length === 0) { alert('Adicione produtos.'); return }
    if (bloqueado) { alert('Sua loja está temporariamente bloqueada. Fale com seu vendedor.'); return }
    if (abaixoMinimo && !confirm(`Pedido abaixo do mínimo da sua loja (${formatBRL(cliente.pedido_minimo)}). Continuar mesmo assim?`)) return
    if (!cliente) { alert('Cliente não identificado.'); return }

    setSalvando(true)
    const { data: pedido, error } = await supabase.from('pedidos').insert({
      filial_id: FILIAL_ID, cliente_id: cliente.id,
      vendedor_id: cliente.vendedor_responsavel_id || null,
      canal: 'atacado', status: 'pendente',
      subtotal, desconto: 0, taxa_entrega: 0, valor_total: valorTotal,
      forma_pagamento: formaPagamento, observacoes: observacoes || null,
      data_entrega: dataEntrega || null, horario_entrega: horarioEntrega || null,
      pedido_origem: 'cliente',
      pedido_repetido_de: repetirId && repetirId !== 'true' ? repetirId : null,
    }).select('id').single()

    if (error || !pedido) { setSalvando(false); alert('Erro: ' + error?.message); return }

    const itens = carrinho.map((i) => ({
      filial_id: FILIAL_ID, pedido_id: pedido.id, produto_id: i.produto_id,
      quantidade: i.quantidade, valor_unitario: i.valor_unitario, valor_total: i.valor_unitario * i.quantidade,
    }))
    const { error: errItens } = await supabase.from('pedido_itens').insert(itens)
    setSalvando(false)
    if (errItens) { alert('Pedido criado, erro nos itens: ' + errItens.message); return }
    router.push('/cliente/pedidos')
  }

  if (loading) return <Loading />

  const prodFiltrados = produtos.filter((p) => p.nome.toLowerCase().includes(buscaProd.toLowerCase()))

  return (
    <div className="space-y-6">
      <PageHeader title="Novo Pedido" subtitle={repetirId ? 'Pedido carregado a partir do anterior — ajuste e finalize' : 'Selecione os produtos e finalize'} />

      {repetirId && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2 text-blue-700 text-sm">
          <Repeat size={18} /> Você pode alterar quantidades, remover ou adicionar itens antes de finalizar.
        </div>
      )}

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
            <Field label="Observações"><Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></Field>
          </div>

          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="flex justify-between text-lg font-bold text-bendito-verde-escuro">
              <span>Total</span><span>{formatBRL(valorTotal)}</span>
            </div>
            {abaixoMinimo && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded p-2 text-xs text-orange-700 flex gap-2">
                <AlertTriangle size={14} /> Pedido abaixo do mínimo da sua loja ({formatBRL(cliente.pedido_minimo)}).
              </div>
            )}
            {bloqueado && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 flex gap-2">
                <AlertTriangle size={14} /> Sua loja está com pendências. Fale com seu vendedor antes de finalizar.
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <SecondaryButton onClick={() => router.push('/cliente')} className="flex-1">Cancelar</SecondaryButton>
              <PrimaryButton onClick={salvar} disabled={salvando || carrinho.length === 0} className="flex-1">{salvando ? 'Enviando...' : 'Enviar Pedido'}</PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense fallback={<Loading />}><NovoPedidoCliente /></Suspense>
}
