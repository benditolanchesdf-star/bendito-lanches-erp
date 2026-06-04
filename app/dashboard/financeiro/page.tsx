'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData } from '@/lib/constants'
import { PageHeader, Loading } from '@/components/ui'
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle,
  RefreshCw, ChevronRight, Building2,
} from 'lucide-react'
import Link from 'next/link'

export default function FinanceiroPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState<any[]>([])
  const [filialFiltro, setFilialFiltro] = useState('todas')
  const [filiais, setFiliais] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [vencendoHoje, setVencendoHoje] = useState<any[]>([])
  const [vencidos, setVencidos] = useState<any[]>([])

  async function load() {
    setLoading(true)
    await supabase.rpc('atualizar_status_vencidas')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('papel').eq('id', user!.id).maybeSingle()
    const admin = ['admin','matriz'].includes(profile?.papel || '')
    setIsAdmin(admin)

    const hoje = new Date().toISOString().split('T')[0]

    const [res, fils, vh, venc] = await Promise.all([
      supabase.from('vw_resumo_financeiro').select('*'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
      // Vencendo hoje — pagar
      supabase.from('contas_pagar').select('id, descricao, valor_parcela, filial_id, filiais(nome)')
        .eq('status', 'aberta').eq('vencimento', hoje).order('valor_parcela', { ascending: false }).limit(10),
      // Vencidos — pagar
      supabase.from('contas_pagar').select('id, descricao, valor_parcela, vencimento, filial_id, filiais(nome)')
        .eq('status', 'vencida').order('vencimento').limit(10),
    ])
    setResumo(res.data || [])
    setFiliais(fils.data || [])
    setVencendoHoje(vh.data || [])
    setVencidos(venc.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtrado = filialFiltro === 'todas' ? resumo : resumo.filter(r => r.filial_id === filialFiltro)

  const totais = filtrado.reduce((acc, r) => ({
    pagar_aberto:   (acc.pagar_aberto   || 0) + Number(r.pagar_aberto),
    pagar_vencido:  (acc.pagar_vencido  || 0) + Number(r.pagar_vencido),
    pago_mes:       (acc.pago_mes       || 0) + Number(r.pago_mes),
    receber_aberto: (acc.receber_aberto || 0) + Number(r.receber_aberto),
    receber_vencido:(acc.receber_vencido|| 0) + Number(r.receber_vencido),
    recebido_mes:   (acc.recebido_mes   || 0) + Number(r.recebido_mes),
  }), {})

  const saldo = (totais.receber_aberto || 0) - (totais.pagar_aberto || 0)
    - (totais.pagar_vencido || 0) - (totais.receber_vencido || 0)

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" subtitle="Contas a pagar, receber, fluxo de caixa e conciliação"
        action={
          <button onClick={load} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
            <RefreshCw size={15}/> Atualizar
          </button>
        }
      />

      {/* Filtro de filial */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-center">
          <Building2 size={18} className="text-bendito-verde"/>
          <span className="text-sm font-semibold text-gray-700">Unidade:</span>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilialFiltro('todas')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${filialFiltro === 'todas' ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-white border-gray-300 text-gray-600 hover:border-bendito-verde'}`}>
              Consolidado
            </button>
            {filiais.map(f => (
              <button key={f.id} onClick={() => setFilialFiltro(f.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${filialFiltro === f.id ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-white border-gray-300 text-gray-600 hover:border-bendito-verde'}`}>
                {f.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'A Receber',      valor: totais.receber_aberto,  cor: 'text-green-600',  bg: 'bg-green-50',  icon: TrendingUp,   border: 'border-green-200' },
          { label: 'A Pagar',        valor: totais.pagar_aberto,    cor: 'text-red-600',    bg: 'bg-red-50',    icon: TrendingDown, border: 'border-red-200' },
          { label: 'Recebido/mês',   valor: totais.recebido_mes,    cor: 'text-blue-600',   bg: 'bg-blue-50',   icon: DollarSign,   border: 'border-blue-200' },
          { label: 'Pago/mês',       valor: totais.pago_mes,        cor: 'text-purple-600', bg: 'bg-purple-50', icon: DollarSign,   border: 'border-purple-200' },
        ].map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-5`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={18} className={c.cor}/>
                <p className="text-xs text-gray-500">{c.label}</p>
              </div>
              <p className={`text-2xl font-bold ${c.cor}`}>{formatBRL(c.valor || 0)}</p>
            </div>
          )
        })}
      </div>

      {/* Alertas de vencidos */}
      {(vencidos.length > 0 || vencendoHoje.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Vencendo hoje */}
          {vencendoHoje.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
              <p className="text-sm font-bold text-yellow-700 flex items-center gap-2 mb-3">
                <AlertTriangle size={16}/> Vencendo Hoje ({vencendoHoje.length})
              </p>
              <div className="space-y-2">
                {vencendoHoje.map(c => (
                  <div key={c.id} className="flex justify-between items-center text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-700 truncate">{c.descricao}</p>
                      <p className="text-xs text-gray-400">{(c.filiais as any)?.nome}</p>
                    </div>
                    <span className="font-bold text-red-600 ml-2">{formatBRL(c.valor_parcela)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vencidos */}
          {vencidos.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <p className="text-sm font-bold text-red-700 flex items-center gap-2 mb-3">
                <AlertTriangle size={16}/> Em Atraso ({vencidos.length})
              </p>
              <div className="space-y-2">
                {vencidos.map(c => (
                  <div key={c.id} className="flex justify-between items-center text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-700 truncate">{c.descricao}</p>
                      <p className="text-xs text-red-400">{formatData(c.vencimento)} · {(c.filiais as any)?.nome}</p>
                    </div>
                    <span className="font-bold text-red-600 ml-2">{formatBRL(c.valor_parcela)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saldo projetado */}
      <div className={`rounded-xl p-6 border-2 ${saldo >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
        <p className="text-sm text-gray-600 mb-1">Posição financeira atual</p>
        <p className={`text-4xl font-bold ${saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatBRL(saldo)}</p>
        <p className="text-xs text-gray-500 mt-1">A Receber − A Pagar (aberto + vencido)</p>
      </div>

      {/* Por filial (se consolidado) */}
      {filialFiltro === 'todas' && resumo.length > 1 && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50">
            <h2 className="font-bold text-bendito-verde-escuro">Por Unidade</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Unidade','A Receber','A Pagar','Vencido P.','Vencido R.','Recebido/mês','Pago/mês'].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y">
                {resumo.map(r => (
                  <tr key={r.filial_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-bendito-verde-escuro">{r.filial_nome}</td>
                    <td className="px-4 py-3 text-green-600 font-semibold">{formatBRL(r.receber_aberto)}</td>
                    <td className="px-4 py-3 text-red-600 font-semibold">{formatBRL(r.pagar_aberto)}</td>
                    <td className="px-4 py-3 text-red-500">{formatBRL(r.pagar_vencido)}</td>
                    <td className="px-4 py-3 text-orange-500">{formatBRL(r.receber_vencido)}</td>
                    <td className="px-4 py-3 text-blue-600">{formatBRL(r.recebido_mes)}</td>
                    <td className="px-4 py-3 text-purple-600">{formatBRL(r.pago_mes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Acesso rápido aos submódulos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: '/dashboard/financeiro/contas-pagar',    cor: 'bg-red-100',    icon: TrendingDown, iconCor: 'text-red-600',    label: 'Contas a Pagar',    sub: `${formatBRL(totais.pagar_aberto || 0)} em aberto` },
          { href: '/dashboard/financeiro/contas-receber',  cor: 'bg-green-100',  icon: TrendingUp,   iconCor: 'text-green-600',  label: 'Contas a Receber',  sub: `${formatBRL(totais.receber_aberto || 0)} em aberto` },
          { href: '/dashboard/financeiro/fluxo-caixa',     cor: 'bg-blue-100',   icon: DollarSign,   iconCor: 'text-blue-600',   label: 'Fluxo de Caixa',    sub: 'Projeção 30/60/90 dias' },
          { href: '/dashboard/financeiro/conciliacao',     cor: 'bg-purple-100', icon: Building2,    iconCor: 'text-purple-600', label: 'Conciliação',        sub: 'Extrato bancário' },
        ].map(item => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg hover:ring-2 hover:ring-bendito-dourado transition group flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`${item.cor} p-3 rounded-xl`}>
                  <Icon size={20} className={item.iconCor}/>
                </div>
                <div>
                  <p className="font-bold text-bendito-verde-escuro text-sm">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.sub}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:text-bendito-verde"/>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
