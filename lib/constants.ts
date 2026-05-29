// Filial matriz (operação única). Mantido como constante para todos os
// inserts já nascerem vinculados à filial — preparado para multi-filial futuro.
export const FILIAL_ID = '11111111-1111-1111-1111-111111111111'

export const CANAIS = [
  { value: 'balcao', label: 'Balcão' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'ifood', label: 'iFood' },
  { value: 'atacado', label: 'Atacado' },
  { value: 'representante', label: 'Representante' },
] as const

export const STATUS_PEDIDO = [
  { value: 'rascunho', label: 'Rascunho', cor: 'bg-gray-100 text-gray-700' },
  { value: 'pendente', label: 'Pendente', cor: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmado', label: 'Confirmado', cor: 'bg-blue-100 text-blue-800' },
  { value: 'producao', label: 'Em Produção', cor: 'bg-purple-100 text-purple-800' },
  { value: 'pronto', label: 'Pronto', cor: 'bg-teal-100 text-teal-800' },
  { value: 'saiu_entrega', label: 'Saiu p/ Entrega', cor: 'bg-orange-100 text-orange-800' },
  { value: 'entregue', label: 'Entregue', cor: 'bg-green-100 text-green-800' },
  { value: 'cancelado', label: 'Cancelado', cor: 'bg-red-100 text-red-800' },
] as const

export const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'credito', label: 'Cartão Crédito' },
  { value: 'debito', label: 'Cartão Débito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'a_prazo', label: 'A Prazo' },
] as const

export const TIPO_CLIENTE = [
  { value: 'varejo', label: 'Varejo' },
  { value: 'atacado', label: 'Atacado' },
  { value: 'ambos', label: 'Ambos' },
] as const

export const STATUS_PRODUCAO = [
  { value: 'planejada', label: 'Planejada', cor: 'bg-blue-100 text-blue-800' },
  { value: 'em_andamento', label: 'Em Andamento', cor: 'bg-purple-100 text-purple-800' },
  { value: 'concluida', label: 'Concluída', cor: 'bg-green-100 text-green-800' },
  { value: 'cancelada', label: 'Cancelada', cor: 'bg-red-100 text-red-800' },
] as const

export const STATUS_FINANCEIRO = [
  { value: 'pendente', label: 'Pendente', cor: 'bg-yellow-100 text-yellow-800' },
  { value: 'pago', label: 'Pago', cor: 'bg-green-100 text-green-800' },
  { value: 'atrasado', label: 'Atrasado', cor: 'bg-red-100 text-red-800' },
  { value: 'cancelado', label: 'Cancelado', cor: 'bg-gray-100 text-gray-700' },
] as const

export function formatBRL(valor: number | string | null | undefined): string {
  const n = Number(valor) || 0
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatData(data: string | null | undefined): string {
  if (!data) return '-'
  return new Date(data).toLocaleDateString('pt-BR')
}
