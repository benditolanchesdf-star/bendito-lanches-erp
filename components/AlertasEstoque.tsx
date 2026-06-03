'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, Package, TrendingDown, XCircle, RefreshCw } from 'lucide-react'

const NIVEL_CONFIG: Record<string, { cor: string; bg: string; icon: any; label: string }> = {
  sem_estoque: { cor: 'text-red-700',    bg: 'bg-red-100 border-red-200',    icon: XCircle,       label: 'Sem Estoque' },
  critico:     { cor: 'text-red-600',    bg: 'bg-red-50 border-red-200',     icon: AlertTriangle, label: 'Crítico' },
  baixo:       { cor: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: TrendingDown, label: 'Baixo' },
  atencao:     { cor: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', icon: Package,      label: 'Atenção' },
}

interface AlertasEstoqueProps {
  filialId?: string   // se passar filialId, filtra por filial; se não, mostra todas
  limite?: number
  compact?: boolean   // modo compacto para o PDV
}

export default function AlertasEstoque({ filialId, limite = 10, compact = false }: AlertasEstoqueProps) {
  const supabase = createClient()
  const [alertas, setAlertas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ultimaAtt, setUltimaAtt] = useState(new Date())

  async function load() {
    let query = supabase
      .from('vw_alertas_estoque')
      .select('*')
      .neq('nivel_alerta', 'normal')
      .limit(limite)

    if (filialId) query = query.eq('filial_id', filialId)

    const { data } = await query
    setAlertas(data || [])
    setUltimaAtt(new Date())
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Atualizar a cada 5 minutos
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [filialId])

  if (loading) return (
    <div className="flex items-center gap-2 text-gray-400 text-sm p-4">
      <RefreshCw size={14} className="animate-spin" /> Verificando estoque...
    </div>
  )

  if (alertas.length === 0) return (
    <div className="flex items-center gap-2 text-green-600 text-sm p-4 bg-green-50 rounded-xl">
      <Package size={16} /> Estoque em dia — nenhum alerta no momento
    </div>
  )

  if (compact) return (
    <div className="space-y-1">
      {alertas.map((a, i) => {
        const cfg = NIVEL_CONFIG[a.nivel_alerta]
        const Icon = cfg?.icon || AlertTriangle
        return (
          <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${cfg?.bg}`}>
            <div className="flex items-center gap-2 min-w-0">
              <Icon size={12} className={cfg?.cor} />
              <span className={`font-medium truncate ${cfg?.cor}`}>{a.produto_nome}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`font-bold ${cfg?.cor}`}>{a.estoque_atual} un</span>
              {a.quantidade_sugerida > 0 && (
                <span className="text-gray-500">→ pedir {Math.ceil(a.quantidade_sugerida)}</span>
              )}
            </div>
          </div>
        )
      })}
      <p className="text-xs text-gray-400 text-right pt-1">
        Att: {ultimaAtt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-md p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-orange-500" size={20} />
          <h2 className="text-base font-bold text-bendito-verde-escuro">Alertas de Estoque</h2>
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{alertas.length}</span>
        </div>
        <button onClick={load} className="text-gray-400 hover:text-bendito-verde" title="Atualizar">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="space-y-2">
        {alertas.map((a, i) => {
          const cfg = NIVEL_CONFIG[a.nivel_alerta]
          const Icon = cfg?.icon || AlertTriangle
          return (
            <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${cfg?.bg}`}>
              <div className="flex items-center gap-3 min-w-0">
                <Icon size={16} className={cfg?.cor} />
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${cfg?.cor}`}>{a.produto_nome}</p>
                  <p className="text-xs text-gray-500">
                    {a.filial_nome}
                    {a.dias_restantes != null ? ` · ${a.dias_restantes} dias restantes` : ''}
                    {a.media_diaria_7d > 0 ? ` · Média: ${a.media_diaria_7d.toFixed(1)}/dia` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className={`text-sm font-bold ${cfg?.cor}`}>{a.estoque_atual} un</p>
                <p className="text-xs text-gray-400">mín: {a.estoque_min}</p>
                {a.quantidade_sugerida > 0 && (
                  <p className="text-xs font-semibold text-indigo-600">
                    Pedir: {Math.ceil(a.quantidade_sugerida)} un
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 text-right mt-3">
        Última atualização: {ultimaAtt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}
