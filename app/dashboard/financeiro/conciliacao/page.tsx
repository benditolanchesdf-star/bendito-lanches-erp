'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import Link from 'next/link'
import { ArrowLeft, Plus, Check, X, Building2, RefreshCw, Upload } from 'lucide-react'

export default function ConciliacaoPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [contas, setContas] = useState<any[]>([])
  const [extrato, setExtrato] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [contaSel, setContaSel] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [modalConta, setModalConta] = useState(false)
  const [modalLancamento, setModalLancamento] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [formConta, setFormConta] = useState({ nome:'', banco:'', agencia:'', conta:'', tipo:'corrente', saldo_inicial:'', filial_id:'' })
  const [formLanc, setFormLanc] = useState({ data_lancamento:'', descricao:'', valor:'', tipo:'credito' })

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('papel').eq('id', user!.id).maybeSingle()
    setIsAdmin(['admin','matriz'].includes(profile?.papel || ''))

    const [conts, fils] = await Promise.all([
      supabase.from('contas_bancarias').select('*, filiais(nome)').eq('ativo', true).order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setContas(conts.data || [])
    setFiliais(fils.data || [])
    if (!contaSel && conts.data && conts.data.length > 0) {
      setContaSel(conts.data[0].id)
    }
    setLoading(false)
  }

  async function carregarExtrato(contaId: string) {
    const { data } = await supabase.from('extrato_bancario')
      .select('*').eq('conta_bancaria_id', contaId)
      .order('data_lancamento', { ascending: false }).limit(100)
    setExtrato(data || [])
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (contaSel) carregarExtrato(contaSel) }, [contaSel])

  async function salvarConta() {
    if (!formConta.nome || !formConta.filial_id) return
    setSalvando(true)
    const saldo = Number(formConta.saldo_inicial) || 0
    await supabase.from('contas_bancarias').insert({
      ...formConta, saldo_inicial: saldo, saldo_atual: saldo,
    })
    setSalvando(false); setModalConta(false); load()
  }

  async function salvarLancamento() {
    if (!formLanc.descricao || !formLanc.valor || !contaSel) return
    setSalvando(true)
    const valor = formLanc.tipo === 'debito' ? -Math.abs(Number(formLanc.valor)) : Math.abs(Number(formLanc.valor))
    const { data: conta } = await supabase.from('contas_bancarias').select('saldo_atual').eq('id', contaSel).single()
    await Promise.all([
      supabase.from('extrato_bancario').insert({
        conta_bancaria_id: contaSel,
        filial_id: contas.find(c => c.id === contaSel)?.filial_id,
        data_lancamento: formLanc.data_lancamento || new Date().toISOString().split('T')[0],
        descricao: formLanc.descricao,
        valor,
        tipo: formLanc.tipo,
      }),
      supabase.from('contas_bancarias').update({
        saldo_atual: Number(conta?.saldo_atual || 0) + valor,
        updated_at: new Date().toISOString(),
      }).eq('id', contaSel),
    ])
    setSalvando(false); setModalLancamento(false)
    setFormLanc({ data_lancamento:'', descricao:'', valor:'', tipo:'credito' })
    carregarExtrato(contaSel); load()
  }

  async function conciliar(id: string) {
    await supabase.from('extrato_bancario').update({ conciliado: true }).eq('id', id)
    carregarExtrato(contaSel)
  }

  const contaAtual = contas.find(c => c.id === contaSel)
  const totalEntradas = extrato.filter(e => e.valor > 0).reduce((s, e) => s + Number(e.valor), 0)
  const totalSaidas   = extrato.filter(e => e.valor < 0).reduce((s, e) => s + Number(e.valor), 0)
  const naoConciliados = extrato.filter(e => !e.conciliado).length

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/financeiro" className="flex items-center gap-1 text-sm text-gray-500 hover:text-bendito-verde transition">
          <ArrowLeft size={16}/> Voltar
        </Link>
      </div>

      <PageHeader title="Conciliação Bancária" subtitle="Extrato e conciliação de contas bancárias"
        action={
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setModalConta(true)} className="flex items-center gap-2">
              <Plus size={15}/> Nova conta
            </SecondaryButton>
            <PrimaryButton onClick={() => setModalLancamento(true)} disabled={!contaSel} className="flex items-center gap-2">
              <Plus size={15}/> Lançamento
            </PrimaryButton>
          </div>
        }
      />

      {/* Seletor de conta */}
      {contas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <Building2 size={48} className="text-gray-300 mx-auto mb-3"/>
          <p className="text-gray-500 font-semibold">Nenhuma conta bancária cadastrada.</p>
          <p className="text-xs text-gray-400 mt-1">Clique em "Nova conta" para começar.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-3 flex-wrap">
            {contas.map(c => (
              <button key={c.id} onClick={() => setContaSel(c.id)}
                className={`flex items-start gap-3 p-4 rounded-xl border transition ${contaSel === c.id ? 'bg-bendito-verde text-white border-bendito-verde shadow-lg' : 'bg-white border-gray-200 hover:border-bendito-verde shadow-md'}`}>
                <Building2 size={20} className={contaSel === c.id ? 'text-white' : 'text-bendito-verde'}/>
                <div className="text-left">
                  <p className="font-bold text-sm">{c.nome}</p>
                  <p className={`text-xs ${contaSel === c.id ? 'text-white/80' : 'text-gray-500'}`}>{c.filiais?.nome} · {c.tipo}</p>
                  <p className={`text-base font-bold mt-1 ${contaSel === c.id ? 'text-white' : Number(c.saldo_atual) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatBRL(c.saldo_atual)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {contaAtual && (
            <>
              {/* KPIs da conta */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Saldo atual',    valor: contaAtual.saldo_atual, cor: Number(contaAtual.saldo_atual) >= 0 ? 'text-green-600' : 'text-red-600' },
                  { label: 'Entradas',        valor: totalEntradas,          cor: 'text-green-600' },
                  { label: 'Saídas',          valor: Math.abs(totalSaidas),  cor: 'text-red-600' },
                  { label: '⚠️ A conciliar', valor: naoConciliados,          cor: 'text-orange-600', noBRL: true },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-xl shadow-md p-4 text-center">
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className={`text-xl font-bold mt-1 ${c.cor}`}>
                      {c.noBRL ? c.valor : formatBRL(c.valor as number)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Extrato */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
                  <h2 className="font-bold text-bendito-verde-escuro">Extrato — {contaAtual.nome}</h2>
                  <button onClick={() => carregarExtrato(contaSel)} className="text-gray-400 hover:text-bendito-verde">
                    <RefreshCw size={14}/>
                  </button>
                </div>
                {extrato.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">Nenhum lançamento registrado.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>{['Data','Descrição','Valor','Conciliado','Ação'].map(h =>
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        )}</tr>
                      </thead>
                      <tbody className="divide-y">
                        {extrato.map(e => (
                          <tr key={e.id} className={`hover:bg-gray-50 ${e.conciliado ? 'opacity-60' : ''}`}>
                            <td className="px-4 py-3 text-gray-500">{formatData(e.data_lancamento)}</td>
                            <td className="px-4 py-3 text-bendito-verde-escuro">{e.descricao}</td>
                            <td className={`px-4 py-3 font-bold ${Number(e.valor) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {Number(e.valor) >= 0 ? '+' : ''}{formatBRL(e.valor)}
                            </td>
                            <td className="px-4 py-3">
                              {e.conciliado
                                ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ Conciliado</span>
                                : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">Pendente</span>
                              }
                            </td>
                            <td className="px-4 py-3">
                              {!e.conciliado && (
                                <button onClick={() => conciliar(e.id)} title="Marcar como conciliado"
                                  className="p-1.5 text-gray-400 hover:text-green-600 rounded"><Check size={14}/></button>
                              )}
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
        </>
      )}

      {/* Modal nova conta bancária */}
      <Modal isOpen={modalConta} onClose={() => setModalConta(false)} title="Nova Conta Bancária">
        <div className="space-y-4">
          <Field label="Nome da conta" required>
            <Input value={formConta.nome} onChange={e => setFormConta({...formConta, nome: e.target.value})} placeholder="Ex: Caixa Matriz, Conta Bradesco..."/>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select value={formConta.tipo} onChange={e => setFormConta({...formConta, tipo: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="corrente">Conta corrente</option>
                <option value="poupanca">Poupança</option>
                <option value="caixa">Caixa físico</option>
                <option value="outro">Outro</option>
              </select>
            </Field>
            <Field label="Unidade">
              <select value={formConta.filial_id} onChange={e => setFormConta({...formConta, filial_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="">Selecione...</option>
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Banco"><Input value={formConta.banco} onChange={e => setFormConta({...formConta, banco: e.target.value})} placeholder="Ex: Bradesco"/></Field>
            <Field label="Agência"><Input value={formConta.agencia} onChange={e => setFormConta({...formConta, agencia: e.target.value})} placeholder="0000"/></Field>
            <Field label="Conta"><Input value={formConta.conta} onChange={e => setFormConta({...formConta, conta: e.target.value})} placeholder="00000-0"/></Field>
          </div>
          <Field label="Saldo inicial (R$)">
            <Input type="number" step="0.01" value={formConta.saldo_inicial} onChange={e => setFormConta({...formConta, saldo_inicial: e.target.value})} placeholder="0,00"/>
          </Field>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalConta(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvarConta} disabled={salvando || !formConta.nome || !formConta.filial_id} className="flex-1">
              {salvando ? 'Salvando...' : 'Criar conta'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* Modal lançamento manual */}
      <Modal isOpen={modalLancamento} onClose={() => setModalLancamento(false)} title="Lançamento Manual">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            Conta: <strong>{contaAtual?.nome}</strong>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select value={formLanc.tipo} onChange={e => setFormLanc({...formLanc, tipo: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="credito">📈 Crédito (entrada)</option>
                <option value="debito">📉 Débito (saída)</option>
              </select>
            </Field>
            <Field label="Data">
              <Input type="date" value={formLanc.data_lancamento} onChange={e => setFormLanc({...formLanc, data_lancamento: e.target.value})}/>
            </Field>
          </div>
          <Field label="Descrição" required>
            <Input value={formLanc.descricao} onChange={e => setFormLanc({...formLanc, descricao: e.target.value})} placeholder="Descrição do lançamento"/>
          </Field>
          <Field label="Valor (R$)" required>
            <Input type="number" step="0.01" value={formLanc.valor} onChange={e => setFormLanc({...formLanc, valor: e.target.value})} placeholder="0,00"/>
          </Field>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalLancamento(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvarLancamento} disabled={salvando || !formLanc.descricao || !formLanc.valor} className="flex-1">
              {salvando ? 'Salvando...' : 'Lançar'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
