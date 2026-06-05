/**
 * /schemas/index.ts
 * Schemas de validação Zod — Bendito Lanches ERP
 * Importar de '@/schemas' em qualquer parte do projeto
 */

import { z } from 'zod'

// ── Utilitários ───────────────────────────────────────
const uuid    = z.string().uuid('ID inválido')
const uuidOpt = z.string().uuid('ID inválido').optional().nullable()
const dataOpt = z.string().optional().nullable()
const phone   = z.string()
  .transform(v => v.replace(/\D/g, ''))
  .pipe(z.string().min(10, 'Telefone inválido').max(13))

// ── Produto ───────────────────────────────────────────
export const ProdutoSchema = z.object({
  nome:             z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  descricao:        z.string().max(500).optional().nullable(),
  categoria_id:     uuidOpt,
  preco_custo:      z.number().min(0, 'Preço não pode ser negativo').optional().nullable(),
  preco_varejo:     z.number().min(0, 'Preço não pode ser negativo').optional().nullable(),
  unidade_medida:   z.string().max(10).optional().nullable(),
  estoque_minimo:   z.number().min(0).optional().nullable(),
  ativo:            z.boolean().default(true),
})

export const ProdutoFiscalSchema = z.object({
  ncm:              z.string().length(8, 'NCM deve ter 8 dígitos').regex(/^\d{8}$/, 'NCM deve conter apenas números'),
  cfop:             z.string().length(4, 'CFOP deve ter 4 dígitos').regex(/^\d{4}$/, 'CFOP inválido'),
  csosn:            z.string().optional().nullable(),
  cst_icms:         z.string().optional().nullable(),
  origem:           z.enum(['0','1','2','3','4','5']).default('0'),
  aliquota_icms:    z.number().min(0).max(100).default(0),
  aliquota_pis:     z.number().min(0).max(100).default(0.65),
  aliquota_cofins:  z.number().min(0).max(100).default(3),
  cst_pis:          z.string().optional().nullable(),
  cst_cofins:       z.string().optional().nullable(),
  unidade_fiscal:   z.string().max(6).default('UN'),
  codigo_barras:    z.string().max(14).optional().nullable(),
  descricao_fiscal: z.string().max(120).optional().nullable(),
  peso_liquido_kg:  z.number().min(0).optional().nullable(),
  peso_bruto_kg:    z.number().min(0).optional().nullable(),
})

export type ProdutoInput      = z.infer<typeof ProdutoSchema>
export type ProdutoFiscalInput = z.infer<typeof ProdutoFiscalSchema>

// ── Cliente ───────────────────────────────────────────
export const ClienteSchema = z.object({
  nome:      z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  nome_loja: z.string().max(100).optional().nullable(),
  telefone:  z.string().max(20).optional().nullable(),
  email:     z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  cnpj_cpf:  z.string().max(18).optional().nullable(),
  endereco:  z.string().max(300).optional().nullable(),
  ativo:     z.boolean().default(true),
})

export type ClienteInput = z.infer<typeof ClienteSchema>

// ── Pedido ────────────────────────────────────────────
export const PedidoItemSchema = z.object({
  produto_id:     uuidOpt,
  nome_produto:   z.string().min(1),
  quantidade:     z.number().min(0.01, 'Quantidade deve ser maior que zero'),
  preco_unitario: z.number().min(0),
  desconto:       z.number().min(0).default(0),
  subtotal:       z.number().min(0),
})

export const NovoPedidoSchema = z.object({
  cliente_id:  uuidOpt,
  vendedor_id: uuidOpt,
  observacoes: z.string().max(500).optional().nullable(),
  itens:       z.array(PedidoItemSchema).min(1, 'O pedido deve ter pelo menos 1 item'),
})

export type NovoPedidoInput = z.infer<typeof NovoPedidoSchema>

// ── PDV / Venda ───────────────────────────────────────
export const VendaPDVSchema = z.object({
  cliente_nome:    z.string().max(100).optional().nullable(),
  desconto:        z.number().min(0).default(0),
  forma_pagamento: z.enum(['dinheiro','pix','credito','debito','misto']),
  valor_dinheiro:  z.number().min(0).default(0),
  valor_pix:       z.number().min(0).default(0),
  valor_cartao:    z.number().min(0).default(0),
  itens:           z.array(z.object({
    produto_id:     uuid,
    nome_produto:   z.string(),
    quantidade:     z.number().min(1),
    preco_unitario: z.number().min(0),
    subtotal:       z.number().min(0),
  })).min(1, 'A venda deve ter pelo menos 1 item'),
})

export const CancelamentoVendaSchema = z.object({
  motivo: z.string().min(5, 'Informe o motivo com pelo menos 5 caracteres').max(300),
})

export type VendaPDVInput         = z.infer<typeof VendaPDVSchema>
export type CancelamentoVendaInput = z.infer<typeof CancelamentoVendaSchema>

// ── Financeiro ────────────────────────────────────────
export const ContaPagarSchema = z.object({
  filial_id:       uuid,
  fornecedor_id:   uuidOpt,
  descricao:       z.string().min(3, 'Descrição muito curta').max(200),
  categoria:       z.string().max(50).default('outros'),
  tipo:            z.enum(['unica','parcelada','recorrente']).default('unica'),
  valor_total:     z.number().min(0.01, 'Valor deve ser maior que zero'),
  num_parcelas:    z.number().min(1).max(60).default(1),
  vencimento:      z.string().min(1, 'Informe o vencimento'),
  forma_pagamento: z.string().max(30).optional().nullable(),
  observacoes:     z.string().max(500).optional().nullable(),
  recorrencia_dia: z.number().min(1).max(31).optional().nullable(),
})

export const ContaReceberSchema = z.object({
  filial_id:        uuid,
  cliente_id:       uuidOpt,
  pedido_id:        uuidOpt,
  descricao:        z.string().min(3).max(200),
  categoria:        z.string().max(50).default('venda'),
  tipo:             z.enum(['unica','parcelada','recorrente']).default('unica'),
  valor_total:      z.number().min(0.01),
  num_parcelas:     z.number().min(1).max(60).default(1),
  vencimento:       z.string().min(1),
  forma_recebimento: z.string().max(30).optional().nullable(),
  observacoes:      z.string().max(500).optional().nullable(),
})

export type ContaPagarInput   = z.infer<typeof ContaPagarSchema>
export type ContaReceberInput = z.infer<typeof ContaReceberSchema>

// ── Entregas ──────────────────────────────────────────
export const EntregaSchema = z.object({
  filial_id:           uuid,
  pedido_id:           uuidOpt,
  entregador_id:       uuidOpt,
  endereco_completo:   z.string().min(10, 'Informe o endereço completo').max(300),
  cliente_nome:        z.string().max(100).optional().nullable(),
  cliente_tel:         z.string().max(20).optional().nullable(),
  tempo_estimado_min:  z.number().min(1).max(480).default(45),
  observacoes:         z.string().max(300).optional().nullable(),
})

export const ConfirmacaoEntregaSchema = z.object({
  avaliacao:       z.number().min(1).max(5).optional(),
  motivo_problema: z.string().min(5).max(300).optional(),
})

export type EntregaInput             = z.infer<typeof EntregaSchema>
export type ConfirmacaoEntregaInput  = z.infer<typeof ConfirmacaoEntregaSchema>

// ── Aprovações ────────────────────────────────────────
export const JustificativaRecusaSchema = z.object({
  justificativa: z.string()
    .min(10, 'Justificativa deve ter pelo menos 10 caracteres')
    .max(500, 'Justificativa muito longa'),
})

export const MotivoAlteracaoSchema = z.object({
  motivo: z.string()
    .min(5, 'Informe o motivo com pelo menos 5 caracteres')
    .max(300),
})

export type JustificativaRecusaInput = z.infer<typeof JustificativaRecusaSchema>
export type MotivoAlteracaoInput     = z.infer<typeof MotivoAlteracaoSchema>

// ── Usuário / Auth ────────────────────────────────────
export const LoginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
})

export const NovoUsuarioSchema = z.object({
  email:    z.string().email('E-mail inválido'),
  nome:     z.string().min(2).max(100),
  papel:    z.enum(['admin','matriz','gerente','vendedor','cliente','atendente_pdv']),
  filial_id: uuidOpt,
})

export type LoginInput       = z.infer<typeof LoginSchema>
export type NovoUsuarioInput = z.infer<typeof NovoUsuarioSchema>

// ── Config Fiscal ─────────────────────────────────────
export const ConfigFiscalSchema = z.object({
  cnpj:               z.string().min(14, 'CNPJ inválido').max(18),
  inscricao_estadual: z.string().max(30).optional().nullable(),
  regime_tributario:  z.enum(['simples','lucro_presumido','lucro_real']),
  csc_id:             z.string().max(10).optional().nullable(),
  csc_token:          z.string().max(100).optional().nullable(),
  ambiente_nfce:      z.enum(['homologacao','producao']).default('homologacao'),
  serie_nfce:         z.number().min(1).max(999).default(1),
})

export type ConfigFiscalInput = z.infer<typeof ConfigFiscalSchema>

// ── Hooks helpers ─────────────────────────────────────
/**
 * Valida um objeto contra um schema e retorna erros formatados
 * Uso: const { data, errors } = validar(ContaPagarSchema, formData)
 */
export function validar<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { data?: T; errors?: Record<string, string> } {
  const result = schema.safeParse(data)
  if (result.success) return { data: result.data }
  const errors: Record<string, string> = {}
  result.error.errors.forEach(e => {
    const key = e.path.join('.')
    errors[key] = e.message
  })
  return { errors }
}
