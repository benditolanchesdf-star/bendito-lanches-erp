'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData } from '@/lib/constants'
import { ContaReceberSchema, type ContaReceberInput } from '@/schemas'
import { PageHeader, Loading, EmptyState } from '@/components/ui'
import Modal from '@/components/Modal'
import Link from 'next/link'
import {
  Plus, Edit, Trash2, Check, Filter,
  ArrowLeft, AlertTriangle, RefreshCw,
} from 'lucide-react'

const STATUS_COR: Record<string,string> = {
  aberta:    'bg-yellow-100 text-yellow-700',
  recebida:  'bg-green-100 text-green-700',
  vencida:   'bg-red-100 text-red-700',
  cancelada: 'bg-gray-100 text-gray-500',
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
      <AlertTriangle size={10}/>{msg}
    </p>
  )
}

export default function ContasReceberPage() {
  const supabase = createClient()
  const [loading, setLoading]     = useState(true)
  const [contas, setContas]       = useState<any[]>([])
  const [clientes, setClientes]   = useState<any[]>([])
  const [filiais, setFiliais]     = useState<any[]>([])
  const [isAdmin, setIsAdmin]     = useState(false)
  const [filialAtual, setFilialAtual] = useState('todas')
  const [filtroStatus, setFiltroStatus] = useState('aberta')
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0,7))
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando]   = useState<any>(null)
  const [salvando, setSalvando]   = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ContaReceberInput>({
    resolver: zodResolver(ContaReceberSchema),
    defaultValues: {
      tipo:         'unica',
      categoria:    'venda',
      num_parcelas: 1,
      vencimento:   new Date().toISOString().split('T')[0],
    },
  })

  const tipoWatch        = watch('tipo')
  const numParcelasWatch = watch('num_parcelas')
  const valorTotalWatch  = watch('valor_total')

  async function load() {
    setLoading(true)
    await supabase.rpc('atualizar_status_vencidas')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile }  = await supabase.from('profiles').select('papel, filial_id').eq('id', user!.id).maybeSingle()
    const admin = ['admin','matriz'].includes(profile?.papel || '')
    setIsAdmin(admin)
    if (!admin && filialAtual === 'todas') setFilialAtual(profile?.filial_id || '')

    let query = supabase.from('contas_receber')
      .select('*, clientes(nome, nome_loja), filiais(nome)')
      .order('vencimento')
    if (filtroStatus !== 'todas') query = query.eq('status', filtroStatus)
    if (filtroMes) query = query.gte('vencimento', `${filtroMes}-01`).lte('vencimento', `${filtroMes}-31`)
    if (filialAtual && filialAtual !== 'todas') query = query.eq('filial_id', filialAtual)

    const [conts, clis, fils] = await Promise.all([
      query,
      supabase.from('clientes').select('id, nome, nome_loja').order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setContas(conts.data || [])
    setClientes(clis.data || [])
    setFiliais(fils.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filtroStatus, filtroMes, filialAtual])

  function abrirNovo() {
    setEditando(null)
    reset({
      filial_id:        filialAtual === 'todas' ? (filiais[0]?.id || '') : filialAtual,
      cliente_id:       undefined,
      descricao:        '',
      categoria:        'venda',
      tipo:             'unica',
      valor_total:      0,
      num_parcelas:     1,
      vencimento:       new Date().toISOString().split('T')[0],
      forma_recebimento: undefined,
      observacoes:      undefined,
    })
    setModalOpen(true)
  }

  function abrirEdicao(c: any) {
    setEditando(c)
    reset({
      filial_id:        c.filial_id,
      cliente_id:       c.cliente_id || undefined,
      descricao:        c.descricao,
      categoria:        c.categoria || 'venda',
      tipo:             c.tipo,
      valor_total:      Number(c.valor_total),
      num_parcelas:     c.num_parcelas,
      vencimento:       c.vencimento,
      forma_recebimento: c.forma_recebimento || undefined,
      observacoes:      c.observacoes || undefined,
    })
    setModalOpen(true)
  }

  async function onSubmit(data: ContaReceberInput) {
    setSalvando(true)
    const valorParcela = data.valor_total / (data.num_parcelas || 1)

    if (editando) {
      await supabase.from('contas_receber').update({
        ...data,
        valor_parcela: valorParcela,
        cliente_id:  data.cliente_id  || null,
        pedido_id:   data.pedido_id   || null,
        updated_at:  new Date().toISOString(),
      }).eq('id', editando.id)
    } else if (data.tipo === 'parcelada' && (data.num_parcelas || 1) > 1) {
      const { data: pai } = await supabase.from('contas_receber').insert({
        ...data,
        valor_parcela: valorParcela,
        parcela_atual: 1,
        cliente_id:  data.cliente_id || null,
        descricao:   `${data.descricao} (1/${data.num_parcelas})`,
      }).select('id').single()

      if (pai) {
        await supabase.from('contas_receber').insert(
          Array.from({ length: (data.num_parcelas || 1) - 1 }, (_, i) => {
            const dt = new Date(data.vencimento)
            dt.setMonth(dt.getMonth() + i + 1)
            return {
              filial_id:     data.filial_id,
              cliente_id:    data.cliente_id || null,
              descricao:     `${data.descricao} (${i+2}/${data.num_parcelas})`,
              categoria:     data.categoria,
              tipo:          'parcelada',
              valor_total:   data.valor_total,
              num_parcelas:  data.num_parcelas,
              parcela_atual: i + 2,
              valor_parcela: valorParcela,
              vencimento:    dt.toISOString().split('T')[0],
              conta_pai_id:  pai.id,
            }
          })
        )
      }
    } else {
      await supabase.from('contas_receber').insert({
        ...data,
        valor_parcela: data.valor_total,
        num_parcelas:  1,
        cliente_id:  data.cliente_id || null,
        pedido_id:   data.pedido_id  || null,
      })
    }

    setSalvando(false)
    setModalOpen(false)
    load()
  }

  async function marcarRecebida(c: any) {
    await supabase.from('contas_receber').update({
      status: 'recebida',
      data_recebimento: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }).eq('id', c.id)
    load()
  }

  async function excluir(c: any) {
    if (!confirm(`Excluir "${c.descricao}"?`)) return
    await supabase.from('contas_receber').delete().eq('id', c.id)
    load()
  }

  const total        = contas.reduce((s, c) => s + Number(c.valor_parcela||0), 0)
  const totalVencido = contas.filter(c => c.status === 'vencida').reduce((s, c) => s + Number(c.valor_parcela||0), 0)

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/financeiro"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-bendito-verde transition">
          <ArrowLeft size={16}/> Voltar
        </Link>
      </div>

      <PageHeader title="Contas a Receber"
        subtitle="Duplicatas, parcelas e recebimentos de clientes"
        action={
          <button onClick={abrirNovo}
            className="flex items-center gap-2 bg-bendito-verde hover:bg-bendito-verde-escuro text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
            <Plus size={16}/> Nova conta
          </button>
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
          <option value="recebida">Recebidas</option>
          <option value="cancelada">Canceladas</option>
        </select>
        {isAdmin && (
          <select value={filialAtual} onChange={e => setFilialAtual(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
            <option value="todas">Todas as unidades</option>
            {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
        <button onClick={load} className="ml-auto text-gray-400 hover:text-bendito-verde">
          <RefreshCw size={14}/>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md p-4 text-center">
          <p className="text-xs text-gray-500">Total do período</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatBRL(total)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center">
          <p className="text-xs text-gray-500">Contas</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">{contas.length}</p>
        </div>
        <div className="bg-red-50 rounded-xl shadow-md p-4 text-center border border-red-200">
          <p className="text-xs text-red-500">⚠️ Inadimplente</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatBRL(totalVencido)}</p>
        </div>
      </div>

      {/* Tabela */}
      {contas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-400">
          Nenhuma conta encontrada.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Descrição','Cliente','Unidade','Vencimento','Valor','Status','Ações'].map(h =>
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
                    <td className="px-4 py-3 text-gray-500">
                      {c.clientes?.nome_loja || c.clientes?.nome || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.filiais?.nome}</td>
                    <td className="px-4 py-3">
                      <span className={c.status === 'vencida' ? 'text-red-600 font-semibold flex items-center gap-1' : 'text-gray-700'}>
                        {c.status === 'vencida' && <AlertTriangle size={12}/>}
                        {formatData(c.vencimento)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-green-600">{formatBRL(c.valor_parcela)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COR[c.status]||'bg-gray-100'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {c.status !== 'recebida' && c.status !== 'cancelada' && (
                          <button onClick={() => marcarRecebida(c)} title="Marcar como recebida"
                            className="p-1.5 text-gray-400 hover:text-green-600 rounded">
                            <Check size={14}/>
                          </button>
                        )}
                        <button onClick={() => abrirEdicao(c)}
                          className="p-1.5 text-gray-400 hover:text-bendito-verde rounded">
                          <Edit size={14}/>
                        </button>
                        <button onClick={() => excluir(c)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal com validação Zod */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editando ? 'Editar conta' : 'Nova Conta a Receber'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

          {isAdmin && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Unidade</label>
              <select {...register('filial_id')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              <FieldError msg={errors.filial_id?.message}/>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Descrição <span className="text-red-500">*</span>
            </label>
            <input {...register('descricao')}
              placeholder="Ex: Pedido #123, Mensalidade cliente X..."
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado
                ${errors.descricao ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}/>
            <FieldError msg={errors.descricao?.message}/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Categoria</label>
              <select {...register('categoria')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {['venda','servico','aluguel','outros'].map(c =>
                  <option key={c} value={c}>{c}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo</label>
              <select {...register('tipo')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="unica">Parcela única</option>
                <option value="parcelada">Parcelada</option>
                <option value="recorrente">Recorrente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Cliente (opcional)</label>
            <select {...register('cliente_id')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
              <option value="">Sem cliente</option>
              {clientes.map(c =>
                <option key={c.id} value={c.id}>{c.nome_loja || c.nome}</option>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Valor total (R$) <span className="text-red-500">*</span>
              </label>
              <input type="number" step="0.01"
                {...register('valor_total', { valueAsNumber: true })}
                placeholder="0,00"
                className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado
                  ${errors.valor_total ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}/>
              <FieldError msg={errors.valor_total?.message}/>
            </div>
            {tipoWatch === 'parcelada' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nº de parcelas</label>
                <input type="number" min={2} max={60}
                  {...register('num_parcelas', { valueAsNumber: true })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado
                    ${errors.num_parcelas ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}/>
                <FieldError msg={errors.num_parcelas?.message}/>
              </div>
            )}
          </div>

          {tipoWatch === 'parcelada' && valorTotalWatch > 0 && (numParcelasWatch||1) > 1 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700">
              💡 {numParcelasWatch}x de {formatBRL(valorTotalWatch / numParcelasWatch)} · Parcelas geradas automaticamente.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Vencimento <span className="text-red-500">*</span>
              </label>
              <input type="date" {...register('vencimento')}
                className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado
                  ${errors.vencimento ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}/>
              <FieldError msg={errors.vencimento?.message}/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Forma de recebimento</label>
              <select {...register('forma_recebimento')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="">Não definido</option>
                {['boleto','pix','transferencia','dinheiro','cartao'].map(f =>
                  <option key={f} value={f}>{f}</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Observações</label>
            <textarea rows={2} {...register('observacoes')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado resize-none"/>
          </div>

          {/* Resumo de erros */}
          {Object.keys(errors).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">
              <p className="font-semibold mb-1 flex items-center gap-1">
                <AlertTriangle size={12}/> Corrija os erros antes de salvar:
              </p>
              <ul className="space-y-0.5 list-disc list-inside">
                {Object.entries(errors).map(([k, v]) => (
                  <li key={k}>{(v as any)?.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-lg text-sm font-semibold transition">
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              className="flex-1 bg-bendito-verde hover:bg-bendito-verde-escuro text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Lançar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
