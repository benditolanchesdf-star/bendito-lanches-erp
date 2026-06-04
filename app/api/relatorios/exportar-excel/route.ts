import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

function formatarBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0)
}

function formatarData(data: string): string {
  if (!data) return '—'
  return new Date(data).toLocaleDateString('pt-BR')
}

function formatarMes(data: string): string {
  if (!data) return '—'
  return new Date(data).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

function estilo(wb: XLSX.WorkBook, ws: XLSX.WorkSheet, cabecalho: string[], dados: any[][]): void {
  // Largura automática das colunas
  const maxWidths = cabecalho.map((h, i) => {
    const maxData = Math.max(...dados.map(row => String(row[i] || '').length))
    return Math.min(Math.max(h.length, maxData) + 2, 40)
  })
  ws['!cols'] = maxWidths.map(w => ({ wch: w }))
}

export async function POST(request: NextRequest) {
  const { aba, inicio, fim, filialId, dre, fluxo, pdv, comissoes, comparativo, entregas } = await request.json()

  const wb = XLSX.utils.book_new()
  const titulo = `Bendito Lanches — Relatório ${aba.toUpperCase()} (${formatarData(inicio)} a ${formatarData(fim)})`

  // ── DRE ──────────────────────────────────────────────
  if (aba === 'dre' && dre?.length > 0) {
    const cab = ['Unidade', 'Mês', 'Receita Total', 'Desp. Fixas', 'Desp. Variáveis', 'Outras Desp.', 'Total Despesas', 'Resultado', 'Margem %']
    const rows = dre.map((d: any) => {
      const margem = d.total_receitas > 0 ? ((d.resultado / d.total_receitas) * 100).toFixed(1) + '%' : '—'
      return [d.filial_nome, formatarMes(d.mes), formatarBRL(d.total_receitas), formatarBRL(d.despesas_fixas), formatarBRL(d.despesas_variaveis), formatarBRL(d.despesas_extras), formatarBRL(d.total_despesas), formatarBRL(d.resultado), margem]
    })
    // Linha de totais
    const totais = dre.reduce((acc: any, d: any) => ({
      receitas: (acc.receitas||0) + Number(d.total_receitas||0),
      desp_fixas: (acc.desp_fixas||0) + Number(d.despesas_fixas||0),
      desp_var: (acc.desp_var||0) + Number(d.despesas_variaveis||0),
      desp_ext: (acc.desp_ext||0) + Number(d.despesas_extras||0),
      total_desp: (acc.total_desp||0) + Number(d.total_despesas||0),
      resultado: (acc.resultado||0) + Number(d.resultado||0),
    }), {})
    const margemTotal = totais.receitas > 0 ? ((totais.resultado / totais.receitas) * 100).toFixed(1) + '%' : '—'
    rows.push(['TOTAL CONSOLIDADO', '', formatarBRL(totais.receitas), formatarBRL(totais.desp_fixas), formatarBRL(totais.desp_var), formatarBRL(totais.desp_ext), formatarBRL(totais.total_desp), formatarBRL(totais.resultado), margemTotal])

    const ws = XLSX.utils.aoa_to_sheet([[titulo], [], cab, ...rows])
    estilo(wb, ws, cab, rows)
    XLSX.utils.book_append_sheet(wb, ws, 'DRE')
  }

  // ── FLUXO DE CAIXA ────────────────────────────────────
  if (aba === 'fluxo' && fluxo?.length > 0) {
    const cab = ['Data', 'Unidade', 'Tipo', 'Descrição', 'Valor']
    const rows = fluxo.map((f: any) => [
      formatarData(f.data), f.filial_nome || '—',
      Number(f.valor) >= 0 ? 'Entrada' : 'Saída',
      f.descricao, formatarBRL(f.valor),
    ])
    const totalE = fluxo.filter((f: any) => Number(f.valor) > 0).reduce((s: number, f: any) => s + Number(f.valor), 0)
    const totalS = fluxo.filter((f: any) => Number(f.valor) < 0).reduce((s: number, f: any) => s + Number(f.valor), 0)
    rows.push(['', '', '', 'Total Entradas', formatarBRL(totalE)])
    rows.push(['', '', '', 'Total Saídas', formatarBRL(Math.abs(totalS))])
    rows.push(['', '', '', 'SALDO', formatarBRL(totalE + totalS)])

    const ws = XLSX.utils.aoa_to_sheet([[titulo], [], cab, ...rows])
    estilo(wb, ws, cab, rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Fluxo de Caixa')
  }

  // ── VENDAS PDV ────────────────────────────────────────
  if (aba === 'pdv' && pdv?.length > 0) {
    const cab = ['Data', 'Unidade', 'Atendente', 'Total Vendas', 'Faturamento', 'Dinheiro', 'PIX', 'Cartão', 'Ticket Médio']
    const rows = pdv.map((d: any) => [
      formatarData(d.data), d.filial_nome, d.atendente_nome || '—',
      d.total_vendas, formatarBRL(d.faturamento), formatarBRL(d.total_dinheiro),
      formatarBRL(d.total_pix), formatarBRL(d.total_cartao), formatarBRL(d.ticket_medio),
    ])
    const ws = XLSX.utils.aoa_to_sheet([[titulo], [], cab, ...rows])
    estilo(wb, ws, cab, rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas PDV')
  }

  // ── COMISSÕES ─────────────────────────────────────────
  if (aba === 'comissoes' && comissoes?.length > 0) {
    const cab = ['Vendedor', 'Unidade', 'Mês', 'Pedidos', 'Total Vendido', 'Comissão Total', 'Pago', 'Pendente']
    const rows = comissoes.map((d: any) => [
      d.vendedor_nome, d.filial_nome, formatarMes(d.mes), d.total_pedidos,
      formatarBRL(d.total_vendido), formatarBRL(d.total_comissao),
      formatarBRL(d.comissao_paga), formatarBRL(d.comissao_pendente),
    ])
    const ws = XLSX.utils.aoa_to_sheet([[titulo], [], cab, ...rows])
    estilo(wb, ws, cab, rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Comissões')
  }

  // ── COMPARATIVO ───────────────────────────────────────
  if (aba === 'comparativo' && comparativo?.length > 0) {
    const mesesMap: Record<string, any> = {}
    for (const d of comparativo) {
      const mes = formatarMes(d.mes)
      if (!mesesMap[mes]) mesesMap[mes] = { receitas: 0, despesas: 0, resultado: 0 }
      mesesMap[mes].receitas  += Number(d.total_receitas || 0)
      mesesMap[mes].despesas  += Number(d.total_despesas || 0)
      mesesMap[mes].resultado += Number(d.resultado || 0)
    }
    const meses = Object.keys(mesesMap)
    const cab = ['Métrica', ...meses, 'Variação']
    const rows = ['receitas', 'despesas', 'resultado'].map(key => {
      const label = key === 'receitas' ? '(+) Receitas' : key === 'despesas' ? '(-) Despesas' : '(=) Resultado'
      const valores = meses.map(m => mesesMap[m][key])
      const primeiro = valores[0] || 0
      const ultimo   = valores[valores.length - 1] || 0
      const variacao = primeiro !== 0 ? ((ultimo - primeiro) / Math.abs(primeiro) * 100).toFixed(1) + '%' : '—'
      return [label, ...valores.map(v => formatarBRL(v)), variacao]
    })
    const ws = XLSX.utils.aoa_to_sheet([[titulo], [], cab, ...rows])
    estilo(wb, ws, cab, rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Comparativo')
  }

  // ── ENTREGAS ──────────────────────────────────────────
  if (aba === 'entregas' && entregas?.length > 0) {
    const cab = ['Data', 'Unidade', 'Entregador', 'Cliente', 'Endereço', 'Status', 'Hora Saída', 'Hora Entrega', 'Avaliação', 'Problema']
    const rows = entregas.map((e: any) => [
      formatarData(e.created_at),
      e.filiais?.nome || '—',
      e.entregadores?.nome || '—',
      e.cliente_nome || '—',
      e.endereco_completo || '—',
      e.status,
      e.hora_saida ? new Date(e.hora_saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
      e.hora_entrega ? new Date(e.hora_entrega).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
      e.avaliacao ? `${e.avaliacao}/5` : '—',
      e.motivo_problema || '—',
    ])
    const ws = XLSX.utils.aoa_to_sheet([[titulo], [], cab, ...rows])
    estilo(wb, ws, cab, rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Entregas')
  }

  // Fallback se nenhuma aba gerou dados
  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([[titulo], [], ['Nenhum dado encontrado para o período selecionado.']])
    XLSX.utils.book_append_sheet(wb, ws, 'Sem dados')
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="relatorio_${aba}_${inicio}_${fim}.xlsx"`,
    },
  })
}
