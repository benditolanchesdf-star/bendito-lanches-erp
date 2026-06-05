'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import {
  Sparkles, RefreshCw, ShoppingCart, AlertTriangle, Check,
  X, Package, TrendingUp, Zap, Building2, ChevronRight,
  CheckCircle, Clock, BarChart2,
} from 'lucide-react'

const MOTIVO_CONFIG: Record<string, { label: string; cor: string; icon: any }> = {
  estoque_zerado:   { label: '🔴 Estoque Zerado',      cor: 'border-red-400 bg-red-50',     icon: AlertTriangle },
  estoque_critico:  { label: '🟠 Estoque Crítico',     cor: 'border-orange-400 bg-orange-50', icon: AlertTriangle },
  validade_proxima: { label: '🟡 Validade Próxima',    cor: 'border-yellow-400 bg-yellow-50', icon: Clock },
  demanda_alta:     { label: '📈 Alta Demanda',        cor: 'border-blue-400 bg-blue-50',    icon: TrendingUp },
}
const PRIORIDADE_LABEL: Record<number, string> = {
  1: '🔥 Urgente',
  2: '⚡ Normal',
  3: '📋 Planejado',
}
const STATUS_COR: Record<string, string> = {
  pendente:       'bg-yellow-100 text-yellow-700',
  aprovada:       'bg-green-100 text-green-700',
  ignorada:       'bg-gray-100 text-gray-500',
  pedido_gerado:  'bg-blue-100 text-blue-700',
}

export default function ComprasAutomaticasPage() {
  const supabase = createClient()
  const [loading, setLoading]       = useState(true)
  const [gerando, setGerando]       = useState(false)
  const [sugestoes, setSugestoes]   = useState<any[]>([])
  const [demanda, setDemanda]       = useState<any[]>([])
  const [filiais, setFiliais]       = useState<any[]>([])
  const [filialSel, setFilialSel]   = useState('')
  const [isAdmin, setIsAdmin]       = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [modalPedido, setModalPedido]  = useState(false)
  const [criandoPedido, setCriandoPedido] = useState(false)
  const [pedidoCriado, setPedidoCriado]   = useState<any>(null)
  const [filtroStatus, setFiltroStatus]   = useState('pendente')
  const [aba, setAba] = useState<'sugestoes'|'demanda'>('sugestoes')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile }  = await supabase.from('profiles').select('papel, filial_id').eq('id', user!.id).maybeSingle()
    const admin = ['admin','matriz'].includes(profile?.papel || '')
    setIsAdmin(admin)
    const fid = filialSel || (admin ? '' : (profile?.filial_id || ''))
    if (!filialSel && !admin) setFilialSel(profile?.filial_id || '')

    let qSug = supabase.from('sugestoes_compra')
      .select('*, produtos(nome, unidade_medida, imagem_url), filiais(nome)')
      .order('prioridade').order('gerado_em', { ascending: false })
    if (filtroStatus !== 'todos') qSug = qSug.eq('status', filtroStatus)
    if (fid) qSug = qSug.eq('filial_id', fid)

    let qDem = supabase.from('vw_demanda_produtos').select('*').limit(20)
    if (fid) qDem = qDem.eq('filial_id', fid)

    const [sugRes, demRes, filsRes] = await Promise.all([
      qSug,
      qDem,
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setSugestoes(sugRes.data || [])
    setDemanda(demRes.data || [])
    setFiliais(filsRes.data || [])
    setSelecionados(new Set())
    setLoading(false)
  }
  useEffect(() => { load() }, [filtroStatus, filialSel])

  async function gerarSugestoes() {
    setGerando(true)
    const fids = filialSel ? [filialSel] : filiais.map(f => f.id)
    for (const fid of fids) {
      await supabase.rpc('gerar_sugestoes_compra', { p_filial_id: fid })
    }
    setGerando(false)
    setFiltroStatus('pendente')
    load()
  }

  async function ignorar(id: string) {
    await supabase.from('sugestoes_compra').update({ status: 'ignorada' }).eq('id', id)
    load()
  }

  async function editarQtd(id: string, novaQtd: number) {
    await supabase.from('sugestoes_compra').update({ quantidade_sugerida: Math.max(1, novaQtd) }).eq('id', id)
    setSugestoes(prev => prev.map(s => s.id === id ? { ...s, quantidade_sugerida: Math.max(1, novaQtd) } : s))
  }

  function toggleSel(id: string) {
    setSelecionados(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function selecionarTodos() {
    const pendentes = sugestoes.filter(s => s.status === 'pendente').map(s => s.id)
    setSelecionados(prev => prev.size === pendentes.length ? new Set() : new Set(pendentes))
  }

  async function gerarPedidoInterno() {
    if (selecionados.size === 0) return
    setCriandoPedido(true)
    const itensSel = sugestoes.filter(s => selecionados.has(s.id))
    const filialOrigem = itensSel[0]?.filial_id
    if (!filialOrigem) { setCriandoPedido(false); return }

    const { data: pedido } = await supabase.from('pedidos_internos').insert({
      filial_origem: filialOrigem,
      filial_destino: '11111111-1111-1111-1111-111111111111',
      observacoes: `Pedido gerado automaticamente — ${itensSel.length} item(s) por sugestão de compra`,
    }).select('id, numero').single()

    if (pedido) {
      await supabase.from('pedido_interno_itens').insert(
        itensSel.map(s => ({
          pedido_interno_id: pedido.id,
          produto_id:       s.produto_id,
          quantidade_pedida: s.quantidade_sugerida,
          unidade:          s.produtos?.unidade_medida || 'un',
          observacao:       `Sugestão automática: ${s.motivo}`,
        }))
      )
      // Marcar sugestões como pedido_gerado
      await supabase.from('sugestoes_compra').update({
        status: 'pedido_gerado',
        pedido_interno_id: pedido.id,
      }).in('id', itensSel.map(s => s.id))

      setPedidoCriado(pedido)
      setModalPedido(true)
    }
    setCriandoPedido(false)
    load()
  }

  const pendentes = sugestoes.filter(s => s.status === 'pendente')
  const urgentes  = pendentes.filter(s => s.prioridade === 1)

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Compras Automáticas"
        subtitle="Sugestões inteligentes baseadas em estoque, validade e demanda"
        action={
          <div className="flex gap-2">
            <button onClick={gerarSugestoes} disabled={gerando}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
              <Sparkles size={15}/> {gerando ? 'Analisando...' : 'Gerar Sugestões'}
            </button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pendentes',       valor: pendentes.length,  cor: 'text-orange-600', bg: 'bg-orange-50' },
          { label: '🔥 Urgentes',     valor: urgentes.length,   cor: 'text-red-600',    bg: 'bg-red-50' },
          { label: 'Selecionados',    valor: selecionados.size, cor: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Pedidos gerados', valor: sugestoes.filter(s => s.status === 'pedido_gerado').length, cor: 'text-green-600', bg: 'bg-green-50' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-xl shadow-md p-4 text-center border border-gray-100`}>
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.cor}`}>{c.valor}</p>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="flex border-b">
          {([
            { key: 'sugestoes', label: `📋 Sugestões (${sugestoes.length})` },
            { key: 'demanda',   label: `📈 Demanda dos Produtos` },
          ] as {key:'sugestoes'|'demanda';label:string}[]).map(a => (
            <button key={a.key} onClick={() => setAba(a.key)}
              className={`px-5 py-4 text-sm font-semibold border-b-2 transition
                ${aba === a.key ? 'border-purple-500 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ABA SUGESTÕES ── */}
      {aba === 'sugestoes' && (
        <div className="space-y-4">
          {/* Filtros + ações em lote */}
          <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-center">
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
              <option value="pendente">Pendentes</option>
              <option value="pedido_gerado">Pedido Gerado</option>
              <option value="ignorada">Ignoradas</option>
              <option value="todos">Todas</option>
            </select>
            {isAdmin && (
              <select value={filialSel} onChange={e => setFilialSel(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="">Todas as unidades</option>
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            )}
            <button onClick={load} className="text-gray-400 hover:text-bendito-verde"><RefreshCw size={15}/></button>

            {filtroStatus === 'pendente' && pendentes.length > 0 && (
              <div className="flex gap-2 ml-auto">
                <button onClick={selecionarTodos}
                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-semibold transition">
                  {selecionados.size === pendentes.length ? <X size={12}/> : <CheckCircle size={12}/>}
                  {selecionados.size === pendentes.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
                {selecionados.size > 0 && (
                  <button onClick={gerarPedidoInterno} disabled={criandoPedido}
                    className="flex items-center gap-2 bg-bendito-verde hover:bg-bendito-verde-escuro text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                    <ShoppingCart size={15}/>
                    {criandoPedido ? 'Criando...' : `Gerar Pedido (${selecionados.size})`}
                  </button>
                )}
              </div>
            )}
          </div>

          {sugestoes.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <Sparkles size={48} className="text-purple-300 mx-auto mb-4"/>
              <p className="text-lg font-bold text-gray-700">Nenhuma sugestão ainda</p>
              <p className="text-sm text-gray-500 mt-1 mb-6">Clique em "Gerar Sugestões" para analisar o estoque</p>
              <button onClick={gerarSugestoes} disabled={gerando}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl text-sm font-semibold mx-auto disabled:opacity-50">
                <Sparkles size={16}/> {gerando ? 'Analisando...' : 'Gerar Agora'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sugestoes.map(s => {
                const cfg     = MOTIVO_CONFIG[s.motivo] || MOTIVO_CONFIG.estoque_critico
                const Icon    = cfg.icon
                const isSel   = selecionados.has(s.id)
                const isPend  = s.status === 'pendente'
                return (
                  <div key={s.id}
                    className={`bg-white rounded-xl shadow-md p-4 border-l-4 transition
                      ${cfg.cor} ${isSel ? 'ring-2 ring-bendito-dourado' : ''}`}>
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      {isPend && (
                        <button onClick={() => toggleSel(s.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition
                            ${isSel ? 'bg-bendito-verde border-bendito-verde' : 'border-gray-300 hover:border-bendito-verde'}`}>
                          {isSel && <Check size={11} className="text-white"/>}
                        </button>
                      )}

                      {/* Imagem */}
                      {s.produtos?.imagem_url && (
                        <img src={s.produtos.imagem_url} alt=""
                          className="w-12 h-12 rounded-lg object-cover shrink-0"/>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-bendito-verde-escuro">{s.produtos?.nome}</p>
                          <span className="text-xs font-semibold text-gray-500">{PRIORIDADE_LABEL[s.prioridade]}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COR[s.status]}`}>
                            {s.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1"><Icon size={11}/> {cfg.label}</span>
                          <span>Estoque atual: <strong>{s.estoque_atual}</strong></span>
                          <span>Mínimo: <strong>{s.estoque_minimo}</strong></span>
                          {s.filiais?.nome && <span className="flex items-center gap-1"><Building2 size={11}/> {s.filiais.nome}</span>}
                        </div>

                        {s.observacoes && (
                          <p className="text-xs text-gray-500 mt-1 bg-gray-50 px-2 py-1 rounded">{s.observacoes}</p>
                        )}

                        {s.pedido_interno_id && (
                          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                            <ShoppingCart size={11}/> Pedido interno criado
                          </p>
                        )}
                      </div>

                      {/* Quantidade + ações */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {isPend ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => editarQtd(s.id, s.quantidade_sugerida - 1)}
                              className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xs font-bold">−</button>
                            <span className="text-base font-bold text-bendito-verde w-10 text-center">{s.quantidade_sugerida}</span>
                            <button onClick={() => editarQtd(s.id, s.quantidade_sugerida + 1)}
                              className="w-7 h-7 rounded-full bg-yellow-400 hover:bg-yellow-300 flex items-center justify-center text-xs font-bold">+</button>
                            <span className="text-xs text-gray-400 ml-1">{s.produtos?.unidade_medida || 'un'}</span>
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-gray-600">
                            {s.quantidade_sugerida} {s.produtos?.unidade_medida || 'un'}
                          </span>
                        )}
                        {isPend && (
                          <button onClick={() => ignorar(s.id)}
                            className="text-xs text-gray-400 hover:text-red-500 transition flex items-center gap-0.5">
                            <X size={11}/> Ignorar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ABA DEMANDA ── */}
      {aba === 'demanda' && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50">
            <h2 className="font-bold text-bendito-verde-escuro">📈 Demanda dos últimos 90 dias</h2>
            <p className="text-xs text-gray-500 mt-0.5">Baseado em pedidos internos aprovados</p>
          </div>
          {demanda.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <BarChart2 size={40} className="mx-auto mb-3 opacity-30"/>
              <p>Nenhum dado de demanda ainda.</p>
              <p className="text-xs mt-1">Os dados aparecem conforme pedidos internos são aprovados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Produto','Unidade','Pedidos','Total Pedido','Média/Pedido','Demanda Mensal','Último Pedido'].map(h =>
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  )}</tr>
                </thead>
                <tbody className="divide-y">
                  {demanda.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-bendito-verde-escuro">{d.produto_nome}</td>
                      <td className="px-4 py-3 text-gray-500">{d.unidade_medida || 'un'}</td>
                      <td className="px-4 py-3 text-center font-bold text-purple-600">{d.total_pedidos}</td>
                      <td className="px-4 py-3 text-center font-bold">{Number(d.total_pedido || 0).toFixed(1)}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{Number(d.media_por_pedido || 0).toFixed(1)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div className="bg-purple-500 h-2 rounded-full"
                              style={{ width: `${Math.min((Number(d.demanda_mensal_estimada||0) / (Number(demanda[0]?.demanda_mensal_estimada)||1)) * 100, 100)}%` }}/>
                          </div>
                          <span className="text-xs font-bold text-purple-700 w-10 text-right">
                            {Number(d.demanda_mensal_estimada || 0).toFixed(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {d.ultimo_pedido ? new Date(d.ultimo_pedido).toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal pedido criado */}
      <Modal isOpen={modalPedido} onClose={() => { setModalPedido(false); setPedidoCriado(null) }}
        title="✅ Pedido Criado com Sucesso!">
        {pedidoCriado && (
          <div className="space-y-4 text-center">
            <CheckCircle size={52} className="text-green-500 mx-auto"/>
            <div>
              <p className="text-2xl font-bold text-bendito-verde-escuro">Pedido #{pedidoCriado.numero}</p>
              <p className="text-gray-500 text-sm mt-1">
                Pedido interno criado e enviado para aprovação da Matriz.
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
              <p>✅ {selecionados.size} produto(s) incluído(s)</p>
              <p className="mt-1">O pedido aparece na Central de Aprovações para aprovação.</p>
            </div>
            <div className="flex gap-3">
              <SecondaryButton onClick={() => { setModalPedido(false); setPedidoCriado(null) }} className="flex-1">
                Fechar
              </SecondaryButton>
              <PrimaryButton onClick={() => { window.location.href = '/dashboard/aprovacoes' }} className="flex-1 flex items-center justify-center gap-2">
                <ChevronRight size={16}/> Ver Aprovações
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
