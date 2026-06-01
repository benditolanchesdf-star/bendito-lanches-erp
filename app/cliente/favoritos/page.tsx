'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL, FORMAS_PAGAMENTO } from '@/lib/constants'
import Modal from '@/components/Modal'
import {
  Field, Input, Select, Textarea,
  PrimaryButton, SecondaryButton,
  PageHeader, Loading, EmptyState,
} from '@/components/ui'
import { Star, Plus, Trash2, ShoppingCart, Edit, Repeat } from 'lucide-react'

type Item = { produto_id: string; nome: string; valor_unitario: number; quantidade: number }

export default function FavoritosPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [cliente, setCliente] = useState<any>(null)
  const [produtos, setProdutos] = useState<any[]>([])
  const [favoritos, setFavoritos] = useState<any[]>([])
  const [itensCache, setItensCache] = useState<Record<string, Item[]>>({})

  // Modal criar/editar favorito
  const [modalOpen, setModalOpen] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nomeFav, setNomeFav] = useState('')
  const [obsFav, setObsFav] = useState('')
  const [carrinho, setCarrinho] = useState<Item[]>([])
  const [buscaProd, setBuscaProd] = useState('')

  // Modal usar favorito (confirmar pedido)
  const [modalPedidoOpen, setModalPedidoOpen] = useState(false)
  const [favSelecionado, setFavSelecionado] = useState<any>(null)
  const [dataEntrega, setDataEntrega] = useState('')
  const [horarioEntrega, setHorarioEntrega] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('a_prazo')
  const [obsEntrega, setObsEntrega] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('cliente_id').eq('id', user!.id).maybeSingle()
    if (!profile?.cliente_id) { setLoading(false); return }

    const [cliRes, favRes, prodRes] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', profile.cliente_id).single(),
      supabase.from('pedidos_favoritos').select('*').eq('cliente_id', profile.cliente_id).eq('ativo', true).order('nome'),
      supabase.from('produtos').select('id, nome, preco_varejo, preco_atacado').eq('ativo', true).order('nome'),
    ])
    setCliente(cliRes.data)
    setFavoritos(favRes.data || [])
    setProdutos(prodRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const usarAtacado = cliente?.tipo !== 'varejo'
  function preco(p: any) { return usarAtacado && p.preco_atacado ? Number(p.preco_atacado) : Number(p.preco_varejo) }

  async function carregarItens(favId: string) {
    if (itensCache[favId]) return
    const { data } = await supabase
      .from('pedidos_favoritos_itens')
      .select('quantidade, valor_unitario, produtos(id, nome)')
      .eq('pedido_favorito_id', favId)
    const itens: Item[] = (data || []).map((i: any) => ({
      produto_id: i.produtos.id,
      nome: i.produtos.nome,
      valor_unitario: Number(i.valor_unitario),
      quantidade: i.quantidade,
    }))
    setItensCache((c) => ({ ...c, [favId]: itens }))
    return itens
  }

  // --- Criar / Editar favorito ---
  async function abrirNovo() {
    setEditandoId(null)
    setNomeFav('')
    setObsFav('')
    setCarrinho([])
    setBuscaProd('')
    setModalOpen(true)
  }

  async function abrirEdicao(fav: any) {
    setEditandoId(fav.id)
    setNomeFav(fav.nome_favorito)
    setObsFav(fav.observacoes || '')
    setBuscaProd('')
    // carrega itens para edição
    let itens = itensCache[fav.id]
    if (!itens) {
      itens = (await carregarItens(fav.id)) || []
    }
    setCarrinho(itens)
    setModalOpen(true)
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

  async function salvarFavorito() {
    if (!nomeFav.trim()) { alert('Dê um nome para este pedido favorito.'); return }
    if (carrinho.length === 0) { alert('Adicione pelo menos um produto.'); return }
    setSalvando(true)

    if (editandoId) {
      // Atualiza nome/obs
      await supabase.from('pedidos_favoritos').update({ nome_favorito: nomeFav.trim(), observacoes: obsFav || null }).eq('id', editandoId)
      // Recria itens
      await supabase.from('pedidos_favoritos_itens').delete().eq('pedido_favorito_id', editandoId)
      await supabase.from('pedidos_favoritos_itens').insert(
        carrinho.map((i) => ({ pedido_favorito_id: editandoId, produto_id: i.produto_id, quantidade: i.quantidade, valor_unitario: i.valor_unitario }))
      )
      setItensCache((c) => ({ ...c, [editandoId]: carrinho }))
    } else {
      const { data: novoFav } = await supabase.from('pedidos_favoritos').insert({
        cliente_id: cliente.id, nome_favorito: nomeFav.trim(), observacoes: obsFav || null, ativo: true,
      }).select('id').single()
      if (novoFav) {
        await supabase.from('pedidos_favoritos_itens').insert(
          carrinho.map((i) => ({ pedido_favorito_id: novoFav.id, produto_id: i.produto_id, quantidade: i.quantidade, valor_unitario: i.valor_unitario }))
        )
        setItensCache((c) => ({ ...c, [novoFav.id]: carrinho }))
      }
    }

    setSalvando(false)
    setModalOpen(false)
    load()
  }

  async function excluirFavorito(id: string) {
    if (!confirm('Excluir este pedido favorito?')) return
    await supabase.from('pedidos_favoritos').update({ ativo: false }).eq('id', id)
    load()
  }

  // --- Usar favorito como pedido ---
  async function abrirPedido(fav: any) {
    let itens = itensCache[fav.id]
    if (!itens) {
      itens = (await carregarItens(fav.id)) || []
    }
    setFavSelecionado({ ...fav, itens })
    setDataEntrega('')
    setHorarioEntrega('')
    setFormaPagamento('a_prazo')
    setObsEntrega('')
    setModalPedidoOpen(true)
  }

  async function enviarPedido() {
    if (!favSelecionado?.itens?.length) return
    if (!dataEntrega) { alert('Informe a data de entrega.'); return }
    setEnviando(true)

    const subtotal = favSelecionado.itens.reduce((s: number, i: Item) => s + i.valor_unitario * i.quantidade, 0)
    const { data: pedido, error } = await supabase.from('pedidos').insert({
      filial_id: FILIAL_ID,
      cliente_id: cliente.id,
      vendedor_id: cliente.vendedor_responsavel_id || null,
      canal: 'atacado',
      status: 'pendente',
      subtotal,
      desconto: 0,
      taxa_entrega: 0,
      valor_total: subtotal,
      forma_pagamento: formaPagamento,
      observacoes: obsEntrega || favSelecionado.observacoes || null,
      data_entrega: dataEntrega,
      horario_entrega: horarioEntrega || null,
      pedido_origem: 'cliente',
    }).select('id').single()

    if (error || !pedido) { setEnviando(false); alert('Erro: ' + error?.message); return }

    await supabase.from('pedido_itens').insert(
      favSelecionado.itens.map((i: Item) => ({
        filial_id: FILIAL_ID,
        pedido_id: pedido.id,
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        valor_unitario: i.valor_unitario,
        valor_total: i.valor_unitario * i.quantidade,
      }))
    )

    setEnviando(false)
    setModalPedidoOpen(false)
    router.push('/cliente/pedidos')
  }

  if (loading) return <Loading />

  const prodFiltrados = produtos.filter((p) =>
    p.nome.toLowerCase().includes(buscaProd.toLowerCase()) &&
    !carrinho.find((i) => i.produto_id === p.id)
  )
  const subtotalCarrinho = carrinho.reduce((s, i) => s + i.valor_unitario * i.quantidade, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos Favoritos"
        subtitle="Salve seus pedidos mais comuns e envie com um clique"
        action={
          <PrimaryButton onClick={abrirNovo} className="flex items-center gap-2">
            <Plus size={18} /> Novo Favorito
          </PrimaryButton>
        }
      />

      {favoritos.length === 0 ? (
        <EmptyState message="Você ainda não tem pedidos favoritos. Crie um para agilizar seus pedidos recorrentes!" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {favoritos.map((fav) => {
            const itens = itensCache[fav.id]
            const total = itens ? itens.reduce((s, i) => s + i.valor_unitario * i.quantidade, 0) : null
            return (
              <div key={fav.id} className="bg-white rounded-xl shadow-md p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Star size={20} className="text-bendito-dourado flex-shrink-0" fill="currentColor" />
                    <h3 className="font-bold text-bendito-verde-escuro leading-tight">{fav.nome_favorito}</h3>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => abrirEdicao(fav)} className="p-1.5 text-gray-400 hover:text-bendito-verde rounded-lg hover:bg-gray-100">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => excluirFavorito(fav.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {fav.observacoes && <p className="text-xs text-gray-500">{fav.observacoes}</p>}

                {/* Itens — carrega ao montar */}
                <FavoritoItens
                  favId={fav.id}
                  cache={itensCache}
                  onLoad={(id, itens) => setItensCache((c) => ({ ...c, [id]: itens }))}
                  supabase={supabase}
                />

                {total !== null && (
                  <p className="text-sm font-bold text-bendito-verde">{formatBRL(total)}</p>
                )}

                <div className="flex gap-2 mt-auto">
                  <PrimaryButton onClick={() => abrirPedido(fav)} className="flex-1 flex items-center justify-center gap-2 text-sm">
                    <ShoppingCart size={16} /> Pedir agora
                  </PrimaryButton>
                  <SecondaryButton
                    onClick={() => router.push(`/cliente/pedido-novo?favorito=${fav.id}`)}
                    className="flex items-center gap-1 text-sm px-3"
                    title="Editar quantidades antes de enviar"
                  >
                    <Repeat size={16} />
                  </SecondaryButton>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Criar / Editar favorito */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editandoId ? 'Editar favorito' : 'Novo pedido favorito'}>
        <div className="space-y-4">
          <Field label="Nome do favorito" required>
            <Input value={nomeFav} onChange={(e) => setNomeFav(e.target.value)} placeholder="Ex: Pedido Segunda-feira, Combo Festa..." />
          </Field>
          <Field label="Observação (opcional)">
            <Input value={obsFav} onChange={(e) => setObsFav(e.target.value)} placeholder="Ex: Sem cebola, embalagem especial..." />
          </Field>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Busca produtos */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Adicionar produtos</p>
              <Input
                value={buscaProd}
                onChange={(e) => setBuscaProd(e.target.value)}
                placeholder="Buscar produto..."
                className="mb-2"
              />
              <div className="space-y-1 max-h-52 overflow-y-auto border rounded-lg">
                {prodFiltrados.length === 0 ? (
                  <p className="text-xs text-gray-400 p-3 text-center">Nenhum produto encontrado.</p>
                ) : prodFiltrados.map((p) => (
                  <button key={p.id} onClick={() => addItem(p)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-bendito-creme text-left transition">
                    <span className="text-sm">{p.nome}</span>
                    <span className="text-xs text-bendito-verde font-semibold">{formatBRL(preco(p))}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Carrinho */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Itens do favorito</p>
              <div className="border rounded-lg min-h-[100px] max-h-52 overflow-y-auto">
                {carrinho.length === 0 ? (
                  <p className="text-xs text-gray-400 p-4 text-center">Adicione produtos ao lado.</p>
                ) : (
                  <>
                    {carrinho.map((i) => (
                      <div key={i.produto_id} className="flex items-center gap-2 px-3 py-2 border-b last:border-0">
                        <span className="flex-1 text-sm truncate">{i.nome}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => mudarQtd(i.produto_id, -1)} className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-sm">−</button>
                          <span className="w-7 text-center text-sm font-semibold">{i.quantidade}</span>
                          <button onClick={() => mudarQtd(i.produto_id, 1)} className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-sm">+</button>
                          <button onClick={() => removerItem(i.produto_id)} className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600">×</button>
                        </div>
                      </div>
                    ))}
                    <div className="px-3 py-2 text-sm font-bold text-bendito-verde border-t">
                      Total estimado: {formatBRL(subtotalCarrinho)}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvarFavorito} disabled={salvando} className="flex-1">
              {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar favorito'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar pedido a partir do favorito */}
      <Modal isOpen={modalPedidoOpen} onClose={() => setModalPedidoOpen(false)} title={`Pedido: ${favSelecionado?.nome_favorito}`}>
        <div className="space-y-4">
          {favSelecionado?.itens && (
            <div className="bg-bendito-creme/50 rounded-lg p-3 space-y-1">
              {favSelecionado.itens.map((i: Item) => (
                <div key={i.produto_id} className="flex justify-between text-sm">
                  <span>{i.quantidade}x {i.nome}</span>
                  <span className="font-semibold">{formatBRL(i.valor_unitario * i.quantidade)}</span>
                </div>
              ))}
              <div className="border-t pt-1 flex justify-between font-bold text-bendito-verde">
                <span>Total</span>
                <span>{formatBRL(favSelecionado.itens.reduce((s: number, i: Item) => s + i.valor_unitario * i.quantidade, 0))}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data de entrega" required>
              <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
            </Field>
            <Field label="Horário">
              <Input type="time" value={horarioEntrega} onChange={(e) => setHorarioEntrega(e.target.value)} />
            </Field>
          </div>
          <Field label="Forma de pagamento">
            <Select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
              {FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </Field>
          <Field label="Observações">
            <Textarea rows={2} value={obsEntrega} onChange={(e) => setObsEntrega(e.target.value)} placeholder="Observações adicionais..." />
          </Field>

          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalPedidoOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={enviarPedido} disabled={enviando} className="flex-1 flex items-center justify-center gap-2">
              <ShoppingCart size={16} />
              {enviando ? 'Enviando...' : 'Confirmar pedido'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Sub-componente que carrega itens automaticamente ao montar
function FavoritoItens({ favId, cache, onLoad, supabase }: {
  favId: string
  cache: Record<string, Item[]>
  onLoad: (id: string, itens: Item[]) => void
  supabase: any
}) {
  useEffect(() => {
    if (cache[favId]) return
    supabase
      .from('pedidos_favoritos_itens')
      .select('quantidade, valor_unitario, produtos(id, nome)')
      .eq('pedido_favorito_id', favId)
      .then(({ data }: any) => {
        const itens: Item[] = (data || []).map((i: any) => ({
          produto_id: i.produtos.id,
          nome: i.produtos.nome,
          valor_unitario: Number(i.valor_unitario),
          quantidade: i.quantidade,
        }))
        onLoad(favId, itens)
      })
  }, [favId])

  const itens = cache[favId]
  if (!itens) return <p className="text-xs text-gray-400 animate-pulse">Carregando...</p>
  if (itens.length === 0) return <p className="text-xs text-gray-400">Nenhum item.</p>

  return (
    <div className="space-y-0.5 text-xs text-gray-600">
      {itens.slice(0, 4).map((i) => (
        <p key={i.produto_id}>{i.quantidade}× {i.nome}</p>
      ))}
      {itens.length > 4 && <p className="text-gray-400">+{itens.length - 4} outros itens</p>}
    </div>
  )
}
