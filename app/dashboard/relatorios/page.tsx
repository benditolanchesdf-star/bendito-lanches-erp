'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL } from '@/lib/constants'
import { PageHeader, Loading } from '@/components/ui'
import {
  TrendingUp, TrendingDown, DollarSign, BarChart2,
  Users, RefreshCw, Building2, Download, FileText,
  FileSpreadsheet, Calendar, ChevronLeft, ChevronRight,
} from 'lucide-react'

const ABAS = [
  { key: 'dre',         label: '📊 DRE',              desc: 'Receitas − Despesas = Resultado' },
  { key: 'fluxo',       label: '💰 Fluxo de Caixa',   desc: 'Entradas e saídas por período' },
  { key: 'pdv',         label: '🛒 Vendas PDV',        desc: 'Por unidade e atendente' },
  { key: 'comissoes',   label: '👥 Comissões',         desc: 'Por vendedor e período' },
  { key: 'comparativo', label: '📈 Comparativo',       desc: 'Mês a mês e filial a filial' },
  { key: 'entregas',    label: '🚚 Entregas',          desc: 'Desempenho e taxa de entrega' },
]

function FiltrosPeriodo({ inicio, fim, filialId, filiais, onInicio, onFim, onFilial, isAdmin }: any) {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">De</label>
        <input type="date" value={inicio} onChange={e => onInicio(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"/>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Até</label>
        <input type="date" value={fim} onChange={e => onFim(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"/>
      </div>
      {isAdmin && (
        <select value={filialId} onChange={e => onFilial(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
          <option value="todas">Todas as unidades</option>
          {filiais.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      )}
    </div>
  )
}

export default function RelatoriosPage() {
  const supabase = createClient()
  const [aba, setAba] = useState('dre')
  const [loading, setLoading] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [filiais, setFiliais] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [filialId, setFilialId] = useState('todas')

  const hoje = new Date()
  const [inicio, setInicio] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0])
  const [fim, setFim] = useState(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0])

  const [dreDados, setDreDados] = useState<any[]>([])
  const [fluxoDados, setFluxoDados] = useState<any[]>([])
  const [pdvDados, setPdvDados] = useState<any[]>([])
  const [comissoesDados, setComissoesDados] = useState<any[]>([])
  const [comparativoDados, setComparativoDados] = useState<any[]>([])
  const [entregasDados, setEntregasDados] = useState<any[]>([])

  // Comparativo: meses para navegar
  const [mesesComp, setMesesComp] = useState(6)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('papel').eq('id', user!.id).maybeSingle()
      setIsAdmin(profile?.papel === 'admin' || profile?.papel === 'matriz')
      const { data: fils } = await supabase.from('filiais').select('id, nome').eq('ativo', true)
      setFiliais(fils || [])
    }
    init()
  }, [])

  useEffect(() => { carregarDados() }, [aba, inicio, fim, filialId])

  async function carregarDados() {
    setLoading(true)
    if (aba === 'dre')         await carregarDRE()
    if (aba === 'fluxo')       await carregarFluxo()
    if (aba === 'pdv')         await carregarPDV()
    if (aba === 'comissoes')   await carregarComissoes()
    if (aba === 'comparativo') await carregarComparativo()
    if (aba === 'entregas')    await carregarEntregas()
    setLoading(false)
  }

  async function carregarDRE() {
    let q = supabase.from('vw_dre').select('*').gte('mes', inicio).lte('mes', fim + 'T23:59:59')
    if (filialId !== 'todas') q = q.eq('filial_id', filialId)
    const { data } = await q
    setDreDados(data || [])
  }

  async function carregarFluxo() {
    let q = supabase.from('vw_fluxo_caixa').select('*').gte('data', inicio).lte('data', fim)
    if (filialId !== 'todas') q = q.eq('filial_id', filialId)
    const { data } = await q.order('data', { ascending: false })
    setFluxoDados(data || [])
  }

  async function carregarPDV() {
    let q = supabase.from('vw_vendas_pdv_resumo').select('*').gte('data', inicio).lte('data', fim)
    if (filialId !== 'todas') q = q.eq('filial_id', filialId)
    const { data } = await q
    setPdvDados(data || [])
  }

  async function carregarComissoes() {
    let q = supabase.from('vw_comissoes_vendedores').select('*').gte('mes', inicio).lte('mes', fim + 'T23:59:59')
    if (filialId !== 'todas') q = q.eq('filial_id', filialId)
    const { data } = await q
    setComissoesDados(data || [])
  }

  async function carregarComparativo() {
    // Últimos N meses para comparativo
    const dataInicio = new Date()
    dataInicio.setMonth(dataInicio.getMonth() - mesesComp)
    const inicioComp = dataInicio.toISOString().split('T')[0]
    const fimComp = new Date().toISOString().split('T')[0]

    let q = supabase.from('vw_dre').select('*').gte('mes', inicioComp).lte('mes', fimComp + 'T23:59:59')
    if (filialId !== 'todas') q = q.eq('filial_id', filialId)
    const { data } = await q.order('mes')
    setComparativoDados(data || [])
  }

  async function carregarEntregas() {
    const { data } = await supabase.from('entregas')
      .select('*, entregadores(nome), filiais(nome)')
      .gte('created_at', inicio).lte('created_at', fim + 'T23:59:59')
      .order('created_at', { ascending: false })
    setEntregasDados(data || [])
  }

  // ── Exportação Excel via API ──────────────────────────
  async function exportarExcel() {
    setExportando(true)
    try {
      const payload = {
        aba, inicio, fim, filialId,
        dre: dreDados, fluxo: fluxoDados, pdv: pdvDados,
        comissoes: comissoesDados, comparativo: comparativoDados,
        entregas: entregasDados,
      }
      const res = await fetch('/api/relatorios/exportar-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `relatorio_${aba}_${inicio}_${fim}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error(e)
    }
    setExportando(false)
  }

  // ── Exportação PDF (impressão) ──────────────────────────
  function exportarPDF() {
    window.print()
  }

  // Consolidados
  const dreConsolidado = dreDados.reduce((acc, d) => ({
    total_receitas:     (acc.total_receitas || 0)     + Number(d.total_receitas || 0),
    despesas_fixas:     (acc.despesas_fixas || 0)     + Number(d.despesas_fixas || 0),
    despesas_variaveis: (acc.despesas_variaveis || 0) + Number(d.despesas_variaveis || 0),
    despesas_extras:    (acc.despesas_extras || 0)    + Number(d.despesas_extras || 0),
    total_despesas:     (acc.total_despesas || 0)     + Number(d.total_despesas || 0),
    resultado:          (acc.resultado || 0)          + Number(d.resultado || 0),
  }), {})

  const totalEntradas = fluxoDados.filter(f => Number(f.valor) > 0).reduce((s, f) => s + Number(f.valor), 0)
  const totalSaidas   = fluxoDados.filter(f => Number(f.valor) < 0).reduce((s, f) => s + Number(f.valor), 0)

  const pdvConsolidado = pdvDados.reduce((acc, d) => ({
    total_vendas:   (acc.total_vendas || 0)   + Number(d.total_vendas || 0),
    faturamento:    (acc.faturamento || 0)    + Number(d.faturamento || 0),
    total_dinheiro: (acc.total_dinheiro || 0) + Number(d.total_dinheiro || 0),
    total_pix:      (acc.total_pix || 0)      + Number(d.total_pix || 0),
    total_cartao:   (acc.total_cartao || 0)   + Number(d.total_cartao || 0),
  }), {})

  const comissoesConsolidado = comissoesDados.reduce((acc, d) => ({
    total_vendido:     (acc.total_vendido || 0)     + Number(d.total_vendido || 0),
    total_comissao:    (acc.total_comissao || 0)    + Number(d.total_comissao || 0),
    comissao_paga:     (acc.comissao_paga || 0)     + Number(d.comissao_paga || 0),
    comissao_pendente: (acc.comissao_pendente || 0) + Number(d.comissao_pendente || 0),
  }), {})

  // Comparativo mensal agrupado
  const mesesMap: Record<string, any> = {}
  for (const d of comparativoDados) {
    const mes = d.mes ? new Date(d.mes).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) : '—'
    if (!mesesMap[mes]) mesesMap[mes] = { receitas: 0, despesas: 0, resultado: 0 }
    mesesMap[mes].receitas  += Number(d.total_receitas || 0)
    mesesMap[mes].despesas  += Number(d.total_despesas || 0)
    mesesMap[mes].resultado += Number(d.resultado || 0)
  }
  const mesesArray = Object.entries(mesesMap)

  // Stats de entregas
  const entregasStats = {
    total:     entregasDados.length,
    entregues: entregasDados.filter(e => e.status === 'entregue').length,
    problemas: entregasDados.filter(e => e.status === 'problema').length,
    mediaAv:   (() => {
      const comAv = entregasDados.filter(e => e.avaliacao)
      return comAv.length > 0 ? (comAv.reduce((s, e) => s + e.avaliacao, 0) / comAv.length).toFixed(1) : '—'
    })(),
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bendito-verde-escuro">Relatórios</h1>
          <p className="text-gray-500 text-sm mt-0.5">Análises consolidadas com exportação</p>
        </div>
        {/* Botões de exportação */}
        <div className="flex gap-2">
          <button onClick={exportarPDF}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold transition">
            <FileText size={15}/> PDF
          </button>
          <button onClick={exportarExcel} disabled={exportando}
            className="flex items-center gap-2 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
            <FileSpreadsheet size={15}/> {exportando ? 'Gerando...' : 'Excel'}
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          {ABAS.map(a => (
            <button key={a.key} onClick={() => setAba(a.key)}
              className={`px-5 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition ${aba === a.key ? 'border-bendito-dourado text-bendito-verde-escuro bg-bendito-creme/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros — não aparece no comparativo (tem controle próprio) */}
      {aba !== 'comparativo' && (
        <FiltrosPeriodo inicio={inicio} fim={fim} filialId={filialId} filiais={filiais} isAdmin={isAdmin}
          onInicio={setInicio} onFim={setFim} onFilial={setFilialId}/>
      )}

      {loading ? <Loading /> : (
        <>
          {/* ════ DRE ════ */}
          {aba === 'dre' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Receita Total',   valor: dreConsolidado.total_receitas, cor: 'text-green-600', icon: TrendingUp },
                  { label: 'Despesas Totais', valor: dreConsolidado.total_despesas, cor: 'text-red-600',   icon: TrendingDown },
                  { label: 'Resultado',       valor: dreConsolidado.resultado,       cor: Number(dreConsolidado.resultado||0) >= 0 ? 'text-green-600' : 'text-red-600', icon: DollarSign },
                ].map(c => {
                  const Icon = c.icon
                  return (
                    <div key={c.label} className="bg-white rounded-xl shadow-md p-5">
                      <div className="flex items-center gap-2 mb-2"><Icon size={18} className={c.cor}/><p className="text-xs text-gray-500">{c.label}</p></div>
                      <p className={`text-2xl font-bold ${c.cor}`}>{formatBRL(c.valor || 0)}</p>
                    </div>
                  )
                })}
              </div>
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50"><h2 className="font-bold text-bendito-verde-escuro">Demonstrativo de Resultado</h2></div>
                <div className="p-6 space-y-3">
                  {[
                    { label: '(+) Receita Total',        valor: dreConsolidado.total_receitas,     cor: 'text-green-600', bold: true },
                    { label: '  (-) Despesas Fixas',      valor: dreConsolidado.despesas_fixas,     cor: 'text-red-500',   bold: false },
                    { label: '  (-) Despesas Variáveis',  valor: dreConsolidado.despesas_variaveis, cor: 'text-red-500',   bold: false },
                    { label: '  (-) Outras Despesas',     valor: dreConsolidado.despesas_extras,    cor: 'text-red-500',   bold: false },
                    { label: '  Total Despesas',          valor: dreConsolidado.total_despesas,     cor: 'text-red-600',   bold: true },
                    { label: '(=) RESULTADO LÍQUIDO',     valor: dreConsolidado.resultado,           cor: Number(dreConsolidado.resultado||0) >= 0 ? 'text-green-700' : 'text-red-700', bold: true, destaque: true },
                  ].map((linha, i) => (
                    <div key={i} className={`flex justify-between items-center py-2 ${linha.destaque ? 'border-t-2 border-gray-200 pt-4 mt-2' : 'border-b border-gray-100'}`}>
                      <span className={`text-sm ${linha.bold ? 'font-bold' : ''} text-gray-700`}>{linha.label}</span>
                      <span className={`text-sm ${linha.bold ? 'font-bold text-base' : ''} ${linha.cor}`}>{formatBRL(linha.valor || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {filialId === 'todas' && dreDados.length > 0 && (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="px-6 py-4 border-b bg-gray-50"><h2 className="font-bold text-bendito-verde-escuro flex items-center gap-2"><Building2 size={18}/> Por Unidade</h2></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>{['Unidade','Mês','Receitas','Despesas','Resultado','Margem'].map(h =>
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        )}</tr>
                      </thead>
                      <tbody className="divide-y">
                        {dreDados.map((d, i) => {
                          const margem = d.total_receitas > 0 ? ((d.resultado / d.total_receitas) * 100).toFixed(1) : '—'
                          return (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium">{d.filial_nome}</td>
                              <td className="px-4 py-3 text-gray-500">{d.mes ? new Date(d.mes).toLocaleDateString('pt-BR',{month:'short',year:'numeric'}) : '—'}</td>
                              <td className="px-4 py-3 text-green-600 font-semibold">{formatBRL(d.total_receitas)}</td>
                              <td className="px-4 py-3 text-red-500 font-semibold">{formatBRL(d.total_despesas)}</td>
                              <td className={`px-4 py-3 font-bold ${Number(d.resultado)>=0?'text-green-600':'text-red-600'}`}>{formatBRL(d.resultado)}</td>
                              <td className={`px-4 py-3 font-semibold ${Number(margem)>=0?'text-green-600':'text-red-600'}`}>{margem !== '—' ? `${margem}%` : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ FLUXO ════ */}
          {aba === 'fluxo' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Entradas',  valor: totalEntradas,              cor: 'text-green-600' },
                  { label: 'Saídas',    valor: Math.abs(totalSaidas),      cor: 'text-red-600' },
                  { label: 'Saldo',     valor: totalEntradas + totalSaidas, cor: totalEntradas + totalSaidas >= 0 ? 'text-green-700' : 'text-red-700' },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-xl shadow-md p-5 text-center">
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${c.cor}`}>{formatBRL(c.valor)}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>{['Data','Unidade','Tipo','Descrição','Valor'].map(h =>
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      )}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {fluxoDados.length === 0
                        ? <tr><td colSpan={5} className="text-center text-gray-400 py-8">Nenhum dado no período.</td></tr>
                        : fluxoDados.map((f, i) => {
                          const entrada = Number(f.valor) > 0
                          return (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-500">{new Date(f.data).toLocaleDateString('pt-BR')}</td>
                              <td className="px-4 py-3 text-gray-600">{f.filial_nome||'—'}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${entrada?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                                  {entrada ? '↑ Entrada' : '↓ Saída'}
                                </span>
                              </td>
                              <td className="px-4 py-3">{f.descricao}</td>
                              <td className={`px-4 py-3 font-bold ${entrada?'text-green-600':'text-red-600'}`}>
                                {entrada?'+':''}{formatBRL(f.valor)}
                              </td>
                            </tr>
                          )
                        })
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════ PDV ════ */}
          {aba === 'pdv' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Vendas', valor: pdvConsolidado.total_vendas, fmt: false },
                  { label: 'Faturamento',  valor: pdvConsolidado.faturamento,  fmt: true },
                  { label: 'PIX',          valor: pdvConsolidado.total_pix,    fmt: true },
                  { label: 'Cartão',       valor: pdvConsolidado.total_cartao, fmt: true },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-xl shadow-md p-4 text-center">
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className="text-2xl font-bold text-bendito-verde mt-1">
                      {c.fmt ? formatBRL(c.valor||0) : (c.valor||0)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>{['Data','Unidade','Atendente','Vendas','Faturamento','Dinheiro','PIX','Cartão','Ticket Médio'].map(h =>
                        <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                      )}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {pdvDados.length === 0
                        ? <tr><td colSpan={9} className="text-center text-gray-400 py-8">Nenhuma venda no período.</td></tr>
                        : pdvDados.map((d, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-500">{new Date(d.data).toLocaleDateString('pt-BR')}</td>
                            <td className="px-4 py-2 font-medium">{d.filial_nome}</td>
                            <td className="px-4 py-2 text-gray-500">{d.atendente_nome||'—'}</td>
                            <td className="px-4 py-2 font-bold text-center">{d.total_vendas}</td>
                            <td className="px-4 py-2 font-bold text-bendito-verde">{formatBRL(d.faturamento)}</td>
                            <td className="px-4 py-2 text-green-600">{formatBRL(d.total_dinheiro)}</td>
                            <td className="px-4 py-2 text-blue-600">{formatBRL(d.total_pix)}</td>
                            <td className="px-4 py-2 text-purple-600">{formatBRL(d.total_cartao)}</td>
                            <td className="px-4 py-2 text-gray-600">{formatBRL(d.ticket_medio)}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════ COMISSÕES ════ */}
          {aba === 'comissoes' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Vendido',      valor: comissoesConsolidado.total_vendido,     cor: 'text-bendito-verde' },
                  { label: 'Total Comissões',     valor: comissoesConsolidado.total_comissao,    cor: 'text-blue-600' },
                  { label: 'Comissões Pagas',     valor: comissoesConsolidado.comissao_paga,     cor: 'text-green-600' },
                  { label: 'Comissões Pendentes', valor: comissoesConsolidado.comissao_pendente, cor: 'text-orange-600' },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-xl shadow-md p-4 text-center">
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className={`text-xl font-bold mt-1 ${c.cor}`}>{formatBRL(c.valor||0)}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>{['Vendedor','Unidade','Mês','Pedidos','Total Vendido','Comissão','Pago','Pendente'].map(h =>
                        <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                      )}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {comissoesDados.length === 0
                        ? <tr><td colSpan={8} className="text-center text-gray-400 py-8">Nenhuma comissão no período.</td></tr>
                        : comissoesDados.map((d, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-semibold text-bendito-verde-escuro">{d.vendedor_nome}</td>
                            <td className="px-4 py-2 text-gray-500">{d.filial_nome}</td>
                            <td className="px-4 py-2 text-gray-500">{d.mes?new Date(d.mes).toLocaleDateString('pt-BR',{month:'short',year:'numeric'}):'—'}</td>
                            <td className="px-4 py-2 text-center font-bold">{d.total_pedidos}</td>
                            <td className="px-4 py-2 font-semibold text-bendito-verde">{formatBRL(d.total_vendido)}</td>
                            <td className="px-4 py-2 font-bold text-blue-600">{formatBRL(d.total_comissao)}</td>
                            <td className="px-4 py-2 text-green-600">{formatBRL(d.comissao_paga)}</td>
                            <td className="px-4 py-2 text-orange-600 font-semibold">{formatBRL(d.comissao_pendente)}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════ COMPARATIVO ════ */}
          {aba === 'comparativo' && (
            <div className="space-y-4">
              {/* Controle de horizonte */}
              <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700">Comparar últimos:</span>
                <div className="flex gap-2">
                  {[3, 6, 12].map(m => (
                    <button key={m} onClick={() => { setMesesComp(m); carregarComparativo() }}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${mesesComp === m ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-white border-gray-300 text-gray-600 hover:border-bendito-verde'}`}>
                      {m} meses
                    </button>
                  ))}
                </div>
                {isAdmin && (
                  <select value={filialId} onChange={e => setFilialId(e.target.value)}
                    className="ml-auto border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="todas">Todas as unidades</option>
                    {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                )}
              </div>

              {/* Tabela comparativa mês a mês */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50">
                  <h2 className="font-bold text-bendito-verde-escuro">📈 Comparativo Mês a Mês</h2>
                </div>
                {mesesArray.length === 0
                  ? <p className="text-center text-gray-400 py-8">Sem dados para comparativo.</p>
                  : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Métrica</th>
                            {mesesArray.map(([mes]) => (
                              <th key={mes} className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{mes}</th>
                            ))}
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Variação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {[
                            { key: 'receitas',  label: '(+) Receitas',  cor: 'text-green-600' },
                            { key: 'despesas',  label: '(-) Despesas',  cor: 'text-red-600' },
                            { key: 'resultado', label: '(=) Resultado', cor: 'text-gray-900', bold: true },
                          ].map(linha => {
                            const valores = mesesArray.map(([, d]) => Number((d as any)[linha.key] || 0))
                            const primeiro = valores[0] || 0
                            const ultimo   = valores[valores.length - 1] || 0
                            const variacao = primeiro !== 0 ? (((ultimo - primeiro) / Math.abs(primeiro)) * 100).toFixed(1) : '—'
                            const subiu = Number(variacao) > 0
                            return (
                              <tr key={linha.key} className="hover:bg-gray-50">
                                <td className={`px-4 py-3 ${linha.bold ? 'font-bold' : 'font-medium'} ${linha.cor}`}>{linha.label}</td>
                                {valores.map((v, i) => (
                                  <td key={i} className={`px-4 py-3 text-right ${linha.bold ? 'font-bold' : ''} ${linha.cor}`}>
                                    {formatBRL(v)}
                                  </td>
                                ))}
                                <td className={`px-4 py-3 text-right font-bold ${variacao === '—' ? 'text-gray-400' : subiu ? 'text-green-600' : 'text-red-600'}`}>
                                  {variacao !== '—' ? `${subiu ? '▲' : '▼'} ${Math.abs(Number(variacao))}%` : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </div>

              {/* Gráfico de barras visual simples */}
              {mesesArray.length > 0 && (
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="font-bold text-bendito-verde-escuro mb-4">📊 Resultado por Mês</h2>
                  <div className="flex items-end gap-3 h-40">
                    {mesesArray.map(([mes, d]) => {
                      const resultado = Number((d as any).resultado || 0)
                      const maxVal = Math.max(...mesesArray.map(([, x]) => Math.abs(Number((x as any).resultado || 0))))
                      const altura = maxVal > 0 ? Math.abs((resultado / maxVal) * 100) : 0
                      const positivo = resultado >= 0
                      return (
                        <div key={mes} className="flex flex-col items-center gap-1 flex-1">
                          <span className={`text-xs font-bold ${positivo ? 'text-green-600' : 'text-red-600'}`}>
                            {formatBRL(resultado).replace('R$\u00a0', '')}
                          </span>
                          <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                            <div
                              className={`w-full rounded-t-lg ${positivo ? 'bg-green-400' : 'bg-red-400'}`}
                              style={{ height: `${Math.max(altura, 4)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 text-center">{mes}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ ENTREGAS ════ */}
          {aba === 'entregas' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Entregas',  valor: entregasStats.total,     cor: 'text-gray-700' },
                  { label: 'Entregues',        valor: entregasStats.entregues, cor: 'text-green-600' },
                  { label: 'Problemas',        valor: entregasStats.problemas, cor: 'text-red-600' },
                  { label: 'Avaliação Média',  valor: entregasStats.mediaAv,   cor: 'text-yellow-600', noBRL: true },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-xl shadow-md p-4 text-center">
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${c.cor}`}>
                      {c.noBRL ? `⭐ ${c.valor}` : c.valor}
                    </p>
                  </div>
                ))}
              </div>

              {/* Taxa por entregador */}
              {(() => {
                const porEnt: Record<string, any> = {}
                for (const e of entregasDados) {
                  const nome = e.entregadores?.nome || 'Sem entregador'
                  if (!porEnt[nome]) porEnt[nome] = { total: 0, entregues: 0, problemas: 0, soma_av: 0, qtd_av: 0 }
                  porEnt[nome].total++
                  if (e.status === 'entregue') { porEnt[nome].entregues++; if (e.avaliacao) { porEnt[nome].soma_av += e.avaliacao; porEnt[nome].qtd_av++ } }
                  if (e.status === 'problema') porEnt[nome].problemas++
                }
                return (
                  <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <div className="px-6 py-4 border-b bg-gray-50"><h2 className="font-bold text-bendito-verde-escuro">Por Entregador</h2></div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>{['Entregador','Total','Entregues','Problemas','Taxa','Avaliação'].map(h =>
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                          )}</tr>
                        </thead>
                        <tbody className="divide-y">
                          {Object.entries(porEnt).map(([nome, s]) => {
                            const taxa = s.total > 0 ? ((s.entregues / s.total) * 100).toFixed(0) : '0'
                            const av   = s.qtd_av > 0 ? (s.soma_av / s.qtd_av).toFixed(1) : '—'
                            return (
                              <tr key={nome} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-semibold text-bendito-verde-escuro">{nome}</td>
                                <td className="px-4 py-3 text-center font-bold">{s.total}</td>
                                <td className="px-4 py-3 text-center text-green-600 font-semibold">{s.entregues}</td>
                                <td className="px-4 py-3 text-center text-red-600 font-semibold">{s.problemas}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${taxa}%` }}/>
                                    </div>
                                    <span className="text-xs font-bold text-green-600">{taxa}%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-yellow-500 font-bold">{av !== '—' ? `⭐ ${av}` : '—'}</td>
                              </tr>
                            )
                          })}
                          {Object.keys(porEnt).length === 0 && (
                            <tr><td colSpan={6} className="text-center text-gray-400 py-8">Nenhuma entrega no período.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </>
      )}
    </div>
  )
}
