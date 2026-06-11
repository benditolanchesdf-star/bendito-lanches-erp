'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, PackagePlus, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader, Loading, PrimaryButton, SecondaryButton, Field, Input } from '@/components/ui'
import { FILIAL_ID } from '@/lib/constants'

// ─── tipos ────────────────────────────────────────────────────
interface Insumo {
  id: string
  name: string
  recipe_unit: string
  purchase_unit: string
  saldo_atual: number
}

interface LinhaEntrada {
  input_id: string
  nome: string
  recipe_unit: string
  quantidade: string
  observacao: string
}

// ─── componente ───────────────────────────────────────────────
export default function EntradaEstoquePage() {
  const router = useRouter()
  const supabase = createClient()

  const [insumos, setInsumos]     = useState<Insumo[]>([])
  const [loading, setLoading]     = useState(true)
  const [salvando, setSalvando]   = useState(false)
  const [sucesso, setSucesso]     = useState(false)
  const [erro, setErro]           = useState('')

  // linhas do lançamento
  const [linhas, setLinhas] = useState<LinhaEntrada[]>([{
    input_id: '', nome: '', recipe_unit: '', quantidade: '', observacao: '',
  }])

  // observação geral
  const [obsGeral, setObsGeral] = useState('')

  // ─── carregar insumos com saldo atual ──────────────────────
  useEffect(() => {
    async function carregar() {
      const { data: inputs } = await supabase
        .from('pricing_inputs')
        .select('id, name, recipe_unit, purchase_unit')
        .eq('filial_id', FILIAL_ID)
        .eq('status', 'active')
        .order('name')

      const { data: estoques } = await supabase
        .from('estoque_insumos')
        .select('input_id, saldo')
        .eq('filial_id', FILIAL_ID)

      const saldoMap: Record<string, number> = {}
      for (const e of estoques ?? []) saldoMap[e.input_id] = e.saldo

      setInsumos((inputs ?? []).map(i => ({
        ...i,
        saldo_atual: saldoMap[i.id] ?? 0,
      })))
      setLoading(false)
    }
    carregar()
  }, [])

  // ─── adicionar linha ──────────────────────────────────────
  function adicionarLinha() {
    setLinhas(l => [...l, { input_id: '', nome: '', recipe_unit: '', quantidade: '', observacao: '' }])
  }

  // ─── remover linha ────────────────────────────────────────
  function removerLinha(idx: number) {
    setLinhas(l => l.filter((_, i) => i !== idx))
  }

  // ─── atualizar campo de linha ─────────────────────────────
  function atualizarLinha(idx: number, campo: keyof LinhaEntrada, valor: string) {
    setLinhas(l => l.map((linha, i) => {
      if (i !== idx) return linha
      if (campo === 'input_id') {
        const insumo = insumos.find(ins => ins.id === valor)
        return {
          ...linha,
          input_id:   valor,
          nome:       insumo?.name ?? '',
          recipe_unit: insumo?.recipe_unit ?? '',
        }
      }
      return { ...linha, [campo]: valor }
    }))
  }

  // ─── validar ──────────────────────────────────────────────
  function validar(): string | null {
    if (linhas.length === 0) return 'Adicione ao menos um insumo.'
    let erroLinha: string | null = null
    linhas.forEach((l, i) => {
      if (erroLinha) return
      if (!l.input_id) { erroLinha = `Linha ${i + 1}: selecione um insumo.`; return }
      const qtd = parseFloat(l.quantidade)
      if (isNaN(qtd) || qtd <= 0) { erroLinha = `Linha ${i + 1}: quantidade inválida.`; return }
    })
    if (erroLinha) return erroLinha
    const ids = linhas.map(l => l.input_id)
    if (new Set(ids).size !== ids.length) return 'Insumo duplicado — use uma linha por insumo.'
    return null
  }

  // ─── salvar ───────────────────────────────────────────────
  async function salvar() {
    setErro('')
    const erroValidacao = validar()
    if (erroValidacao) { setErro(erroValidacao); return }

    setSalvando(true)
    const { data: { user } } = await supabase.auth.getUser()

    for (const linha of linhas) {
      const qtd = parseFloat(linha.quantidade)

      // upsert no estoque_insumos
      const { data: atual } = await supabase
        .from('estoque_insumos')
        .select('saldo')
        .eq('filial_id', FILIAL_ID)
        .eq('input_id', linha.input_id)
        .single()

      const saldo_antes  = atual?.saldo ?? 0
      const saldo_depois = saldo_antes + qtd

      await supabase
        .from('estoque_insumos')
        .upsert({
          filial_id: FILIAL_ID,
          input_id:  linha.input_id,
          saldo:     saldo_depois,
          unidade:   linha.recipe_unit,
        }, { onConflict: 'filial_id,input_id' })

      // registrar movimentação
      await supabase
        .from('estoque_movimentacoes')
        .insert({
          filial_id:    FILIAL_ID,
          input_id:     linha.input_id,
          tipo:         'entrada',
          quantidade:   qtd,
          saldo_antes,
          saldo_depois,
          origem:       'entrada_manual',
          observacao:   [linha.observacao, obsGeral].filter(Boolean).join(' | ') || null,
          criado_por:   user?.id ?? null,
        })
    }

    setSalvando(false)
    setSucesso(true)
  }

  // ─── render ───────────────────────────────────────────────
  if (loading) return <Loading />

  if (sucesso) return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-green-200 shadow-sm p-10 text-center">
        <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-bendito-verde-escuro mb-2">Entrada registrada!</h2>
        <p className="text-sm text-gray-500 mb-6">
          {linhas.length} insumo{linhas.length > 1 ? 's' : ''} adicionado{linhas.length > 1 ? 's' : ''} ao estoque.
        </p>
        <div className="flex gap-3 justify-center">
          <SecondaryButton onClick={() => {
            setLinhas([{ input_id: '', nome: '', recipe_unit: '', quantidade: '', observacao: '' }])
            setObsGeral('')
            setSucesso(false)
          }}>
            Nova entrada
          </SecondaryButton>
          <PrimaryButton onClick={() => router.push('/dashboard/estoque')}>
            Ver estoque
          </PrimaryButton>
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.back()}
          className="mt-1 p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"
        >
          <ArrowLeft size={18} />
        </button>
        <PageHeader
          title="Entrada de Estoque"
          subtitle="Registre a entrada de insumos no almoxarifado"
        />
      </div>

      {/* Linhas de insumos */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-bendito-verde-escuro">Insumos</h3>
          <button
            onClick={adicionarLinha}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-bendito-dourado text-bendito-dourado-escuro hover:bg-bendito-creme transition"
          >
            <Plus size={13} /> Adicionar linha
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {linhas.map((linha, idx) => {
            const insumo = insumos.find(i => i.id === linha.input_id)
            return (
              <div key={idx} className="px-5 py-4">
                <div className="grid grid-cols-12 gap-3 items-end">

                  {/* Insumo — col 5 */}
                  <div className="col-span-12 sm:col-span-5">
                    <Field label={`Insumo ${linhas.length > 1 ? idx + 1 : ''}`}>
                      <select
                        value={linha.input_id}
                        onChange={e => atualizarLinha(idx, 'input_id', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bendito-dourado text-gray-700"
                      >
                        <option value="">— Selecione —</option>
                        {insumos.map(i => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                    </Field>
                    {insumo && (
                      <p className="text-xs text-gray-400 mt-1">
                        Saldo atual: <span className="font-medium text-gray-600">
                          {insumo.saldo_atual} {insumo.recipe_unit}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Quantidade — col 3 */}
                  <div className="col-span-6 sm:col-span-3">
                    <Field label={`Qtd (${linha.recipe_unit || '—'})`}>
                      <Input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={linha.quantidade}
                        onChange={e => atualizarLinha(idx, 'quantidade', e.target.value)}
                        placeholder="0"
                      />
                    </Field>
                    {insumo && linha.quantidade && !isNaN(parseFloat(linha.quantidade)) && (
                      <p className="text-xs text-green-600 mt-1">
                        Novo saldo: {(insumo.saldo_atual + parseFloat(linha.quantidade)).toFixed(3)} {insumo.recipe_unit}
                      </p>
                    )}
                  </div>

                  {/* Observação — col 3 */}
                  <div className="col-span-5 sm:col-span-3">
                    <Field label="Obs. (opcional)">
                      <Input
                        value={linha.observacao}
                        onChange={e => atualizarLinha(idx, 'observacao', e.target.value)}
                        placeholder="Lote, validade…"
                      />
                    </Field>
                  </div>

                  {/* Remover — col 1 */}
                  <div className="col-span-1 flex justify-end pb-1">
                    {linhas.length > 1 && (
                      <button
                        onClick={() => removerLinha(idx)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                </div>
              </div>
            )
          })}
        </div>

        {/* Observação geral */}
        <div className="px-5 py-4 border-t border-gray-50 bg-gray-50">
          <Field label="Observação geral (opcional)">
            <Input
              value={obsGeral}
              onChange={e => setObsGeral(e.target.value)}
              placeholder="Ex: compra do dia, fornecedor X, NF 001234…"
            />
          </Field>
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle size={15} /> {erro}
        </div>
      )}

      {/* Resumo + ação */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm text-gray-500">
          <span className="font-medium text-bendito-verde-escuro">{linhas.filter(l => l.input_id).length}</span>
          {' '}de{' '}
          <span className="font-medium">{linhas.length}</span>
          {' '}linha{linhas.length > 1 ? 's' : ''} preenchida{linhas.length > 1 ? 's' : ''}
        </div>
        <div className="flex gap-3">
          <SecondaryButton onClick={() => router.back()}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton
            onClick={salvar}
            disabled={salvando || linhas.every(l => !l.input_id)}
          >
            <PackagePlus size={15} className="mr-1" />
            {salvando ? 'Registrando…' : 'Registrar entrada'}
          </PrimaryButton>
        </div>
      </div>

    </div>
  )
}
