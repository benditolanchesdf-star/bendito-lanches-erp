'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL } from '@/lib/constants'
import { Loading, PrimaryButton, SecondaryButton, Field, Input } from '@/components/ui'
import { Search, Plus, Minus, Trash2, ShoppingCart, X, CheckCircle, User, Lock } from 'lucide-react'

type ItemCarrinho = { produto_id: string; nome: string; preco: number; quantidade: number; desconto: number }

export default function PDVPage() {
  const supabase = createClient()
  const [fase, setFase] = useState<'login'|'caixa'|'venda'>('login')
  const [loading, setLoading] = useState(false)

  // Login atendente
  const [atendentes, setAtendentes] = useState<any[]>([])
  const [atendenteSel, setAtendenteSel] = useState('')
  const [senhaInput, setSenhaInput] = useState('')
  const [erroLogin, setErroLogin] = useState('')
  const [atendente, setAtendente] = useState<any>(null)

  // Caixa
  const [caixaAberto, setCaixaAberto] = useState<any>(null)
  const [valorAbertura, setValorAbertura] = useState('')

  // Produtos e busca
  const [produtos, setProdutos] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])

  // Pagamento
  const [modalPag, setModalPag] = useState(false)
  const [formaPag, setFormaPag] = useState<'dinheiro'|'pix'|'credito'|'debito'|'misto'>('dinheiro')
  const [valorDinheiro, setValorDinheiro] = useState('')
  const [valorPix, setValorPix] = useState('')
  const [valorCartao, setValorCartao] = useState('')
  const [desconto, setDesconto] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [vendaConcluida, setVendaConcluida] = useState<any>(null)

  // Fechamento de caixa
  const [modalFechamento, setModalFechamento] = useState(false)

  const subtotal = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const descontoTotal = Number(desconto) || 0
  const total = Math.max(subtotal - descontoTotal, 0)
  const troco = formaPag === 'dinheiro' ? Math.max((Number(valorDinheiro) || 0) - total, 0) : 0

  useEffect(() => {
    supabase.from('atendentes_pdv').select('*').eq('filial_id', FILIAL_ID).eq('ativo', true).then(({ data }) => setAtendentes(data || []))
    supabase.from('produtos').select('id, nome, preco_venda, unidade').eq('ativo', true).eq('filial_id', FILIAL_ID).order('nome').then(({ data }) => setProdutos(data || []))
  }, [])

  async function fazerLogin() {
    setErroLogin('')
    const at = atendentes.find(a => a.id === atendenteSel)
    if (!at) { setErroLogin('Selecione um atendente.'); return }
    if (at.senha_pdv !== senhaInput) { setErroLogin('Senha incorreta.'); return }
    setAtendente(at)
    // Verificar caixa aberto
    const { data: caixa } = await supabase.from('caixas_pdv')
      .select('*').eq('filial_id', FILIAL_ID).eq('atendente_id', at.id).eq('status', 'aberto').maybeSingle()
    if (caixa) { setCaixaAberto(caixa); setFase('venda') }
    else setFase('caixa')
  }

  async function abrirCaixa() {
    setLoading(true)
    const { data } = await supabase.from('caixas_pdv').insert({
      filial_id: FILIAL_ID,
      atendente_id: atendente.id,
      valor_abertura: Number(valorAbertura) || 0,
      status: 'aberto',
    }).select('*').single()
    setCaixaAberto(data); setFase('venda'); setLoading(false)
  }

  function addProduto(p: any) {
    setCarrinho(prev => {
      const ex = prev.find(i => i.produto_id === p.id)
      if (ex) return prev.map(i => i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...prev, { produto_id: p.id, nome: p.nome, preco: Number(p.preco_venda || 0), quantidade: 1, desconto: 0 }]
    })
  }

  function updateQtd(id: string, delta: number) {
    setCarrinho(prev => prev.map(i => i.produto_id === id
      ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i))
  }

  function remover(id: string) { setCarrinho(prev => prev.filter(i => i.produto_id !== id)) }

  async function finalizarVenda() {
    if (carrinho.length === 0) return
    setSalvando(true)

    const vPag = {
      dinheiro: formaPag === 'dinheiro' ? total : formaPag === 'misto' ? Number(valorDinheiro) || 0 : 0,
      pix: formaPag === 'pix' ? total : formaPag === 'misto' ? Number(valorPix) || 0 : 0,
      cartao: ['credito','debito'].includes(formaPag) ? total : formaPag === 'misto' ? Number(valorCartao) || 0 : 0,
    }

    const { data: venda } = await supabase.from('vendas_pdv').insert({
      filial_id: FILIAL_ID,
      caixa_id: caixaAberto.id,
      atendente_id: atendente.id,
      cliente_nome: clienteNome || null,
      subtotal, desconto: descontoTotal, total,
      forma_pagamento: formaPag,
      valor_dinheiro: vPag.dinheiro,
      valor_pix: vPag.pix,
      valor_cartao: vPag.cartao,
      troco,
    }).select('*').single()

    if (venda) {
      await supabase.from('venda_pdv_itens').insert(
        carrinho.map(i => ({
          venda_id: venda.id, produto_id: i.produto_id, nome_produto: i.nome,
          quantidade: i.quantidade, preco_unitario: i.preco,
          desconto: i.desconto, subtotal: i.preco * i.quantidade,
        }))
      )
      // Atualizar totais do caixa
      await supabase.from('caixas_pdv').update({
        total_vendas: (caixaAberto.total_vendas || 0) + total,
        total_dinheiro: (caixaAberto.total_dinheiro || 0) + vPag.dinheiro,
        total_pix: (caixaAberto.total_pix || 0) + vPag.pix,
        total_cartao: (caixaAberto.total_cartao || 0) + vPag.cartao,
      }).eq('id', caixaAberto.id)
      // Atualizar caixa local
      setCaixaAberto((prev: any) => ({
        ...prev,
        total_vendas: (prev.total_vendas || 0) + total,
        total_dinheiro: (prev.total_dinheiro || 0) + vPag.dinheiro,
        total_pix: (prev.total_pix || 0) + vPag.pix,
        total_cartao: (prev.total_cartao || 0) + vPag.cartao,
      }))
    }

    setVendaConcluida({ ...venda, troco })
    setCarrinho([]); setDesconto(''); setClienteNome(''); setModalPag(false)
    setSalvando(false)
  }

  async function fecharCaixa() {
    await supabase.from('caixas_pdv').update({
      status: 'fechado', fechamento_at: new Date().toISOString(),
      valor_fechamento: caixaAberto.total_vendas,
    }).eq('id', caixaAberto.id)
    setModalFechamento(false); setFase('login'); setAtendente(null)
    setCaixaAberto(null); setCarrinho([])
  }

  const prodFiltrados = produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()))

  // ──────────────────────────────────────────────
  // TELA LOGIN ATENDENTE
  // ──────────────────────────────────────────────
  if (fase === 'login') return (
    <div className="min-h-screen bg-bendito-verde-escuro flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-bendito-dourado">🍕 PDV</h1>
          <p className="text-sm text-gray-500 mt-1">Frente de Caixa — Bendito Lanches</p>
        </div>
        <div className="space-y-4">
          <Field label="Atendente">
            <select value={atendenteSel} onChange={e => setAtendenteSel(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-bendito-dourado text-sm">
              <option value="">Selecione...</option>
              {atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </Field>
          <Field label="Senha PDV">
            <Input type="password" value={senhaInput} onChange={e => setSenhaInput(e.target.value)}
              placeholder="••••" onKeyDown={e => e.key === 'Enter' && fazerLogin()} />
          </Field>
          {erroLogin && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{erroLogin}</p>}
          <PrimaryButton onClick={fazerLogin} className="w-full">Entrar no Caixa</PrimaryButton>
        </div>
      </div>
    </div>
  )

  // ──────────────────────────────────────────────
  // TELA ABERTURA DE CAIXA
  // ──────────────────────────────────────────────
  if (fase === 'caixa') return (
    <div className="min-h-screen bg-bendito-verde-escuro flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-bendito-verde-escuro">Abrir Caixa</h2>
          <p className="text-sm text-gray-500">Atendente: <strong>{atendente?.nome}</strong></p>
        </div>
        <div className="space-y-4">
          <Field label="Valor em caixa (troco inicial R$)">
            <Input type="number" step="0.01" value={valorAbertura} onChange={e => setValorAbertura(e.target.value)} placeholder="0,00" />
          </Field>
          <PrimaryButton onClick={abrirCaixa} disabled={loading} className="w-full">
            {loading ? 'Abrindo...' : '✅ Abrir Caixa'}
          </PrimaryButton>
          <SecondaryButton onClick={() => setFase('login')} className="w-full">Voltar</SecondaryButton>
        </div>
      </div>
    </div>
  )

  // ──────────────────────────────────────────────
  // TELA PDV PRINCIPAL
  // ──────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* Painel esquerdo — produtos */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-bendito-verde-escuro text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-bendito-dourado">🍕 PDV</span>
            <span className="text-xs bg-bendito-verde px-2 py-0.5 rounded-full flex items-center gap-1">
              <User size={11} /> {atendente?.nome}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-300">Caixa aberto</span>
            <button onClick={() => setModalFechamento(true)}
              className="text-xs bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg">Fechar Caixa</button>
          </div>
        </div>

        {/* Busca */}
        <div className="p-3 bg-white border-b flex items-center gap-2">
          <Search size={16} className="text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..."
            className="flex-1 outline-none text-sm" autoFocus />
          {busca && <button onClick={() => setBusca('')}><X size={14} className="text-gray-400" /></button>}
        </div>

        {/* Grid produtos */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {prodFiltrados.map(p => (
              <button key={p.id} onClick={() => addProduto(p)}
                className="bg-white rounded-xl p-3 shadow-sm hover:shadow-md hover:ring-2 hover:ring-bendito-dourado transition text-left">
                <p className="text-sm font-semibold text-bendito-verde-escuro leading-tight">{p.nome}</p>
                <p className="text-base font-bold text-bendito-dourado mt-1">{formatBRL(p.preco_venda)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito — carrinho */}
      <div className="w-80 bg-white flex flex-col shadow-xl">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
          <ShoppingCart size={18} className="text-bendito-verde" />
          <span className="font-bold text-bendito-verde-escuro">Carrinho</span>
          {carrinho.length > 0 && (
            <span className="ml-auto text-xs bg-bendito-dourado text-bendito-verde-escuro px-2 py-0.5 rounded-full font-bold">
              {carrinho.length}
            </span>
          )}
        </div>

        {/* Identificar cliente */}
        <div className="px-3 pt-3">
          <input value={clienteNome} onChange={e => setClienteNome(e.target.value)}
            placeholder="👤 Cliente (opcional)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-bendito-dourado" />
        </div>

        {/* Itens carrinho */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {carrinho.length === 0
            ? <p className="text-center text-sm text-gray-400 mt-8">Selecione produtos ao lado</p>
            : carrinho.map(i => (
              <div key={i.produto_id} className="bg-gray-50 rounded-lg p-2">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-medium text-bendito-verde-escuro flex-1 leading-tight">{i.nome}</p>
                  <button onClick={() => remover(i.produto_id)} className="text-red-400 hover:text-red-600 ml-1">
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQtd(i.produto_id, -1)}
                      className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                      <Minus size={10} />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{i.quantidade}</span>
                    <button onClick={() => updateQtd(i.produto_id, 1)}
                      className="w-6 h-6 rounded-full bg-bendito-dourado hover:opacity-80 flex items-center justify-center">
                      <Plus size={10} />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-bendito-verde">{formatBRL(i.preco * i.quantidade)}</span>
                </div>
              </div>
            ))
          }
        </div>

        {/* Totais e ação */}
        <div className="p-3 border-t space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Desconto R$</span>
            <input type="number" step="0.01" value={desconto} onChange={e => setDesconto(e.target.value)}
              placeholder="0,00" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none text-right" />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span>{formatBRL(subtotal)}</span>
          </div>
          {descontoTotal > 0 && (
            <div className="flex justify-between text-sm text-red-500">
              <span>Desconto</span><span>- {formatBRL(descontoTotal)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg text-bendito-verde-escuro border-t pt-2">
            <span>TOTAL</span><span>{formatBRL(total)}</span>
          </div>
          <PrimaryButton onClick={() => setModalPag(true)} disabled={carrinho.length === 0} className="w-full text-base py-3">
            💳 Cobrar
          </PrimaryButton>
        </div>
      </div>

      {/* Modal pagamento */}
      {modalPag && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-bendito-verde-escuro">Forma de Pagamento</h3>
              <button onClick={() => setModalPag(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="text-center py-2 bg-bendito-creme rounded-xl">
              <p className="text-sm text-gray-500">Total a cobrar</p>
              <p className="text-3xl font-bold text-bendito-verde">{formatBRL(total)}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'dinheiro', label: '💵 Dinheiro' },
                { val: 'pix', label: '📱 PIX' },
                { val: 'credito', label: '💳 Crédito' },
                { val: 'debito', label: '💳 Débito' },
                { val: 'misto', label: '🔀 Misto' },
              ].map(f => (
                <button key={f.val} onClick={() => setFormaPag(f.val as any)}
                  className={`py-2 px-1 rounded-lg text-xs font-semibold border transition ${formaPag === f.val ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-white border-gray-200 hover:border-bendito-verde'}`}>
                  {f.label}
                </button>
              ))}
            </div>

            {formaPag === 'dinheiro' && (
              <Field label="Valor recebido (R$)">
                <Input type="number" step="0.01" value={valorDinheiro} onChange={e => setValorDinheiro(e.target.value)} placeholder="0,00" autoFocus />
              </Field>
            )}
            {formaPag === 'misto' && (
              <div className="space-y-2">
                <Field label="Dinheiro R$"><Input type="number" step="0.01" value={valorDinheiro} onChange={e => setValorDinheiro(e.target.value)} /></Field>
                <Field label="PIX R$"><Input type="number" step="0.01" value={valorPix} onChange={e => setValorPix(e.target.value)} /></Field>
                <Field label="Cartão R$"><Input type="number" step="0.01" value={valorCartao} onChange={e => setValorCartao(e.target.value)} /></Field>
              </div>
            )}

            {formaPag === 'dinheiro' && Number(valorDinheiro) > 0 && (
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Troco</p>
                <p className="text-2xl font-bold text-green-600">{formatBRL(troco)}</p>
              </div>
            )}

            <PrimaryButton onClick={finalizarVenda} disabled={salvando} className="w-full py-3 text-base">
              {salvando ? 'Finalizando...' : '✅ Finalizar Venda'}
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* Modal venda concluída */}
      {vendaConcluida && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center space-y-3">
            <CheckCircle size={48} className="text-green-500 mx-auto" />
            <h3 className="text-xl font-bold text-bendito-verde-escuro">Venda #{vendaConcluida.numero}</h3>
            <p className="text-3xl font-bold text-bendito-verde">{formatBRL(vendaConcluida.total)}</p>
            {vendaConcluida.troco > 0 && (
              <p className="text-sm text-green-600 font-semibold">Troco: {formatBRL(vendaConcluida.troco)}</p>
            )}
            <PrimaryButton onClick={() => setVendaConcluida(null)} className="w-full mt-2">
              Nova Venda
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* Modal fechamento de caixa */}
      {modalFechamento && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-bendito-verde-escuro">Fechar Caixa</h3>
            <div className="space-y-2 bg-bendito-creme rounded-xl p-4 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Total vendas</span><span className="font-bold">{formatBRL(caixaAberto?.total_vendas || 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Dinheiro</span><span>{formatBRL(caixaAberto?.total_dinheiro || 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">PIX</span><span>{formatBRL(caixaAberto?.total_pix || 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Cartão</span><span>{formatBRL(caixaAberto?.total_cartao || 0)}</span></div>
            </div>
            <div className="flex gap-3">
              <SecondaryButton onClick={() => setModalFechamento(false)} className="flex-1">Cancelar</SecondaryButton>
              <PrimaryButton onClick={fecharCaixa} className="flex-1 bg-red-600 hover:bg-red-700">Fechar Caixa</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
