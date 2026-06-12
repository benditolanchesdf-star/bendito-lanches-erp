'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, RefreshCw, Clock, CheckCircle2, Truck, XCircle, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader, Loading, EmptyState, PrimaryButton, SecondaryButton, Field, Input, Select, Textarea } from '@/components/ui'
import Modal from '@/components/Modal'
import { FILIAL_ID, formatBRL, formatData } from '@/lib/constants'

// ─── tipos ────────────────────────────────────────────────────
type Status = 'pendente' | 'confirmado' | 'em_producao' | 'pronto' | 'saiu_entrega' | 'entregue' | 'cancelado'
type TipoEntrega = 'retirada' | 'entrega' | 'consumo_local'
type Canal = 'balcao' | 'whatsapp' | 'telefone' | 'app' | 'ifood'
type FormaPagamento = 'dinheiro' | 'cartao_debito' | 'cartao_credito' | 'pix' | 'misto' | 'fiado'

interface Cliente { id: string; nome: string; telefone: string | null }
interface Pedido {
  id: string
  numero: string
  filial_id: string
  cliente_id: string | null
  vendedor_id: string | null
  status: Status
  tipo_entrega: TipoEntrega
  canal: Canal | null
  subtotal: number
  desconto: number
  taxa_entrega: number
  total: number
  forma_pagamento: FormaPagamento | null
  observacoes: string | null
  created_at: string
  clientes: { nome: string } | null
  vendedor: { full_name: string } | null
}

// ─── helpers ──────────────────────────────────────────────────
const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: React.ElementType }> = {
  pendente:     { label: 'Pendente',        color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmado:   { label: 'Confirmado',      color: 'bg-blue-100 text-blue-800',     icon: CheckCircle2 },
  em_producao:  { label: 'Em produção',     color: 'bg-purple-100 text-purple-800', icon: Package },
  pronto:       { label: 'Pronto',          color: 'bg-green-100 text-green-800',   icon: CheckCircle2 },
  saiu_entrega: { label: 'Saiu p/ entrega', color: 'bg-orange-100 text-orange-800', icon: Truck },
  entregue:     { label: 'Entregue',        color: 'bg-gray-100 text-gray-600',     icon: CheckCircle2 },
  cancelado:    { label: 'Cancelado',       color: 'bg-red-100 text-red-700',       icon: XCircle },
}

const CANAL_LABEL: Record<string, string> = {
  balcao: 'Balcão', whatsapp: 'WhatsApp', telefone: 'Telefone', app: 'App', ifood: 'iFood',
}

const ENTREGA_LABEL: Record<string, string> = {
  retirada: 'Retirada', entrega: 'Entrega', consumo_local: 'Local',
}

const PROXIMO_STATUS: Partial<Record<Status, Status>> = {
  pendente:    'confirmado',
  confirmado:  'em_producao',
  em_producao: 'pronto',
  pronto:      'saiu_entrega',
  saiu_entrega:'entregue',
}

// ─── componente ───────────────────────────────────────────────
export default function PedidosPage() {
  const supabase = createClient()

  const [pedidos, setPedidos]       = useState<Pedido[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busca, setBusca]           = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('ativos')
  const [filtroCanal, setFiltroCanal]   = useState<string>('')

  // modal novo pedido
  const [modalAberto, setModalAberto] = useState(false)
  const [clientes, setClientes]       = useState<Cliente[]>([])
  const [salvando, setSalvando]       = useState(false)
  const [erro, setErro]               = useState('')
  const [form, setForm] = useState({
    cliente_id:      '',
    tipo_entrega:    'retirada' as TipoEntrega,
    canal:           'balcao' as Canal,
    forma_pagamento: 'pix' as FormaPagamento,
    observacoes:     '',
  })

  // ─── buscar pedidos ───────────────────────────────────────
  const buscarPedidos = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    else setRefreshing(true)

    let query = supabase
      .from('pedidos')
      .select(`
        id, numero, filial_id, cliente_id, vendedor_id,
        status, tipo_entrega, canal,
        subtotal, desconto, taxa_entrega, total,
        forma_pagamento, observacoes, created_at,
        clientes (nome),
        vendedor:profiles!pedidos_vendedor_id_fkey (full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (filtroStatus === 'ativos') {
      query = query.in('status', ['pendente', 'confirmado', 'em_producao', 'pronto', 'saiu_entrega'])
    } else if (filtroStatus !== 'todos') {
      query = query.eq('status', filtroStatus)
    }

    if (filtroCanal) query = query.eq('canal', filtroCanal)

    const { data, error } = await query
    if (!error && data) setPedidos(data as unknown as Pedido[])
    setLoading(false)
    setRefreshing(false)
  }, [filtroStatus, filtroCanal])

  useEffect(() => { buscarPedidos() }, [buscarPedidos])

  // ─── realtime ─────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('pedidos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        buscarPedidos(true)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [buscarPedidos])

  // ─── clientes para modal ──────────────────────────────────
  useEffect(() => {
    if (!modalAberto) return
    supabase
      .from('clientes')
      .select('id, nome, telefone')
      .eq('filial_id', FILIAL_ID)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => { if (data) setClientes(data) })
  }, [modalAberto])

  // ─── filtro local ─────────────────────────────────────────
  const pedidosFiltrados = pedidos.filter(p => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return (
      p.numero?.toLowerCase().includes(q) ||
      p.clientes?.nome?.toLowerCase().includes(q) ||
      p.vendedor?.full_name?.toLowerCase().includes(q)
    )
  })

  const contadores = pedidos.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // ─── salvar pedido ────────────────────────────────────────
  async function salvarPedido() {
    setErro('')
    setSalvando(true)
    const { error } = await supabase
      .from('pedidos')
      .insert({
        filial_id:       FILIAL_ID,
        cliente_id:      form.cliente_id || null,
        tipo_entrega:    form.tipo_entrega,
        canal:           form.canal,
        forma_pagamento: form.forma_pagamento,
        observacoes:     form.observacoes || null,
        subtotal: 0, desconto: 0, taxa_entrega: 0,
      })
      .select()

    if (error) {
      setErro('Erro ao criar pedido. Verifique os dados e tente novamente.')
      setSalvando(false)
      return
    }
    setModalAberto(false)
    setForm({ cliente_id: '', tipo_entrega: 'retirada', canal: 'balcao', forma_pagamento: 'pix', observacoes: '' })
    buscarPedidos(true)
    setSalvando(false)
  }

  // ─── mudar status ─────────────────────────────────────────
  async function mudarStatus(pedidoId: string, novoStatus: Status) {
    await supabase.from('pedidos').update({ status: novoStatus }).eq('id', pedidoId)
    buscarPedidos(true)
  }

  // ─── render ───────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title="Pedidos de Clientes"
          subtitle="Pedidos externos, entregas e retiradas"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => buscarPedidos(true)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
            title="Atualizar"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <PrimaryButton onClick={() => setModalAberto(true)}>
            <Plus size={16} className="mr-1" /> Novo Pedido
          </PrimaryButton>
        </div>
      </div>

      {/* KPIs clicáveis */}
      <div className="flex flex-wrap gap-2">
        {(['pendente', 'confirmado', 'em_producao', 'pronto', 'saiu_entrega'] as Status[]).map(s => {
          const cfg = STATUS_CONFIG[s]
          const Icon = cfg.icon
          const qty = contadores[s] || 0
          return (
            <button
              key={s}
              onClick={() => setFiltroStatus(filtroStatus === s ? 'ativos' : s)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition
                ${filtroStatus === s
                  ? `${cfg.color} border-current shadow-sm`
                  : 'bg-white border-gray-200 text-gray-600 hover:border-bendito-dourado'
                }`}
            >
              <Icon size={14} />
              {cfg.label}
              {qty > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs font-bold
                  ${filtroStatus === s ? 'bg-white/60' : 'bg-gray-100'}`}>
                  {qty}
                </span>
              )}
            </button>
          )
        })}
        <button
          onClick={() => setFiltroStatus('todos')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition
            ${filtroStatus === 'todos'
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white border-gray-200 text-gray-600 hover:border-bendito-dourado'
            }`}
        >
          Todos
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por número, cliente ou vendedor…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bendito-dourado"
            />
          </div>
          <select
            value={filtroCanal}
            onChange={e => setFiltroCanal(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bendito-dourado text-gray-600"
          >
            <option value="">Todos os canais</option>
            <option value="balcao">Balcão</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="telefone">Telefone</option>
            <option value="app">App</option>
            <option value="ifood">iFood</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <Loading />
      ) : pedidosFiltrados.length === 0 ? (
        <EmptyState
          title="Nenhum pedido encontrado"
          description={busca ? 'Tente ajustar os filtros de busca.' : 'Clique em "Novo Pedido" para começar.'}
        />
      ) : (
        <div className="space-y-2">
          {pedidosFiltrados.map(pedido => {
            const cfg = STATUS_CONFIG[pedido.status]
            const Icon = cfg.icon
            const proximo = PROXIMO_STATUS[pedido.status]

            return (
              <div key={pedido.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 hover:shadow-md transition">
                <div className="flex items-center gap-4 flex-wrap">

                  {/* Número + data — clicável para detalhe */}
                  <Link href={`/dashboard/pedidos/${pedido.id}`} className="min-w-32 group">
                    <p className="font-bold text-bendito-verde-escuro text-sm group-hover:underline">
                      {pedido.numero}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatData(pedido.created_at)}</p>
                  </Link>

                  {/* Cliente + vendedor */}
                  <div className="flex-1 min-w-40">
                    <p className="text-sm font-medium text-gray-800">
                      {pedido.clientes?.nome ?? <span className="text-gray-400 italic">Sem cliente</span>}
                    </p>
                    {pedido.vendedor?.full_name && (
                      <p className="text-xs text-gray-400 mt-0.5">Vendedor: {pedido.vendedor.full_name}</p>
                    )}
                  </div>

                  {/* Canal + tipo */}
                  <div className="hidden sm:block min-w-28 text-center">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {CANAL_LABEL[pedido.canal ?? ''] ?? pedido.canal}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{ENTREGA_LABEL[pedido.tipo_entrega]}</p>
                  </div>

                  {/* Total */}
                  <div className="min-w-24 text-right">
                    <p className="font-bold text-bendito-verde-escuro">{formatBRL(pedido.total)}</p>
                    {pedido.desconto > 0 && (
                      <p className="text-xs text-gray-400">-{formatBRL(pedido.desconto)}</p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="min-w-32 flex justify-end">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                      <Icon size={12} />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Avançar status */}
                  {proximo && pedido.status !== 'cancelado' && (
                    <button
                      onClick={() => mudarStatus(pedido.id, proximo)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-bendito-verde text-white hover:bg-bendito-verde-escuro transition font-medium whitespace-nowrap"
                    >
                      → {STATUS_CONFIG[proximo].label}
                    </button>
                  )}
                  {pedido.status === 'pendente' && (
                    <button
                      onClick={() => mudarStatus(pedido.id, 'cancelado')}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition"
                    >
                      Cancelar
                    </button>
                  )}
                </div>

                {pedido.observacoes && (
                  <p className="mt-2 text-xs text-gray-400 border-t border-gray-50 pt-2 truncate">
                    {pedido.observacoes}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Modal: Novo Pedido ─── */}
      <Modal isOpen={modalAberto} onClose={() => setModalAberto(false)} title="Novo Pedido">
        <div className="space-y-4">

          <Field label="Cliente">
            <Select
              value={form.cliente_id}
              onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
            >
              <option value="">— Sem cliente (balcão) —</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de entrega">
              <Select
                value={form.tipo_entrega}
                onChange={e => setForm(f => ({ ...f, tipo_entrega: e.target.value as TipoEntrega }))}
              >
                <option value="retirada">Retirada</option>
                <option value="entrega">Entrega</option>
                <option value="consumo_local">Consumo local</option>
              </Select>
            </Field>

            <Field label="Canal">
              <Select
                value={form.canal}
                onChange={e => setForm(f => ({ ...f, canal: e.target.value as Canal }))}
              >
                <option value="balcao">Balcão</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telefone">Telefone</option>
                <option value="app">App</option>
                <option value="ifood">iFood</option>
              </Select>
            </Field>
          </div>

          <Field label="Forma de pagamento">
            <Select
              value={form.forma_pagamento}
              onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value as FormaPagamento }))}
            >
              <option value="pix">Pix</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao_debito">Cartão débito</option>
              <option value="cartao_credito">Cartão crédito</option>
              <option value="misto">Misto</option>
              <option value="fiado">Fiado</option>
            </Select>
          </Field>

          <Field label="Observações">
            <Textarea
              rows={2}
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              placeholder="Ex: sem cebola, entregar às 12h…"
            />
          </Field>

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>
          )}

          <div className="flex gap-2 pt-1">
            <SecondaryButton onClick={() => setModalAberto(false)} className="flex-1">
              Cancelar
            </SecondaryButton>
            <PrimaryButton onClick={salvarPedido} disabled={salvando} className="flex-1">
              {salvando ? 'Criando…' : 'Criar Pedido'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
