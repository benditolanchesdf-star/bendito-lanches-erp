'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatData } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, Textarea, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Trash2, Eye, CheckCircle, XCircle, Send, Package, Search, X } from 'lucide-react'

const MATRIZ_ID = '11111111-1111-1111-1111-111111111111'

const STATUS: Record<string, { label: string; cor: string }> = {
  pendente:  { label: 'Pendente',   cor: 'bg-yellow-100 text-yellow-700' },
  aprovado:  { label: 'Aprovado',   cor: 'bg-blue-100 text-blue-700' },
  separando: { label: 'Separando',  cor: 'bg-purple-100 text-purple-700' },
  enviado:   { label: 'Enviado',    cor: 'bg-orange-100 text-orange-700' },
  recebido:  { label: 'Recebido',   cor: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado',  cor: 'bg-red-100 text-red-700' },
}

type ItemPedido = {
  produto_id: string | null
  nome: string
  quantidade: number
  unidade: string
  outros: boolean
}

export default function PedidosInternosPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [produtos, setProdutos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [filialAtual, setFilialAtual] = useState<string>(FILIAL_ID)

  // Novo pedido
  const [modalOpen, setModalOpen] = useState(false)
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [categoriaSel, setCategoriaSel] = useState('')

  // Campo Outros
  const [outroNome, setOutroNome] = useState('')
  const [outroQtd, setOutroQtd] = useState(1)
  const [outroUnidade, setOutroUnidade] = useState('un')

  // Cadastro rápido
  const [modalNovoProd, setModalNovoProd] = useState(false)
  const [salvandoProd, setSalvandoProd] = useState(false)
  const [formProd, setFormProd] = useState({
    nome: '', unidade_medida: 'un', categoria_id: '', descricao: '',
  })

  // Detalhe
  const [detalheOpen, setDetalheOpen] = useState(false)
  const [pedidoDetalhe, setPedidoDetalhe] = useState<any>(null)
  const [itensDetalhe, setItensDetalhe] = useState<any[]>([])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('papel').eq('id', user!.id).maybeSingle()
    const admin = profile?.papel === 'admin' || profile?.papel === 'matriz'
    setIsAdmin(admin)

    const [peds, prods, cats, fils] = await Promise.all([
      supabase.from('pedidos_internos')
        .select('*, filiais_origem:filial_origem(nome), filiais_destino:filial_destino(nome)')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('produtos')
        .select('id, nome, unidade_medida, categoria_id, categorias(nome)')
        .eq('ativo', true).eq('filial_id', MATRIZ_ID).order('nome'),
      supabase.from('categorias').select('id, nome').order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setPedidos(peds.data || [])
    setProdutos(prods.data || [])
    setCategorias(cats.data || [])
    setFiliais(fils.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Produtos filtrados por busca e categoria
  const prodsFiltrados = produtos.filter(p => {
    const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase())
    const matchCat = !categoriaSel || p.categoria_id === categoriaSel
    return matchBusca && matchCat
  })

  function addProduto(p: any) {
    setItens(prev => {
      const ex = prev.find(i => i.produto_id === p.id)
      if (ex) return prev.map(i => i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...prev, { produto_id: p.id, nome: p.nome, quantidade: 1, unidade: p.unidade_medida || 'un', outros: false }]
    })
  }

  function updateQtd(produto_id: string | null, idx: number, delta: number) {
    setItens(prev => prev.map((i, j) => j === idx ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i))
  }

  function addOutro() {
    if (!outroNome.trim()) return
    setItens(prev => [...prev, { produto_id: null, nome: outroNome.trim(), quantidade: outroQtd, unidade: outroUnidade, outros: true }])
    setOutroNome(''); setOutroQtd(1); setOutroUnidade('un')
  }

  async function salvarNovoProduto() {
    if (!formProd.nome.trim()) return
    setSalvandoProd(true)
    const { data: novoProd } = await supabase.from('produtos').insert({
      nome: formProd.nome,
      unidade_medida: formProd.unidade_medida || 'un',
      categoria_id: formProd.categoria_id || null,
      descricao: formProd.descricao || null,
      filial_id: MATRIZ_ID,
      ativo: true,
      preco_varejo: 0,
    }).select('id, nome, unidade_medida, categoria_id').single()

    if (novoProd) {
      // Criar produto_filial para a Matriz
      await supabase.from('produto_filial').insert({
        produto_id: novoProd.id, filial_id: MATRIZ_ID,
        estoque_atual: 0, estoque_minimo: 0,
      })
      // Adicionar ao carrinho do pedido
      setItens(prev => [...prev, {
        produto_id: novoProd.id, nome: novoProd.nome,
        quantidade: 1, unidade: novoProd.unidade_medida || 'un', outros: false,
      }])
      // Atualizar lista de produtos
      await load()
    }
    setSalvandoProd(false)
    setModalNovoProd(false)
    setFormProd({ nome: '', unidade_medida: 'un', categoria_id: '', descricao: '' })
  }

  async function salvar() {
    if (!itens.length) return
    setSalvando(true)
    const { data: pedido } = await supabase.from('pedidos_internos').insert({
      filial_origem: filialAtual,
      filial_destino: MATRIZ_ID,
      observacoes: obs || null,
    }).select('id').single()

    if (pedido) {
      await supabase.from('pedido_interno_itens').insert(
        itens.map(i => ({
          pedido_interno_id: pedido.id,
          produto_id: i.produto_id || null,
          quantidade_pedida: i.quantidade,
          unidade: i.unidade,
          observacao: i.outros ? `[OUTRO] ${i.nome}` : null,
        }))
      )
    }
    setSalvando(false); setModalOpen(false)
    setItens([]); setObs(''); setBusca(''); setCategoriaSel('')
    load()
  }

  async function verDetalhe(p: any) {
    const { data } = await supabase.from('pedido_interno_itens')
      .select('*, produtos(nome)').eq('pedido_interno_id', p.id)
    setPedidoDetalhe(p); setItensDetalhe(data || []); setDetalheOpen(true)
  }

  async function mudarStatus(id: string, status: string) {
    await supabase.from('pedidos_internos').update({ status }).eq('id', id)
    load()
    if (detalheOpen) {
      const { data } = await supabase.from('pedidos_internos')
        .select('*, filiais_origem:filial_origem(nome), filiais_destino:filial_destino(nome)').eq('id', id).maybeSingle()
      setPedidoDetalhe(data)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos Internos" subtitle="Solicitações de produtos da Filial para a Matriz"
        action={
          <PrimaryButton onClick={() => { setItens([]); setObs(''); setBusca(''); setCategoriaSel(''); setModalOpen(true) }}
            className="flex items-center gap-2">
            <Plus size={16} /> Novo Pedido
          </PrimaryButton>
        }
      />

      {/* Lista de pedidos */}
      {pedidos.length === 0 ? <EmptyState message="Nenhum pedido interno ainda." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Nº','Filial','Destino','Data','Status','Ações'].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y">
                {pedidos.map(p => {
                  const st = STATUS[p.status] || STATUS.pendente
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-bendito-verde-escuro">#{p.numero}</td>
                      <td className="px-4 py-3">{p.filiais_origem?.nome}</td>
                      <td className="px-4 py-3 text-gray-500">{p.filiais_destino?.nome}</td>
                      <td className="px-4 py-3 text-gray-500">{formatData(p.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cor}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => verDetalhe(p)} className="p-1.5 text-gray-400 hover:text-bendito-verde rounded"><Eye size={14}/></button>
                          {isAdmin && p.status === 'pendente' && <>
                            <button onClick={() => mudarStatus(p.id, 'aprovado')} className="p-1.5 text-gray-400 hover:text-green-600 rounded"><CheckCircle size={14}/></button>
                            <button onClick={() => mudarStatus(p.id, 'cancelado')} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><XCircle size={14}/></button>
                          </>}
                          {isAdmin && p.status === 'aprovado' && (
                            <button onClick={() => mudarStatus(p.id, 'separando')} className="p-1.5 text-gray-400 hover:text-purple-600 rounded"><Package size={14}/></button>
                          )}
                          {isAdmin && p.status === 'separando' && (
                            <button onClick={() => mudarStatus(p.id, 'enviado')} className="p-1.5 text-gray-400 hover:text-orange-500 rounded"><Send size={14}/></button>
                          )}
                          {!isAdmin && p.status === 'enviado' && (
                            <button onClick={() => mudarStatus(p.id, 'recebido')} className="p-1.5 text-gray-400 hover:text-green-600 rounded"><CheckCircle size={14}/></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal novo pedido ── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Novo Pedido Interno" size="xl">
        <div className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto pr-1">

          {/* Filial solicitante (admin) */}
          {isAdmin && filiais.length > 1 && (
            <Field label="Filial solicitante">
              <select value={filialAtual} onChange={e => setFilialAtual(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </Field>
          )}

          {/* ── Produtos cadastrados ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-bendito-verde-escuro">📦 Produtos cadastrados</p>
              <button onClick={() => setModalNovoProd(true)}
                className="flex items-center gap-1 text-xs text-bendito-verde font-semibold hover:underline">
                <Plus size={12}/> Cadastrar novo produto
              </button>
            </div>

            {/* Filtros */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..."
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"/>
                {busca && <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={13}/></button>}
              </div>
              <select value={categoriaSel} onChange={e => setCategoriaSel(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="">Todas as categorias</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            {/* Grid de produtos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto">
              {prodsFiltrados.map(p => {
                const noLista = itens.find(i => i.produto_id === p.id)
                return (
                  <button key={p.id} onClick={() => addProduto(p)}
                    className={`relative p-3 rounded-xl border text-left transition text-sm ${noLista ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-gray-50 hover:bg-bendito-creme border-gray-200 hover:border-bendito-verde'}`}>
                    <p className="font-semibold leading-tight">{p.nome}</p>
                    <p className={`text-xs mt-0.5 ${noLista ? 'text-white/80' : 'text-gray-400'}`}>
                      {(p.categorias as any)?.nome || 'Sem categoria'}
                    </p>
                    {noLista && (
                      <span className="absolute top-2 right-2 bg-white text-bendito-verde text-xs font-bold px-1.5 py-0.5 rounded-full">
                        {noLista.quantidade}
                      </span>
                    )}
                  </button>
                )
              })}
              {prodsFiltrados.length === 0 && (
                <p className="col-span-full text-center text-gray-400 text-sm py-4">
                  {produtos.length === 0 ? 'Nenhum produto cadastrado na Matriz.' : 'Nenhum produto encontrado.'}
                </p>
              )}
            </div>
          </div>

          {/* ── Campo Outros ── */}
          <div className="border border-dashed border-gray-300 rounded-xl p-4">
            <p className="text-sm font-bold text-gray-600 mb-3">➕ Outros (produto não cadastrado)</p>
            <div className="flex gap-2">
              <input value={outroNome} onChange={e => setOutroNome(e.target.value)}
                placeholder="Ex: Detergente, Saco de lixo, Frutas..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"/>
              <input type="number" min={1} value={outroQtd} onChange={e => setOutroQtd(Number(e.target.value))}
                className="w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none text-center"/>
              <input value={outroUnidade} onChange={e => setOutroUnidade(e.target.value)} placeholder="un"
                className="w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none text-center"/>
              <SecondaryButton onClick={addOutro} disabled={!outroNome.trim()}>Add</SecondaryButton>
            </div>
          </div>

          {/* ── Resumo do pedido ── */}
          {itens.length > 0 && (
            <div className="bg-bendito-creme rounded-xl p-4">
              <p className="text-sm font-bold text-bendito-verde-escuro mb-3">🛒 Itens do pedido ({itens.length})</p>
              <div className="space-y-2">
                {itens.map((i, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      {i.outros && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-semibold shrink-0">OUTRO</span>}
                      <span className="text-bendito-verde-escuro font-medium truncate">{i.nome}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => updateQtd(i.produto_id, idx, -1)}
                        className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xs font-bold">−</button>
                      <span className="font-bold text-bendito-verde w-6 text-center">{i.quantidade}</span>
                      <button onClick={() => updateQtd(i.produto_id, idx, 1)}
                        className="w-6 h-6 rounded-full bg-bendito-dourado hover:bg-bendito-dourado-escuro flex items-center justify-center text-xs font-bold text-bendito-verde-escuro">+</button>
                      <span className="text-gray-400 text-xs">{i.unidade}</span>
                      <button onClick={() => setItens(prev => prev.filter((_, j) => j !== idx))}
                        className="text-red-400 hover:text-red-600 ml-1"><X size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Field label="Observações gerais">
            <Textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder="Urgência, prazo, observações..." />
          </Field>

          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !itens.length} className="flex-1">
              {salvando ? 'Enviando...' : `Enviar Pedido (${itens.length} item${itens.length > 1 ? 's' : ''})`}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* ── Modal cadastrar novo produto ── */}
      <Modal isOpen={modalNovoProd} onClose={() => setModalNovoProd(false)} title="Cadastrar Novo Produto">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            O produto será cadastrado no catálogo da Matriz e ficará disponível para todas as filiais.
          </div>
          <Field label="Nome do produto" required>
            <Input value={formProd.nome} onChange={e => setFormProd({...formProd, nome: e.target.value})}
              placeholder="Ex: Detergente 500ml, Saco de lixo 100L..." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unidade de medida">
              <select value={formProd.unidade_medida} onChange={e => setFormProd({...formProd, unidade_medida: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {['un','kg','g','l','ml','cx','pct','fd','sc'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Categoria">
              <select value={formProd.categoria_id} onChange={e => setFormProd({...formProd, categoria_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="">Sem categoria</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Descrição (opcional)">
            <Input value={formProd.descricao} onChange={e => setFormProd({...formProd, descricao: e.target.value})}
              placeholder="Detalhes do produto..." />
          </Field>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalNovoProd(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvarNovoProduto} disabled={salvandoProd || !formProd.nome} className="flex-1">
              {salvandoProd ? 'Cadastrando...' : '✅ Cadastrar e adicionar'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* ── Modal detalhe ── */}
      <Modal isOpen={detalheOpen} onClose={() => setDetalheOpen(false)} title={`Pedido Interno #${pedidoDetalhe?.numero}`}>
        {pedidoDetalhe && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <p>De: <strong>{pedidoDetalhe.filiais_origem?.nome}</strong></p>
              <p>Para: <strong>{pedidoDetalhe.filiais_destino?.nome}</strong></p>
              <p>Data: <strong>{formatData(pedidoDetalhe.created_at)}</strong></p>
              <p>Status: <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS[pedidoDetalhe.status]?.cor}`}>{STATUS[pedidoDetalhe.status]?.label}</span></p>
            </div>
            {pedidoDetalhe.observacoes && (
              <p className="text-xs bg-yellow-50 border border-yellow-200 p-2 rounded">📝 {pedidoDetalhe.observacoes}</p>
            )}
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-500 border-b">
                {['Produto','Pedido','Enviado'].map(h => <th key={h} className="text-left pb-1">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y">
                {itensDetalhe.map(i => (
                  <tr key={i.id}>
                    <td className="py-2">
                      {i.observacao?.startsWith('[OUTRO]')
                        ? <span className="flex items-center gap-1">{i.observacao.replace('[OUTRO] ','')}<span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">outro</span></span>
                        : i.produtos?.nome
                      }
                    </td>
                    <td className="py-2">{i.quantidade_pedida} {i.unidade}</td>
                    <td className="py-2 text-green-600">{i.quantidade_enviada ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isAdmin && ['pendente','aprovado','separando'].includes(pedidoDetalhe.status) && (
              <div className="flex gap-2 pt-2 border-t flex-wrap">
                {pedidoDetalhe.status === 'pendente' && <>
                  <PrimaryButton onClick={() => mudarStatus(pedidoDetalhe.id, 'aprovado')} className="flex-1">✅ Aprovar</PrimaryButton>
                  <SecondaryButton onClick={() => mudarStatus(pedidoDetalhe.id, 'cancelado')} className="flex-1 text-red-600">❌ Cancelar</SecondaryButton>
                </>}
                {pedidoDetalhe.status === 'aprovado' && (
                  <PrimaryButton onClick={() => mudarStatus(pedidoDetalhe.id, 'separando')} className="flex-1">📦 Iniciar Separação</PrimaryButton>
                )}
                {pedidoDetalhe.status === 'separando' && (
                  <PrimaryButton onClick={() => mudarStatus(pedidoDetalhe.id, 'enviado')} className="flex-1">🚚 Marcar como Enviado</PrimaryButton>
                )}
              </div>
            )}
            {!isAdmin && pedidoDetalhe.status === 'enviado' && (
              <PrimaryButton onClick={() => { mudarStatus(pedidoDetalhe.id, 'recebido'); setDetalheOpen(false) }} className="w-full">
                ✅ Confirmar Recebimento
              </PrimaryButton>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
