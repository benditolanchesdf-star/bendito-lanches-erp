'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL } from '@/lib/constants'
import { PageHeader, Loading } from '@/components/ui'
import Link from 'next/link'
import { Truck, Package, CheckCircle, Clock, RefreshCw, ChevronRight, MapPin, AlertTriangle } from 'lucide-react'

export default function AgendaEntregasPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [entregas, setEntregas] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [filialFiltro, setFilialFiltro] = useState('todas')
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0])

  async function load() {
    setLoading(true)
    let query = supabase.from('vw_entregas_dia').select('*')
    if (filialFiltro !== 'todas') query = query.eq('filial_id', filialFiltro)
    if (dataFiltro) query = query.gte('created_at', `${dataFiltro}T00:00:00`).lte('created_at', `${dataFiltro}T23:59:59`)

    const [ents, fils] = await Promise.all([
      query,
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setEntregas(ents.data || [])
    setFiliais(fils.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filialFiltro, dataFiltro])

  // Agrupar por entregador
  const porEntregador: Record<string, any[]> = {}
  const semEntregador: any[] = []
  for (const e of entregas) {
    if (!e.entregador_id) { semEntregador.push(e); continue }
    const key = e.entregador_id
    if (!porEntregador[key]) porEntregador[key] = []
    porEntregador[key].push(e)
  }

  const STATUS_ICON: Record<string, any> = {
    pendente: <Clock size={14} className="text-yellow-500"/>,
    saiu:     <Truck size={14} className="text-blue-500"/>,
    entregue: <CheckCircle size={14} className="text-green-500"/>,
    problema: <AlertTriangle size={14} className="text-red-500"/>,
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Agenda de Entregas" subtitle="Visão por entregador e rota do dia"
        action={
          <div className="flex gap-2">
            <Link href="/dashboard/entregas/entregadores"
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
              <Truck size={15}/> Entregadores
            </Link>
            <Link href="/dashboard/entregas"
              className="flex items-center gap-2 bg-bendito-verde hover:bg-bendito-verde-escuro text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
              <Package size={15}/> Gerenciar
            </Link>
          </div>
        }
      />

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-center">
        <input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"/>
        <select value={filialFiltro} onChange={e => setFilialFiltro(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
          <option value="todas">Todas as unidades</option>
          {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <button onClick={load} className="ml-auto text-gray-400 hover:text-bendito-verde"><RefreshCw size={15}/></button>
      </div>

      {/* KPIs do dia */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',     valor: entregas.length,                                 cor: 'text-gray-700' },
          { label: 'Em Rota',   valor: entregas.filter(e => e.status === 'saiu').length,    cor: 'text-blue-600' },
          { label: 'Entregues', valor: entregas.filter(e => e.status === 'entregue').length, cor: 'text-green-600' },
          { label: 'Pendentes', valor: entregas.filter(e => e.status === 'pendente').length, cor: 'text-yellow-600' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl shadow-md p-4 text-center">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-2xl font-bold ${c.cor} mt-1`}>{c.valor}</p>
          </div>
        ))}
      </div>

      {entregas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <Truck size={48} className="text-gray-300 mx-auto mb-3"/>
          <p className="text-gray-500">Nenhuma entrega agendada para este dia.</p>
          <Link href="/dashboard/entregas" className="text-bendito-verde text-sm hover:underline mt-2 inline-block">
            Criar entrega →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Por entregador */}
          {Object.entries(porEntregador).map(([entregadorId, items]) => {
            const primeiro = items[0]
            const concluidas = items.filter(e => e.status === 'entregue').length
            const emRota = items.some(e => e.status === 'saiu')
            return (
              <div key={entregadorId} className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className={`px-5 py-3 flex items-center justify-between ${emRota ? 'bg-blue-50 border-b border-blue-100' : 'bg-gray-50 border-b'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${emRota ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Truck size={16} className={emRota ? 'text-blue-600' : 'text-gray-500'}/>
                    </div>
                    <div>
                      <p className="font-bold text-bendito-verde-escuro">{primeiro.entregador_nome}</p>
                      <p className="text-xs text-gray-500">{primeiro.filial_nome}</p>
                    </div>
                    {emRota && <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-semibold animate-pulse">EM ROTA</span>}
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-bendito-verde">{concluidas}/{items.length} entregas</p>
                    <div className="w-20 bg-gray-200 rounded-full h-1.5 mt-1">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${(concluidas/items.length)*100}%` }}/>
                    </div>
                  </div>
                </div>
                <div className="divide-y">
                  {items.sort((a, b) => (a.ordem_rota || 99) - (b.ordem_rota || 99)).map((e, idx) => (
                    <div key={e.id} className={`flex items-center gap-3 px-5 py-3 ${e.status === 'entregue' ? 'opacity-60' : ''}`}>
                      <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                        {e.ordem_rota || idx + 1}
                      </span>
                      {STATUS_ICON[e.status] || <Clock size={14} className="text-gray-400"/>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{e.cliente_nome || `Pedido #${e.numero_pedido}`}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                          <MapPin size={10}/> {e.endereco_completo}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {e.valor_total && <p className="text-xs font-semibold text-bendito-verde">{formatBRL(e.valor_total)}</p>}
                        {e.tempo_estimado_min && e.status === 'pendente' && (
                          <p className="text-xs text-gray-400">~{e.tempo_estimado_min}min</p>
                        )}
                        {e.hora_entrega && (
                          <p className="text-xs text-green-600">{new Date(e.hora_entrega).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
                        )}
                      </div>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.endereco_completo)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-gray-400 hover:text-blue-500">
                        <ChevronRight size={16}/>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Sem entregador */}
          {semEntregador.length > 0 && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="px-5 py-3 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2">
                <AlertTriangle size={16} className="text-yellow-500"/>
                <p className="font-bold text-yellow-700">Sem entregador ({semEntregador.length})</p>
              </div>
              <div className="divide-y">
                {semEntregador.map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                    <Package size={14} className="text-gray-400 shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{e.cliente_nome || `Pedido #${e.numero_pedido}`}</p>
                      <p className="text-xs text-gray-500 truncate">{e.endereco_completo}</p>
                    </div>
                    <Link href="/dashboard/entregas"
                      className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-2 py-1 rounded font-semibold transition">
                      Atribuir
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
