'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, Textarea, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import Link from 'next/link'
import { Plus, Edit, Trash2, Check, Filter, ArrowLeft, AlertTriangle, RefreshCw } from 'lucide-react'

const CATEGORIAS = ['aluguel','folha','fornecedor','impostos','utilities','manutencao','marketing','outros']
const STATUS_COR: Record<string,string> = {
  aberta:    'bg-yellow-100 text-yellow-700',
  paga:      'bg-green-100 text-green-700',
  vencida:   'bg-red-100 text-red-700',
  cancelada: 'bg-gray-100 text-gray-500',
}

export default function ContasPagarPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [contas, setContas] = useState<any[]>([])
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [filialAtual, setFilialAtual] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('aberta')
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0,7))
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({
    filial_id:'', fornecedor_id:'', descricao:'', categoria:'outros',
    tipo:'unica', valor_total:'', num_parcelas:1, vencimento:'',
    forma_pagamento:'', observacoes:'', recorrencia_dia:'',
  })

  async function load() {
    setLoading(true)
    await supabase.rpc('atualizar_status_vencidas')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('papel, filial_id').eq('id', user!.id).maybeSingle()
    const admin = ['admin','matriz'].includes(profile?.papel || '')
    setIsAdmin(admin)
    const fid = profile?.filial_id || ''
    if (!filialAtual) setFilialAtual(admin ? 'todas' : fid)

    let query = supabase.from('contas_pagar')
      .select('*, fornecedores(nome), filiais(nome)')
      .order('vencimento')

    if (filtroStatus !== 'todas') query = query.eq('status', filtroStatus)
    if (filtroMes) {
      query = query.gte('vencimento', `${filtroMes}-01`).lte('vencimento', `${filtroMes}-31`)
    }
    if (filialAtual && filialAtual !== 'todas') query = query.eq('filial_id', filialAtual)

    const [conts, forns, fils] = await Promise.all([
      query,
      supabase.from('fornecedores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setContas(conts.data || [])
    setFornecedores(forns.data || [])
    setFiliais(fils.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filtroStatus, filtroMes, filialAtual])

  function abrirNovo() {
    setEditando(null)
    setForm({
      filial_id: filialAtual === 'todas' ? (filiais[0]?.id||'') : filialAtual,
      fornecedor_id:'', descricao:'', categoria:'outros',
      tipo:'unica', valor_total:'', num_parcelas:1,
      vencimento: new Date().toISOString().split('T')[0],
      forma_pagamento:'', observacoes:'', recorrencia_dia:'',
    })
    setModalOpen(true)
  }

  function abrirEdicao(c: any) {
    setEditando(c)
    setForm({
      filial_id: c.filial_id, fornecedor_id: c.fornecedor_id||'',
      descricao: c.descricao, categoria: c.categoria||'outros',
      tipo: c.tipo, valor_total: String(c.valor_total),
      num_parcelas: c.num_parcelas, vencimento: c.vencimento,
      forma_pagamento: c.forma_pagamento||'', observacoes: c.observacoes||'',
      recorrencia_dia: c.recorrencia_dia||'',
    })
    setModalOpen(true)
  }

  async function salvar() {
    if (!form.descricao || !form.valor_total || !form.vencimento) return
    setSalvando(true)
    const valorTotal = Number(form.valor_total)
    const numParcelas = form.tipo === 'parcelada' ? Number(form.num_parcelas) : 1
    const valorParcela = valorTotal / numParcelas

    if (editando) {
      await supabase.from('contas_pagar').update({
        ...form, valor_total: valorTotal,
        num_parcelas: numParcelas, valor_parcela: valorParcela,
        fornecedor_id: form.fornecedor_id || null,
        recorrencia_dia: form.recorrencia_dia ? Number(form.recorrencia_dia) : null,
        updated_at: new Date().toISOString(),
      }).eq('id', editando.id)
    } else {
      // Criar parcelas se parcelado
      if (form.tipo === 'parcelada' && numParcelas > 1) {
        const { data: pai } = await supabase.from('contas_pagar').insert({
          ...form, valor_total: valorTotal, num_parcelas: numParcelas,
          valor_parcela: valorParcela, parcela_atual: 1,
          fornecedor_id: form.fornecedor_id || null,
        }).select('id').single()

        if (pai) {
          const parcelas = Array.from({length: numParcelas - 1}, (_, i) => {
            const dt = new Date(form.vencimento)
            dt.setMonth(dt.getMonth() + i + 1)
            return {
              filial_id: form.filial_id,
              fornecedor_id: form.fornecedor_id || null,
              descricao: `${form.descricao} (${i+2}/${numParcelas})`,
              categoria: form.categoria,
              tipo: 'parcelada',
              valor_total: valorTotal,
              num_parcelas: numParcelas,
              parcela_atual: i + 2,
              valor_parcela: valorParcela,
              vencimento: dt.toISOString().split('T')[0],
              conta_pai_id: pai.id,
            }
          })
          await supabase.from('contas_pagar').insert(parcelas)
          // Atualizar descrição da primeira
          await supabase.from('contas_pagar').update({
            descricao: `${form.descricao} (1/${numParcelas})`,
          }).eq('id', pai.id)
        }
      } else {
        await supabase.from('contas_pagar').insert({
          ...form, valor_total: valorTotal,
          num_parcelas: 1, valor_parcela: valorTotal,
          fornecedor_id: form.fornecedor_id || null,
          recorrencia_dia: form.tipo === 'recorrente' ? Number(form.recorrencia_dia)||null : null,
        })
      }
    }
    setSalvando(false); setModalOpen(false); load()
  }

  async function marcarPaga(c: any) {
    await supabase.from('contas_pagar').update({
      status: 'paga',
      data_pagamento: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }).eq('id', c.id)
    load()
  }

  async function excluir(c: any) {
    if (!confirm(`Excluir "${c.descricao}"?`)) return
    await supabase.from('contas_pagar').delete().eq('id', c.id)
    load()
  }

  const total = contas.reduce((s, c) => s + Number(c.valor_parcela||0), 0)
  const totalVencido = contas.filter(c => c.status === 'vencida').reduce((s, c) => s + Number(c.valor_parcela||0), 0)

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/financeiro" className="flex items-center gap-1 text-sm text-gray-500 hover:text-bendito-verde transition">
          <ArrowLeft size={16}/> Voltar
        </Link>
      </div>

      <PageHeader title="Contas a Pagar" subtitle="Gerencie fornecedores, parcelas e recorrências"
        action={
          <PrimaryButton onClick={abrirNovo} className="flex items-center gap-2">
            <Plus size={16}/> Nova conta
          </PrimaryButton>
        }
      />

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-center">
        <Filter size={16} className="text-gray-400"/>
        <input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"/>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
          <option value="todas">Todos os status</option>
          <option value="aberta">Em aberto</option>
          <option value="vencida">Vencidas</option>
          <option value="paga">Pagas</option>
          <option value="cancelada">Canceladas</option>
        </select>
        {isAdmin && (
          <select value={filialAtual} onChange={e => setFilialAtual(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
            <option value="todas">Todas as unidades</option>
            {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
        <button onClick={load} className="flex items-center gap-1 text-gray-400 hover:text-bendito-verde ml-auto">
          <RefreshCw size={14}/>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md p-4 text-center">
          <p className="text-xs text-gray-500">Total do período</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">{formatBRL(total)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center">
          <p className="text-xs text-gray-500">Contas</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">{contas.length}</p>
        </div>
        <div className="bg-red-50 rounded-xl shadow-md p-4 text-center border border-red-200">
          <p className="text-xs text-red-500">⚠️ Vencido</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatBRL(totalVencido)}</p>
        </div>
      </div>

      {contas.length === 0 ? <EmptyState message="Nenhuma conta encontrada no período." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Descrição','Fornecedor','Unidade','Vencimento','Valor','Status','Ações'].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y">
                {contas.map(c => (
                  <tr key={c.id} className={`hover:bg-gray-50 ${c.status === 'vencida' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-bendito-verde-escuro">{c.descricao}</p>
                      <p className="text-xs text-gray-400">{c.categoria} · {c.tipo}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.fornecedores?.nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.filiais?.nome}</td>
                    <td className="px-4 py-3">
                      <span className={c.status === 'vencida' ? 'text-red-600 font-semibold flex items-center gap-1' : 'text-gray-700'}>
                        {c.status === 'vencida' && <AlertTriangle size={12}/>}
                        {formatData(c.vencimento)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-red-600">{formatBRL(c.valor_parcela)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COR[c.status]||'bg-gray-100'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {c.status !== 'paga' && c.status !== 'cancelada' && (
                          <button onClick={() => marcarPaga(c)} title="Marcar como paga"
                            className="p-1.5 text-gray-400 hover:text-green-600 rounded"><Check size={14}/></button>
                        )}
                        <button onClick={() => abrirEdicao(c)} className="p-1.5 text-gray-400 hover:text-bendito-verde rounded"><Edit size={14}/></button>
                        <button onClick={() => excluir(c)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar conta' : 'Nova Conta a Pagar'}>
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {isAdmin && (
            <Field label="Unidade">
              <select value={form.filial_id} onChange={e => setForm({...form, filial_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </Field>
          )}
          <Field label="Descrição" required>
            <Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Ex: Aluguel novembro, NF fornecedor X..."/>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Tipo">
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="unica">Parcela única</option>
                <option value="parcelada">Parcelada</option>
                <option value="recorrente">Recorrente mensal</option>
              </select>
            </Field>
          </div>
          <Field label="Fornecedor (opcional)">
            <select value={form.fornecedor_id} onChange={e => setForm({...form, fornecedor_id: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
              <option value="">Sem fornecedor</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor total (R$)" required>
              <Input type="number" step="0.01" value={form.valor_total} onChange={e => setForm({...form, valor_total: e.target.value})} placeholder="0,00"/>
            </Field>
            {form.tipo === 'parcelada' && (
              <Field label="Nº de parcelas">
                <Input type="number" min={2} max={60} value={form.num_parcelas} onChange={e => setForm({...form, num_parcelas: e.target.value})}/>
              </Field>
            )}
            {form.tipo === 'recorrente' && (
              <Field label="Dia do mês">
                <Input type="number" min={1} max={31} value={form.recorrencia_dia} onChange={e => setForm({...form, recorrencia_dia: e.target.value})} placeholder="Ex: 5"/>
              </Field>
            )}
          </div>
          {form.tipo === 'parcelada' && form.valor_total && Number(form.num_parcelas) > 1 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              💡 {form.num_parcelas}x de {formatBRL(Number(form.valor_total) / Number(form.num_parcelas))} · As parcelas serão criadas automaticamente com vencimento mensal.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={form.tipo === 'parcelada' ? '1º Vencimento' : 'Vencimento'} required>
              <Input type="date" value={form.vencimento} onChange={e => setForm({...form, vencimento: e.target.value})}/>
            </Field>
            <Field label="Forma de pagamento">
              <select value={form.forma_pagamento} onChange={e => setForm({...form, forma_pagamento: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="">Não definido</option>
                {['boleto','pix','transferencia','cheque','dinheiro','cartao'].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Observações">
            <Textarea rows={2} value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})}/>
          </Field>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.descricao || !form.valor_total || !form.vencimento} className="flex-1">
              {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Lançar'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
