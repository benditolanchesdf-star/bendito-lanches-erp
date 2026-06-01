'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL } from '@/lib/constants'
import { PricingCalculator } from '@/lib/pricing-calculator'
import { PageHeader, Loading, Field, Input, Select, PrimaryButton, SecondaryButton } from '@/components/ui'
import { Plus, Trash2, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'

export default function FichaTecnicaPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const prodId = params.id as string

  const [loading, setLoading] = useState(true)
  const [produto, setProduto] = useState<any>(null)
  const [insumos, setInsumos] = useState<any[]>([])
  const [itens, setItens] = useState<any[]>([])
  const [taxaCF, setTaxaCF] = useState(0)
  const [adicionando, setAdicionando] = useState(false)
  const [novoInsumo, setNovoInsumo] = useState('')
  const [novaQtd, setNovaQtd] = useState('')
  const [salvandoRendimento, setSalvandoRendimento] = useState(false)
  const [rendimento, setRendimento] = useState('1')

  async function load() {
    setLoading(true)
    const [sett, costs, prod, ins, its] = await Promise.all([
      supabase.from('pricing_settings').select('estimated_monthly_revenue').eq('filial_id', FILIAL_ID).maybeSingle(),
      supabase.from('pricing_fixed_costs').select('amount').eq('filial_id', FILIAL_ID).eq('status', 'active'),
      supabase.from('pricing_products').select('*').eq('id', prodId).single(),
      supabase.from('pricing_inputs').select('*').eq('filial_id', FILIAL_ID).eq('status', 'active').order('name'),
      supabase.from('pricing_product_inputs').select('*, pricing_inputs(*)').eq('product_id', prodId),
    ])
    const rev = Number(sett.data?.estimated_monthly_revenue || 0)
    const totalCF = (costs.data || []).reduce((s: number, c: any) => s + Number(c.amount || 0), 0)
    setTaxaCF(rev > 0 ? totalCF / rev : 0)
    setProduto(prod.data)
    setRendimento(String(prod.data?.yield || 1))
    setInsumos(ins.data || [])
    setItens(its.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [prodId])

  async function adicionarItem() {
    if (!novoInsumo || !novaQtd) return
    setAdicionando(true)
    await supabase.from('pricing_product_inputs').insert({ product_id: prodId, input_id: novoInsumo, required_quantity: Number(novaQtd) })
    setNovoInsumo(''); setNovaQtd('')
    setAdicionando(false); load()
  }

  async function removerItem(id: string) {
    await supabase.from('pricing_product_inputs').delete().eq('id', id)
    load()
  }

  async function salvarRendimento() {
    setSalvandoRendimento(true)
    await supabase.from('pricing_products').update({ yield: Number(rendimento) || 1 }).eq('id', prodId)
    setSalvandoRendimento(false); load()
  }

  if (loading) return <Loading />
  if (!produto) return <div className="p-8 text-center text-gray-500">Produto não encontrado.</div>

  // Cálculos da ficha
  const totalReceita = itens.reduce((s, item) => {
    const inp = item.pricing_inputs
    if (!inp) return s
    const uc = PricingCalculator.inputUnitCost(Number(inp.purchase_price), Number(inp.purchase_quantity), inp.purchase_unit, inp.recipe_unit)
    return s + uc * Number(item.required_quantity || 0)
  }, 0)
  const rend = Math.max(Number(rendimento), 1)
  const custoPorPorcao = totalReceita / rend
  const result = PricingCalculator.calculate({
    costBase: custoPorPorcao,
    fixedCostRate: taxaCF,
    packagingCost: Number(produto.packaging_cost || 0),
    idealMarkup: Number(produto.ideal_markup || 1),
    taxRate: Number(produto.tax_rate || 0),
    cardRate: Number(produto.card_rate || 0),
    deliveryRate: Number(produto.delivery_rate || 0),
    appliedPrice: Number(produto.applied_price || 0),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 text-gray-500 hover:text-bendito-verde rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <PageHeader title={produto.name} subtitle="Ficha técnica — composição e cálculo de custo unitário" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rendimento */}
        <div className="bg-white rounded-xl shadow-md p-5">
          <h2 className="font-bold text-bendito-verde-escuro mb-3">Rendimento da Ficha</h2>
          <div className="flex gap-3 items-end">
            <Field label="Quantas porções/unidades a receita rende?">
              <Input type="number" step="0.01" value={rendimento} onChange={e => setRendimento(e.target.value)} />
            </Field>
            <PrimaryButton onClick={salvarRendimento} disabled={salvandoRendimento} className="mb-0.5">
              {salvandoRendimento ? 'Salvando...' : 'Salvar'}
            </PrimaryButton>
          </div>
        </div>

        {/* Resumo financeiro */}
        <div className="bg-white rounded-xl shadow-md p-5">
          <h2 className="font-bold text-bendito-verde-escuro mb-3">Resumo de Precificação</h2>
          <div className="space-y-1.5 text-sm">
            {[
              { label: 'Custo total da receita',    value: formatBRL(totalReceita) },
              { label: `Custo por porção (÷${rend})`, value: formatBRL(custoPorPorcao), bold: true },
              { label: 'Custo fixo rateado',         value: formatBRL(result.fixedCostAmount) },
              { label: 'Embalagem',                  value: formatBRL(produto.packaging_cost) },
              { label: 'Custo total unitário',       value: formatBRL(result.totalCost), bold: true },
              { label: 'Preço c/ markup ideal',      value: formatBRL(result.priceWithMarkup) },
              { label: 'Preço sugerido',             value: formatBRL(result.suggestedPrice), blue: true },
              { label: 'Preço praticado',            value: formatBRL(produto.applied_price), bold: true },
              { label: 'Markup aplicado',            value: `${(result.appliedMarkup * 100).toFixed(1)}%` },
              { label: 'Margem de contribuição',     value: formatBRL(result.contributionMargin), bold: true },
            ].map(({ label, value, bold, blue }) => (
              <div key={label} className="flex justify-between">
                <span className="text-gray-500">{label}</span>
                <span className={`font-${bold ? 'bold' : 'medium'} ${blue ? 'text-blue-600' : 'text-gray-800'}`}>{value}</span>
              </div>
            ))}
            <div className="pt-2 flex items-center gap-2">
              {result.status === 'Dentro da margem'
                ? <span className="flex items-center gap-1 text-sm font-semibold text-green-600"><CheckCircle size={16} /> Dentro da margem</span>
                : <span className="flex items-center gap-1 text-sm font-semibold text-red-600"><AlertTriangle size={16} /> Ajustar preço</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Ingredientes */}
      <div className="bg-white rounded-xl shadow-md p-5">
        <h2 className="font-bold text-bendito-verde-escuro mb-4">Ingredientes / Insumos</h2>

        {/* Adicionar */}
        <div className="flex gap-3 items-end mb-4 flex-wrap">
          <div className="flex-1 min-w-[180px]">
          <Field label="Insumo">
            <Select value={novoInsumo} onChange={e => setNovoInsumo(e.target.value)}>
              <option value="">Selecione um insumo...</option>
              {insumos.map(i => <option key={i.id} value={i.id}>{i.name} ({i.recipe_unit})</option>)}
            </Select>
          </Field>
          </div>
          <Field label="Quantidade">
            <Input type="number" step="0.001" value={novaQtd} onChange={e => setNovaQtd(e.target.value)} placeholder="Ex: 150" className="w-32" />
          </Field>
          <PrimaryButton onClick={adicionarItem} disabled={adicionando || !novoInsumo || !novaQtd} className="flex items-center gap-2 mb-0.5">
            <Plus size={15} /> Adicionar
          </PrimaryButton>
        </div>

        {itens.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Nenhum ingrediente adicionado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>{['Insumo', 'Qtd', 'Un.', 'Custo unit.', 'Custo total', ''].map(h => (
                <th key={h} className="text-left pb-2 text-xs text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y">
              {itens.map(item => {
                const inp = item.pricing_inputs
                if (!inp) return null
                const uc = PricingCalculator.inputUnitCost(Number(inp.purchase_price), Number(inp.purchase_quantity), inp.purchase_unit, inp.recipe_unit)
                const total = uc * Number(item.required_quantity || 0)
                return (
                  <tr key={item.id}>
                    <td className="py-2 font-medium">{inp.name}</td>
                    <td className="py-2">{item.required_quantity}</td>
                    <td className="py-2 text-gray-400">{inp.recipe_unit}</td>
                    <td className="py-2">{formatBRL(uc)}</td>
                    <td className="py-2 font-semibold text-bendito-verde">{formatBRL(total)}</td>
                    <td className="py-2"><button onClick={() => removerItem(item.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                  </tr>
                )
              })}
              <tr className="border-t font-bold">
                <td colSpan={4} className="pt-2 text-right text-gray-600">Total da receita:</td>
                <td className="pt-2 text-bendito-verde">{formatBRL(totalReceita)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
