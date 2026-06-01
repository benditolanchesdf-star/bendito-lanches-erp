/**
 * Calculadora de Precificação — Bendito Lanches ERP
 * Centraliza todas as fórmulas do módulo de precificação.
 */

export interface PricingFactors {
  costBase: number       // Custo de insumos ou valor de compra
  fixedCostRate: number  // Taxa de custo fixo (ex: 0.15 = 15%)
  packagingCost: number  // Custo da embalagem
  idealMarkup: number    // Markup ideal (ex: 1.00 = 100%)
  taxRate: number        // Impostos (ex: 0.06 = 6%)
  cardRate: number       // Taxa de cartão (ex: 0.025 = 2.5%)
  deliveryRate: number   // Taxa de delivery (ex: 0.12 = 12%)
  appliedPrice: number   // Preço praticado pelo usuário
}

export interface PricingResult {
  fixedCostAmount: number      // Custo fixo rateado
  totalCost: number            // Custo total (base + fixo + embalagem)
  priceWithMarkup: number      // Custo total × (1 + markup ideal)
  suggestedPrice: number       // Preço sugerido após dedução de taxas
  appliedMarkup: number        // Markup real com base no preço praticado
  contributionMargin: number   // Margem de contribuição unitária
  totalDeductionsRate: number  // Soma das taxas sobre faturamento
  status: 'Dentro da margem' | 'Ajustar'
}

export class PricingCalculator {
  static calculate(f: PricingFactors): PricingResult {
    const totalDeductionsRate = f.taxRate + f.cardRate + f.deliveryRate

    // 1. Custo fixo rateado proporcional ao custo base
    const fixedCostAmount = f.costBase * f.fixedCostRate

    // 2. Custo total do produto
    const totalCost = f.costBase + fixedCostAmount + f.packagingCost

    // 3. Preço com markup ideal aplicado
    const priceWithMarkup = totalCost * (1 + f.idealMarkup)

    // 4. Preço de venda sugerido (infla para cobrir taxas sobre faturamento)
    const suggestedPrice =
      totalDeductionsRate < 1 ? priceWithMarkup / (1 - totalDeductionsRate) : 0

    // 5. Markup aplicado retroativo (baseado no preço praticado)
    const netRevenue = f.appliedPrice * (1 - totalDeductionsRate)
    const appliedMarkup = totalCost > 0 ? netRevenue / totalCost - 1 : 0

    // 6. Margem de contribuição unitária
    const contributionMargin =
      f.appliedPrice - (totalCost + f.appliedPrice * totalDeductionsRate)

    return {
      fixedCostAmount,
      totalCost,
      priceWithMarkup,
      suggestedPrice,
      appliedMarkup,
      contributionMargin,
      totalDeductionsRate,
      status: appliedMarkup >= f.idealMarkup ? 'Dentro da margem' : 'Ajustar',
    }
  }

  /** Custo unitário do insumo com conversão de unidade */
  static inputUnitCost(
    purchasePrice: number,
    purchaseQuantity: number,
    purchaseUnit: string,
    recipeUnit: string,
  ): number {
    const base = purchasePrice / purchaseQuantity
    if (purchaseUnit === 'kg' && recipeUnit === 'g') return base / 1000
    if (purchaseUnit === 'l' && recipeUnit === 'ml') return base / 1000
    return base
  }

  /** Ponto de equilíbrio financeiro (faturamento mínimo) */
  static breakeven(totalFixedCosts: number, avgContribMargin: number, avgPrice: number): number {
    if (avgContribMargin <= 0 || avgPrice <= 0) return 0
    const mcRate = avgContribMargin / avgPrice
    return mcRate > 0 ? totalFixedCosts / mcRate : 0
  }

  /** Ponto de equilíbrio em unidades */
  static breakevenUnits(totalFixedCosts: number, avgContribMargin: number): number {
    return avgContribMargin > 0 ? totalFixedCosts / avgContribMargin : 0
  }
}
