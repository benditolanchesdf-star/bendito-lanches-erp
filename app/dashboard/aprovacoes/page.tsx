'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData } from '@/lib/constants'
import { PageHeader, Loading, EmptyState } from '@/components/ui'
import Modal from '@/components/Modal'
import {
  CheckCircle, XCircle, Clock, ShoppingBag, ArrowLeftRight,
  RefreshCw, Eye, Printer, Download, AlertTriangle,
} from 'lucide-react'

type Aba = 'pendentes' | 'aprovados' | 'recusados'

const TIPO_CONFIG: Record<string, { label: string; icon: any; cor: string }> = {
  pedido_interno:       { label: 'Pedido Interno',  icon: ArrowLeftRight, cor: 'bg-blue-100 text-blue-700' },
  pedido_compra_matriz: { label: 'Compra (Matriz)', icon: ShoppingBag,    cor: 'bg-purple-100 text-purple-700' },
  pedido_compra_admin:  { label: 'Compra (Admin)',  icon: ShoppingBag,    cor: 'bg-red-100 text-red-700' },
  pedido_compra:        { label: 'Pedido de Compra',icon: ShoppingBag,    cor: 'bg-orange-100 text-orange-700' },
}

const STATUS_COR: Record<string, string> = {
  pendente:       'bg-yellow-100 text-yellow-700',
  aprovado:       'bg-blue-100 text-blue-700',
  aprovado_matriz:'bg-blue-100 text-blue-700',
  aprovado_admin: 'bg-indigo-100 text-indigo-700',
  separando:      'bg-purple-100 text-purple-700',
  enviado:        'bg-orange-100 text-orange-700',
  em_compra:      'bg-purple-100 text-purple-700',
  recebido:       'bg-green-100 text-green-700',
  concluido:      'bg-green-100 text-green-700',
  cancelado:      'bg-red-100 text-red-700',
  recusado:       'bg-red-100 text-red-700',
}

export default function AprovacoesPage() {
  const supabase = createClient()
  const [aba, setAba] = useState<Aba>('pendentes')
  const [loading, setLoading] = useState(true)
  const [pendentes, setPendentes] = useState<any[]>([])
  const [aprovados, setAprovados] = useState<any[]>([])
  const [recusados, setRecusados] = useState<any[]>([])
  const [salvando, setSalvando] = useState<string | null>(null)
  const [obsMap, setObsMap] = useState<Record<string, string>>({})

  // Modal detalhe
  const [detalheOpen, setDetalheOpen] = useState(false)
  const [itemSel, setItemSel] = useState<any>(null)
  const [itensPedido, setItensPedido] = useState<any[]>([])
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)

  // Modal recusa
  const [recusaOpen, setRecusaOpen] = useState(false)
  const [itemRecusa, setItemRecusa] = useState<any>(null)
  const [justificativa, setJustificativa] = useState('')
  const [salvandoRecusa, setSalvandoRecusa] = useState(false)

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

  async function abrirDetalhe(item: any) {
    setItemSel(item)
    setItensPedido([])
    setDetalheOpen(true)
    setLoadingDetalhe(true)
    if (item.tipo === 'pedido_interno') {
      const { data } = await supabase.from('pedido_interno_itens')
        .select('*, produtos(nome)').eq('pedido_interno_id', item.id)
      setItensPedido(data || [])
    } else {
      const { data } = await supabase.from('pedido_compra_itens')
        .select('*').eq('pedido_compra_id', item.id)
      setItensPedido(data || [])
    }
    setLoadingDetalhe(false)
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
    setJustificativa('')
    setRecusaOpen(true)
  }

  async function confirmarRecusa() {
    if (!justificativa.trim()) return
    setSalvandoRecusa(true)
    if (itemRecusa.tipo === 'pedido_interno') {
      await supabase.from('pedidos_internos').update({
        status: 'cancelado', justificativa_recusa: justificativa,
      }).eq('id', itemRecusa.id)
    } else {
      await supabase.from('pedidos_compra').update({
        status: 'recusado', justificativa_recusa: justificativa,
      }).eq('id', itemRecusa.id)
    }
    setSalvandoRecusa(false); setRecusaOpen(false); setItemRecusa(null); load()
  }

  function imprimirPedido() {
    if (!itemSel) return
    const linhasItens = itensPedido.map(i =>
      `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${i.produtos?.nome || i.descricao || i.observacao?.replace('[OUTRO] ','') || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${i.quantidade_pedida || i.quantidade || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${i.unidade || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${i.valor_unitario_est ? 'R$ ' + Number(i.valor_unitario_est).toFixed(2) : '—'}</td>
      </tr>`
    ).join('')

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Pedido #${itemSel.numero}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 13px; color: #333; padding: 24px; }
          h1 { font-size: 18px; color: #1a3a2a; margin-bottom: 4px; }
          .info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 16px 0; font-size: 12px; }
          .info span { color: #666; }
          .info strong { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background: #f5f5f5; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; color: #666; }
          .badge { display:inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
          .obs { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 8px 12px; margin-top: 16px; font-size: 12px; }
          .footer { margin-top: 32px; border-top: 1px solid #eee; padding-top: 12px; font-size: 11px; color: #999; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>🍕 Bendito Lanches — ${itemSel.categoria} #${itemSel.numero}</h1>
        <div class="info">
          <div><span>Origem: </span><strong>${itemSel.origem}</strong></div>
          <div><span>Destino: </span><strong>${itemSel.destino}</strong></div>
          <div><span>Data: </span><strong>${new Date(itemSel.created_at).toLocaleDateString('pt-BR')}</strong></div>
          <div><span>Status: </span><strong>${itemSel.status}</strong></div>
          ${itemSel.valor ? `<div><span>Valor estimado: </span><strong>${formatBRL(itemSel.valor)}</strong></div>` : ''}
        </div>
        ${itemSel.observacoes ? `<div class="obs">📝 Observações: ${itemSel.observacoes}</div>` : ''}
        <table>
          <thead>
            <tr>
              <th>Produto / Descrição</th>
              <th style="text-align:center">Qtd</th>
              <th>Un</th>
              <th style="text-align:right">Valor Unit.</th>
            </tr>
          </thead>
          <tbody>${linhasItens}</tbody>
        </table>
        <div class="footer">
          Documento gerado em ${new Date().toLocaleString('pt-BR')} · Bendito Lanches ERP
        </div>
      </body>
      </html>
    `
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  function baixarPDF() {
    if (!itemSel) return
    imprimirPedido() // Usa o print do navegador que permite salvar como PDF
  }

  const urgentes = pendentes.filter(a => {
    const dias = Math.floor((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24))
    return dias >= 2
  })

  const renderLista = (lista: any[], tipo: 'pendentes' | 'aprovados' | 'recusados') => {
    if (lista.length === 0) return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center">
        <CheckCircle size={48} className="text-green-400 mx-auto mb-3"/>
        <p className="text-lg font-bold text-gray-700">
          {tipo === 'pendentes' ? 'Tudo em dia!' : tipo === 'aprovados' ? 'Nenhuma aprovação ainda.' : 'Nenhuma recusa registrada.'}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {tipo === 'pendentes' ? 'Nenhuma solicitação pendente.' : ''}
        </p>
      </div>
    )

    return (
      <div className="space-y-3">
        {lista.map(a => {
          const cfg = TIPO_CONFIG[a.tipo] || TIPO_CONFIG.pedido_interno
          const Icon = cfg.icon
          const dias = Math.floor((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24))
          const urgente = tipo === 'pendentes' && dias >= 2
          return (
            <div key={a.id} className={`bg-white rounded-xl shadow-md p-5 border-l-4 ${urgente ? 'border-red-400' : tipo === 'aprovados' ? 'border-green-400' : tipo === 'recusados' ? 'border-red-300' : 'border-bendito-dourado'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-lg ${cfg.cor} shrink-0`}><Icon size={16}/></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-bendito-verde-escuro">{a.categoria} #{a.numero}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cor}`}>{cfg.label}</span>
                      {urgente && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
                          ⚠️ {dias} dias em espera
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COR[a.status] || 'bg-gray-100 text-gray-600'}`}>
                        {a.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">{a.origem}</span>
                      {a.destino && <> → <span className="font-medium">{a.destino}</span></>}
                    </p>
                    {a.observacoes && (
                      <p className="text-xs text-gray-500 mt-1 bg-gray-50 px-2 py-1 rounded">📝 {a.observacoes}</p>
                    )}
                    {tipo === 'recusados' && a.justificativa_recusa && (
                      <p className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded">
                        ❌ Motivo: {a.justificativa_recusa}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span><Clock size={11} className="inline mr-1"/>{formatData(a.created_at)}</span>
                      {a.valor && <span className="font-semibold text-bendito-verde">{formatBRL(a.valor)}</span>}
                    </div>
                  </div>
                </div>

                {/* Ações */}
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

              {/* Campo obs recusa — só pendentes */}
              {tipo === 'pendentes' && (
                <div className="mt-3">
                  <input value={obsMap[a.id] || ''} onChange={e => setObsMap(prev => ({...prev, [a.id]: e.target.value}))}
                    placeholder="Justificativa da recusa (obrigatório ao recusar)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-bendito-dourado"/>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Central de Aprovações" subtitle="Gerencie todas as solicitações pendentes, aprovadas e recusadas"
        action={
          <button onClick={load} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
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
            <p className="text-xs text-gray-500">⚠️ Com atraso (+2 dias)</p>
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
              className={`px-5 py-4 text-sm font-semibold border-b-2 transition ${aba === a.key ? 'border-bendito-dourado text-bendito-verde-escuro' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Loading /> : (
        <>
          {aba === 'pendentes' && renderLista(pendentes, 'pendentes')}
          {aba === 'aprovados' && renderLista(aprovados, 'aprovados')}
          {aba === 'recusados' && renderLista(recusados, 'recusados')}
        </>
      )}

      {/* Modal detalhe + impressão */}
      <Modal isOpen={detalheOpen} onClose={() => setDetalheOpen(false)}
        title={`${itemSel?.categoria} #${itemSel?.numero}`}>
        {itemSel && (
          <div className="space-y-4">
            {/* Botões impressão */}
            <div className="flex gap-2 justify-end">
              <button onClick={imprimirPedido}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-xs font-semibold transition">
                <Printer size={14}/> Imprimir
              </button>
              <button onClick={baixarPDF}
                className="flex items-center gap-1.5 bg-bendito-verde hover:bg-bendito-verde-escuro text-white px-3 py-2 rounded-lg text-xs font-semibold transition">
                <Download size={14}/> Salvar PDF
              </button>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <p>Origem: <strong className="text-gray-700">{itemSel.origem}</strong></p>
              <p>Destino: <strong className="text-gray-700">{itemSel.destino}</strong></p>
              <p>Data: <strong className="text-gray-700">{formatData(itemSel.created_at)}</strong></p>
              <p>Status: <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_COR[itemSel.status] || 'bg-gray-100'}`}>{itemSel.status}</span></p>
              {itemSel.valor && <p>Valor est.: <strong className="text-bendito-verde">{formatBRL(itemSel.valor)}</strong></p>}
            </div>

            {itemSel.observacoes && (
              <p className="text-xs bg-yellow-50 border border-yellow-200 p-2 rounded">📝 {itemSel.observacoes}</p>
            )}
            {itemSel.justificativa_recusa && (
              <p className="text-xs bg-red-50 border border-red-200 p-2 rounded text-red-700">❌ Motivo da recusa: {itemSel.justificativa_recusa}</p>
            )}

            {/* Itens */}
            {loadingDetalhe ? (
              <p className="text-center text-gray-400 text-sm py-4">Carregando itens...</p>
            ) : itensPedido.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Itens do pedido</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b">
                      {['Produto/Descrição','Qtd','Un','Valor Est.'].map(h =>
                        <th key={h} className="text-left pb-1">{h}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {itensPedido.map((i, idx) => (
                      <tr key={idx}>
                        <td className="py-2">
                          {i.observacao?.startsWith('[OUTRO]')
                            ? <span className="flex items-center gap-1 text-orange-600">
                                {i.observacao.replace('[OUTRO] ','')}
                                <span className="text-xs bg-orange-100 px-1 rounded">outro</span>
                              </span>
                            : (i.produtos?.nome || i.descricao || '—')
                          }
                        </td>
                        <td className="py-2">{i.quantidade_pedida || i.quantidade || '—'}</td>
                        <td className="py-2 text-gray-500">{i.unidade || '—'}</td>
                        <td className="py-2 text-right">{i.valor_unitario_est ? formatBRL(i.valor_unitario_est) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">Nenhum item encontrado.</p>
            )}

            {/* Ações no detalhe */}
            {pendentes.find(p => p.id === itemSel.id) && (
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
          </div>
        )}
      </Modal>

      {/* Modal recusa com justificativa obrigatória */}
      <Modal isOpen={recusaOpen} onClose={() => setRecusaOpen(false)} title="Recusar Pedido">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="font-semibold text-red-700 text-sm">{itemRecusa?.categoria} #{itemRecusa?.numero}</p>
            <p className="text-xs text-red-600 mt-1">{itemRecusa?.origem} → {itemRecusa?.destino}</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Justificativa da recusa <span className="text-red-500">*</span>
            </label>
            <textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={4}
              placeholder="Explique o motivo da recusa. Esta justificativa ficará registrada e visível para quem fez a solicitação..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400 resize-none"/>
            {!justificativa.trim() && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle size={11}/> A justificativa é obrigatória para recusar.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setRecusaOpen(false)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-lg text-sm font-semibold transition">
              Cancelar
            </button>
            <button onClick={confirmarRecusa} disabled={salvandoRecusa || !justificativa.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
              <XCircle size={16}/> {salvandoRecusa ? 'Recusando...' : 'Confirmar recusa'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
