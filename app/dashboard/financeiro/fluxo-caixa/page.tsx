'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL } from '@/lib/constants'
import { PageHeader, Loading } from '@/components/ui'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, RefreshCw, Building2 } from 'lucide-react'

export default function FluxoCaixaPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [fluxo, setFluxo] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [filialFiltro, setFilialFiltro] = useState('todas')
  const [horizonte, setHorizonte] = useState('30')
  const [isAdmin, setIsAdmin] = useState(false)
  const [saldoAtual, setSaldoAtual] = useState(0)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('papel').eq('id', user!.id).maybeSingle()
    setIsAdmin(['admin','matriz'].includes(profile?.papel || ''))

    let query = supabase.from('vw_fluxo_projetado').select('*')
    if (filialFiltro !== 'todas') query = query.eq('filial_id', filialFiltro)

    const [flux, fils, contasBancarias] = await Promise.all([
      query,
      supabase.from('filiais').select('id, nome').eq('ativo', true),
      supabase.from('contas_bancarias').select('saldo_atual').eq('ativo', true),
    ])
    setFluxo(flux.data || [])
    setFiliais(fils.data || [])
    setSaldoAtual((contasBancarias.data || []).reduce((s, c) => s + Number(c.saldo_atual||0), 0))
    setLoading(false)
  }
  useEffect(() => { load() }, [filialFiltro])

  // Agrupar por data e consolidar se "todas"
  const hoje = new Date().toISOString().split('T')[0]
  const limite = new Date()
  limite.setDate(limite.getDate() + Number(horizonte))
  const limitStr = limite.toISOString().split('T')[0]

  const diasMap: Record<string, { entradas: number; saidas: number; saldo_dia: number; qtd_receber: number; qtd_pagar: number }> = {}
  fluxo
    .filter(f => f.data >= hoje && f.data <= limitStr)
    .forEach(f => {
      if (!diasMap[f.data]) diasMap[f.data] = { entradas: 0, saidas: 0, saldo_dia: 0, qtd_receber: 0, qtd_pagar: 0 }
      diasMap[f.data].entradas   += Number(f.entradas || 0)
      diasMap[f.data].saidas     += Number(f.saidas || 0)
      diasMap[f.data].saldo_dia  += Number(f.saldo_dia || 0)
      diasMap[f.data].qtd_receber+= Number(f.qtd_receber || 0)
      diasMap[f.data].qtd_pagar  += Number(f.qtd_pagar || 0)
    })

  const dias = Object.entries(diasMap).sort(([a], [b]) => a.localeCompare(b))

  // Saldo acumulado
  let saldoAcumulado = saldoAtual
  const diasComSaldo = dias.map(([data, d]) => {
    saldoAcumulado += d.saldo_dia
    return { data, ...d, saldo_acumulado: saldoAcumulado }
  })

  const totalEntradas = dias.reduce((s, [, d]) => s + d.entradas, 0)
  const totalSaidas   = dias.reduce((s, [, d]) => s + Math.abs(d.saidas), 0)
  const saldoProjeto  = totalEntradas - totalSaidas

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/financeiro" className="flex items-center gap-1 text-sm text-gray-500 hover:text-bendito-verde transition">
          <ArrowLeft size={16}/> Voltar
        </Link>
      </div>

      <PageHeader title="Fluxo de Caixa" subtitle="Projeção de entradas e saídas futuras"
        action={
          <button onClick={load} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
            <RefreshCw size={15}/> Atualizar
          </button>
        }
      />

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {['30','60','90'].map(h => (
            <button key={h} onClick={() => setHorizonte(h)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${horizonte === h ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-white border-gray-300 text-gray-600 hover:border-bendito-verde'}`}>
              {h} dias
            </button>
          ))}
        </div>
        {isAdmin && (
          <select value={filialFiltro} onChange={e => setFilialFiltro(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
            <option value="todas">Todas as unidades</option>
            {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Saldo atual (bancos)', valor: saldoAtual,    cor: 'text-gray-700',   bg: 'bg-white',       icon: Building2 },
          { label: `Entradas (${horizonte}d)`, valor: totalEntradas, cor: 'text-green-600', bg: 'bg-green-50',    icon: TrendingUp },
          { label: `Saídas (${horizonte}d)`,   valor: totalSaidas,   cor: 'text-red-600',   bg: 'bg-red-50',      icon: TrendingDown },
          { label: 'Saldo projetado',      valor: saldoAtual + saldoProjeto, cor: saldoAtual + saldoProjeto >= 0 ? 'text-green-700' : 'text-red-700', bg: saldoAtual + saldoProjeto >= 0 ? 'bg-green-50' : 'bg-red-50', icon: DollarSign },
        ].map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} className={`${c.bg} rounded-xl shadow-md p-5 border border-gray-100`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} className={c.cor}/>
                <p className="text-xs text-gray-500">{c.label}</p>
              </div>
              <p className={`text-xl font-bold ${c.cor}`}>{formatBRL(c.valor)}</p>
            </div>
          )
        })}
      </div>

      {/* Tabela projeção */}
      {diasComSaldo.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <DollarSign size={48} className="text-gray-300 mx-auto mb-3"/>
          <p className="text-gray-500">Nenhuma movimentação prevista nos próximos {horizonte} dias.</p>
          <p className="text-xs text-gray-400 mt-1">Lance contas a pagar e receber para visualizar o fluxo.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Data','Entradas','Saídas','Saldo do Dia','Saldo Acumulado','Qtd A Receber','Qtd A Pagar'].map(h =>
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {diasComSaldo.map(d => (
                  <tr key={d.data} className={`hover:bg-gray-50 ${d.data === hoje ? 'bg-yellow-50' : ''}`}>
                    <td className="px-4 py-3 font-medium">
                      {d.data === hoje && <span className="text-xs bg-yellow-200 text-yellow-700 px-1.5 rounded mr-1">hoje</span>}
                      {new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', {weekday:'short', day:'2-digit', month:'2-digit'})}
                    </td>
                    <td className="px-4 py-3 text-green-600 font-semibold">{d.entradas > 0 ? formatBRL(d.entradas) : '—'}</td>
                    <td className="px-4 py-3 text-red-600 font-semibold">{d.saidas < 0 ? formatBRL(Math.abs(d.saidas)) : '—'}</td>
                    <td className={`px-4 py-3 font-bold ${d.saldo_dia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {d.saldo_dia >= 0 ? '+' : ''}{formatBRL(d.saldo_dia)}
                    </td>
                    <td className={`px-4 py-3 font-bold text-base ${d.saldo_acumulado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatBRL(d.saldo_acumulado)}
                    </td>
                    <td className="px-4 py-3 text-center">{d.qtd_receber > 0 ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">{d.qtd_receber}</span> : '—'}</td>
                    <td className="px-4 py-3 text-center">{d.qtd_pagar > 0 ? <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-semibold">{d.qtd_pagar}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
