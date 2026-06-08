'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL } from '@/lib/constants'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, X, CheckCircle,
  User, LogOut, Package, BarChart2, RefreshCw, Eye, EyeOff,
  Lock, Building2, AlertTriangle, Banknote, Smartphone,
  CreditCard, Printer, ArrowDownCircle, ArrowUpCircle, History,
  PackagePlus,
} from 'lucide-react'

const MATRIZ_ID = '11111111-1111-1111-1111-111111111111'

type Fase = 'filial' | 'login' | 'trocar_senha' | 'caixa' | 'pdv'
type Aba  = 'caixa' | 'pedido_interno' | 'estoque' | 'resumo'
type ItemCarrinho = {
  produto_id: string | null    // null quando é venda diversa
  nome: string
  preco: number
  quantidade: number
  descricao_livre?: string     // preenchido quando produto_id é null
}
type ItemPedido   = { produto_id: string | null; nome: string; quantidade: number; unidade: string; outros: boolean }

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-500 ${className}`} {...props} />
}
function Btn({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition disabled:opacity-50 ${className}`} {...props} />
}

// Máscara de CPF: 12345678901 → 123.456.789-01
function mascararCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

export default function PDVPage() {
  const supabase = createClient()

  const [fase, setFase] = useState<Fase>('filial')
  const [aba, setAba] = useState<Aba>('caixa')
  const [filiais, setFiliais] = useState<any[]>([])
  const [filialSel, setFilialSel] = useState<any>(null)
  const [atendentes, setAtendentes] = useState<any[]>([])
  const [atendente, setAtendente] = useState<any>(null)
  const [caixaAberto, setCaixaAberto] = useState<any>(null)

  // Login
  const [atendenteSel, setAtendenteSel] = useState('')
  const [senhaInput, setSenhaInput] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [erroLogin, setErroLogin] = useState('')

  // Trocar senha
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [showNovaSenha, setShowNovaSenha] = useState(false)
  const [erroSenha, setErroSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  const [valorAbertura, setValorAbertura] = useState('')

  // Produtos
  const [produtos, setProdutos] = useState<any[]>([])
  const [produtosPed, setProdutosPed] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [clienteNome, setClienteNome] = useState('')
  const [cpfCliente, setCpfCliente] = useState('')   // APONTAMENTO 7
  const [desconto, setDesconto] = useState('')

  // Modal Venda Diversa — APONTAMENTO 6
  const [modalVendaDiversa, setModalVendaDiversa] = useState(false)
  const [diversaDesc, setDiversaDesc] = useState('')
  const [diversaValor, setDiversaValor] = useState('')
  const [diversaQtd, setDiversaQtd] = useState(1)

  // Pagamento
  const [salvando, setSalvando] = useState(false)
  const [vendaConcluida, setVendaConcluida] = useState<any>(null)
  const [modalFechamento, setModalFechamento] = useState(false)
  const [modalPagMisto, setModalPagMisto] = useState(false)
  const [valDinheiro, setValDinheiro] = useState('')
  const [valPix, setValPix] = useState('')
  const [valCartao, setValCartao] = useState('')

  // Cancelamento de venda
  const [modalCancelamento, setModalCancelamento] = useState(false)
  const [vendaCancelar, setVendaCancelar] = useState<any>(null)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [cancelando, setCancelando] = useState(false)

  // Reimpressão
  const [modalHistorico, setModalHistorico] = useState(false)
  const [vendasHoje, setVendasHoje] = useState<any[]>([])
  const [loadingVendas, setLoadingVendas] = useState(false)

  // Sangria / Suprimento
  const [modalMovimentacao, setModalMovimentacao] = useState(false)
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'sangria'|'suprimento'>('sangria')
  const [valorMovimentacao, setValorMovimentacao] = useState('')
  const [motivoMovimentacao, setMotivoMovimentacao] = useState('')
  const [salvandoMov, setSalvandoMov] = useState(false)

  // Pedido interno
  const [itensPed, setItensPed] = useState<ItemPedido[]>([])
  const [obsPed, setObsPed] = useState('')
  const [salvandoPed, setSalvandoPed] = useState(false)
  const [pedidoEnviado, setPedidoEnviado] = useState(false)
  const [outroNome, setOutroNome] = useState('')
  const [outroQtd, setOutroQtd] = useState(1)
  const [outroUnidade, setOutroUnidade] = useState('un')

  // Estoque
  const [estoqueItems, setEstoqueItems] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const [resumo, setResumo] = useState<any>(null)

  useEffect(() => {
    supabase.from('filiais').select('id, nome').eq('ativo', true).order('nome')
      .then(({ data }) => setFiliais(data || []))
  }, [])

  async function selecionarFilial(f: any) {
    setFilialSel(f)
    const { data } = await supabase.from('atendentes_pdv')
      .select('*, atendente_filiais!inner(filial_id)')
      .eq('atendente_filiais.filial_id', f.id).eq('ativo', true).order('nome')
    setAtendentes(data || [])
    setFase('login')
  }

  async function fazerLogin() {
    setErroLogin('')
    const at = atendentes.find(a => a.id === atendenteSel)
    if (!at) { setErroLogin('Selecione um atendente.'); return }
    if (at.senha_pdv !== senhaInput) { setErroLogin('Senha incorreta.'); return }
    setAtendente(at)
    if (at.primeiro_acesso) { setFase('trocar_senha'); return }
    const { data: caixa } = await supabase.from('caixas_pdv')
      .select('*').eq('filial_id', filialSel.id).eq('atendente_id', at.id).eq('status', 'aberto').maybeSingle()
    if (caixa) { setCaixaAberto(caixa); await carregarProdutos(filialSel); setFase('pdv') }
    else setFase('caixa')
  }

  async function trocarSenha() {
    setErroSenha('')
    if (novaSenha.length < 4) { setErroSenha('Mínimo 4 caracteres.'); return }
    if (novaSenha !== confirmaSenha) { setErroSenha('As senhas não coincidem.'); return }
    if (novaSenha === '1234') { setErroSenha('Escolha uma senha diferente de 1234.'); return }
    setSalvandoSenha(true)
    await supabase.from('atendentes_pdv').update({ senha_pdv: novaSenha, primeiro_acesso: false }).eq('id', atendente.id)
    setAtendente({ ...atendente, senha_pdv: novaSenha, primeiro_acesso: false })
    setSalvandoSenha(false); setFase('caixa')
  }

  async function abrirCaixa() {
    const { data } = await supabase.from('caixas_pdv').insert({
      filial_id: filialSel.id, atendente_id: atendente.id,
      valor_abertura: Number(valorAbertura) || 0, status: 'aberto',
    }).select('*').single()
    setCaixaAberto(data)
    await carregarProdutos(filialSel)
    setFase('pdv')
  }

  async function carregarProdutos(f: any) {
    const [{ data: prodCaixa }, { data: prodMatriz }] = await Promise.all([
      supabase.from('vw_produtos_filial')
        .select('produto_id, nome, preco_varejo, unidade_medida')
        .eq('filial_id', f.id).eq('ativo_na_filial', true).order('nome'),
      supabase.from('vw_produtos_filial')
        .select('produto_id, nome, unidade_medida')
        .eq('filial_id', MATRIZ_ID).eq('ativo_na_filial', true).order('nome'),
    ])
    setProdutos((prodCaixa || []).map((p: any) => ({ ...p, id: p.produto_id })))
    setProdutosPed((prodMatriz || []).map((p: any) => ({ ...p, id: p.produto_id })))
  }

  async function carregarEstoque() {
    const [{ data: ef }, { data: al }] = await Promise.all([
      supabase.from('produto_filial').select('*, produtos(nome, unidade_medida)').eq('filial_id', filialSel.id),
      supabase.from('vw_alertas_estoque').select('*').eq('filial_id', filialSel.id).neq('nivel_alerta', 'normal'),
    ])
    setEstoqueItems(ef || []); setAlertas(al || [])
  }

  async function carregarResumo() {
    const { data: vendas } = await supabase.from('vendas_pdv')
      .select('total, valor_dinheiro, valor_pix, valor_cartao')
      .eq('filial_id', filialSel.id).eq('caixa_id', caixaAberto?.id).eq('status', 'concluida')
    const { data: movs } = await supabase.from('caixa_movimentacoes')
      .select('tipo, valor').eq('caixa_id', caixaAberto?.id)
    const arr = vendas || []
    const sangria   = (movs || []).filter(m => m.tipo === 'sangria').reduce((s, m) => s + Number(m.valor), 0)
    const suprimento= (movs || []).filter(m => m.tipo === 'suprimento').reduce((s, m) => s + Number(m.valor), 0)
    setResumo({
      totalVendas: arr.length,
      totalFaturado: arr.reduce((s, v) => s + Number(v.total || 0), 0),
      totalDinheiro: arr.reduce((s, v) => s + Number(v.valor_dinheiro || 0), 0),
      totalPix: arr.reduce((s, v) => s + Number(v.valor_pix || 0), 0),
      totalCartao: arr.reduce((s, v) => s + Number(v.valor_cartao || 0), 0),
      sangria, suprimento,
    })
  }

  async function carregarVendasHoje() {
    setLoadingVendas(true)
    const { data } = await supabase.from('vendas_pdv')
      .select('*, venda_pdv_itens(nome_produto, quantidade, preco_unitario)')
      .eq('caixa_id', caixaAberto?.id)
      .order('created_at', { ascending: false })
    setVendasHoje(data || [])
    setLoadingVendas(false)
  }

  useEffect(() => {
    if (fase !== 'pdv') return
    if (aba === 'estoque') carregarEstoque()
    if (aba === 'resumo') carregarResumo()
  }, [aba, fase])

  // Carrinho
  const subtotal = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const descontoVal = Number(desconto) || 0
  const total = Math.max(subtotal - descontoVal, 0)

  function addProduto(p: any) {
    setCarrinho(prev => {
      const ex = prev.find(i => i.produto_id === p.id)
      if (ex) return prev.map(i => i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...prev, { produto_id: p.id, nome: p.nome, preco: Number(p.preco_varejo || 0), quantidade: 1 }]
    })
  }

  // APONTAMENTO 6 — adicionar item avulso (sem produto cadastrado)
  function adicionarVendaDiversa() {
    const valor = Number(diversaValor)
    const qtd = Number(diversaQtd) || 1
    if (!diversaDesc.trim()) { alert('Descreva o produto/serviço.'); return }
    if (!valor || valor <= 0) { alert('Informe um valor maior que zero.'); return }
    setCarrinho(prev => [
      ...prev,
      {
        produto_id: null,
        nome: diversaDesc.trim(),
        descricao_livre: diversaDesc.trim(),
        preco: valor,
        quantidade: qtd,
      },
    ])
    setDiversaDesc(''); setDiversaValor(''); setDiversaQtd(1)
    setModalVendaDiversa(false)
  }

  function updateQtd(idx: number, delta: number) {
    setCarrinho(prev => prev.map((i, k) => k === idx ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i))
  }
  function removerItem(idx: number) {
    setCarrinho(prev => prev.filter((_, k) => k !== idx))
  }

  async function finalizarVenda(forma: 'dinheiro'|'pix'|'credito'|'debito'|'misto', vDin?: number) {
    if (!carrinho.length) return

    // Validar CPF se informado
    const cpfLimpo = cpfCliente.replace(/\D/g, '')
    if (cpfLimpo && cpfLimpo.length !== 11) {
      alert('CPF deve ter 11 dígitos ou ficar em branco.')
      return
    }

    setSalvando(true)
    const vPag = {
      dinheiro: forma === 'dinheiro' ? (vDin ?? total) : forma === 'misto' ? Number(valDinheiro)||0 : 0,
      pix:      forma === 'pix'      ? total            : forma === 'misto' ? Number(valPix)||0      : 0,
      cartao:   ['credito','debito'].includes(forma)    ? total : forma === 'misto' ? Number(valCartao)||0 : 0,
    }
    const trocoFinal = forma === 'dinheiro' ? Math.max((vDin ?? total) - total, 0) : 0
    const { data: venda } = await supabase.from('vendas_pdv').insert({
      filial_id: filialSel.id, caixa_id: caixaAberto.id, atendente_id: atendente.id,
      cliente_nome: clienteNome || null,
      cpf_cliente: cpfLimpo || null,                  // APONTAMENTO 7
      subtotal, desconto: descontoVal, total,
      forma_pagamento: forma, valor_dinheiro: vPag.dinheiro, valor_pix: vPag.pix,
      valor_cartao: vPag.cartao, troco: trocoFinal, status: 'concluida',
    }).select('*').single()
    if (venda) {
      await supabase.from('venda_pdv_itens').insert(
        carrinho.map(i => ({
          venda_id: venda.id,
          produto_id: i.produto_id,                   // pode ser null (venda diversa)
          nome_produto: i.nome,
          descricao_livre: i.produto_id ? null : (i.descricao_livre || i.nome),  // APONTAMENTO 6
          quantidade: i.quantidade,
          preco_unitario: i.preco,
          desconto: 0,
          subtotal: i.preco * i.quantidade,
        }))
      )
      // Só baixa estoque dos itens que têm produto cadastrado
      for (const item of carrinho) {
        if (!item.produto_id) continue
        const { data: pf } = await supabase.from('produto_filial')
          .select('estoque_atual').eq('filial_id', filialSel.id).eq('produto_id', item.produto_id).maybeSingle()
        if (pf) {
          await supabase.from('produto_filial').update({
            estoque_atual: Math.max(0, Number(pf.estoque_atual) - item.quantidade),
            updated_at: new Date().toISOString(),
          }).eq('filial_id', filialSel.id).eq('produto_id', item.produto_id)
        }
      }
      const cx = caixaAberto
      const novo = {
        total_vendas:   (cx.total_vendas   || 0) + total,
        total_dinheiro: (cx.total_dinheiro || 0) + vPag.dinheiro,
        total_pix:      (cx.total_pix      || 0) + vPag.pix,
        total_cartao:   (cx.total_cartao   || 0) + vPag.cartao,
      }
      await supabase.from('caixas_pdv').update(novo).eq('id', cx.id)
      setCaixaAberto({ ...cx, ...novo })
    }
    setVendaConcluida({ ...venda, troco: trocoFinal })
    setCarrinho([]); setDesconto(''); setClienteNome(''); setCpfCliente('')
    setValDinheiro(''); setValPix(''); setValCartao('')
    setModalPagMisto(false); setSalvando(false)
  }

  // ── Cancelamento de venda ──
  async function cancelarVenda() {
    if (!vendaCancelar || !motivoCancelamento.trim()) return
    setCancelando(true)
    await supabase.from('vendas_pdv').update({
      status: 'cancelada',
      motivo_cancelamento: motivoCancelamento,
      cancelado_em: new Date().toISOString(),
    }).eq('id', vendaCancelar.id)
    // Estornar estoque (só dos itens com produto cadastrado)
    if (vendaCancelar.venda_pdv_itens) {
      for (const item of vendaCancelar.venda_pdv_itens) {
        if (!item.produto_id) continue
        const { data: pf } = await supabase.from('produto_filial')
          .select('estoque_atual').eq('filial_id', filialSel.id).eq('produto_id', item.produto_id).maybeSingle()
        if (pf) {
          await supabase.from('produto_filial').update({
            estoque_atual: Number(pf.estoque_atual) + item.quantidade,
            updated_at: new Date().toISOString(),
          }).eq('filial_id', filialSel.id).eq('produto_id', item.produto_id)
        }
      }
    }
    // Estornar totais do caixa
    const cx = caixaAberto
    await supabase.from('caixas_pdv').update({
      total_vendas:   Math.max(0, (cx.total_vendas   || 0) - Number(vendaCancelar.total)),
      total_dinheiro: Math.max(0, (cx.total_dinheiro || 0) - Number(vendaCancelar.valor_dinheiro || 0)),
      total_pix:      Math.max(0, (cx.total_pix      || 0) - Number(vendaCancelar.valor_pix || 0)),
      total_cartao:   Math.max(0, (cx.total_cartao   || 0) - Number(vendaCancelar.valor_cartao || 0)),
    }).eq('id', cx.id)
    setCancelando(false); setModalCancelamento(false); setModalHistorico(false)
    setMotivoCancelamento(''); setVendaCancelar(null)
    carregarVendasHoje()
  }

  // ── Sangria / Suprimento ──
  async function salvarMovimentacao() {
    if (!valorMovimentacao || !motivoMovimentacao.trim()) return
    setSalvandoMov(true)
    const valor = Number(valorMovimentacao)
    await supabase.from('caixa_movimentacoes').insert({
      caixa_id:    caixaAberto.id,
      filial_id:   filialSel.id,
      atendente_id: atendente.id,
      tipo:        tipoMovimentacao,
      valor,
      motivo:      motivoMovimentacao,
    })
    const cx = caixaAberto
    const campo = tipoMovimentacao === 'sangria' ? 'total_sangria' : 'total_suprimento'
    const novoValor = (cx[campo] || 0) + valor
    await supabase.from('caixas_pdv').update({ [campo]: novoValor }).eq('id', cx.id)
    setCaixaAberto({ ...cx, [campo]: novoValor })
    setSalvandoMov(false); setModalMovimentacao(false)
    setValorMovimentacao(''); setMotivoMovimentacao('')
  }

  // ── Reimprimir cupom ──
  function imprimirCupom(venda: any) {
    const itens = (venda.venda_pdv_itens || []).map((i: any) =>
      `${i.quantidade}x ${i.nome_produto} .............. ${formatBRL(i.preco_unitario * i.quantidade)}`
    ).join('\n')
    const cpfLinha = venda.cpf_cliente
      ? `<div>CPF: ${mascararCPF(venda.cpf_cliente)}</div>` : ''
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <style>body{font-family:monospace;font-size:12px;width:280px;margin:0 auto}
    hr{border:1px dashed #000}.right{text-align:right}.center{text-align:center}
    .bold{font-weight:bold}.big{font-size:16px}</style></head><body>
    <div class="center bold">🍕 BENDITO LANCHES</div>
    <div class="center">${filialSel?.nome}</div>
    <hr/>
    <div>Venda #${venda.numero}</div>
    <div>${new Date(venda.created_at).toLocaleString('pt-BR')}</div>
    <div>Atendente: ${atendente?.nome}</div>
    ${venda.cliente_nome ? `<div>Cliente: ${venda.cliente_nome}</div>` : ''}
    ${cpfLinha}
    <hr/>
    <pre>${itens}</pre>
    <hr/>
    <div class="right">Subtotal: ${formatBRL(venda.subtotal)}</div>
    ${Number(venda.desconto) > 0 ? `<div class="right">Desconto: -${formatBRL(venda.desconto)}</div>` : ''}
    <div class="right bold big">TOTAL: ${formatBRL(venda.total)}</div>
    <div class="right">Forma: ${venda.forma_pagamento}</div>
    ${Number(venda.troco) > 0 ? `<div class="right">Troco: ${formatBRL(venda.troco)}</div>` : ''}
    <hr/>
    <div class="center">Obrigado pela preferência! 🙏</div>
    </body></html>`
    const w = window.open('', '_blank', 'width=350,height=600')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  // Pedido interno
  function addProdutoPed(p: any) {
    setItensPed(prev => {
      const ex = prev.find(i => i.produto_id === p.id)
      if (ex) return prev.map(i => i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...prev, { produto_id: p.id, nome: p.nome, quantidade: 1, unidade: p.unidade_medida || 'un', outros: false }]
    })
  }

  function addOutro() {
    if (!outroNome.trim()) return
    setItensPed(prev => [...prev, { produto_id: null, nome: outroNome.trim(), quantidade: outroQtd, unidade: outroUnidade, outros: true }])
    setOutroNome(''); setOutroQtd(1); setOutroUnidade('un')
  }

  async function enviarPedidoInterno() {
    if (!itensPed.length) return
    setSalvandoPed(true)
    const { data: ped } = await supabase.from('pedidos_internos').insert({
      filial_origem: filialSel.id, filial_destino: MATRIZ_ID, observacoes: obsPed || null,
    }).select('id').single()
    if (ped) {
      await supabase.from('pedido_interno_itens').insert(
        itensPed.map(i => ({
          pedido_interno_id: ped.id, produto_id: i.produto_id || null,
          quantidade_pedida: i.quantidade, unidade: i.unidade,
          observacao: i.outros ? `[OUTRO] ${i.nome}` : null,
        }))
      )
    }
    setSalvandoPed(false); setItensPed([]); setObsPed('')
    setPedidoEnviado(true); setTimeout(() => setPedidoEnviado(false), 3000)
  }

  async function fecharCaixa() {
    await supabase.from('caixas_pdv').update({
      status: 'fechado', fechamento_at: new Date().toISOString(),
      valor_fechamento: caixaAberto.total_vendas,
    }).eq('id', caixaAberto.id)
    setModalFechamento(false)
    setFase('filial'); setAtendente(null); setCaixaAberto(null)
    setCarrinho([]); setAtendenteSel(''); setSenhaInput(''); setFilialSel(null)
  }

  const prodFiltrados = produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()))

  // ════ TELA FILIAL ════
  if (fase === 'filial') return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm border border-gray-700">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍕</div>
          <h1 className="text-2xl font-bold text-yellow-400">Bendito Lanches</h1>
          <p className="text-gray-400 text-sm mt-1">Terminal de Vendas</p>
        </div>
        <p className="text-xs text-gray-400 text-center mb-4">Selecione a unidade</p>
        <div className="space-y-3">
          {filiais.map(f => (
            <button key={f.id} onClick={() => selecionarFilial(f)}
              className="w-full bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-yellow-400 rounded-xl p-4 text-left transition flex items-center gap-3">
              <Building2 size={20} className="text-yellow-400 shrink-0"/>
              <span className="font-semibold text-white">{f.nome}</span>
            </button>
          ))}
          {filiais.length === 0 && <p className="text-center text-gray-500 text-sm py-4">Nenhuma unidade cadastrada.</p>}
        </div>
      </div>
    </div>
  )

  // ════ TELA LOGIN ════
  if (fase === 'login') return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm border border-gray-700">
        <button onClick={() => { setFase('filial'); setAtendenteSel(''); setSenhaInput('') }}
          className="text-xs text-gray-400 hover:text-gray-200 mb-4 flex items-center gap-1">← Trocar unidade</button>
        <div className="text-center mb-6">
          <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-2 inline-block mb-4">
            <p className="text-yellow-400 font-bold text-sm">🏢 {filialSel?.nome}</p>
          </div>
          <h2 className="text-xl font-bold text-white">Identificação</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Atendente</label>
            <select value={atendenteSel} onChange={e => setAtendenteSel(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-yellow-400">
              <option value="">Selecione...</option>
              {atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            {atendentes.length === 0 && <p className="text-xs text-orange-400 mt-1">Nenhum atendente autorizado.</p>}
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Senha PDV</label>
            <div className="relative">
              <Input type={showSenha ? 'text' : 'password'} value={senhaInput}
                onChange={e => setSenhaInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && fazerLogin()} placeholder="••••"/>
              <button onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showSenha ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>
          {erroLogin && <p className="text-xs text-red-400 bg-red-900/30 p-2 rounded">{erroLogin}</p>}
          <Btn onClick={fazerLogin} className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 py-3">Entrar no Caixa</Btn>
        </div>
      </div>
    </div>
  )

  // ════ TROCAR SENHA ════
  if (fase === 'trocar_senha') return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm border border-yellow-500">
        <div className="text-center mb-6">
          <Lock size={40} className="text-yellow-400 mx-auto mb-3"/>
          <h2 className="text-xl font-bold text-white">Primeiro Acesso</h2>
          <p className="text-yellow-400 font-semibold mt-1">{atendente?.nome}</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Nova senha</label>
            <div className="relative">
              <Input type={showNovaSenha ? 'text' : 'password'} value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo 4 caracteres"/>
              <button onClick={() => setShowNovaSenha(!showNovaSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showNovaSenha ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Confirmar senha</label>
            <Input type="password" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)} placeholder="Repita a senha"/>
          </div>
          {erroSenha && <p className="text-xs text-red-400 bg-red-900/30 p-2 rounded">{erroSenha}</p>}
          <Btn onClick={trocarSenha} disabled={salvandoSenha || !novaSenha || !confirmaSenha}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 py-3">
            {salvandoSenha ? 'Salvando...' : '✅ Definir senha'}
          </Btn>
        </div>
      </div>
    </div>
  )

  // ════ ABERTURA DE CAIXA ════
  if (fase === 'caixa') return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm border border-gray-700">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">💰</div>
          <h2 className="text-xl font-bold text-white">Abrir Caixa</h2>
          <p className="text-gray-400 text-sm">{filialSel?.nome} · <span className="text-yellow-400">{atendente?.nome}</span></p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Valor inicial em caixa (troco) R$</label>
            <Input type="number" step="0.01" value={valorAbertura} onChange={e => setValorAbertura(e.target.value)} placeholder="0,00"/>
          </div>
          <Btn onClick={abrirCaixa} className="w-full bg-green-500 hover:bg-green-400 text-white py-3">✅ Abrir Caixa</Btn>
          <Btn onClick={() => { setFase('login'); setAtendente(null) }} className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300">Voltar</Btn>
        </div>
      </div>
    </div>
  )

  // ════ PDV PRINCIPAL ════
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-yellow-400">🍕</span>
          <span className="text-xs bg-yellow-400/10 border border-yellow-400/30 px-2 py-0.5 rounded-full text-yellow-400 font-semibold">{filialSel?.nome}</span>
          <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-gray-300 flex items-center gap-1"><User size={11}/> {atendente?.nome}</span>
          {alertas.length > 0 && (
            <span className="text-xs bg-red-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
              <AlertTriangle size={10}/> {alertas.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Btn onClick={() => { setTipoMovimentacao('sangria'); setModalMovimentacao(true) }}
            className="bg-orange-700 hover:bg-orange-600 text-white text-xs px-2 py-1.5 flex items-center gap-1">
            <ArrowDownCircle size={13}/> Sangria
          </Btn>
          <Btn onClick={() => { setTipoMovimentacao('suprimento'); setModalMovimentacao(true) }}
            className="bg-blue-700 hover:bg-blue-600 text-white text-xs px-2 py-1.5 flex items-center gap-1">
            <ArrowUpCircle size={13}/> Suprimento
          </Btn>
          <Btn onClick={() => { setModalHistorico(true); carregarVendasHoje() }}
            className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1.5 flex items-center gap-1">
            <History size={13}/> Histórico
          </Btn>
          <Btn onClick={() => setModalFechamento(true)}
            className="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 flex items-center gap-1">
            <LogOut size={13}/> Fechar
          </Btn>
        </div>
      </div>

      {/* Abas */}
      <div className="bg-gray-800 border-b border-gray-700 flex shrink-0">
        {([
          { key: 'caixa',          label: '🛒 Caixa' },
          { key: 'pedido_interno', label: '📦 Pedir à Matriz' },
          { key: 'estoque',        label: '📊 Estoque' },
          { key: 'resumo',         label: '💵 Resumo' },
        ] as {key:Aba;label:string}[]).map(a => (
          <button key={a.key} onClick={() => setAba(a.key)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${aba === a.key ? 'border-yellow-400 text-yellow-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ── ABA CAIXA ── */}
      {aba === 'caixa' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-700 flex items-center gap-2 bg-gray-800">
              <Search size={15} className="text-gray-400 shrink-0"/>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..."
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500" autoFocus/>
              {busca && <button onClick={() => setBusca('')}><X size={14} className="text-gray-400"/></button>}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {prodFiltrados.map(p => (
                  <button key={p.id} onClick={() => addProduto(p)}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-yellow-400 rounded-xl p-3 text-left transition active:scale-95">
                    <p className="text-sm font-semibold text-white leading-tight">{p.nome}</p>
                    <p className="text-base font-bold text-yellow-400 mt-1">{formatBRL(p.preco_varejo)}</p>
                  </button>
                ))}
                {prodFiltrados.length === 0 && (
                  <p className="col-span-full text-center text-gray-500 text-sm py-8">
                    {produtos.length === 0 ? 'Nenhum produto disponível.' : 'Nenhum produto encontrado.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Carrinho */}
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-3 border-b border-gray-700 flex items-center gap-2">
              <ShoppingCart size={16} className="text-yellow-400"/>
              <span className="font-bold text-sm">Carrinho</span>
              {carrinho.length > 0 && (
                <span className="ml-auto bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">{carrinho.length}</span>
              )}
            </div>

            {/* APONTAMENTO 6 — Botão Venda Diversa */}
            <div className="px-3 pt-3">
              <Btn onClick={() => setModalVendaDiversa(true)}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center gap-2 py-2">
                <PackagePlus size={15}/> Venda diversa
              </Btn>
            </div>

            {/* Cliente + APONTAMENTO 7 — CPF */}
            <div className="px-3 pt-2 space-y-2">
              <input value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="👤 Cliente (opcional)"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-xs outline-none"/>
              <input value={cpfCliente} onChange={e => setCpfCliente(mascararCPF(e.target.value))}
                placeholder="🆔 CPF (opcional)" inputMode="numeric"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-xs outline-none"/>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {carrinho.length === 0
                ? <p className="text-center text-gray-500 text-xs mt-8">Clique nos produtos para adicionar</p>
                : carrinho.map((i, idx) => (
                  <div key={idx} className="bg-gray-700 rounded-lg p-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white leading-tight">{i.nome}</p>
                        {!i.produto_id && (
                          <span className="inline-block mt-0.5 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                            avulso
                          </span>
                        )}
                      </div>
                      <button onClick={() => removerItem(idx)}
                        className="text-red-400 hover:text-red-300 ml-1"><Trash2 size={11}/></button>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQtd(idx, -1)}
                          className="w-6 h-6 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center"><Minus size={10}/></button>
                        <span className="text-sm font-bold w-6 text-center">{i.quantidade}</span>
                        <button onClick={() => updateQtd(idx, 1)}
                          className="w-6 h-6 rounded-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 flex items-center justify-center"><Plus size={10}/></button>
                      </div>
                      <span className="text-sm font-bold text-yellow-400">{formatBRL(i.preco * i.quantidade)}</span>
                    </div>
                  </div>
                ))
              }
            </div>
            <div className="p-3 border-t border-gray-700 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Desconto R$</span>
                <input type="number" step="0.01" value={desconto} onChange={e => setDesconto(e.target.value)}
                  placeholder="0,00" className="flex-1 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1.5 text-xs outline-none text-right"/>
              </div>
              <div className="bg-gray-700 rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-300">TOTAL</span>
                <span className="text-2xl font-bold text-yellow-400">{formatBRL(total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Btn onClick={() => finalizarVenda('dinheiro', total)} disabled={!carrinho.length || salvando}
                  className="bg-green-600 hover:bg-green-500 text-white flex items-center justify-center gap-1.5 py-3">
                  <Banknote size={16}/> Dinheiro
                </Btn>
                <Btn onClick={() => finalizarVenda('pix')} disabled={!carrinho.length || salvando}
                  className="bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 py-3">
                  <Smartphone size={16}/> PIX
                </Btn>
                <Btn onClick={() => finalizarVenda('debito')} disabled={!carrinho.length || salvando}
                  className="bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-1.5 py-3">
                  <CreditCard size={16}/> Débito
                </Btn>
                <Btn onClick={() => finalizarVenda('credito')} disabled={!carrinho.length || salvando}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 py-3">
                  <CreditCard size={16}/> Crédito
                </Btn>
              </div>
              <Btn onClick={() => setModalPagMisto(true)} disabled={!carrinho.length || salvando}
                className="w-full bg-gray-600 hover:bg-gray-500 text-white flex items-center justify-center gap-2 py-2.5">
                🔀 Misto / Calcular Troco
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── ABA PEDIDO INTERNO ── */}
      {aba === 'pedido_interno' && (
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Package size={20} className="text-yellow-400"/> Pedir produtos à Matriz
          </h2>
          {pedidoEnviado && (
            <div className="bg-green-800 border border-green-600 rounded-xl p-4 flex items-center gap-2 text-green-300">
              <CheckCircle size={20}/> Pedido enviado!
            </div>
          )}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-sm font-semibold text-yellow-400 mb-3">📋 Produtos cadastrados na Matriz</p>
            {produtosPed.length === 0
              ? <p className="text-xs text-gray-500 italic">Nenhum produto cadastrado na Matriz.</p>
              : (
                <div className="space-y-2">
                  {produtosPed.map(p => {
                    const noLista = itensPed.find(i => i.produto_id === p.id)
                    return (
                      <div key={p.id} className="flex items-center justify-between bg-gray-700 rounded-lg px-3 py-2.5">
                        <span className="text-sm text-white">{p.nome}</span>
                        <div className="flex items-center gap-2">
                          {noLista ? (
                            <>
                              <button onClick={() => setItensPed(prev => prev.map(i => i.produto_id === p.id ? { ...i, quantidade: Math.max(1, i.quantidade - 1) } : i))}
                                className="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center"><Minus size={11}/></button>
                              <span className="text-sm font-bold text-yellow-400 w-7 text-center">{noLista.quantidade}</span>
                              <button onClick={() => setItensPed(prev => prev.map(i => i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i))}
                                className="w-7 h-7 rounded-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 flex items-center justify-center"><Plus size={11}/></button>
                              <button onClick={() => setItensPed(prev => prev.filter(i => i.produto_id !== p.id))}
                                className="text-red-400 hover:text-red-300 ml-1"><X size={13}/></button>
                            </>
                          ) : (
                            <button onClick={() => addProdutoPed(p)}
                              className="flex items-center gap-1 bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-3 py-1.5 rounded-lg text-xs font-semibold">
                              <Plus size={12}/> Adicionar
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-300 mb-3">➕ Outros</p>
            <div className="flex gap-2">
              <input value={outroNome} onChange={e => setOutroNome(e.target.value)} placeholder="Descreva o produto..."
                className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm outline-none"/>
              <input type="number" min={1} value={outroQtd} onChange={e => setOutroQtd(Number(e.target.value))}
                className="w-14 bg-gray-700 border border-gray-600 text-white rounded-lg px-2 py-2 text-sm outline-none text-center"/>
              <input value={outroUnidade} onChange={e => setOutroUnidade(e.target.value)} placeholder="un"
                className="w-14 bg-gray-700 border border-gray-600 text-white rounded-lg px-2 py-2 text-sm outline-none text-center"/>
              <Btn onClick={addOutro} disabled={!outroNome.trim()} className="bg-gray-600 hover:bg-gray-500 text-white px-3">Add</Btn>
            </div>
          </div>
          {itensPed.length > 0 && (
            <div className="bg-gray-800 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-sm font-semibold text-yellow-400 mb-3">🛒 Resumo ({itensPed.length} item(s))</p>
              <div className="space-y-2">
                {itensPed.map((i, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-700 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      {i.outros && <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-semibold shrink-0">OUTRO</span>}
                      <span className="text-white truncate">{i.nome}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-yellow-400 font-bold">{i.quantidade} {i.unidade}</span>
                      <button onClick={() => setItensPed(prev => prev.filter((_, j) => j !== idx))}
                        className="text-red-400 hover:text-red-300"><X size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <textarea value={obsPed} onChange={e => setObsPed(e.target.value)} rows={2}
            placeholder="Observações..."
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none resize-none"/>
          <Btn onClick={enviarPedidoInterno} disabled={salvandoPed || !itensPed.length}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 py-3 text-base">
            {salvandoPed ? 'Enviando...' : '📦 Enviar Pedido para a Matriz'}
          </Btn>
        </div>
      )}

      {/* ── ABA ESTOQUE ── */}
      {aba === 'estoque' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart2 size={20} className="text-yellow-400"/> Estoque — {filialSel?.nome}
            </h2>
            <Btn onClick={carregarEstoque} className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs flex items-center gap-1">
              <RefreshCw size={12}/> Atualizar
            </Btn>
          </div>
          {alertas.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-bold text-red-400 flex items-center gap-1 mb-2"><AlertTriangle size={13}/> ALERTAS</p>
              {alertas.map((a, i) => {
                const cores: Record<string,string> = {
                  sem_estoque: 'bg-red-900/50 border-red-600 text-red-300',
                  critico: 'bg-red-900/30 border-red-700 text-red-400',
                  baixo: 'bg-orange-900/30 border-orange-700 text-orange-400',
                  atencao: 'bg-yellow-900/30 border-yellow-700 text-yellow-400',
                }
                return (
                  <div key={i} className={`flex justify-between items-center p-3 rounded-lg border text-sm ${cores[a.nivel_alerta] || cores.atencao}`}>
                    <span className="font-medium">{a.produto_nome}</span>
                    <div className="text-right text-xs">
                      <p className="font-bold">{a.estoque_atual} un</p>
                      {a.quantidade_sugerida > 0 && <p>Pedir: {Math.ceil(a.quantidade_sugerida)}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>{['Produto','Estoque','Mínimo','Status'].map(h =>
                  <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-400">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {estoqueItems.map((e: any) => {
                  const baixo = Number(e.estoque_atual) <= Number(e.estoque_minimo)
                  return (
                    <tr key={e.id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-2 text-white">{e.produtos?.nome}</td>
                      <td className={`px-4 py-2 font-bold ${baixo ? 'text-red-400' : 'text-green-400'}`}>{e.estoque_atual}</td>
                      <td className="px-4 py-2 text-gray-400">{e.estoque_minimo}</td>
                      <td className="px-4 py-2">
                        {baixo
                          ? <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">⚠️ Baixo</span>
                          : <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">✓ OK</span>}
                      </td>
                    </tr>
                  )
                })}
                {estoqueItems.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-gray-500 py-8 text-sm">Sem itens no estoque.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ABA RESUMO ── */}
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
                <p className="text-sm text-gray-400 mt-1">{resumo.totalVendas} venda(s)</p>
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
              {(resumo.sangria > 0 || resumo.suprimento > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-orange-900/30 border border-orange-700 rounded-xl p-3 text-center">
                    <p className="text-xs text-orange-400">🔻 Sangria</p>
                    <p className="text-base font-bold text-orange-300 mt-1">{formatBRL(resumo.sangria)}</p>
                  </div>
                  <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-3 text-center">
                    <p className="text-xs text-blue-400">🔺 Suprimento</p>
                    <p className="text-base font-bold text-blue-300 mt-1">{formatBRL(resumo.suprimento)}</p>
                  </div>
                </div>
              )}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-xs text-gray-400 space-y-1">
                <p>Unidade: <span className="text-yellow-400 font-medium">{filialSel?.nome}</span></p>
                <p>Atendente: <span className="text-white font-medium">{atendente?.nome}</span></p>
                <p>Fundo: <span className="text-white">{formatBRL(caixaAberto?.valor_abertura||0)}</span></p>
              </div>
              <Btn onClick={() => setModalFechamento(true)} className="w-full bg-red-700 hover:bg-red-600 text-white py-3">Fechar Caixa</Btn>
            </div>
          )}
        </div>
      )}

      {/* ── APONTAMENTO 6 — Modal Venda Diversa ── */}
      {modalVendaDiversa && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-amber-600 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PackagePlus size={20} className="text-amber-400"/> Venda diversa
              </h3>
              <button onClick={() => setModalVendaDiversa(false)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-3 text-xs text-amber-300">
              💡 Use para itens não cadastrados (refrigerante avulso, taxa, serviço, promoção pontual). O item não baixa estoque.
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Descrição <span className="text-red-400">*</span></label>
              <Input value={diversaDesc} onChange={e => setDiversaDesc(e.target.value)}
                placeholder="Ex: Refrigerante 2L promoção"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Valor unitário R$ <span className="text-red-400">*</span></label>
                <Input type="number" step="0.01" value={diversaValor}
                  onChange={e => setDiversaValor(e.target.value)} placeholder="0,00"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Quantidade</label>
                <Input type="number" min={1} value={diversaQtd}
                  onChange={e => setDiversaQtd(Number(e.target.value))}/>
              </div>
            </div>
            {Number(diversaValor) > 0 && (
              <div className="bg-gray-700 rounded-xl p-3 flex justify-between items-center">
                <span className="text-xs text-gray-400">Total do item</span>
                <span className="text-xl font-bold text-amber-400">
                  {formatBRL(Number(diversaValor) * (Number(diversaQtd) || 1))}
                </span>
              </div>
            )}
            <div className="flex gap-3">
              <Btn onClick={() => setModalVendaDiversa(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300">Cancelar</Btn>
              <Btn onClick={adicionarVendaDiversa}
                disabled={!diversaDesc.trim() || !Number(diversaValor)}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white">
                Adicionar ao carrinho
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Pagamento Misto / Troco ── */}
      {modalPagMisto && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Pagamento</h3>
              <button onClick={() => setModalPagMisto(false)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div className="bg-gray-700 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400">Total</p>
              <p className="text-3xl font-bold text-yellow-400">{formatBRL(total)}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">💵 Dinheiro R$</label>
                <Input type="number" step="0.01" value={valDinheiro} onChange={e => setValDinheiro(e.target.value)} placeholder="0,00"/>
                {Number(valDinheiro) > 0 && (
                  <p className="text-xs text-green-400 mt-1">Troco: {formatBRL(Math.max(Number(valDinheiro)-total,0))}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">📱 PIX R$</label>
                <Input type="number" step="0.01" value={valPix} onChange={e => setValPix(e.target.value)} placeholder="0,00"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">💳 Cartão R$</label>
                <Input type="number" step="0.01" value={valCartao} onChange={e => setValCartao(e.target.value)} placeholder="0,00"/>
              </div>
            </div>
            <Btn onClick={() => finalizarVenda('misto')} disabled={salvando}
              className="w-full bg-green-500 hover:bg-green-400 text-white py-3">
              {salvando ? 'Finalizando...' : '✅ Finalizar Venda'}
            </Btn>
          </div>
        </div>
      )}

      {/* ── Modal Venda Concluída ── */}
      {vendaConcluida && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-green-600 rounded-2xl w-full max-w-xs p-6 text-center space-y-3">
            <CheckCircle size={52} className="text-green-400 mx-auto"/>
            <h3 className="text-xl font-bold text-white">Venda #{vendaConcluida.numero}</h3>
            <p className="text-4xl font-bold text-yellow-400">{formatBRL(vendaConcluida.total)}</p>
            {vendaConcluida.troco > 0 && <p className="text-2xl font-bold text-green-400">Troco: {formatBRL(vendaConcluida.troco)}</p>}
            <div className="flex gap-2 mt-2">
              <Btn onClick={() => imprimirCupom(vendaConcluida)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center gap-2">
                <Printer size={16}/> Cupom
              </Btn>
              <Btn onClick={() => setVendaConcluida(null)}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-gray-900">
                ➕ Nova
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Histórico de Vendas ── */}
      {modalHistorico && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-white">📋 Vendas do Caixa</h3>
              <button onClick={() => setModalHistorico(false)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {loadingVendas ? (
                <p className="text-center text-gray-400 py-4">Carregando...</p>
              ) : vendasHoje.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Nenhuma venda registrada.</p>
              ) : vendasHoje.map(v => (
                <div key={v.id} className={`bg-gray-700 rounded-xl p-3 ${v.status === 'cancelada' ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white flex items-center gap-2">
                        #{v.numero}
                        {v.status === 'cancelada' && <span className="text-xs bg-red-800 text-red-300 px-2 py-0.5 rounded">cancelada</span>}
                      </p>
                      <p className="text-xs text-gray-400">{v.forma_pagamento} · {new Date(v.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
                      {v.cliente_nome && <p className="text-xs text-gray-400">{v.cliente_nome}</p>}
                      {v.cpf_cliente && <p className="text-xs text-gray-500">CPF {mascararCPF(v.cpf_cliente)}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-yellow-400">{formatBRL(v.total)}</p>
                      <div className="flex gap-1 mt-1">
                        <button onClick={() => imprimirCupom(v)}
                          className="p-1.5 bg-gray-600 hover:bg-gray-500 rounded text-gray-300">
                          <Printer size={13}/>
                        </button>
                        {v.status !== 'cancelada' && (
                          <button onClick={() => { setVendaCancelar(v); setModalCancelamento(true) }}
                            className="p-1.5 bg-red-800 hover:bg-red-700 rounded text-red-300">
                            <X size={13}/>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Cancelamento ── */}
      {modalCancelamento && vendaCancelar && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-red-700 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">❌ Cancelar Venda #{vendaCancelar.numero}</h3>
            <div className="bg-gray-700 rounded-xl p-3 text-sm">
              <p className="text-gray-400">Valor: <span className="font-bold text-white">{formatBRL(vendaCancelar.total)}</span></p>
              <p className="text-gray-400">Forma: <span className="text-white">{vendaCancelar.forma_pagamento}</span></p>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Motivo do cancelamento <span className="text-red-400">*</span></label>
              <textarea value={motivoCancelamento} onChange={e => setMotivoCancelamento(e.target.value)} rows={3}
                placeholder="Informe o motivo do cancelamento..."
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-red-500"/>
            </div>
            <div className="flex gap-3">
              <Btn onClick={() => { setModalCancelamento(false); setMotivoCancelamento('') }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300">Voltar</Btn>
              <Btn onClick={cancelarVenda} disabled={cancelando || !motivoCancelamento.trim()}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white">
                {cancelando ? 'Cancelando...' : 'Confirmar'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Sangria / Suprimento ── */}
      {modalMovimentacao && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                {tipoMovimentacao === 'sangria' ? '🔻 Sangria de Caixa' : '🔺 Suprimento de Caixa'}
              </h3>
              <button onClick={() => setModalMovimentacao(false)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div className={`rounded-xl p-3 text-xs ${tipoMovimentacao === 'sangria' ? 'bg-orange-900/30 border border-orange-700 text-orange-300' : 'bg-blue-900/30 border border-blue-700 text-blue-300'}`}>
              {tipoMovimentacao === 'sangria'
                ? '💡 Sangria: retirada de dinheiro do caixa (ex: depósito bancário, segurança)'
                : '💡 Suprimento: adição de dinheiro ao caixa (ex: troco adicional)'}
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Valor R$</label>
              <Input type="number" step="0.01" value={valorMovimentacao} onChange={e => setValorMovimentacao(e.target.value)} placeholder="0,00"/>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Motivo <span className="text-red-400">*</span></label>
              <Input value={motivoMovimentacao} onChange={e => setMotivoMovimentacao(e.target.value)} placeholder="Ex: Depósito bancário, Troco adicional..."/>
            </div>
            <div className="flex gap-3">
              <Btn onClick={() => setModalMovimentacao(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300">Cancelar</Btn>
              <Btn onClick={salvarMovimentacao} disabled={salvandoMov || !valorMovimentacao || !motivoMovimentacao.trim()}
                className={`flex-1 text-white ${tipoMovimentacao === 'sangria' ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                {salvandoMov ? 'Salvando...' : 'Confirmar'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Fechar Caixa ── */}
      {modalFechamento && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Fechar Caixa — {filialSel?.nome}</h3>
            <div className="bg-gray-700 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Total vendas</span><span className="font-bold text-yellow-400">{formatBRL(caixaAberto?.total_vendas||0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Dinheiro</span><span className="text-green-400">{formatBRL(caixaAberto?.total_dinheiro||0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">PIX</span><span className="text-blue-400">{formatBRL(caixaAberto?.total_pix||0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Cartão</span><span className="text-purple-400">{formatBRL(caixaAberto?.total_cartao||0)}</span></div>
              {caixaAberto?.total_sangria > 0 && <div className="flex justify-between"><span className="text-gray-400">Sangria</span><span className="text-orange-400">-{formatBRL(caixaAberto?.total_sangria||0)}</span></div>}
              {caixaAberto?.total_suprimento > 0 && <div className="flex justify-between"><span className="text-gray-400">Suprimento</span><span className="text-blue-400">+{formatBRL(caixaAberto?.total_suprimento||0)}</span></div>}
              <div className="flex justify-between border-t border-gray-600 pt-2 font-bold">
                <span className="text-gray-300">Saldo final caixa</span>
                <span className="text-white">
                  {formatBRL(
                    (caixaAberto?.valor_abertura||0) +
                    (caixaAberto?.total_dinheiro||0) -
                    (caixaAberto?.total_sangria||0) +
                    (caixaAberto?.total_suprimento||0)
                  )}
                </span>
              </div>
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
