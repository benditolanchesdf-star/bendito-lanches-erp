'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader, Loading, EmptyState, PrimaryButton } from '@/components/ui'
import { Brain, TrendingUp, Calendar } from 'lucide-react'

export default function IAPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [previsoes, setPrevisoes] = useState<any[]>([])
  const [insights, setInsights] = useState<any[]>([])
  const [processando, setProcessando] = useState(false)

  async function load() {
    setLoading(true)
    // Busca histórico de pedidos dos últimos 30 dias para gerar previsões
    const desde30 = new Date(); desde30.setDate(desde30.getDate() - 30)
    const { data: itens } = await supabase
      .from('pedido_itens')
      .select('produto_id, quantidade, produtos(nome), pedidos!inner(created_at, status)')
      .gte('pedidos.created_at', desde30.toISOString())
      .neq('pedidos.status', 'cancelado')

    if (!itens || itens.length === 0) {
      setPrevisoes([])
      setInsights([{ titulo: 'Sem histórico suficiente', descricao: 'Registre pedidos por alguns dias para que a IA possa gerar previsões de demanda.', tipo: 'aviso' }])
      setLoading(false)
      return
    }

    // Agrupa quantidade por produto
    const porProduto: Record<string, { nome: string; total: number }> = {}
    for (const it of itens as any[]) {
      const id = it.produto_id
      if (!porProduto[id]) porProduto[id] = { nome: it.produtos?.nome || 'Produto', total: 0 }
      porProduto[id].total += Number(it.quantidade || 0)
    }

    // Média diária ponderada -> previsão para os próximos 7 dias
    const previsoesProd = Object.values(porProduto).map((p) => {
      const mediaDiaria = p.total / 30
      const previsao7d = Math.ceil(mediaDiaria * 7)
      // confiança proporcional ao volume histórico
      const confianca = Math.min(95, 40 + Math.floor(p.total / 5))
      return { nome: p.nome, mediaDiaria: mediaDiaria.toFixed(1), previsao7d, confianca, total30d: p.total }
    }).sort((a, b) => b.previsao7d - a.previsao7d)

    setPrevisoes(previsoesProd)

    // Insights gerados a partir dos dados
    const ins: any[] = []
    const top = previsoesProd[0]
    if (top) ins.push({ titulo: `Produto líder: ${top.nome}`, descricao: `Mantém ~${top.mediaDiaria} unidades/dia. Reforce o estoque desse item antes dos picos.`, tipo: 'destaque' })

    const baixaConfianca = previsoesProd.filter((p) => p.confianca < 60).length
    if (baixaConfianca > 0) ins.push({ titulo: `${baixaConfianca} produto(s) com baixa confiança`, descricao: 'Volume histórico ainda pequeno. As previsões ficam mais precisas com mais vendas registradas.', tipo: 'aviso' })

    setInsights(ins)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function recalcular() {
    setProcessando(true)
    await load()
    setProcessando(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="IA - Previsões" subtitle="Previsão de demanda com base no histórico de vendas"
        action={<PrimaryButton onClick={recalcular} disabled={processando} className="flex items-center gap-2"><Brain size={20} /> {processando ? 'Calculando...' : 'Recalcular'}</PrimaryButton>} />

      {loading ? <Loading /> : (
        <>
          {insights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map((i, idx) => (
                <div key={idx} className={`rounded-xl shadow-md p-5 ${i.tipo === 'destaque' ? 'bg-bendito-verde text-white' : 'bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${i.tipo === 'destaque' ? 'bg-white/20' : 'bg-bendito-creme'}`}>
                      {i.tipo === 'destaque' ? <TrendingUp size={20} /> : <Calendar size={20} className="text-bendito-dourado-escuro" />}
                    </div>
                    <div>
                      <h3 className={`font-bold ${i.tipo === 'destaque' ? '' : 'text-bendito-verde-escuro'}`}>{i.titulo}</h3>
                      <p className={`text-sm mt-1 ${i.tipo === 'destaque' ? 'text-bendito-creme' : 'text-gray-600'}`}>{i.descricao}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="text-bendito-dourado-escuro" size={22} />
              <h2 className="text-lg font-bold text-bendito-verde-escuro">Previsão para os Próximos 7 Dias</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">Modelo: média móvel sobre os últimos 30 dias de vendas.</p>

            {previsoes.length === 0 ? <EmptyState message="Sem dados suficientes para previsão." /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-bendito-verde-escuro text-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm">Produto</th>
                      <th className="px-4 py-3 text-left text-sm">Vendido (30d)</th>
                      <th className="px-4 py-3 text-left text-sm">Média / dia</th>
                      <th className="px-4 py-3 text-left text-sm">Previsão 7d</th>
                      <th className="px-4 py-3 text-left text-sm">Confiança</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {previsoes.map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{p.nome}</td>
                        <td className="px-4 py-3 text-sm">{p.total30d} un</td>
                        <td className="px-4 py-3 text-sm">{p.mediaDiaria} un/dia</td>
                        <td className="px-4 py-3 text-sm font-bold text-bendito-verde">{p.previsao7d} un</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full ${p.confianca >= 80 ? 'bg-green-500' : p.confianca >= 60 ? 'bg-bendito-dourado' : 'bg-orange-400'}`} style={{ width: `${p.confianca}%` }} />
                            </div>
                            <span className="text-xs font-semibold">{p.confianca}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
