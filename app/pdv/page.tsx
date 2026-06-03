'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, FILIAL_ID } from '@/lib/constants'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, X, CheckCircle,
  User, LogOut, Package, BarChart2, ArrowLeftRight, CreditCard,
  AlertTriangle, RefreshCw, Eye, EyeOff, Lock,
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────
type Fase = 'login' | 'trocar_senha' | 'caixa' | 'pdv'
type Aba  = 'caixa' | 'pedido_interno' | 'estoque' | 'resumo'
type ItemCarrinho = { produto_id: string; nome: string; preco: number; quantidade: number }

// ─── Helpers ─────────────────────────────────────────────
function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-500 ${className}`} {...props} />
}
function Btn({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition disabled:opacity-50 ${className}`} {...props} />
}

// ─────────────────────────────────────────────────────────
export default function PDVPage() {
  const supabase = createClient()

  // Estado global
  const [fase, setFase] = useState<Fase>('login')
  const [aba, setAba] = useState<Aba>('caixa')
  const [atendente, setAtendente] = useState<any>(null)
  const [caixaAberto, setCaixaAberto] = useState<any>(null)
  const [filialId, setFilialId] = useState(FILIAL_ID)
  const [filiais, setFiliais] = useState<any[]>([])

  // Login
  const [atendentes, setAtendentes] = useState<any[]>([])
  const [atendenteSel, setAtendenteSel] = useState('')
  const [senhaInput, setSenhaInput] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [erroLogin, setErroLogin] = useState('')

  // Trocar senha (primeiro acesso)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [showNovaSenha, setShowNovaSenha] = useState(false)
  const [erroSenha, setErroSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  // Abertura caixa
  const [valorAbertura, setValorAbertura] = useState('')

  // Produtos e carrinho
  const [produtos, setProdutos] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [desconto, setDesconto] = useState('')
  const [clienteNome, setClienteNome] = useState('')

  // Pagamento
  const [modalPag, setModalPag] = useState(false)
  const [formaPag, setFormaPag] = useState<'dinheiro'|'pix'|'credito'|'debito'|'misto'>('dinheiro')
  const [valDinheiro, setValDinheiro] = useState('')
  const [valPix, setValPix] = useState('')
  const [valCartao, setValCartao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [vendaConcluida, setVendaConcluida] = useState<any>(null)

  // Fechamento
  const [modalFechamento, setModalFechamento] = useState(false)

  // Pedido interno
  const [produtosPed, setProdutosPed] = useState<any[]>([])
  const [itensPed, setItensPed] = useState<{produto_id:string;nome:string;quantidade:number;unidade:string}[]>([])
  const [prodSelPed, setProdSelPed] = useState('')
  const [qtdSelPed, setQtdSelPed] = useState(1)
  const [obsPed, setObsPed] = useState('')
  const [salvandoPed, setSalvandoPed] = useState(false)
  const [pedidoEnviado, setPedidoEnviado] = useState(false)

  // Estoque e alertas
  const [estoqueItems, setEstoqueItems] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])

  // Resumo do dia
  const [resumo, setResumo] = useState<any>(null)

  // ── Carregar dados iniciais ──
  useEffect(() => {
    supabase.from('atendentes_pdv').select('*').eq('ativo', true).order('nome')
      .then(({ data }) => setAtendentes(data || []))
    supabase.from('filiais').select('id, nome').eq('ativo', true)
      .then(({ data }) => setFiliais(data || []))
  }, [])

  // ── Login ──
  async function fazerLogin() {
    setErroLogin('')
    const at = atendentes.find(a => a.id === atendenteSel)
    if (!at) { setErroLogin('Selecione um atendente.'); return }
    if (at.senha_pdv !== senhaInput) { setErroLogin('Senha incorreta.'); return }
    setAtendente(at)
    setFilialId(at.filial_id || FILIAL_ID)

    if (at.primeiro_acesso) {
      setFase('trocar_senha')
      return
    }

    // Verificar caixa aberto
    const { data: caixa } = await supabase.from('caixas_pdv')
      .select('*').eq('filial_id', at.filial_id || FILIAL_ID)
      .eq('atendente_id', at.id).eq('status', 'aberto').maybeSingle()

    if (caixa) { setCaixaAberto(caixa); await carregarProdutos(at.filial_id); setFase('pdv') }
    else setFase('caixa')
  }

  // ── Trocar senha (primeiro acesso) ──
  async function trocarSenha() {
    setErroSenha('')
    if (novaSenha.length < 4) { setErroSenha('A senha deve ter pelo menos 4 caracteres.'); return }
    if (novaSenha !== confirmaSenha) { setErroSenha('As senhas não coincidem.'); return }
    if (novaSenha === '1234') { setErroSenha('Escolha uma senha diferente de 1234.'); return }
    setSalvandoSenha(true)
    await supabase.from('atendentes_pdv').update({
      senha_pdv: novaSenha, primeiro_acesso: false,
    }).eq('id', atendente.id)
    // Atualizar atendente local
    setAtendente({ ...atendente, senha_pdv: novaSenha, primeiro_acesso: false })
    setSalvandoSenha(false)
    setFase('caixa')
  }

  // ── Abrir caixa ──
  async function abrirCaixa() {
    const { data } = await supabase.from('caixas_pdv').insert({
      filial_id: filialId, atendente_id: atendente.id,
      valor_abertura: Number(valorAbertura) || 0, status: 'aberto',
    }).select('*').single()
    setCaixaAberto(data)
    await carregarProdutos(filialId)
    setFase('pdv')
  }

  // ── Carregar produtos ──
  async function carregarProdutos(fid: string) {
    const { data } = await supabase.from('produtos')
      .select('id, nome, preco_venda, unidade')
      .eq('ativo', true).eq('filial_id', fid).order('nome')
    setProdutos(data || [])
    setProdutosPed(data || [])
  }

  // ── Carregar estoque e alertas ──
  async function carregarEstoque() {
    const [{ data: ef }, { data: al }] = await Promise.all([
      supabase.from('estoque_filial').select('*, produtos(nome, unidade)')
        .eq('filial_id', filialId).order('produtos(nome)'),
      supabase.from('vw_alertas_estoque').select('*')
        .eq('filial_id', filialId).neq('nivel_alerta', 'normal'),
    ])
    setEstoqueItems(ef || [])
    setAlertas(al || [])
  }

  // ── Carregar resumo do dia ──
  async function carregarResumo() {
    const hoje = new Date().toISOString().split('T')[0]
    const { data: vendas } = await supabase.from('vendas_pdv')
      .select('total, forma_pagamento, valor_dinheiro, valor_pix, valor_cartao')
      .eq('filial_id', filialId).eq('caixa_id', caixaAberto?.id)
      .eq('status', 'concluida')
    const arr = vendas || []
    setResumo({
      totalVendas: arr.length,
      totalFaturado: arr.reduce((s, v) => s + Number(v.total || 0), 0),
      totalDinheiro: arr.reduce((s, v) => s + Number(v.valor_dinheiro || 0), 0),
      totalPix: arr.reduce((s, v) => s + Number(v.valor_pix || 0), 0),
      totalCartao: arr.reduce((s, v) => s + Number(v.valor_cartao || 0), 0),
    })
  }

  // Carregar dados ao trocar aba
  useEffect(() => {
    if (fase !== 'pdv') return
    if (aba === 'estoque') carregarEstoque()
    if (aba === 'resumo') carregarResumo()
  }, [aba, fase])

  // ── Carrinho ──
  const subtotal = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const descontoVal = Number(desconto) || 0
  const total = Math.max(subtotal - descontoVal, 0)
  const troco = formaPag === 'dinheiro' ? Math.max((Number(valDinheiro) || 0) - total, 0) : 0

  function addProduto(p: any) {
    setCarrinho(prev => {
      const ex = prev.find(i => i.produto_id === p.id)
      if (ex) return prev.map(i => i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...prev, { produto_id: p.id, nome: p.nome, preco: Number(p.preco_venda || 0), quantidade: 1 }]
    })
  }

  function updateQtd(id: string, delta: number) {
    setCarrinho(prev => prev.map(i => i.produto_id === id
      ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i))
  }

  // ── Finalizar venda ──
  async function finalizarVenda() {
    if (!carrinho.length) return
    setSalvando(true)
    const vPag = {
      dinheiro: formaPag === 'dinheiro' ? total : formaPag === 'misto' ? Number(valDinheiro)||0 : 0,
      pix:      formaPag === 'pix'      ? total : formaPag === 'misto' ? Number(valPix)||0      : 0,
      cartao:   ['credito','debito'].includes(formaPag) ? total : formaPag === 'misto' ? Number(valCartao)||0 : 0,
    }
    const { data: venda } = await supabase.from('vendas_pdv').insert({
      filial_id: filialId, caixa_id: caixaAberto.id, atendente_id: atendente.id,
      cliente_nome: clienteNome || null, subtotal, desconto: descontoVal, total,
      forma_pagamento: formaPag,
      valor_dinheiro: vPag.dinheiro, valor_pix: vPag.pix, valor_cartao: vPag.cartao, troco,
    }).select('*').single()

    if (venda) {
      await supabase.from('venda_pdv_itens').insert(
        carrinho.map(i => ({
          venda_id: venda.id, produto_id: i.produto_id, nome_produto: i.nome,
          quantidade: i.quantidade, preco_unitario: i.preco,
          desconto: 0, subtotal: i.preco * i.quantidade,
        }))
      )
      // Dar baixa no estoque
      for (const item of carrinho) {
        const { data: ef } = await supabase.from('estoque_filial')
          .select('quantidade').eq('filial_id', filialId).eq('produto_id', item.produto_id).maybeSingle()
        if (ef) {
          const novaQtd = Math.max(0, Number(ef.quantidade) - item.quantidade)
          await supabase.from('estoque_filial').update({ quantidade: novaQtd, updated_at: new Date().toISOString() })
            .eq('filial_id', filialId).eq('produto_id', item.produto_id)
        }
      }
      // Atualizar totais do caixa
      const cx = caixaAberto
      const novoCaixa = {
        total_vendas:   (cx.total_vendas   || 0) + total,
        total_dinheiro: (cx.total_dinheiro || 0) + vPag.dinheiro,
        total_pix:      (cx.total_pix      || 0) + vPag.pix,
        total_cartao:   (cx.total_cartao   || 0) + vPag.cartao,
      }
      await supabase.from('caixas_pdv').update(novoCaixa).eq('id', cx.id)
      setCaixaAberto({ ...cx, ...novoCaixa })
    }
    setVendaConcluida({ ...venda, troco })
    setCarrinho([]); setDesconto(''); setClienteNome('')
    setValDinheiro(''); setValPix(''); setValCartao('')
    setModalPag(false); setSalvando(false)
  }

  // ── Enviar pedido interno ──
  async function enviarPedidoInterno() {
    if (!itensPed.length) return
    setSalvandoPed(true)
    const matrizId = '11111111-1111-1111-1111-111111111111'
    const { data: ped } = await supabase.from('pedidos_internos').insert({
      filial_origem: filialId, filial_destino: matrizId,
      observacoes: obsPed || null,
    }).select('id').single()
    if (ped) {
      await supabase.from('pedido_interno_itens').insert(
        itensPed.map(i => ({
          pedido_interno_id: ped.id, produto_id: i.produto_id,
          quantidade_pedida: i.quantidade, unidade: i.unidade,
        }))
      )
    }
    setSalvandoPed(false)
    setItensPed([]); setObsPed(''); setProdSelPed(''); setQtdSelPed(1)
    setPedidoEnviado(true)
    setTimeout(() => setPedidoEnviado(false), 3000)
  }

  // ── Fechar caixa ──
  async function fecharCaixa() {
    await supabase.from('caixas_pdv').update({
      status: 'fechado', fechamento_at: new Date().toISOString(),
      valor_fechamento: caixaAberto.total_vendas,
    }).eq('id', caixaAberto.id)
    setModalFechamento(false)
    setFase('login'); setAtendente(null); setCaixaAberto(null)
    setCarrinho([]); setAtendenteSel(''); setSenhaInput('')
  }

  const prodFiltrados = produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()))
  const isGerente = atendente?.papel === 'gerente' || atendente?.papel === 'admin'

  // ════════════════════════════════════════════════
  // TELA: LOGIN
  // ════════════════════════════════════════════════
  if (fase === 'login') return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm border border-gray-700">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍕</div>
          <h1 className="text-2xl font-bold text-yellow-400">Bendito Lanches</h1>
          <p className="text-gray-400 text-sm mt-1">Terminal de Vendas</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Atendente</label>
            <select value={atendenteSel} onChange={e => setAtendenteSel(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-yellow-400">
              <option value="">Selecione...</option>
              {atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Senha PDV</label>
            <div className="relative">
              <Input type={showSenha ? 'text' : 'password'} value={senhaInput}
                onChange={e => setSenhaInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fazerLogin()}
                placeholder="••••" />
              <button onClick={() => setShowSenha(!showSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showSenha ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>
          {erroLogin && <p className="text-xs text-red-400 bg-red-900/30 p-2 rounded">{erroLogin}</p>}
          <Btn onClick={fazerLogin} className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 py-3">
            Entrar no Caixa
          </Btn>
        </div>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════
  // TELA: PRIMEIRO ACESSO — TROCAR SENHA
  // ════════════════════════════════════════════════
  if (fase === 'trocar_senha') return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm border border-yellow-500">
        <div className="text-center mb-6">
          <Lock size={40} className="text-yellow-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white">Primeiro Acesso</h2>
          <p className="text-gray-400 text-sm mt-1">Olá, <strong className="text-yellow-400">{atendente?.nome}</strong>!</p>
          <p className="text-gray-400 text-xs mt-2">Por segurança, defina sua senha pessoal antes de continuar.</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Nova senha (mínimo 4 caracteres)</label>
            <div className="relative">
              <Input type={showNovaSenha ? 'text' : 'password'} value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)} placeholder="Digite sua nova senha" />
              <button onClick={() => setShowNovaSenha(!showNovaSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showNovaSenha ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Confirmar nova senha</label>
            <Input type="password" value={confirmaSenha}
              onChange={e => setConfirmaSenha(e.target.value)} placeholder="Repita a senha" />
          </div>
          {erroSenha && <p className="text-xs text-red-400 bg-red-900/30 p-2 rounded">{erroSenha}</p>}
          <Btn onClick={trocarSenha} disabled={salvandoSenha || !novaSenha || !confirmaSenha}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 py-3">
            {salvandoSenha ? 'Salvando...' : '✅ Definir senha e continuar'}
          </Btn>
        </div>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════
  // TELA: ABERTURA DE CAIXA
  // ════════════════════════════════════════════════
  if (fase === 'caixa') return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm border border-gray-700">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">💰</div>
          <h2 className="text-xl font-bold text-white">Abrir Caixa</h2>
          <p className="text-gray-400 text-sm">Atendente: <strong className="text-yellow-400">{atendente?.nome}</strong></p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Valor inicial em caixa (troco) R$</label>
            <Input type="number" step="0.01" value={valorAbertura}
              onChange={e => setValorAbertura(e.target.value)} placeholder="0,00" />
          </div>
          <Btn onClick={abrirCaixa} className="w-full bg-green-500 hover:bg-green-400 text-white py-3">
            ✅ Abrir Caixa e Iniciar Vendas
          </Btn>
          <Btn onClick={() => { setFase('login'); setAtendente(null) }}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300">
            Voltar
          </Btn>
        </div>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════
  // TELA: PDV PRINCIPAL
  // ════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-yellow-400">🍕 PDV</span>
          <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-gray-300 flex items-center gap-1">
            <User size={11}/> {atendente?.nome}
          </span>
          {alertas.length > 0 && (
            <span className="text-xs bg-red-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
              <AlertTriangle size={10}/> {alertas.length} alerta(s)
            </span>
          )}
        </div>
        <Btn onClick={() => setModalFechamento(true)}
          className="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 flex items-center gap-1">
          <LogOut size={13}/> Fechar Caixa
        </Btn>
      </div>

      {/* ── Abas ── */}
      <div className="bg-gray-800 border-b border-gray-700 flex shrink-0">
        {([
          { key: 'caixa',           label: '🛒 Caixa',           show: true },
          { key: 'pedido_interno',  label: '📦 Pedir à Matriz',  show: true },
          { key: 'estoque',         label: '📊 Estoque',         show: true },
          { key: 'resumo',          label: '💵 Resumo do Dia',   show: true },
        ] as {key:Aba;label:string;show:boolean}[]).filter(a => a.show).map(a => (
          <button key={a.key} onClick={() => setAba(a.key)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${aba === a.key ? 'border-yellow-400 text-yellow-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ════ ABA: CAIXA ════ */}
      {aba === 'caixa' && (
        <div className="flex flex-1 overflow-hidden">

          {/* Produtos */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-700 flex items-center gap-2 bg-gray-800">
              <Search size={15} className="text-gray-400 shrink-0"/>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..."
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500" autoFocus />
              {busca && <button onClick={() => setBusca('')}><X size={14} className="text-gray-400"/></button>}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {prodFiltrados.map(p => (
                  <button key={p.id} onClick={() => addProduto(p)}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-yellow-400 rounded-xl p-3 text-left transition">
                    <p className="text-sm font-semibold text-white leading-tight">{p.nome}</p>
                    <p className="text-base font-bold text-yellow-400 mt-1">{formatBRL(p.preco_venda)}</p>
                  </button>
                ))}
                {prodFiltrados.length === 0 && (
                  <p className="col-span-full text-center text-gray-500 text-sm py-8">Nenhum produto encontrado.</p>
                )}
              </div>
            </div>
          </div>

          {/* Carrinho */}
          <div className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-3 border-b border-gray-700 flex items-center gap-2">
              <ShoppingCart size={16} className="text-yellow-400"/>
              <span className="font-bold text-sm">Carrinho</span>
              {carrinho.length > 0 && (
                <span className="ml-auto bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">{carrinho.length}</span>
              )}
            </div>

            {/* Cliente */}
            <div className="px-3 pt-2">
              <input value={clienteNome} onChange={e => setClienteNome(e.target.value)}
                placeholder="👤 Cliente (opcional)"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-xs outline-none" />
            </div>

            {/* Itens */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {carrinho.length === 0
                ? <p className="text-center text-gray-500 text-xs mt-8">Selecione produtos</p>
                : carrinho.map(i => (
                  <div key={i.produto_id} className="bg-gray-700 rounded-lg p-2">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-medium text-white flex-1 leading-tight">{i.nome}</p>
                      <button onClick={() => setCarrinho(prev => prev.filter(x => x.produto_id !== i.produto_id))}
                        className="text-red-400 hover:text-red-300 ml-1"><Trash2 size={11}/></button>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQtd(i.produto_id, -1)}
                          className="w-5 h-5 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center">
                          <Minus size={9}/>
                        </button>
                        <span className="text-xs font-bold w-5 text-center">{i.quantidade}</span>
                        <button onClick={() => updateQtd(i.produto_id, 1)}
                          className="w-5 h-5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 flex items-center justify-center">
                          <Plus size={9}/>
                        </button>
                      </div>
                      <span className="text-xs font-bold text-yellow-400">{formatBRL(i.preco * i.quantidade)}</span>
                    </div>
                  </div>
                ))
              }
            </div>

            {/* Totais */}
            <div className="p-3 border-t border-gray-700 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Desconto R$</span>
                <input type="number" step="0.01" value={desconto} onChange={e => setDesconto(e.target.value)}
                  placeholder="0,00"
                  className="flex-1 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs outline-none text-right" />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Subtotal</span><span>{formatBRL(subtotal)}</span>
              </div>
              {descontoVal > 0 && (
                <div className="flex justify-between text-xs text-red-400">
                  <span>Desconto</span><span>- {formatBRL(descontoVal)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-gray-600 pt-2">
                <span>TOTAL</span><span className="text-yellow-400">{formatBRL(total)}</span>
              </div>
              <Btn onClick={() => setModalPag(true)} disabled={!carrinho.length}
                className="w-full bg-green-500 hover:bg-green-400 text-white py-3 text-base flex items-center justify-center gap-2">
                <CreditCard size={18}/> Cobrar
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ════ ABA: PEDIDO INTERNO ════ */}
      {aba === 'pedido_interno' && (
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Package size={20} className="text-yellow-400"/> Pedir produtos à Matriz
          </h2>

          {pedidoEnviado && (
            <div className="bg-green-800 border border-green-600 rounded-xl p-4 mb-4 flex items-center gap-2 text-green-300">
              <CheckCircle size={20}/> Pedido enviado com sucesso! A Matriz receberá a solicitação.
            </div>
          )}

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-gray-300 mb-3">Adicionar produto</p>
            <div className="flex gap-2">
              <select value={prodSelPed} onChange={e => setProdSelPed(e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">Selecione um produto...</option>
                {produtosPed.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <input type="number" min={1} value={qtdSelPed} onChange={e => setQtdSelPed(Number(e.target.value))}
                className="w-16 bg-gray-700 border border-gray-600 text-white rounded-lg px-2 py-2 text-sm outline-none text-center" />
              <Btn onClick={() => {
                if (!prodSelPed) return
                const p = produtosPed.find(x => x.id === prodSelPed)
                if (!p) return
                setItensPed(prev => [...prev.filter(i => i.produto_id !== prodSelPed),
                  { produto_id: prodSelPed, nome: p.nome, quantidade: qtdSelPed, unidade: p.unidade || 'un' }])
                setProdSelPed(''); setQtdSelPed(1)
              }} className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-3">Add</Btn>
            </div>
          </div>

          {itensPed.length > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-gray-300 mb-3">Itens do pedido</p>
              <div className="space-y-2">
                {itensPed.map(i => (
                  <div key={i.produto_id} className="flex justify-between items-center bg-gray-700 rounded-lg px-3 py-2 text-sm">
                    <span className="text-white">{i.nome}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 font-bold">{i.quantidade} {i.unidade}</span>
                      <button onClick={() => setItensPed(prev => prev.filter(x => x.produto_id !== i.produto_id))}
                        className="text-red-400 hover:text-red-300"><Trash2 size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4">
            <label className="text-xs text-gray-400 mb-1 block">Observações (opcional)</label>
            <textarea value={obsPed} onChange={e => setObsPed(e.target.value)} rows={2}
              placeholder="Urgência, prazo, observações..."
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm outline-none resize-none" />
          </div>

          <Btn onClick={enviarPedidoInterno} disabled={salvandoPed || !itensPed.length}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 py-3 text-base">
            {salvandoPed ? 'Enviando...' : '📦 Enviar Pedido para a Matriz'}
          </Btn>
        </div>
      )}

      {/* ════ ABA: ESTOQUE ════ */}
      {aba === 'estoque' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart2 size={20} className="text-yellow-400"/> Estoque da Unidade
            </h2>
            <Btn onClick={carregarEstoque} className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs flex items-center gap-1">
              <RefreshCw size={12}/> Atualizar
            </Btn>
          </div>

          {alertas.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-bold text-red-400 flex items-center gap-1">
                <AlertTriangle size={13}/> ALERTAS DE ESTOQUE
              </p>
              {alertas.map((a, i) => {
                const cores: Record<string,string> = {
                  sem_estoque: 'bg-red-900/50 border-red-600 text-red-300',
                  critico:     'bg-red-900/30 border-red-700 text-red-400',
                  baixo:       'bg-orange-900/30 border-orange-700 text-orange-400',
                  atencao:     'bg-yellow-900/30 border-yellow-700 text-yellow-400',
                }
                const cor = cores[a.nivel_alerta] || cores.atencao
                return (
                  <div key={i} className={`flex justify-between items-center p-3 rounded-lg border text-sm ${cor}`}>
                    <span className="font-medium">{a.produto_nome}</span>
                    <div className="text-right text-xs">
                      <p className="font-bold">{a.estoque_atual} un (mín: {a.estoque_min})</p>
                      {a.quantidade_sugerida > 0 && <p>Pedir: {Math.ceil(a.quantidade_sugerida)} un</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>{['Produto','Qtd Atual','Mínimo','Status'].map(h =>
                  <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-400">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {estoqueItems.map(e => {
                  const baixo = Number(e.quantidade) <= Number(e.estoque_min)
                  return (
                    <tr key={e.id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-2 text-white">{(e.produtos as any)?.nome}</td>
                      <td className={`px-4 py-2 font-bold ${baixo ? 'text-red-400' : 'text-green-400'}`}>{e.quantidade}</td>
                      <td className="px-4 py-2 text-gray-400">{e.estoque_min}</td>
                      <td className="px-4 py-2">
                        {baixo
                          ? <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">⚠️ Baixo</span>
                          : <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">✓ OK</span>
                        }
                      </td>
                    </tr>
                  )
                })}
                {estoqueItems.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-gray-500 py-8 text-sm">Nenhum item no estoque.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════ ABA: RESUMO DO DIA ════ */}
      {aba === 'resumo' && (
        <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">💵 Resumo do Dia</h2>
            <Btn onClick={carregarResumo} className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs flex items-center gap-1">
              <RefreshCw size={12}/> Atualizar
            </Btn>
          </div>
          {resumo && (
            <div className="space-y-3">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <p className="text-xs text-gray-400 mb-1">Total faturado</p>
                <p className="text-4xl font-bold text-yellow-400">{formatBRL(resumo.totalFaturado)}</p>
                <p className="text-sm text-gray-400 mt-1">{resumo.totalVendas} venda(s) realizadas</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label:'💵 Dinheiro', val: resumo.totalDinheiro, cor:'text-green-400' },
                  { label:'📱 PIX',      val: resumo.totalPix,      cor:'text-blue-400' },
                  { label:'💳 Cartão',   val: resumo.totalCartao,   cor:'text-purple-400' },
                ].map(c => (
                  <div key={c.label} className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400">{c.label}</p>
                    <p className={`text-base font-bold ${c.cor} mt-1`}>{formatBRL(c.val)}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-xs text-gray-400 space-y-1">
                <p>Atendente: <span className="text-white font-medium">{atendente?.nome}</span></p>
                <p>Caixa aberto: <span className="text-white">{caixaAberto?.abertura_at ? new Date(caixaAberto.abertura_at).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : '-'}</span></p>
                <p>Valor de abertura: <span className="text-white">{formatBRL(caixaAberto?.valor_abertura || 0)}</span></p>
              </div>
              <Btn onClick={() => setModalFechamento(true)}
                className="w-full bg-red-700 hover:bg-red-600 text-white py-3">
                Fechar Caixa
              </Btn>
            </div>
          )}
        </div>
      )}

      {/* ════ MODAL PAGAMENTO ════ */}
      {modalPag && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Pagamento</h3>
              <button onClick={() => setModalPag(false)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div className="bg-gray-700 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400">Total a cobrar</p>
              <p className="text-4xl font-bold text-yellow-400">{formatBRL(total)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                {val:'dinheiro', label:'💵 Dinheiro'},
                {val:'pix',      label:'📱 PIX'},
                {val:'credito',  label:'💳 Crédito'},
                {val:'debito',   label:'💳 Débito'},
                {val:'misto',    label:'🔀 Misto'},
              ] as {val:typeof formaPag;label:string}[]).map(f => (
                <button key={f.val} onClick={() => setFormaPag(f.val)}
                  className={`py-2 px-1 rounded-lg text-xs font-semibold border transition ${formaPag === f.val ? 'bg-yellow-400 text-gray-900 border-yellow-400' : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-yellow-400'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {formaPag === 'dinheiro' && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Valor recebido R$</label>
                <Input type="number" step="0.01" value={valDinheiro} onChange={e => setValDinheiro(e.target.value)} autoFocus />
                {Number(valDinheiro) > 0 && (
                  <div className="bg-green-800/50 border border-green-700 rounded-lg p-3 text-center mt-2">
                    <p className="text-xs text-green-400">Troco</p>
                    <p className="text-2xl font-bold text-green-300">{formatBRL(troco)}</p>
                  </div>
                )}
              </div>
            )}
            {formaPag === 'misto' && (
              <div className="space-y-2">
                <div><label className="text-xs text-gray-400 mb-1 block">Dinheiro R$</label><Input type="number" step="0.01" value={valDinheiro} onChange={e => setValDinheiro(e.target.value)}/></div>
                <div><label className="text-xs text-gray-400 mb-1 block">PIX R$</label><Input type="number" step="0.01" value={valPix} onChange={e => setValPix(e.target.value)}/></div>
                <div><label className="text-xs text-gray-400 mb-1 block">Cartão R$</label><Input type="number" step="0.01" value={valCartao} onChange={e => setValCartao(e.target.value)}/></div>
              </div>
            )}
            <Btn onClick={finalizarVenda} disabled={salvando}
              className="w-full bg-green-500 hover:bg-green-400 text-white py-3 text-base">
              {salvando ? 'Finalizando...' : '✅ Finalizar Venda'}
            </Btn>
          </div>
        </div>
      )}

      {/* ════ MODAL VENDA CONCLUÍDA ════ */}
      {vendaConcluida && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-green-600 rounded-2xl w-full max-w-xs p-6 text-center space-y-3">
            <CheckCircle size={52} className="text-green-400 mx-auto"/>
            <h3 className="text-xl font-bold text-white">Venda #{vendaConcluida.numero}</h3>
            <p className="text-4xl font-bold text-yellow-400">{formatBRL(vendaConcluida.total)}</p>
            {vendaConcluida.troco > 0 && (
              <p className="text-lg font-bold text-green-400">Troco: {formatBRL(vendaConcluida.troco)}</p>
            )}
            <Btn onClick={() => setVendaConcluida(null)} className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 py-3 text-base mt-2">
              Nova Venda
            </Btn>
          </div>
        </div>
      )}

      {/* ════ MODAL FECHAR CAIXA ════ */}
      {modalFechamento && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Fechar Caixa</h3>
            <div className="bg-gray-700 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Total vendas</span><span className="font-bold text-yellow-400">{formatBRL(caixaAberto?.total_vendas||0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Dinheiro</span><span className="text-green-400">{formatBRL(caixaAberto?.total_dinheiro||0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">PIX</span><span className="text-blue-400">{formatBRL(caixaAberto?.total_pix||0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Cartão</span><span className="text-purple-400">{formatBRL(caixaAberto?.total_cartao||0)}</span></div>
            </div>
            <div className="flex gap-3">
              <Btn onClick={() => setModalFechamento(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300">Cancelar</Btn>
              <Btn onClick={fecharCaixa} className="flex-1 bg-red-600 hover:bg-red-500 text-white">Fechar Caixa</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

