'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData } from '@/lib/constants'
import Modal from '@/components/Modal'
import {
  PageHeader, Loading, EmptyState, PrimaryButton, SecondaryButton,
  Field, Input, Select,
} from '@/components/ui'
import {
  Search, RefreshCw, Filter, Eye, Package, Factory, Truck,
  AlertTriangle, CheckCircle2, Clock, XCircle, ChevronRight,
  Phone, MapPin, User, FileText, ShoppingCart,
} from 'lucide-react'
import { gerarOPDePedido, buscarOPDoPedido } from '@/lib/api/ordens'

// ════════════════════════════════════════════════════════════
// Configuração de status (visual e regras de negócio)
// ════════════════════════════════════════════════════════════
const STATUS_CONFIG: Record<string, { label: string; cor: string; icon: any }> = {
  rascunho:           { label: 'Rascunho',          cor: 'bg-gray-100 text-gray-600',     icon: FileText },
  pendente:           { label: 'Pendente',          cor: 'bg-yellow-100 text-yellow-700', icon: Clock },
  em_analise:         { label: 'Em análise',        cor: 'bg-amber-100 text-amber-700',   icon: AlertTriangle },
  confirmado:         { label: 'Confirmado',        cor: 'bg-blue-100 text-blue-700',     icon: CheckCircle2 },
  producao:           { label: 'Em produção',       cor: 'bg-indigo-100 text-indigo-700', icon: Factory },
  em_producao:        { label: 'Em produção',       cor: 'bg-indigo-100 text-indigo-700', icon: Factory },
  pronto:             { label: 'Pronto',            cor: 'bg-emerald-100 text-emerald-700', icon: Package },
  separado:           { label: 'Separado',          cor: 'bg-emerald-100 text-emerald-700', icon: Package },
  saiu_entrega:       { label: 'Saiu p/ entrega',   cor: 'bg-cyan-100 text-cyan-700',     icon: Truck },
  saiu_para_entrega:  { label: 'Saiu p/ entrega',   cor: 'bg-cyan-100 text-cyan-700',     icon: Truck },
  entregue:           { label: 'Entregue',          cor: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  baixado:            { label: 'Baixado',           cor: 'bg-gray-200 text-gray-600',     icon: CheckCircle2 },
  problema_entrega:   { label: 'Problema entrega',  cor: 'bg-red-100 text-red-700',       icon: AlertTriangle },
  cancelado:          { label: 'Cancelado',         cor: 'bg-gray-200 text-gray-500',     icon: XCircle },
}

const PODE_GERAR_OP = ['pendente', 'em_analise', 'confirmado']

const FILTROS_STATUS = [
  { value: 'todos',     label: 'Todos' },
  { value: 'ativos',    label: 'Ativos (sem cancelado/entregue)' },
  { value: 'pendente',  label: 'Pendentes' },
  { value: 'confirmado',label: 'Confirmados' },
  { value: 'producao',  label: 'Em produção' },
  { value: 'pronto',    label: 'Prontos' },
  { value: 'entregue',  label: 'Entregues' },
  { value: 'cancelado', label: 'Cancelados' },
]

// ════════════════════════════════════════════════════════════
// Página principal
// ════════════════════════════════════════════════════════════
export default function PedidosPage() {
  const supabase = createClient()
  const [pedidos, setPedidos] = useState<any[]>([])
  const [opsPorPedido, setOpsPorPedido] = useState<Record<string, { id: string; numero_ordem: number }>>({})
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('ativos')
  const [busca, setBusca] = useState('')
  const [pedidoSel, setPedidoSel] = useState<any>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro' | 'info'; texto: string } | null>(null)
  const [gerandoOPId, setGerandoOPId] = useState<string | null>(null)

  // ── Carregar pedidos ──
  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('pedidos')
      .select(`
        id, numero_pedido, status, canal, valor_total, subtotal, desconto, taxa_entrega,
        forma_pagamento, status_pagamento, tipo_entrega, endereco_entrega,
        data_entrega, observacoes, observacoes_internas, cpf_cliente,
        created_at, filial_id, cliente_id, vendedor_id,
        clientes (id, nome, nome_loja, telefone, endereco),
        vendedores (id, nome),
        filiais (id, nome)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (filtroStatus === 'ativos') {
      q = q.not('status', 'in', '(cancelado,baixado,entregue)')
    } else if (filtroStatus !== 'todos') {
      // Mapeia para múltiplos valores de enum quando há sinônimos
      if (filtroStatus === 'producao') {
        q = q.in('status', ['producao', 'em_producao'])
      } else if (filtroStatus === 'pronto') {
        q = q.in('status', ['pronto', 'separado'])
      } else if (filtroStatus === 'entregue') {
        q = q.in('status', ['entregue', 'baixado'])
      } else {
        q = q.eq('status', filtroStatus)
      }
    }

    const { data, error } = await q
    if (error) {
      setFeedback({ tipo: 'erro', texto: 'Erro ao carregar: ' + error.message })
      setLoading(false)
      return
    }

    const lista = data || []
    setPedidos(lista)

    // Pega OPs vinculadas em batch
    if (lista.length > 0) {
      const ids = lista.map((p) => p.id)
      const { data: ops } = await supabase
        .from('ordens_producao')
        .select('id, numero_ordem, pedido_id, status')
        .in('pedido_id', ids)
        .neq('status', 'cancelada')

      const mapa: Record<string, { id: string; numero_ordem: number }> = {}
      ;(ops || []).forEach((op: any) => {
        if (!mapa[op.pedido_id]) {
          mapa[op.pedido_id] = { id: op.id, numero_ordem: op.numero_ordem }
        }
      })
      setOpsPorPedido(mapa)
    }

    setLoading(false)
  }, [filtroStatus])

  useEffect(() => { load() }, [load])

  // ── Auto-dismiss do feedback ──
  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 5000)
    return () => clearTimeout(t)
  }, [feedback])

  // ── Realtime: pedidos novos / atualizados ──
  useEffect(() => {
    const ch = supabase
      .channel('pedidos_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => load()
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, supabase])

  // ── Gerar OP ──
  async function handleGerarOP(pedido: any) {
    if (!confirm(`Gerar ordem de produção para o pedido #${pedido.numero_pedido}?`)) return
    setGerandoOPId(pedido.id)
    const r = await gerarOPDePedido(pedido.id)
    setGerandoOPId(null)

    if (!r.ok) {
      setFeedback({ tipo: 'erro', texto: r.erro || 'Falha ao gerar OP.' })
      return
    }

    if (r.jaExistia) {
      setFeedback({
        tipo: 'info',
        texto: `Pedido #${pedido.numero_pedido} já tinha a OP #${r.numeroOrdem}.`,
      })
    } else {
      const extra = (r.itensPulados ?? 0) > 0
        ? ` (${r.itensPulados} item(ns) de revenda foram ignorados)`
        : ''
      setFeedback({
        tipo: 'ok',
        texto: `OP #${r.numeroOrdem} criada com ${r.itensCriados} itens${extra}.`,
      })
    }
    // Atualiza vínculo local sem recarregar tudo
    setOpsPorPedido((prev) => ({
      ...prev,
      [pedido.id]: { id: r.ordemId!, numero_ordem: r.numeroOrdem! },
    }))
  }

  // ── Mudar status manualmente ──
  async function mudarStatus(pedidoId: string, novoStatus: string) {
    const { error } = await supabase
      .from('pedidos')
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq('id', pedidoId)
      .select()
    if (error) {
      setFeedback({ tipo: 'erro', texto: 'Erro ao mudar status: ' + error.message })
      return
    }
    setFeedback({ tipo: 'ok', texto: 'Status atualizado.' })
    load()
  }

  // ── Filtro local de busca ──
  const filtrados = useMemo(() => {
    if (!busca) return pedidos
    const b = busca.toLowerCase()
    return pedidos.filter((p) => {
      const numero = String(p.numero_pedido || '')
      const cliente = (p.clientes?.nome_loja || p.clientes?.nome || '').toLowerCase()
      return numero.includes(b) || cliente.includes(b)
    })
  }, [pedidos, busca])

  // ── KPIs ──
  const kpis = useMemo(() => {
    const counts: Record<string, number> = {}
    pedidos.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1 })
    return {
      total: pedidos.length,
      pendentes: (counts.pendente || 0) + (counts.em_analise || 0),
      confirmados: counts.confirmado || 0,
      producao: (counts.producao || 0) + (counts.em_producao || 0),
      prontos: (counts.pronto || 0) + (counts.separado || 0),
    }
  }, [pedidos])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        subtitle="Gestão de pedidos B2B, atendimento e produção"
        action={
          <button
            onClick={load}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-bendito-verde-escuro px-3 py-2 rounded-lg"
          >
            <RefreshCw size={15} /> Atualizar
          </button>
        }
      />

      {/* Feedback flutuante */}
      {feedback && (
        <div
          className={`rounded-xl p-3 text-sm flex items-center gap-2 border ${
            feedback.tipo === 'ok'
              ? 'bg-green-50 border-green-200 text-green-800'
              : feedback.tipo === 'erro'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {feedback.tipo === 'ok' && <CheckCircle2 size={16} />}
          {feedback.tipo === 'erro' && <AlertTriangle size={16} />}
          {feedback.tipo === 'info' && <FileText size={16} />}
          {feedback.texto}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <CardKPI label="Total"        valor={kpis.total}       cor="text-gray-700" />
        <CardKPI label="Pendentes"    valor={kpis.pendentes}   cor="text-yellow-600" bg="bg-yellow-50" />
        <CardKPI label="Confirmados"  valor={kpis.confirmados} cor="text-blue-600"   bg="bg-blue-50" />
        <CardKPI label="Em produção"  valor={kpis.producao}    cor="text-indigo-600" bg="bg-indigo-50" />
        <CardKPI label="Prontos"      valor={kpis.prontos}     cor="text-emerald-600" bg="bg-emerald-50" />
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex items-center gap-2 text-gray-500">
          <Filter size={16} />
          <span className="text-sm font-medium">Filtros</span>
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"
        >
          {FILTROS_STATUS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nº pedido ou cliente..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"
          />
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <Loading />
      ) : filtrados.length === 0 ? (
        <EmptyState message="Nenhum pedido encontrado para os filtros selecionados." />
      ) : (
        <div className="space-y-3">
          {filtrados.map((p) => (
            <PedidoCard
              key={p.id}
              pedido={p}
              op={opsPorPedido[p.id]}
              gerando={gerandoOPId === p.id}
              onGerarOP={() => handleGerarOP(p)}
              onAbrir={() => { setPedidoSel(p); setModalAberto(true) }}
              onMudarStatus={(s) => mudarStatus(p.id, s)}
            />
          ))}
        </div>
      )}

      {/* Modal de detalhes */}
      <ModalDetalhesPedido
        aberto={modalAberto}
        pedido={pedidoSel}
        op={pedidoSel ? opsPorPedido[pedidoSel.id] : undefined}
        onClose={() => setModalAberto(false)}
        onGerarOP={() => pedidoSel && handleGerarOP(pedidoSel)}
        gerando={pedidoSel && gerandoOPId === pedidoSel.id}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// Componente: card de KPI
// ════════════════════════════════════════════════════════════
function CardKPI({ label, valor, cor, bg = 'bg-white' }: { label: string; valor: number; cor: string; bg?: string }) {
  return (
    <div className={`${bg} rounded-xl shadow-md p-4 border border-gray-100 text-center`}>
      <p className="text-xs text-gray-500 uppercase font-semibold">{label}</p>
      <p className={`text-2xl font-bold ${cor} mt-1`}>{valor}</p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// Componente: card de pedido
// ════════════════════════════════════════════════════════════
function PedidoCard({
  pedido, op, gerando, onGerarOP, onAbrir, onMudarStatus,
}: {
  pedido: any
  op?: { id: string; numero_ordem: number }
  gerando: boolean
  onGerarOP: () => void
  onAbrir: () => void
  onMudarStatus: (novo: string) => void
}) {
  const st = STATUS_CONFIG[pedido.status] || { label: pedido.status, cor: 'bg-gray-100 text-gray-600', icon: FileText }
  const Icon = st.icon
  const cliente = pedido.clientes?.nome_loja || pedido.clientes?.nome || 'Cliente avulso'
  const podeGerarOP = PODE_GERAR_OP.includes(pedido.status) && !op

  // Cor da borda lateral por status
  const corBorda =
    pedido.status === 'cancelado'        ? 'border-red-400'
    : pedido.status === 'entregue'       ? 'border-green-400'
    : pedido.status === 'producao' || pedido.status === 'em_producao' ? 'border-indigo-400'
    : pedido.status === 'pronto'         ? 'border-emerald-400'
    : pedido.status === 'pendente'       ? 'border-yellow-400'
    : pedido.status === 'confirmado'     ? 'border-blue-400'
    : 'border-gray-300'

  return (
    <div className={`bg-white rounded-xl shadow-md p-4 border-l-4 ${corBorda}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Esquerda: info principal */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`p-2 rounded-lg shrink-0 ${st.cor}`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-bendito-verde-escuro text-lg">#{pedido.numero_pedido}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${st.cor}`}>{st.label}</span>
              <span className="text-xs text-gray-400">{pedido.canal}</span>
              {op && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center gap-1">
                  <Factory size={11} /> OP #{op.numero_ordem}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-gray-800 mt-1 flex items-center gap-1">
              <User size={13} className="text-gray-400" /> {cliente}
              {pedido.clientes?.telefone && (
                <a href={`tel:${pedido.clientes.telefone}`} className="text-blue-500 text-xs ml-2 hover:underline">
                  <Phone size={11} className="inline" /> {pedido.clientes.telefone}
                </a>
              )}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span>{formatData(pedido.created_at)}</span>
              {pedido.vendedores?.nome && <span>Vendedor: {pedido.vendedores.nome}</span>}
              {pedido.tipo_entrega && <span className="bg-gray-100 px-2 py-0.5 rounded">{pedido.tipo_entrega}</span>}
              {pedido.filiais?.nome && <span>📍 {pedido.filiais.nome}</span>}
            </div>
          </div>
        </div>

        {/* Direita: valor + ações */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-xl font-bold text-bendito-verde">{formatBRL(pedido.valor_total)}</span>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={onAbrir}
              className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              <Eye size={13} /> Detalhes
            </button>

            {podeGerarOP && (
              <button
                onClick={onGerarOP}
                disabled={gerando}
                className="flex items-center gap-1 bg-bendito-verde hover:bg-bendito-verde-escuro text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50"
              >
                <Factory size={13} /> {gerando ? 'Gerando...' : 'Gerar OP'}
              </button>
            )}

            {op && (
              <a
                href={`/dashboard/producao?ordem=${op.id}`}
                className="flex items-center gap-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              >
                Ver OP <ChevronRight size={13} />
              </a>
            )}

            {pedido.status === 'pendente' && (
              <button
                onClick={() => onMudarStatus('confirmado')}
                className="flex items-center gap-1 bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              >
                <CheckCircle2 size={13} /> Confirmar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// Componente: modal de detalhes
// ════════════════════════════════════════════════════════════
function ModalDetalhesPedido({
  aberto, pedido, op, onClose, onGerarOP, gerando,
}: {
  aberto: boolean
  pedido: any
  op?: { id: string; numero_ordem: number }
  onClose: () => void
  onGerarOP: () => void
  gerando: boolean | null | undefined
}) {
  const supabase = createClient()
  const [itens, setItens] = useState<any[]>([])
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!aberto || !pedido) return
    setCarregando(true)
    supabase
      .from('pedido_itens')
      .select('id, produto_id, quantidade, valor_unitario, valor_total, observacoes, descricao_livre, produtos(nome, fabricado_internamente)')
      .eq('pedido_id', pedido.id)
      .then(({ data }) => {
        setItens(data || [])
        setCarregando(false)
      })
  }, [aberto, pedido, supabase])

  if (!aberto || !pedido) return null

  const st = STATUS_CONFIG[pedido.status] || { label: pedido.status, cor: 'bg-gray-100 text-gray-600', icon: FileText }
  const cliente = pedido.clientes?.nome_loja || pedido.clientes?.nome || 'Cliente avulso'
  const podeGerarOP = PODE_GERAR_OP.includes(pedido.status) && !op

  return (
    <Modal isOpen={aberto} onClose={onClose} title={`Pedido #${pedido.numero_pedido}`}>
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* Cabeçalho com status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${st.cor}`}>{st.label}</span>
          <span className="text-xs text-gray-400">{pedido.canal}</span>
          {op && (
            <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center gap-1">
              <Factory size={11} /> OP #{op.numero_ordem}
            </span>
          )}
        </div>

        {/* Cliente */}
        <section className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
          <p className="font-semibold flex items-center gap-1"><User size={14} /> {cliente}</p>
          {pedido.clientes?.telefone && (
            <a href={`tel:${pedido.clientes.telefone}`} className="text-blue-500 hover:underline flex items-center gap-1">
              <Phone size={13} /> {pedido.clientes.telefone}
            </a>
          )}
          {pedido.endereco_entrega && (
            <p className="text-xs text-gray-600 flex items-start gap-1">
              <MapPin size={12} className="mt-0.5 shrink-0" /> {pedido.endereco_entrega}
            </p>
          )}
          {pedido.cpf_cliente && <p className="text-xs text-gray-500">CPF: {pedido.cpf_cliente}</p>}
        </section>

        {/* Itens */}
        <section>
          <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
            <ShoppingCart size={14} /> Itens ({itens.length})
          </p>
          {carregando ? (
            <p className="text-xs text-gray-400 py-2 text-center">Carregando...</p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2">Produto</th>
                    <th className="text-right px-3 py-2">Qtd</th>
                    <th className="text-right px-3 py-2">Unit.</th>
                    <th className="text-right px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itens.map((it) => {
                    const nome = it.produtos?.nome || it.descricao_livre || '—'
                    const isRevenda = it.produto_id && it.produtos && it.produtos.fabricado_internamente === false
                    const isVendaDiversa = !it.produto_id
                    return (
                      <tr key={it.id}>
                        <td className="px-3 py-2">
                          {nome}
                          {isVendaDiversa && (
                            <span className="ml-1 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-semibold">
                              VENDA DIVERSA
                            </span>
                          )}
                          {isRevenda && (
                            <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                              REVENDA
                            </span>
                          )}
                        </td>
                        <td className="text-right px-3 py-2">{it.quantidade}</td>
                        <td className="text-right px-3 py-2">{formatBRL(it.valor_unitario)}</td>
                        <td className="text-right px-3 py-2 font-semibold">{formatBRL(it.valor_total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 text-sm">
                  {Number(pedido.subtotal) !== Number(pedido.valor_total) && (
                    <tr>
                      <td colSpan={3} className="text-right px-3 py-1 text-gray-500">Subtotal</td>
                      <td className="text-right px-3 py-1">{formatBRL(pedido.subtotal)}</td>
                    </tr>
                  )}
                  {Number(pedido.desconto) > 0 && (
                    <tr>
                      <td colSpan={3} className="text-right px-3 py-1 text-gray-500">Desconto</td>
                      <td className="text-right px-3 py-1 text-red-600">-{formatBRL(pedido.desconto)}</td>
                    </tr>
                  )}
                  {Number(pedido.taxa_entrega) > 0 && (
                    <tr>
                      <td colSpan={3} className="text-right px-3 py-1 text-gray-500">Frete</td>
                      <td className="text-right px-3 py-1">{formatBRL(pedido.taxa_entrega)}</td>
                    </tr>
                  )}
                  <tr className="font-bold">
                    <td colSpan={3} className="text-right px-3 py-2 text-bendito-verde-escuro">TOTAL</td>
                    <td className="text-right px-3 py-2 text-bendito-verde text-lg">{formatBRL(pedido.valor_total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Pagamento */}
        {(pedido.forma_pagamento || pedido.status_pagamento) && (
          <section className="text-xs text-gray-600">
            {pedido.forma_pagamento && <span>Forma: <b>{pedido.forma_pagamento}</b></span>}
            {pedido.status_pagamento && <span className="ml-3">Status: <b>{pedido.status_pagamento}</b></span>}
          </section>
        )}

        {/* Observações */}
        {(pedido.observacoes || pedido.observacoes_internas) && (
          <section className="space-y-2">
            {pedido.observacoes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
                <p className="font-semibold text-yellow-800">📝 Observação do cliente</p>
                <p className="text-gray-700">{pedido.observacoes}</p>
              </div>
            )}
            {pedido.observacoes_internas && (
              <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                <p className="font-semibold text-blue-800">🔒 Observação interna</p>
                <p className="text-gray-700">{pedido.observacoes_internas}</p>
              </div>
            )}
          </section>
        )}

        {/* Ações */}
        <div className="flex gap-3 pt-2 border-t">
          {podeGerarOP && (
            <PrimaryButton
              onClick={onGerarOP}
              disabled={!!gerando}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <Factory size={16} /> {gerando ? 'Gerando...' : 'Gerar Ordem de Produção'}
            </PrimaryButton>
          )}
          {op && (
            <a
              href={`/dashboard/producao?ordem=${op.id}`}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition"
            >
              <Factory size={16} /> Abrir OP #{op.numero_ordem}
            </a>
          )}
          <SecondaryButton onClick={onClose} className="flex-1">Fechar</SecondaryButton>
        </div>
      </div>
    </Modal>
  )
}
