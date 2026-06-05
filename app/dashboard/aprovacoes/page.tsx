'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData } from '@/lib/constants'
import {
  JustificativaRecusaSchema, MotivoAlteracaoSchema,
  type JustificativaRecusaInput, type MotivoAlteracaoInput,
} from '@/schemas'
import { PageHeader, Loading } from '@/components/ui'
import Modal from '@/components/Modal'
import {
  CheckCircle, XCircle, Clock, ShoppingBag, ArrowLeftRight,
  RefreshCw, Eye, Printer, Download, AlertTriangle, Plus, Trash2,
} from 'lucide-react'

type Aba = 'pendentes' | 'aprovados' | 'recusados'

const TIPO_CONFIG: Record<string, { label: string; icon: any; cor: string }> = {
  pedido_interno:       { label: 'Pedido Interno',   icon: ArrowLeftRight, cor: 'bg-blue-100 text-blue-700' },
  pedido_compra_matriz: { label: 'Compra (Matriz)',  icon: ShoppingBag,    cor: 'bg-purple-100 text-purple-700' },
  pedido_compra_admin:  { label: 'Compra (Admin)',   icon: ShoppingBag,    cor: 'bg-red-100 text-red-700' },
  pedido_compra:        { label: 'Pedido de Compra', icon: ShoppingBag,    cor: 'bg-orange-100 text-orange-700' },
}
const STATUS_COR: Record<string, string> = {
  pendente:        'bg-yellow-100 text-yellow-700',
  aprovado:        'bg-blue-100 text-blue-700',
  aprovado_matriz: 'bg-blue-100 text-blue-700',
  aprovado_admin:  'bg-indigo-100 text-indigo-700',
  separando:       'bg-purple-100 text-purple-700',
  enviado:         'bg-orange-100 text-orange-700',
  em_compra:       'bg-purple-100 text-purple-700',
  recebido:        'bg-green-100 text-green-700',
  concluido:       'bg-green-100 text-green-700',
  cancelado:       'bg-red-100 text-red-700',
  recusado:        'bg-red-100 text-red-700',
}

type ItemEditavel = {
  id: string | null
  produto_id: string | null
  nome: string
  quantidade_pedida: number
  quantidade_aprovada: number
  unidade: string
  outros: boolean
  removido: boolean
  alterado: boolean
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
      <AlertTriangle size={10}/>{msg}
    </p>
  )
}

export default function AprovacoesPage() {
  const supabase = createClient()
  const [aba, setAba] = useState<Aba>('pendentes')
  const [loading, setLoading] = useState(true)
  const [pendentes, setPendentes] = useState<any[]>([])
  const [aprovados, setAprovados] = useState<any[]>([])
  const [recusados, setRecusados] = useState<any[]>([])
  const [salvando, setSalvando] = useState<string | null>(null)

  // Detalhe + edição
  const [detalheOpen, setDetalheOpen]     = useState(false)
  const [itemSel, setItemSel]             = useState<any>(null)
  const [itensEditaveis, setItensEditaveis] = useState<ItemEditavel[]>([])
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [modoEdicao, setModoEdicao]       = useState(false)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [alteracoesLog, setAlteracoesLog] = useState<any[]>([])
  const [produtosMatriz, setProdutosMatriz] = useState<any[]>([])
  const [novoProdId, setNovoProdId]       = useState('')

  // Modal recusa — com React Hook Form + Zod
  const [recusaOpen, setRecusaOpen] = useState(false)
  const [itemRecusa, setItemRecusa] = useState<any>(null)
  const [salvandoRecusa, setSalvandoRecusa] = useState(false)

  const recusaForm = useForm<JustificativaRecusaInput>({
    resolver: zodResolver(JustificativaRecusaSchema),
    defaultValues: { justificativa: '' },
  })

  // Modal alteração de itens — com React Hook Form + Zod
  const alteracaoForm = useForm<MotivoAlteracaoInput>({
    resolver: zodResolver(MotivoAlteracaoSchema),
    defaultValues: { motivo: '' },
  })

  async function load() {
    setLoading(true)
    const [{ data: pend }, { data: aprov }, { data: recus }] = await Promise.all([
      supabase.from('vw_aprovacoes_pendentes').select('*'),
      supabase.from('vw_aprovacoes_aprovadas').select('*').limit(50),
      supabase.from('vw_aprovacoes_recusadas').select('*').limit(50),
    ])
    setPendentes(pend || [])
    setAprovados(aprov || [])
    setRecusados(recus || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function abrirDetalhe(item: any, editar = false) {
    setItemSel(item)
    setItensEditaveis([])
    setAlteracoesLog([])
    setModoEdicao(editar)
    alteracaoForm.reset({ motivo: '' })
    setNovoProdId('')
    setDetalheOpen(true)
    setLoadingDetalhe(true)

    const [itensRes, logsRes, prodsRes] = await Promise.all([
      item.tipo === 'pedido_interno'
        ? supabase.from('pedido_interno_itens').select('*, produtos(nome)').eq('pedido_interno_id', item.id)
        : supabase.from('pedido_compra_itens').select('*').eq('pedido_compra_id', item.id),
      supabase.from('pedido_interno_alteracoes').select('*').eq('pedido_interno_id', item.id).order('created_at', { ascending: false }),
      supabase.from('produtos').select('id, nome, unidade_medida').eq('ativo', true)
        .eq('filial_id', '11111111-1111-1111-1111-111111111111').order('nome'),
    ])

    setItensEditaveis((itensRes.data || []).map(i => ({
      id: i.id,
      produto_id: i.produto_id || null,
      nome: i.observacao?.startsWith('[OUTRO]')
        ? i.observacao.replace('[OUTRO] ', '')
        : (i.produtos?.nome || i.descricao || '—'),
      quantidade_pedida: Number(i.quantidade_pedida || i.quantidade || 0),
      quantidade_aprovada: Number(i.quantidade_aprovada || i.quantidade_pedida || i.quantidade || 0),
      unidade: i.unidade || 'un',
      outros: !!(i.observacao?.startsWith('[OUTRO]')),
      removido: i.removido || false,
      alterado: false,
    })))
    setAlteracoesLog(logsRes.data || [])
    setProdutosMatriz(prodsRes.data || [])
    setLoadingDetalhe(false)
  }

  function updateQtdItem(idx: number, novaQtd: number) {
    setItensEditaveis(prev => prev.map((i, j) => j !== idx ? i : {
      ...i,
      quantidade_aprovada: Math.max(0, novaQtd),
      alterado: novaQtd !== i.quantidade_pedida,
    }))
  }

  function removerItem(idx: number) {
    setItensEditaveis(prev => prev.map((i, j) =>
      j === idx ? { ...i, removido: true, alterado: true } : i
    ))
  }

  function restaurarItem(idx: number) {
    setItensEditaveis(prev => prev.map((i, j) =>
      j === idx ? { ...i, removido: false, alterado: i.quantidade_aprovada !== i.quantidade_pedida } : i
    ))
  }

  function addProdutoNovo() {
    if (!novoProdId) return
    const p = produtosMatriz.find(x => x.id === novoProdId)
    if (!p || itensEditaveis.find(i => i.produto_id === p.id && !i.removido)) return
    setItensEditaveis(prev => [...prev, {
      id: null, produto_id: p.id, nome: p.nome,
      quantidade_pedida: 0, quantidade_aprovada: 1,
      unidade: p.unidade_medida || 'un',
      outros: false, removido: false, alterado: true,
    }])
    setNovoProdId('')
  }

  const temAlteracoes = itensEditaveis.some(i => i.alterado || i.removido || i.id === null)

  async function salvarEdicao(data: MotivoAlteracaoInput) {
    setSalvandoEdicao(true)
    const alteracoes = itensEditaveis
      .filter(i => i.alterado || i.removido || i.id === null)
      .map(i => ({
        produto: i.nome,
        acao: i.id === null ? 'adicionado'
          : i.removido ? 'removido'
          : `quantidade: ${i.quantidade_pedida} → ${i.quantidade_aprovada}`,
      }))

    await supabase.from('pedido_interno_alteracoes').insert({
      pedido_interno_id: itemSel.id,
      motivo: data.motivo,
      alteracoes,
    })

    for (const item of itensEditaveis.filter(i => i.id !== null)) {
      await supabase.from('pedido_interno_itens').update({
        quantidade_aprovada: item.removido ? 0 : item.quantidade_aprovada,
        removido: item.removido,
        obs_alteracao: (item.alterado || item.removido) ? data.motivo : null,
      }).eq('id', item.id!)
    }

    const novos = itensEditaveis.filter(i => i.id === null && !i.removido)
    if (novos.length > 0) {
      await supabase.from('pedido_interno_itens').insert(
        novos.map(i => ({
          pedido_interno_id: itemSel.id,
          produto_id: i.produto_id,
          quantidade_pedida: 0,
          quantidade_aprovada: i.quantidade_aprovada,
          unidade: i.unidade,
          obs_alteracao: `Adicionado pelo aprovador: ${data.motivo}`,
        }))
      )
    }

    setSalvandoEdicao(false)
    setModoEdicao(false)
    alteracaoForm.reset()
    abrirDetalhe(itemSel, false)
  }

  async function aprovar(item: any) {
    setSalvando(item.id)
    if (item.tipo === 'pedido_interno') {
      await supabase.from('pedidos_internos').update({ status: 'aprovado' }).eq('id', item.id)
    } else if (item.tipo === 'pedido_compra_matriz') {
      await supabase.from('pedidos_compra').update({ status: 'aprovado_matriz' }).eq('id', item.id)
    } else if (item.tipo === 'pedido_compra_admin') {
      await supabase.from('pedidos_compra').update({ status: 'aprovado_admin' }).eq('id', item.id)
    }
    setSalvando(null); load()
  }

  function abrirRecusa(item: any) {
    setItemRecusa(item)
    recusaForm.reset({ justificativa: '' })
    setRecusaOpen(true)
  }

  async function confirmarRecusa(data: JustificativaRecusaInput) {
    setSalvandoRecusa(true)
    if (itemRecusa.tipo === 'pedido_interno') {
      await supabase.from('pedidos_internos').update({
        status: 'cancelado',
        justificativa_recusa: data.justificativa,
      }).eq('id', itemRecusa.id)
    } else {
      await supabase.from('pedidos_compra').update({
        status: 'recusado',
        justificativa_recusa: data.justificativa,
      }).eq('id', itemRecusa.id)
    }
    setSalvandoRecusa(false)
    setRecusaOpen(false)
    setItemRecusa(null)
    load()
  }

  function imprimirPedido() {
    if (!itemSel) return
    const linhas = itensEditaveis.filter(i => !i.removido).map(i => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${i.nome}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${i.quantidade_pedida || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;color:${i.alterado ? '#d97706' : '#333'}">${i.quantidade_aprovada}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${i.unidade}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Pedido #${itemSel.numero}</title>
    <style>body{font-family:Arial,sans-serif;font-size:13px;padding:24px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#f5f5f5;text-align:left;padding:8px;font-size:11px;text-transform:uppercase;color:#666}
    @media print{body{padding:0}}</style></head><body>
    <h1>🍕 ${itemSel.categoria} #${itemSel.numero}</h1>
    <p>${itemSel.origem} → ${itemSel.destino} · ${new Date(itemSel.created_at).toLocaleDateString('pt-BR')}</p>
    <table><thead><tr><th>Produto</th><th>Pedido</th><th>Aprovado</th><th>Un</th></tr></thead>
    <tbody>${linhas}</tbody></table>
    <p style="margin-top:24px;font-size:11px;color:#999">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    </body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  const urgentes = pendentes.filter(a =>
    Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400000) >= 2
  )

  const renderCard = (a: any, tipo: Aba) => {
    const cfg = TIPO_CONFIG[a.tipo] || TIPO_CONFIG.pedido_interno
    const Icon = cfg.icon
    const dias   = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400000)
    const urgente = tipo === 'pendentes' && dias >= 2
    return (
      <div key={a.id} className={`bg-white rounded-xl shadow-md p-5 border-l-4
        ${urgente ? 'border-red-400' : tipo === 'aprovados' ? 'border-green-400' : tipo === 'recusados' ? 'border-red-300' : 'border-bendito-dourado'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={`p-2 rounded-lg ${cfg.cor} shrink-0`}><Icon size={16}/></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-bendito-verde-escuro">{a.categoria} #{a.numero}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cor}`}>{cfg.label}</span>
                {urgente && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">⚠️ {dias} dias</span>}
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COR[a.status] || 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1"><strong>{a.origem}</strong> → <strong>{a.destino}</strong></p>
              {a.observacoes && <p className="text-xs text-gray-500 mt-1 bg-gray-50 px-2 py-1 rounded">📝 {a.observacoes}</p>}
              {tipo === 'recusados' && a.justificativa_recusa && (
                <p className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded">❌ {a.justificativa_recusa}</p>
              )}
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                <span><Clock size={11} className="inline mr-1"/>{formatData(a.created_at)}</span>
                {a.valor && <span className="font-semibold text-bendito-verde">{formatBRL(a.valor)}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={() => abrirDetalhe(a)}
              className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition">
              <Eye size={13}/> Ver
            </button>
            {tipo === 'pendentes' && (
              <>
                <button onClick={() => aprovar(a)} disabled={salvando === a.id}
                  className="flex items-center gap-1 bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50">
                  <CheckCircle size={13}/> Aprovar
                </button>
                <button onClick={() => abrirRecusa(a)} disabled={salvando === a.id}
                  className="flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50">
                  <XCircle size={13}/> Recusar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Central de Aprovações"
        subtitle="Visualize, edite e decida sobre as solicitações"
        action={
          <button onClick={load}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
            <RefreshCw size={15}/> Atualizar
          </button>
        }
      />

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-md p-4 text-center">
            <p className="text-xs text-gray-500">Pendentes</p>
            <p className="text-3xl font-bold text-orange-500 mt-1">{pendentes.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 text-center">
            <p className="text-xs text-gray-500">Aprovados</p>
            <p className="text-3xl font-bold text-green-500 mt-1">{aprovados.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 text-center">
            <p className="text-xs text-gray-500">⚠️ Atraso +2 dias</p>
            <p className="text-3xl font-bold text-red-500 mt-1">{urgentes.length}</p>
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="flex border-b">
          {([
            { key: 'pendentes', label: `⏳ Pendentes (${pendentes.length})` },
            { key: 'aprovados', label: `✅ Aprovados (${aprovados.length})` },
            { key: 'recusados', label: `❌ Recusados (${recusados.length})` },
          ] as {key:Aba;label:string}[]).map(a => (
            <button key={a.key} onClick={() => setAba(a.key)}
              className={`px-5 py-4 text-sm font-semibold border-b-2 transition
                ${aba === a.key ? 'border-bendito-dourado text-bendito-verde-escuro' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Loading /> : (
        <div className="space-y-3">
          {aba === 'pendentes' && (
            pendentes.length === 0
              ? <div className="bg-white rounded-xl shadow-md p-8 text-center"><CheckCircle size={48} className="text-green-400 mx-auto mb-3"/><p className="text-lg font-bold text-gray-700">Tudo em dia!</p></div>
              : pendentes.map(a => renderCard(a, 'pendentes'))
          )}
          {aba === 'aprovados' && (
            aprovados.length === 0
              ? <div className="bg-white rounded-xl p-8 text-center text-gray-400">Nenhuma aprovação ainda.</div>
              : aprovados.map(a => renderCard(a, 'aprovados'))
          )}
          {aba === 'recusados' && (
            recusados.length === 0
              ? <div className="bg-white rounded-xl p-8 text-center text-gray-400">Nenhuma recusa registrada.</div>
              : recusados.map(a => renderCard(a, 'recusados'))
          )}
        </div>
      )}

      {/* Modal detalhe + edição */}
      <Modal isOpen={detalheOpen} onClose={() => { setDetalheOpen(false); setModoEdicao(false) }}
        title={`${itemSel?.categoria} #${itemSel?.numero}`}>
        {itemSel && (
          <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            <div className="flex gap-2 justify-between">
              <div className="flex gap-2">
                <button onClick={imprimirPedido}
                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                  <Printer size={13}/> Imprimir
                </button>
                <button onClick={imprimirPedido}
                  className="flex items-center gap-1.5 bg-bendito-verde hover:bg-bendito-verde-escuro text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                  <Download size={13}/> PDF
                </button>
              </div>
              {pendentes.find(p => p.id === itemSel.id) && !modoEdicao && (
                <button onClick={() => setModoEdicao(true)}
                  className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                  ✏️ Editar itens
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <p>Origem: <strong className="text-gray-700">{itemSel.origem}</strong></p>
              <p>Destino: <strong className="text-gray-700">{itemSel.destino}</strong></p>
              <p>Data: <strong className="text-gray-700">{formatData(itemSel.created_at)}</strong></p>
              <p>Status: <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_COR[itemSel.status] || 'bg-gray-100'}`}>{itemSel.status}</span></p>
            </div>

            {loadingDetalhe ? (
              <p className="text-center text-gray-400 py-4">Carregando...</p>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Itens</p>
                    {modoEdicao && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-semibold">modo edição ativo</span>}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b">
                        <th className="text-left pb-1">Produto</th>
                        <th className="text-center pb-1">Pedido</th>
                        <th className="text-center pb-1">{modoEdicao ? 'Aprovado ✏️' : 'Aprovado'}</th>
                        <th className="text-left pb-1">Un</th>
                        {modoEdicao && <th className="pb-1"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {itensEditaveis.map((i, idx) => (
                        <tr key={idx} className={i.removido ? 'opacity-40 line-through' : ''}>
                          <td className="py-2 text-sm">
                            {i.outros && <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded mr-1">outro</span>}
                            {i.nome}
                            {i.id === null && <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded ml-1">novo</span>}
                          </td>
                          <td className="py-2 text-center text-gray-500">{i.quantidade_pedida || '—'}</td>
                          <td className="py-2 text-center">
                            {modoEdicao && !i.removido ? (
                              <div className="flex items-center justify-center gap-1">
                                <button type="button" onClick={() => updateQtdItem(idx, i.quantidade_aprovada - 1)}
                                  className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 text-xs font-bold flex items-center justify-center">−</button>
                                <input type="number" min={0} value={i.quantidade_aprovada}
                                  onChange={e => updateQtdItem(idx, Number(e.target.value))}
                                  className="w-14 text-center border border-gray-300 rounded px-1 py-0.5 text-sm outline-none"/>
                                <button type="button" onClick={() => updateQtdItem(idx, i.quantidade_aprovada + 1)}
                                  className="w-6 h-6 rounded-full bg-yellow-400 hover:bg-yellow-300 text-xs font-bold flex items-center justify-center">+</button>
                              </div>
                            ) : (
                              <span className={i.alterado ? 'font-bold text-orange-600' : ''}>{i.quantidade_aprovada}</span>
                            )}
                          </td>
                          <td className="py-2 text-gray-500 text-xs">{i.unidade}</td>
                          {modoEdicao && (
                            <td className="py-2">
                              {i.removido
                                ? <button type="button" onClick={() => restaurarItem(idx)} className="text-xs text-green-600 hover:underline">restaurar</button>
                                : <button type="button" onClick={() => removerItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={13}/></button>
                              }
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {modoEdicao && (
                  <div className="border border-dashed border-blue-300 rounded-xl p-3 bg-blue-50">
                    <p className="text-xs font-semibold text-blue-700 mb-2">+ Adicionar produto</p>
                    <div className="flex gap-2">
                      <select value={novoProdId} onChange={e => setNovoProdId(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
                        <option value="">Selecione...</option>
                        {produtosMatriz.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                      <button type="button" onClick={addProdutoNovo} disabled={!novoProdId}
                        className="flex items-center gap-1 bg-blue-500 hover:bg-blue-400 text-white px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                        <Plus size={13}/> Add
                      </button>
                    </div>
                  </div>
                )}

                {/* Motivo de alteração com validação Zod */}
                {modoEdicao && temAlteracoes && (
                  <form onSubmit={alteracaoForm.handleSubmit(salvarEdicao)} className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Motivo das alterações <span className="text-red-500">*</span>
                    </label>
                    <textarea rows={2}
                      {...alteracaoForm.register('motivo')}
                      placeholder="Explique o motivo das alterações feitas neste pedido..."
                      className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400 resize-none
                        ${alteracaoForm.formState.errors.motivo ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}/>
                    <FieldError msg={alteracaoForm.formState.errors.motivo?.message}/>

                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setModoEdicao(false); alteracaoForm.reset() }}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-lg text-sm font-semibold transition">
                        Cancelar
                      </button>
                      <button type="submit" disabled={salvandoEdicao || !temAlteracoes}
                        className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-gray-900 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                        {salvandoEdicao ? 'Salvando...' : '💾 Salvar alterações'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Histórico */}
                {alteracoesLog.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Histórico de alterações</p>
                    <div className="space-y-2">
                      {alteracoesLog.map(l => (
                        <div key={l.id} className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs">
                          <p className="font-semibold text-orange-700">
                            {new Date(l.created_at).toLocaleString('pt-BR')} — {l.motivo}
                          </p>
                          <ul className="mt-1 space-y-0.5 text-orange-600">
                            {(l.alteracoes || []).map((a: any, i: number) => (
                              <li key={i}>• {a.produto}: {a.acao}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pendentes.find(p => p.id === itemSel.id) && !modoEdicao && (
                  <div className="flex gap-2 pt-3 border-t">
                    <button onClick={() => { aprovar(itemSel); setDetalheOpen(false) }}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white py-2.5 rounded-lg text-sm font-semibold transition">
                      <CheckCircle size={16}/> Aprovar
                    </button>
                    <button onClick={() => { setDetalheOpen(false); abrirRecusa(itemSel) }}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-600 py-2.5 rounded-lg text-sm font-semibold transition">
                      <XCircle size={16}/> Recusar
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Modal recusa com validação Zod */}
      <Modal isOpen={recusaOpen} onClose={() => setRecusaOpen(false)} title="Recusar Pedido">
        <form onSubmit={recusaForm.handleSubmit(confirmarRecusa)} className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="font-semibold text-red-700 text-sm">{itemRecusa?.categoria} #{itemRecusa?.numero}</p>
            <p className="text-xs text-red-600 mt-1">{itemRecusa?.origem} → {itemRecusa?.destino}</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Justificativa da recusa <span className="text-red-500">*</span>
            </label>
            <textarea rows={4}
              {...recusaForm.register('justificativa')}
              placeholder="Explique o motivo da recusa com pelo menos 10 caracteres..."
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400 resize-none
                ${recusaForm.formState.errors.justificativa ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}/>
            <FieldError msg={recusaForm.formState.errors.justificativa?.message}/>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setRecusaOpen(false)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-lg text-sm font-semibold transition">
              Cancelar
            </button>
            <button type="submit" disabled={salvandoRecusa}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
              <XCircle size={16}/> {salvandoRecusa ? 'Recusando...' : 'Confirmar recusa'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
