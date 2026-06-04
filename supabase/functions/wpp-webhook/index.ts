/**
 * Supabase Edge Function — WhatsApp Bot Webhook
 * Recebe mensagens da Z-API e processa via IA (Claude)
 *
 * Deploy: supabase functions deploy wpp-webhook
 * Configurar na Z-API: Webhook URL = https://upzwgohtaybgycyigwlw.supabase.co/functions/v1/wpp-webhook
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY    = Deno.env.get('ANTHROPIC_API_KEY')!
const ZAPI_INSTANCE    = Deno.env.get('ZAPI_INSTANCE_ID')!
const ZAPI_TOKEN       = Deno.env.get('ZAPI_TOKEN')!
const ZAPI_CLIENT_TOKEN= Deno.env.get('ZAPI_CLIENT_TOKEN')!
const FILIAL_ID        = '11111111-1111-1111-1111-111111111111'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Enviar mensagem WhatsApp ──────────────────────────
async function enviarWpp(telefone: string, mensagem: string): Promise<void> {
  try {
    await fetch(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': ZAPI_CLIENT_TOKEN,
        },
        body: JSON.stringify({ phone: telefone, message: mensagem }),
      }
    )
    // Salvar no log
    await supabase.from('wpp_fila').insert({
      filial_id: FILIAL_ID,
      telefone,
      mensagem,
      evento: 'bot_resposta',
      status: 'enviado',
      enviado_em: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[WPP] Erro ao enviar:', e)
  }
}

// ── Buscar ou criar sessão ────────────────────────────
async function obterSessao(telefone: string) {
  const { data: sessao } = await supabase
    .from('wpp_sessoes')
    .select('*, clientes(*)')
    .eq('telefone', telefone)
    .maybeSingle()

  if (sessao) {
    // Verificar expiração (30 min sem mensagem → reset)
    const ultimaMsg = new Date(sessao.ultima_msg_em)
    const agora = new Date()
    const minutos = (agora.getTime() - ultimaMsg.getTime()) / 60000
    if (minutos > 30 && sessao.estado !== 'inicio') {
      await supabase.from('wpp_sessoes').update({
        estado: 'inicio', contexto: {},
        ultima_msg_em: agora.toISOString(),
      }).eq('id', sessao.id)
      return { ...sessao, estado: 'inicio', contexto: {} }
    }
    // Atualizar última mensagem
    await supabase.from('wpp_sessoes').update({
      ultima_msg_em: agora.toISOString(),
    }).eq('id', sessao.id)
    return sessao
  }

  // Criar nova sessão
  const { data: nova } = await supabase.from('wpp_sessoes').insert({
    telefone,
    filial_id: FILIAL_ID,
    estado: 'inicio',
    contexto: {},
  }).select('*, clientes(*)').single()

  return nova
}

// ── Buscar cardápio ───────────────────────────────────
async function obterCardapio(): Promise<string> {
  const { data: produtos } = await supabase
    .from('vw_produtos_filial')
    .select('nome, preco_varejo, categoria_nome')
    .eq('filial_id', FILIAL_ID)
    .eq('ativo_na_filial', true)
    .order('categoria_nome')
    .order('nome')

  if (!produtos || produtos.length === 0) return '😔 Cardápio não disponível no momento.'

  const porCategoria: Record<string, typeof produtos> = {}
  for (const p of produtos) {
    const cat = p.categoria_nome || 'Outros'
    if (!porCategoria[cat]) porCategoria[cat] = []
    porCategoria[cat].push(p)
  }

  let cardapio = '🍕 *CARDÁPIO BENDITO LANCHES*\n\n'
  let num = 1
  for (const [cat, itens] of Object.entries(porCategoria)) {
    cardapio += `*${cat.toUpperCase()}*\n`
    for (const p of itens) {
      const preco = Number(p.preco_varejo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      cardapio += `${num}. ${p.nome} — ${preco}\n`
      num++
    }
    cardapio += '\n'
  }
  cardapio += '_Para pedir, é só dizer o que quer! Ex: "quero 2 X-Burguer" 😊_'
  return cardapio
}

// ── IA: interpretar mensagem com Claude ───────────────
async function interpretarComIA(
  mensagem: string,
  sessao: any,
  historico: any[],
  produtos: any[]
): Promise<{
  intencao: 'pedir' | 'cardapio' | 'status' | 'cancelar' | 'suporte' | 'confirmar' | 'negar' | 'saudacao' | 'desconhecido'
  itens?: { nome: string; quantidade: number }[]
  resposta: string
  novo_estado?: string
}> {
  const cardapioTexto = produtos.map((p, i) =>
    `${i+1}. ${p.nome} (${p.categoria_nome || 'Geral'}) - R$${Number(p.preco_varejo).toFixed(2)}`
  ).join('\n')

  const historicoTexto = historico.slice(-6).map(h =>
    `${h.direcao === 'entrada' ? 'Cliente' : 'Bot'}: ${h.mensagem}`
  ).join('\n')

  const carrinhoAtual = sessao.contexto?.carrinho
    ? JSON.stringify(sessao.contexto.carrinho, null, 2)
    : 'vazio'

  const prompt = `Você é o assistente de pedidos do Bendito Lanches, uma rede de lanches em Brasília.
Seu trabalho é interpretar mensagens de clientes e responder de forma amigável em português.

CARDÁPIO DISPONÍVEL:
${cardapioTexto}

CARRINHO ATUAL DO CLIENTE:
${carrinhoAtual}

ESTADO ATUAL DA CONVERSA: ${sessao.estado}
CLIENTE CADASTRADO: ${sessao.clientes ? `Sim - ${sessao.clientes.nome_loja || sessao.clientes.nome}` : 'Não'}

HISTÓRICO RECENTE:
${historicoTexto}

MENSAGEM ATUAL DO CLIENTE: "${mensagem}"

Analise a mensagem e responda APENAS com JSON válido neste formato:
{
  "intencao": "pedir|cardapio|status|cancelar|suporte|confirmar|negar|saudacao|desconhecido",
  "itens": [{"nome": "nome exato do produto", "quantidade": 1}],
  "resposta": "sua resposta para o cliente em português, amigável, com emojis",
  "novo_estado": "inicio|cardapio|pedindo|confirmando|suporte"
}

REGRAS:
- Se cliente quer pedir algo, identifique os produtos pelo nome mais próximo do cardápio
- Se cliente confirmar pedido, intencao = "confirmar"
- Se cliente negar/cancelar antes de confirmar, intencao = "negar"
- Sempre responda em português brasileiro
- Use emojis moderadamente
- Se não entender, peça para reformular ou ofereça o menu
- Para suporte humano, informe que um atendente entrará em contato`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  const texto = data.content?.[0]?.text || '{}'

  try {
    const clean = texto.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return {
      intencao: 'desconhecido',
      resposta: '😅 Desculpe, não entendi bem. Pode reformular?\n\n1️⃣ Ver cardápio\n2️⃣ Fazer pedido\n3️⃣ Status do pedido\n4️⃣ Cancelar\n5️⃣ Atendente',
    }
  }
}

// ── Criar pedido no sistema ───────────────────────────
async function criarPedido(sessao: any, carrinho: any[]): Promise<any> {
  // Buscar produtos com preço real
  const { data: produtos } = await supabase
    .from('vw_produtos_filial')
    .select('produto_id, nome, preco_varejo')
    .eq('filial_id', FILIAL_ID)
    .eq('ativo_na_filial', true)

  const itensComPreco = carrinho.map(item => {
    const prod = produtos?.find(p =>
      p.nome.toLowerCase().includes(item.nome.toLowerCase()) ||
      item.nome.toLowerCase().includes(p.nome.toLowerCase())
    )
    return prod ? {
      produto_id: prod.produto_id,
      nome: prod.nome,
      quantidade: item.quantidade,
      preco_unitario: Number(prod.preco_varejo),
      subtotal: item.quantidade * Number(prod.preco_varejo),
    } : null
  }).filter(Boolean)

  if (itensComPreco.length === 0) return null

  const valorTotal = itensComPreco.reduce((s, i) => s + (i?.subtotal || 0), 0)

  // Criar pedido
  const { data: pedido } = await supabase.from('pedidos').insert({
    filial_id:        FILIAL_ID,
    cliente_id:       sessao.cliente_id || null,
    origem:           'whatsapp',
    status:           'confirmado',
    valor_total:      valorTotal,
    observacoes:      `Pedido via WhatsApp — ${sessao.telefone}`,
    canal:            'whatsapp',
  }).select('*, numero_pedido').single()

  if (!pedido) return null

  // Inserir itens
  await supabase.from('pedido_itens').insert(
    itensComPreco.map(i => ({
      pedido_id:      pedido.id,
      produto_id:     i!.produto_id,
      nome_produto:   i!.nome,
      quantidade:     i!.quantidade,
      preco_unitario: i!.preco_unitario,
      subtotal:       i!.subtotal,
    }))
  )

  // Atualizar sessão
  await supabase.from('wpp_sessoes').update({
    ultimo_pedido_id: pedido.id,
    estado: 'inicio',
    contexto: {},
    total_pedidos: (sessao.total_pedidos || 0) + 1,
  }).eq('id', sessao.id)

  return pedido
}

// ── Handler principal ─────────────────────────────────
async function processarMensagem(telefone: string, texto: string) {
  const sessao = await obterSessao(telefone)
  if (!sessao) return

  // Salvar mensagem recebida
  await supabase.from('wpp_historico').insert({
    sessao_id:    sessao.id,
    telefone,
    direcao:      'entrada',
    mensagem:     texto,
    estado_antes: sessao.estado,
  })

  // Buscar produtos para IA
  const { data: produtos } = await supabase
    .from('vw_produtos_filial')
    .select('produto_id, nome, preco_varejo, categoria_nome')
    .eq('filial_id', FILIAL_ID)
    .eq('ativo_na_filial', true)
    .order('nome')

  // Buscar histórico recente
  const { data: historico } = await supabase
    .from('wpp_historico')
    .select('direcao, mensagem')
    .eq('sessao_id', sessao.id)
    .order('created_at', { ascending: false })
    .limit(8)

  // Menu numérico simples (fallback rápido para números 1-5)
  const textoLimpo = texto.trim()
  let respostaFinal = ''
  let novoEstado = sessao.estado

  if (['1', '1️⃣'].includes(textoLimpo) || textoLimpo.toLowerCase() === 'cardápio') {
    respostaFinal = await obterCardapio()
    novoEstado = 'cardapio'
  } else if (['2', '2️⃣'].includes(textoLimpo) || textoLimpo.toLowerCase().includes('pedido')) {
    respostaFinal = '🛒 Ótimo! Me diga o que você quer pedir.\nEx: _"2 X-Burguer e 1 Combo Duplo"_\n\nOu envie *cardápio* para ver as opções.'
    novoEstado = 'pedindo'
  } else if (['3', '3️⃣'].includes(textoLimpo) || textoLimpo.toLowerCase().includes('status')) {
    if (sessao.ultimo_pedido_id) {
      const { data: ped } = await supabase.from('pedidos')
        .select('numero_pedido, status, valor_total')
        .eq('id', sessao.ultimo_pedido_id).single()
      if (ped) {
        respostaFinal = `📦 Seu último pedido:\n*#${ped.numero_pedido}*\nStatus: *${ped.status}*\nValor: *R$${Number(ped.valor_total).toFixed(2)}*`
      } else {
        respostaFinal = '🤷 Não encontrei pedidos recentes para você.'
      }
    } else {
      respostaFinal = '🤷 Você ainda não fez nenhum pedido por aqui.'
    }
    novoEstado = 'inicio'
  } else if (['4', '4️⃣'].includes(textoLimpo)) {
    respostaFinal = '❌ Para cancelar, confirme: deseja cancelar seu último pedido? (sim/não)'
    novoEstado = 'cancelando'
  } else if (['5', '5️⃣'].includes(textoLimpo) || textoLimpo.toLowerCase().includes('atendente')) {
    respostaFinal = '👤 Um de nossos atendentes entrará em contato em breve!\nHorário de atendimento: seg-sex, 8h-18h.'
    novoEstado = 'suporte'
    // Notificar equipe interna
    await supabase.from('wpp_fila').insert({
      filial_id: FILIAL_ID,
      telefone: '5561998215292', // número da equipe
      mensagem: `⚠️ Cliente ${telefone} solicitou atendente humano no WhatsApp Bot!`,
      evento: 'suporte_solicitado',
      status: 'pendente',
    })
  } else {
    // IA interpreta mensagem
    const ia = await interpretarComIA(texto, sessao, historico?.reverse() || [], produtos || [])

    if (ia.intencao === 'pedir' && ia.itens && ia.itens.length > 0) {
      // Adicionar ao carrinho
      const carrinhoAtual = sessao.contexto?.carrinho || []
      const novoCarrinho = [...carrinhoAtual]

      for (const item of ia.itens) {
        const existente = novoCarrinho.findIndex(c => c.nome.toLowerCase() === item.nome.toLowerCase())
        if (existente >= 0) {
          novoCarrinho[existente].quantidade += item.quantidade
        } else {
          novoCarrinho.push(item)
        }
      }

      // Calcular total estimado
      const totalEstimado = novoCarrinho.reduce((s, item) => {
        const prod = produtos?.find(p => p.nome.toLowerCase().includes(item.nome.toLowerCase()))
        return s + (prod ? Number(prod.preco_varejo) * item.quantidade : 0)
      }, 0)

      const resumoCarrinho = novoCarrinho.map(i => `• ${i.quantidade}x ${i.nome}`).join('\n')

      respostaFinal = `🛒 *Seu carrinho:*\n${resumoCarrinho}\n\n💰 *Total estimado: R$${totalEstimado.toFixed(2)}*\n\nConfirma o pedido? (sim/não)`
      novoEstado = 'confirmando'

      await supabase.from('wpp_sessoes').update({
        contexto: { ...sessao.contexto, carrinho: novoCarrinho, total: totalEstimado },
      }).eq('id', sessao.id)
    } else if (ia.intencao === 'confirmar' && sessao.estado === 'confirmando') {
      const carrinho = sessao.contexto?.carrinho || []
      if (carrinho.length > 0) {
        const pedido = await criarPedido(sessao, carrinho)
        if (pedido) {
          respostaFinal = `✅ *Pedido confirmado!*\n\n📋 Número: *#${pedido.numero_pedido}*\n💰 Total: *R$${Number(pedido.valor_total).toFixed(2)}*\n⏱️ Previsão: 45 min\n\nObrigado pela preferência! 🍕`
          novoEstado = 'inicio'
        } else {
          respostaFinal = '😔 Desculpe, houve um erro ao registrar seu pedido. Tente novamente.'
        }
      } else {
        respostaFinal = '🛒 Seu carrinho está vazio. O que deseja pedir?'
        novoEstado = 'pedindo'
      }
    } else if (ia.intencao === 'negar' && sessao.estado === 'confirmando') {
      await supabase.from('wpp_sessoes').update({
        contexto: { ...sessao.contexto, carrinho: [] },
      }).eq('id', sessao.id)
      respostaFinal = '❌ Pedido cancelado. Como posso te ajudar?\n\n1️⃣ Ver cardápio\n2️⃣ Fazer pedido\n3️⃣ Status\n4️⃣ Cancelar\n5️⃣ Atendente'
      novoEstado = 'inicio'
    } else if (ia.intencao === 'cancelar' && sessao.ultimo_pedido_id) {
      await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', sessao.ultimo_pedido_id)
      respostaFinal = '❌ Seu último pedido foi cancelado. Há algo mais que posso ajudar?'
      novoEstado = 'inicio'
    } else {
      respostaFinal = ia.resposta || '😅 Não entendi. Pode reformular?\n\n1️⃣ Cardápio\n2️⃣ Pedir\n3️⃣ Status\n4️⃣ Cancelar\n5️⃣ Atendente'
      novoEstado = ia.novo_estado || sessao.estado
    }
  }

  // Tratar cliente novo (aguardando cadastro)
  if (sessao.estado === 'aguardando_nome' && !['1','2','3','4','5'].includes(textoLimpo)) {
    await supabase.from('wpp_sessoes').update({
      contexto: { ...sessao.contexto, nome_temp: texto },
      estado: 'aguardando_endereco',
    }).eq('id', sessao.id)
    respostaFinal = '📍 Qual o seu endereço de entrega? (Rua, número, bairro)'
    novoEstado = 'aguardando_endereco'
  } else if (sessao.estado === 'aguardando_endereco' && !['1','2','3','4','5'].includes(textoLimpo)) {
    // Criar cliente
    const { data: novoCliente } = await supabase.from('clientes').insert({
      nome: sessao.contexto?.nome_temp || telefone,
      telefone,
      endereco: texto,
      filial_id: FILIAL_ID,
    }).select('id').single()

    if (novoCliente) {
      await supabase.from('wpp_sessoes').update({
        cliente_id: novoCliente.id,
        estado: 'inicio',
        contexto: {},
      }).eq('id', sessao.id)
      respostaFinal = `✅ Cadastro realizado! Bem-vindo(a), *${sessao.contexto?.nome_temp}*! 🎉\n\nComo posso ajudar?\n\n1️⃣ Ver cardápio\n2️⃣ Fazer pedido\n3️⃣ Status\n4️⃣ Cancelar\n5️⃣ Atendente`
      novoEstado = 'inicio'
    }
  } else if (!sessao.cliente_id && sessao.estado === 'inicio' && !['1','2','3','4','5'].includes(textoLimpo) && novoEstado === 'inicio') {
    // Cliente não cadastrado — perguntar nome
    const { data: clienteExistente } = await supabase
      .from('clientes').select('id').eq('telefone', telefone).maybeSingle()

    if (!clienteExistente) {
      respostaFinal = '👋 Olá! Parece que é sua primeira vez aqui.\nQual é o seu *nome* para cadastro?'
      novoEstado = 'aguardando_nome'
    } else {
      // Vincular cliente existente
      await supabase.from('wpp_sessoes').update({
        cliente_id: clienteExistente.id,
      }).eq('id', sessao.id)
    }
  }

  // Se ainda sem resposta, enviar boas-vindas
  if (!respostaFinal) {
    respostaFinal = '🍕 Olá! Bem-vindo ao *Bendito Lanches*!\n\n1️⃣ Ver cardápio\n2️⃣ Fazer pedido\n3️⃣ Status do pedido\n4️⃣ Cancelar pedido\n5️⃣ Falar com atendente'
    novoEstado = 'menu'
  }

  // Atualizar estado da sessão
  await supabase.from('wpp_sessoes').update({
    estado: novoEstado,
    ultima_msg_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', sessao.id)

  // Salvar resposta no histórico
  await supabase.from('wpp_historico').insert({
    sessao_id:     sessao.id,
    telefone,
    direcao:       'saida',
    mensagem:      respostaFinal,
    estado_antes:  sessao.estado,
    estado_depois: novoEstado,
  })

  // Enviar resposta
  await enviarWpp(telefone, respostaFinal)
}

// ── Entry point ───────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', bot: 'Bendito Lanches WhatsApp Bot' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()
    console.log('[WPP] Webhook recebido:', JSON.stringify(body).slice(0, 200))

    // Formato Z-API
    const phone   = body.phone || body.from || body.sender
    const message = body.text?.message || body.message || body.body || ''

    if (!phone || !message) {
      return new Response('OK', { status: 200 })
    }

    // Ignorar mensagens do próprio bot
    if (body.fromMe === true) {
      return new Response('OK', { status: 200 })
    }

    // Processar em background (não bloquear o webhook)
    EdgeRuntime.waitUntil(processarMensagem(phone, message))

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('[WPP] Erro:', err)
    return new Response('OK', { status: 200 }) // sempre 200 para Z-API não reenviar
  }
})
