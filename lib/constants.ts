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

// 11 status: rascunho, pendente, em_analise, confirmado, producao, separado,
// pronto, saiu_entrega, entregue, baixado, cancelado
export const STATUS_PEDIDO = [
  { value: 'rascunho',     label: 'Rascunho',         cor: 'bg-gray-100 text-gray-700' },
  { value: 'pendente',     label: 'Pedido Recebido',  cor: 'bg-yellow-100 text-yellow-800' },
  { value: 'em_analise',   label: 'Em Análise',       cor: 'bg-amber-100 text-amber-800' },
  { value: 'confirmado',   label: 'Confirmado',       cor: 'bg-blue-100 text-blue-800' },
  { value: 'producao',     label: 'Em Produção',      cor: 'bg-purple-100 text-purple-800' },
  { value: 'separado',     label: 'Separado',         cor: 'bg-indigo-100 text-indigo-800' },
  { value: 'pronto',       label: 'Pronto',           cor: 'bg-teal-100 text-teal-800' },
  { value: 'saiu_entrega', label: 'Saiu p/ Entrega',  cor: 'bg-orange-100 text-orange-800' },
  { value: 'entregue',     label: 'Entregue',         cor: 'bg-green-100 text-green-800' },
  { value: 'baixado',      label: 'Baixado',          cor: 'bg-emerald-100 text-emerald-800' },
  { value: 'cancelado',    label: 'Cancelado',        cor: 'bg-red-100 text-red-800' },
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
  { value: 'planejada',    label: 'Planejada',    cor: 'bg-blue-100 text-blue-800' },
  { value: 'em_andamento', label: 'Em Andamento', cor: 'bg-purple-100 text-purple-800' },
  { value: 'concluida',    label: 'Concluída',    cor: 'bg-green-100 text-green-800' },
  { value: 'cancelada',    label: 'Cancelada',    cor: 'bg-red-100 text-red-800' },
] as const

export const STATUS_FINANCEIRO_TRANSACAO = [
  { value: 'pendente',  label: 'Pendente',  cor: 'bg-yellow-100 text-yellow-800' },
  { value: 'pago',      label: 'Pago',      cor: 'bg-green-100 text-green-800' },
  { value: 'atrasado',  label: 'Atrasado',  cor: 'bg-red-100 text-red-800' },
  { value: 'cancelado', label: 'Cancelado', cor: 'bg-gray-100 text-gray-700' },
] as const
// Alias mantido por compatibilidade
export const STATUS_FINANCEIRO = STATUS_FINANCEIRO_TRANSACAO

export const STATUS_FIN_CLIENTE = [
  { value: 'regular',          label: 'Regular',          cor: 'bg-green-100 text-green-800' },
  { value: 'atencao',          label: 'Atenção',          cor: 'bg-yellow-100 text-yellow-800' },
  { value: 'bloqueado',        label: 'Bloqueado',        cor: 'bg-red-100 text-red-800' },
  { value: 'liberado_manual',  label: 'Liberado Manual',  cor: 'bg-blue-100 text-blue-800' },
] as const

export const ALERTAS_CLIENTE = [
  { value: 'comprou_hoje',  label: 'Comprou hoje',     cor: 'bg-green-100 text-green-800',  prioridade: 0 },
  { value: 'recente',       label: 'Compra recente',   cor: 'bg-green-100 text-green-800',  prioridade: 1 },
  { value: 'atencao',       label: 'Atenção',          cor: 'bg-yellow-100 text-yellow-800', prioridade: 2 },
  { value: 'queda',         label: 'Queda',            cor: 'bg-orange-100 text-orange-800', prioridade: 3 },
  { value: 'risco_perda',   label: 'Risco de perda',   cor: 'bg-red-100 text-red-800',      prioridade: 4 },
  { value: 'nunca_comprou', label: 'Nunca comprou',    cor: 'bg-gray-100 text-gray-700',    prioridade: 5 },
] as const

export const ROTAS_ENTREGA = [
  { value: 'aguas_claras',   label: 'Águas Claras' },
  { value: 'taguatinga',     label: 'Taguatinga' },
  { value: 'arniqueira',     label: 'Arniqueira' },
  { value: 'vicente_pires',  label: 'Vicente Pires' },
  { value: 'guara',          label: 'Guará' },
  { value: 'plano_piloto',   label: 'Plano Piloto' },
  { value: 'outros',         label: 'Outros' },
] as const

export function formatBRL(valor: number | string | null | undefined): string {
  const n = Number(valor) || 0
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatData(data: string | null | undefined): string {
  if (!data) return '-'
  return new Date(data).toLocaleDateString('pt-BR')
}

export function formatDataHora(data: string | null | undefined): string {
  if (!data) return '-'
  return new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// Rotas por perfil
export function dashboardPath(papel: string): string {
  switch (papel) {
    case 'cliente':  return '/cliente'
    case 'vendedor': return '/vendedor'
    default:         return '/dashboard'    // admin e matriz
  }
}
