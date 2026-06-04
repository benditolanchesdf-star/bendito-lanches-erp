'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL } from '@/lib/constants'
import { PageHeader, Loading } from '@/components/ui'
import {
  Brain, Send, RefreshCw, Sparkles, TrendingUp, TrendingDown,
  Package, Users, DollarSign, ShoppingCart, Truck, AlertTriangle,
  ChevronRight, Bot, User, Zap, BarChart2,
} from 'lucide-react'

type Aba = 'chat' | 'analises' | 'insights'
type Msg = { role: 'user' | 'assistant'; content: string; ts: Date }

const SUGESTOES = [
  'Quais são meus produtos mais vendidos este mês?',
  'Quais clientes estão sumindo e precisam de atenção?',
  'O que devo pedir à Matriz para repor o estoque?',
  'Como está meu fluxo de caixa nos próximos 30 dias?',
  'Qual filial está performando melhor?',
  'Quais despesas posso reduzir?',
  'Como estão minhas comissões de vendedores?',
  'Qual o ticket médio dos pedidos este mês?',
]

export default function IAPage() {
  const supabase = createClient()
  const [aba, setAba] = useState<Aba>('chat')
  const [loading, setLoading] = useState(false)
  const [loadingAnalises, setLoadingAnalises] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: 'assistant',
    content: '👋 Olá! Sou o assistente de IA do Bendito Lanches. Tenho acesso aos dados do seu negócio e posso te ajudar com análises de vendas, sugestões de reposição, alertas de clientes e muito mais.\n\nComo posso te ajudar hoje?',
    ts: new Date(),
  }])
  const [input, setInput] = useState('')
  const [analises, setAnalises] = useState<any[]>([])
  const [gerando, setGerando] = useState(false)
  const [contexto, setContexto] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  useEffect(() => {
    carregarContexto()
    carregarAnalises()
  }, [])

  // Carregar dados do negócio para contexto da IA
  async function carregarContexto() {
    const hoje = new Date().toISOString().split('T')[0]
    const mesInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    const [dashboard, dre, estoque, churn, financeiro, vendas, entregas] = await Promise.all([
      supabase.from('vw_dashboard_resumo').select('*'),
      supabase.from('vw_dre').select('*').gte('mes', mesInicio).limit(10),
      supabase.from('vw_alertas_estoque').select('*').neq('nivel_alerta', 'normal').limit(10),
      supabase.from('vw_churn_atacado').select('*').limit(10),
      supabase.from('vw_resumo_financeiro').select('*'),
      supabase.from('vw_vendas_pdv_resumo').select('*').gte('data', mesInicio).limit(10),
      supabase.from('vw_entregas_dia').select('*').limit(10),
    ])

    setContexto({
      dashboard: dashboard.data || [],
      dre: dre.data || [],
      estoque: estoque.data || [],
      churn: churn.data || [],
      financeiro: financeiro.data || [],
      vendas: vendas.data || [],
      entregas: entregas.data || [],
      data_atual: new Date().toLocaleDateString('pt-BR'),
    })
  }

  async function carregarAnalises() {
    const { data } = await supabase.from('ia_analises')
      .select('*').order('gerado_em', { ascending: false }).limit(20)
    setAnalises(data || [])
  }

  // Montar prompt de sistema com dados reais do negócio
  function montarSystemPrompt() {
    if (!contexto) return ''

    const dashboard = contexto.dashboard[0] || {}
    const financeiro = contexto.financeiro[0] || {}

    return `Você é o assistente de IA do Bendito Lanches, uma rede de lanches em Brasília, DF.
Você tem acesso aos dados em tempo real do negócio e deve fornecer análises precisas, práticas e objetivas.

## DADOS ATUAIS DO NEGÓCIO (${contexto.data_atual})

### Dashboard
- Faturamento hoje: R$ ${Number(dashboard.faturamento_hoje || 0).toFixed(2)}
- Faturamento do mês: R$ ${Number(dashboard.faturamento_mes || 0).toFixed(2)}
- Faturamento mês anterior: R$ ${Number(dashboard.faturamento_mes_ant || 0).toFixed(2)}
- Variação: ${dashboard.variacao_mes_pct || 0}%
- Pedidos do mês: ${dashboard.pedidos_mes || 0}
- Vendas PDV hoje: ${dashboard.vendas_pdv_hoje || 0}
- Aprovações pendentes: ${dashboard.aprovacoes_pendentes || 0}
- Produtos estoque crítico: ${dashboard.produtos_estoque_critico || 0}
- Entregas hoje: ${dashboard.entregas_hoje || 0} (${dashboard.entregas_concluidas || 0} concluídas)
- Clientes risco churn: ${dashboard.clientes_risco_churn || 0}

### Posição Financeira
- A receber (aberto): R$ ${Number(financeiro.receber_aberto || 0).toFixed(2)}
- A receber (vencido): R$ ${Number(financeiro.receber_vencido || 0).toFixed(2)}
- A pagar (aberto): R$ ${Number(financeiro.pagar_aberto || 0).toFixed(2)}
- A pagar (vencido): R$ ${Number(financeiro.pagar_vencido || 0).toFixed(2)}
- Recebido no mês: R$ ${Number(financeiro.recebido_mes || 0).toFixed(2)}
- Pago no mês: R$ ${Number(financeiro.pago_mes || 0).toFixed(2)}

### Alertas de Estoque (${contexto.estoque.length} produtos críticos)
${contexto.estoque.map((e: any) => `- ${e.produto_nome}: ${e.estoque_atual} un (nível: ${e.nivel_alerta}, sugestão reposição: ${Math.ceil(e.quantidade_sugerida || 0)} un)`).join('\n') || '- Nenhum alerta crítico'}

### Clientes em Risco de Churn (${contexto.churn.length} clientes)
${contexto.churn.slice(0, 5).map((c: any) => `- ${c.nome_loja || c.nome}: ${c.dias_sem_comprar} dias sem comprar, último pedido R$ ${Number(c.valor_ultimo_pedido || 0).toFixed(2)}`).join('\n') || '- Nenhum cliente em risco'}

### DRE do Mês
${contexto.dre.map((d: any) => `- ${d.filial_nome}: Receita R$ ${Number(d.total_receitas || 0).toFixed(2)}, Despesas R$ ${Number(d.total_despesas || 0).toFixed(2)}, Resultado R$ ${Number(d.resultado || 0).toFixed(2)}`).join('\n') || '- Sem dados DRE'}

## INSTRUÇÕES
- Responda sempre em português brasileiro
- Seja direto e prático — foque em ações concretas
- Use números reais dos dados acima nas suas análises
- Formate a resposta com tópicos quando relevante
- Se não tiver dados suficientes para uma análise, diga claramente
- Nunca invente dados que não estão no contexto`
  }

  async function enviarMensagem(texto?: string) {
    const pergunta = texto || input.trim()
    if (!pergunta || loading) return

    setInput('')
    const novaMsgUser: Msg = { role: 'user', content: pergunta, ts: new Date() }
    setMsgs(prev => [...prev, novaMsgUser])
    setLoading(true)

    try {
      // Historico para contexto (últimas 6 msgs)
      const historico = msgs.slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: montarSystemPrompt(),
          messages: [...historico, { role: 'user', content: pergunta }],
        }),
      })

      const data = await res.json()
      const resposta = data.content?.[0]?.text || 'Não consegui processar sua pergunta. Tente novamente.'

      const novaMsgIA: Msg = { role: 'assistant', content: resposta, ts: new Date() }
      setMsgs(prev => [...prev, novaMsgIA])

      // Salvar no histórico
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('ia_conversas').insert({
          usuario_id: user.id,
          mensagem: pergunta,
          resposta,
          tokens_usados: data.usage?.output_tokens || 0,
        })
      }
    } catch (err) {
      setMsgs(prev => [...prev, {
        role: 'assistant',
        content: '❌ Erro ao conectar com a IA. Verifique sua conexão e tente novamente.',
        ts: new Date(),
      }])
    }
    setLoading(false)
  }

  // Gerar análises automáticas
  async function gerarAnalises() {
    setGerando(true)
    const tipos = [
      {
        tipo: 'vendas',
        titulo: 'Análise de Vendas',
        pergunta: 'Faça uma análise completa das vendas do mês atual. Identifique tendências, produtos/canais de destaque e pontos de atenção. Seja específico com os números.',
      },
      {
        tipo: 'reposicao',
        titulo: 'Sugestão de Reposição de Estoque',
        pergunta: 'Com base no estoque crítico atual, gere uma lista priorizada de produtos para pedir à Matriz, com quantidades sugeridas e justificativa. Formato de lista.',
      },
      {
        tipo: 'churn',
        titulo: 'Alerta de Clientes em Risco',
        pergunta: 'Analise os clientes em risco de churn. Para cada um, sugira uma ação específica de reengajamento (promoção, ligação, WhatsApp). Seja prático.',
      },
      {
        tipo: 'financeiro',
        titulo: 'Análise Financeira',
        pergunta: 'Analise a posição financeira atual. Destaque o saldo entre receber e pagar, itens vencidos e recomende ações prioritárias para os próximos 7 dias.',
      },
    ]

    for (const item of tipos) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: montarSystemPrompt(),
            messages: [{ role: 'user', content: item.pergunta }],
          }),
        })
        const data = await res.json()
        const conteudo = data.content?.[0]?.text || ''

        if (conteudo) {
          await supabase.from('ia_analises').insert({
            tipo: item.tipo,
            titulo: item.titulo,
            conteudo,
            valido_ate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })
        }
      } catch (err) {
        console.error('Erro ao gerar análise:', item.tipo, err)
      }
    }

    setGerando(false)
    carregarAnalises()
    setAba('analises')
  }

  const TIPO_CONFIG: Record<string, { icon: any; cor: string; bg: string }> = {
    vendas:     { icon: TrendingUp,   cor: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
    reposicao:  { icon: Package,      cor: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
    churn:      { icon: Users,        cor: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
    financeiro: { icon: DollarSign,   cor: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
    geral:      { icon: BarChart2,    cor: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200' },
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inteligência Artificial" subtitle="Análises automáticas e assistente inteligente do negócio"
        action={
          <button onClick={gerarAnalises} disabled={gerando || !contexto}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
            <Sparkles size={15}/> {gerando ? 'Analisando...' : 'Gerar Análises'}
          </button>
        }
      />

      {/* KPIs rápidos do contexto */}
      {contexto && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Fat. do mês',      valor: formatBRL(contexto.dashboard[0]?.faturamento_mes || 0),  icon: DollarSign,  cor: 'text-green-600',  bg: 'bg-green-50' },
            { label: 'Estoque crítico',   valor: `${contexto.estoque.length} produtos`,                   icon: Package,     cor: 'text-red-600',    bg: 'bg-red-50' },
            { label: 'Risco churn',       valor: `${contexto.churn.length} clientes`,                     icon: Users,       cor: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Aprovações pend.',  valor: `${contexto.dashboard[0]?.aprovacoes_pendentes || 0}`,   icon: AlertTriangle, cor: 'text-yellow-600', bg: 'bg-yellow-50' },
          ].map(c => {
            const Icon = c.icon
            return (
              <div key={c.label} className={`${c.bg} rounded-xl p-4 border border-opacity-50`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={15} className={c.cor}/>
                  <p className="text-xs text-gray-500">{c.label}</p>
                </div>
                <p className={`text-lg font-bold ${c.cor}`}>{c.valor}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Abas */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="flex border-b">
          {([
            { key: 'chat',     label: '💬 Assistente IA' },
            { key: 'analises', label: `📊 Análises (${analises.length})` },
            { key: 'insights', label: '⚡ Insights Rápidos' },
          ] as {key:Aba; label:string}[]).map(a => (
            <button key={a.key} onClick={() => setAba(a.key)}
              className={`px-5 py-4 text-sm font-semibold border-b-2 transition ${aba === a.key ? 'border-purple-500 text-purple-700 bg-purple-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ABA CHAT ── */}
      {aba === 'chat' && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col" style={{ height: '600px' }}>
          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <Brain size={16} className="text-white"/>
                  </div>
                )}
                <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-tr-sm'
                    : 'bg-gray-50 border border-gray-200 text-gray-700 rounded-tl-sm'
                }`}>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  <p className={`text-xs mt-1.5 ${m.role === 'user' ? 'text-white/60' : 'text-gray-400'}`}>
                    {m.ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {m.role === 'user' && (
                  <div className="w-8 h-8 bg-bendito-verde rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <User size={16} className="text-white"/>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shrink-0">
                  <Brain size={16} className="text-white"/>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-5">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {/* Sugestões */}
          {msgs.length <= 1 && (
            <div className="px-5 pb-3 flex flex-wrap gap-2">
              {SUGESTOES.slice(0, 4).map((s, i) => (
                <button key={i} onClick={() => enviarMensagem(s)}
                  className="text-xs bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 px-3 py-1.5 rounded-full transition">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex gap-3 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem() } }}
                placeholder="Pergunte sobre vendas, estoque, clientes, financeiro... (Enter para enviar)"
                rows={2}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-400 resize-none bg-white"
              />
              <button onClick={() => enviarMensagem()} disabled={!input.trim() || loading}
                className="bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white p-3 rounded-xl transition disabled:opacity-50 shrink-0">
                <Send size={18}/>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 text-center">IA com acesso aos dados reais do seu negócio · Shift+Enter para nova linha</p>
          </div>
        </div>
      )}

      {/* ── ABA ANÁLISES ── */}
      {aba === 'analises' && (
        <div className="space-y-4">
          {analises.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-10 text-center">
              <Sparkles size={48} className="text-purple-300 mx-auto mb-4"/>
              <p className="text-lg font-bold text-gray-700">Nenhuma análise gerada ainda</p>
              <p className="text-sm text-gray-500 mt-1 mb-6">Clique em "Gerar Análises" para obter insights completos do seu negócio</p>
              <button onClick={gerarAnalises} disabled={gerando}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl text-sm font-semibold transition mx-auto disabled:opacity-50">
                <Sparkles size={16}/> {gerando ? 'Analisando negócio...' : 'Gerar Análises Agora'}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{analises.length} análise(s) gerada(s)</p>
                <button onClick={gerarAnalises} disabled={gerando}
                  className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 px-4 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50">
                  <RefreshCw size={13}/> {gerando ? 'Atualizando...' : 'Atualizar análises'}
                </button>
              </div>
              {analises.map(a => {
                const cfg = TIPO_CONFIG[a.tipo] || TIPO_CONFIG.geral
                const Icon = cfg.icon
                const expirou = a.valido_ate && new Date(a.valido_ate) < new Date()
                return (
                  <div key={a.id} className={`bg-white rounded-xl shadow-md overflow-hidden border-l-4 ${a.tipo === 'vendas' ? 'border-green-400' : a.tipo === 'reposicao' ? 'border-blue-400' : a.tipo === 'churn' ? 'border-orange-400' : a.tipo === 'financeiro' ? 'border-purple-400' : 'border-gray-300'}`}>
                    <div className={`px-5 py-4 flex items-center justify-between border-b ${cfg.bg} border-opacity-50`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-white`}>
                          <Icon size={18} className={cfg.cor}/>
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{a.titulo}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(a.gerado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            {expirou && <span className="ml-2 text-orange-500">· Desatualizada</span>}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => {
                        setAba('chat')
                        setInput(`Com base na análise de ${a.titulo.toLowerCase()}, o que você recomenda como próximo passo?`)
                      }}
                        className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                        Continuar no chat <ChevronRight size={12}/>
                      </button>
                    </div>
                    <div className="p-5">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{a.conteudo}</p>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* ── ABA INSIGHTS RÁPIDOS ── */}
      {aba === 'insights' && (
        <div className="space-y-4">
          {!contexto ? <Loading /> : (
            <>
              {/* Estoque crítico */}
              {contexto.estoque.length > 0 && (
                <div className="bg-white rounded-xl shadow-md overflow-hidden border-l-4 border-red-400">
                  <div className="px-5 py-4 border-b bg-red-50 flex items-center gap-3">
                    <Package size={18} className="text-red-600"/>
                    <div>
                      <p className="font-bold text-red-700">⚠️ Estoque Crítico — {contexto.estoque.length} produto(s)</p>
                      <p className="text-xs text-red-500">Reposição necessária</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {contexto.estoque.map((e: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                        <div>
                          <p className="font-medium text-gray-700">{e.produto_nome}</p>
                          <p className="text-xs text-gray-400">{e.filial_nome}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${e.nivel_alerta === 'sem_estoque' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                            {e.estoque_atual} un
                          </span>
                          {e.quantidade_sugerida > 0 && (
                            <p className="text-xs text-blue-600 mt-0.5">Pedir: {Math.ceil(e.quantidade_sugerida)} un</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 pb-4">
                    <button onClick={() => { setAba('chat'); setInput('Gere um pedido interno para a Matriz com todos os produtos em estoque crítico, com as quantidades sugeridas.') }}
                      className="flex items-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-xs font-semibold transition">
                      <Zap size={13}/> Gerar pedido à Matriz com IA
                    </button>
                  </div>
                </div>
              )}

              {/* Clientes em risco */}
              {contexto.churn.length > 0 && (
                <div className="bg-white rounded-xl shadow-md overflow-hidden border-l-4 border-orange-400">
                  <div className="px-5 py-4 border-b bg-orange-50 flex items-center gap-3">
                    <Users size={18} className="text-orange-600"/>
                    <div>
                      <p className="font-bold text-orange-700">👥 Clientes em Risco — {contexto.churn.length} cliente(s)</p>
                      <p className="text-xs text-orange-500">Sem comprar há mais de 15 dias</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {contexto.churn.slice(0, 6).map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                        <div>
                          <p className="font-medium text-gray-700">{c.nome_loja || c.nome}</p>
                          <p className="text-xs text-gray-400">{c.dias_sem_comprar} dias sem comprar</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Último: {formatBRL(c.valor_ultimo_pedido || 0)}</p>
                          <p className="text-xs text-gray-400">{c.total_pedidos} pedido(s) histórico</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 pb-4">
                    <button onClick={() => { setAba('chat'); setInput('Para cada cliente em risco de churn, sugira uma mensagem personalizada de reengajamento para enviar pelo WhatsApp, com oferta ou promoção específica.') }}
                      className="flex items-center gap-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 px-4 py-2 rounded-lg text-xs font-semibold transition">
                      <Zap size={13}/> Gerar mensagens de reengajamento
                    </button>
                  </div>
                </div>
              )}

              {/* Posição financeira */}
              {contexto.financeiro.length > 0 && (() => {
                const f = contexto.financeiro[0]
                const vencidos = Number(f.pagar_vencido || 0) + Number(f.receber_vencido || 0)
                if (vencidos === 0) return null
                return (
                  <div className="bg-white rounded-xl shadow-md overflow-hidden border-l-4 border-purple-400">
                    <div className="px-5 py-4 border-b bg-purple-50 flex items-center gap-3">
                      <DollarSign size={18} className="text-purple-600"/>
                      <div>
                        <p className="font-bold text-purple-700">💰 Atenção Financeira</p>
                        <p className="text-xs text-purple-500">{formatBRL(vencidos)} em contas vencidas</p>
                      </div>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-3">
                      {[
                        { label: 'A Pagar vencido',   valor: f.pagar_vencido,   cor: 'text-red-600',    bg: 'bg-red-50' },
                        { label: 'A Receber vencido', valor: f.receber_vencido, cor: 'text-orange-600', bg: 'bg-orange-50' },
                        { label: 'A Pagar aberto',    valor: f.pagar_aberto,    cor: 'text-gray-600',   bg: 'bg-gray-50' },
                        { label: 'A Receber aberto',  valor: f.receber_aberto,  cor: 'text-green-600',  bg: 'bg-green-50' },
                      ].map(c => (
                        <div key={c.label} className={`${c.bg} rounded-lg p-3 text-center`}>
                          <p className="text-xs text-gray-500">{c.label}</p>
                          <p className={`text-base font-bold ${c.cor} mt-0.5`}>{formatBRL(c.valor || 0)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 pb-4">
                      <button onClick={() => { setAba('chat'); setInput('Analise minhas contas vencidas e sugira um plano de ação para os próximos 7 dias, priorizando o que pagar e o que cobrar.') }}
                        className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 px-4 py-2 rounded-lg text-xs font-semibold transition">
                        <Zap size={13}/> Plano de ação financeira
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* Tudo ok */}
              {contexto.estoque.length === 0 && contexto.churn.length === 0 && (
                <div className="bg-white rounded-xl shadow-md p-8 text-center">
                  <div className="text-5xl mb-4">🎉</div>
                  <p className="text-lg font-bold text-gray-700">Nenhum alerta crítico!</p>
                  <p className="text-sm text-gray-500 mt-1">Estoque e clientes estão sob controle. Ótimo trabalho!</p>
                </div>
              )}

              {/* Sugestões de perguntas */}
              <div className="bg-white rounded-xl shadow-md p-5">
                <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Bot size={18} className="text-purple-600"/> Perguntas sugeridas
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {SUGESTOES.map((s, i) => (
                    <button key={i} onClick={() => { setAba('chat'); setInput(s) }}
                      className="flex items-center gap-2 text-left bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-700 px-4 py-2.5 rounded-lg text-xs font-medium transition group">
                      <ChevronRight size={13} className="shrink-0 group-hover:translate-x-0.5 transition"/>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
