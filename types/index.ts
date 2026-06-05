/**
 * /types/index.ts
 * Tipos TypeScript centralizados — Bendito Lanches ERP
 * Importar de '@/types' em qualquer parte do projeto
 */

// ── Papéis e autenticação ─────────────────────────────
export type Papel =
  | 'admin'
  | 'matriz'
  | 'gerente'
  | 'vendedor'
  | 'cliente'
  | 'atendente_pdv'

export interface Profile {
  id:           string
  email?:       string
  nome?:        string
  papel:        Papel
  filial_id?:   string
  vendedor_id?: string
  cliente_id?:  string
  created_at:   string
  updated_at?:  string
}

// ── Filiais ───────────────────────────────────────────
export interface Filial {
  id:        string
  nome:      string
  cnpj?:     string
  endereco?: string
  ativo:     boolean
  created_at: string
}

// ── Produtos ──────────────────────────────────────────
export interface Produto {
  id:               string
  filial_id:        string
  nome:             string
  descricao?:       string
  categoria_id?:    string
  preco_custo?:     number
  preco_varejo?:    number
  unidade_medida?:  string
  estoque_minimo?:  number
  ativo:            boolean
  // Campos fiscais
  ncm?:             string
  cfop?:            string
  csosn?:           string
  cst_icms?:        string
  origem?:          string
  aliquota_icms?:   number
  aliquota_pis?:    number
  aliquota_cofins?: number
  codigo_barras?:   string
  unidade_fiscal?:  string
  // Auditoria
  created_by?:  string
  updated_by?:  string
  created_at:   string
  updated_at?:  string
}

export interface ProdutoFilial {
  id:            string
  filial_id:     string
  produto_id:    string
  preco_varejo?: number
  preco_custo?:  number
  estoque_atual: number
  estoque_minimo?: number
  ativo_na_filial: boolean
  updated_by?:   string
  updated_at?:   string
}

// ── Clientes ──────────────────────────────────────────
export interface Cliente {
  id:           string
  filial_id?:   string
  nome:         string
  nome_loja?:   string
  telefone?:    string
  email?:       string
  cnpj_cpf?:    string
  endereco?:    string
  ativo:        boolean
  created_by?:  string
  updated_by?:  string
  created_at:   string
  updated_at?:  string
}

// ── Pedidos ───────────────────────────────────────────
export type StatusPedido =
  | 'rascunho'
  | 'pendente'
  | 'em_analise'
  | 'confirmado'
  | 'em_producao'
  | 'producao'
  | 'pronto'
  | 'separado'
  | 'saiu_para_entrega'
  | 'saiu_entrega'
  | 'entregue'
  | 'problema_entrega'
  | 'baixado'
  | 'cancelado'

export interface Pedido {
  id:            string
  filial_id:     string
  cliente_id?:   string
  vendedor_id?:  string
  numero_pedido: number
  status:        StatusPedido
  valor_total:   number
  canal?:        string
  observacoes?:  string
  created_by?:   string
  updated_by?:   string
  created_at:    string
  updated_at?:   string
}

export interface PedidoItem {
  id:              string
  pedido_id:       string
  produto_id?:     string
  nome_produto:    string
  quantidade:      number
  preco_unitario:  number
  subtotal:        number
  desconto?:       number
}

export type StatusPedidoInterno =
  | 'pendente'
  | 'aprovado'
  | 'separando'
  | 'enviado'
  | 'recebido'
  | 'cancelado'

export interface PedidoInterno {
  id:              string
  filial_origem:   string
  filial_destino:  string
  numero:          number
  status:          StatusPedidoInterno
  observacoes?:    string
  justificativa_recusa?: string
  created_by?:     string
  updated_by?:     string
  created_at:      string
  updated_at?:     string
}

// ── PDV / Caixa ───────────────────────────────────────
export type StatusCaixa = 'aberto' | 'fechado'
export type FormaPagamento = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'misto'
export type StatusVenda = 'concluida' | 'cancelada'

export interface CaixaPDV {
  id:               string
  filial_id:        string
  atendente_id:     string
  status:           StatusCaixa
  valor_abertura:   number
  valor_fechamento?: number
  total_vendas:     number
  total_dinheiro:   number
  total_pix:        number
  total_cartao:     number
  total_sangria:    number
  total_suprimento: number
  abertura_at:      string
  fechamento_at?:   string
}

export interface VendaPDV {
  id:                  string
  filial_id:           string
  caixa_id:            string
  atendente_id?:       string
  numero:              number
  cliente_nome?:       string
  subtotal:            number
  desconto:            number
  total:               number
  forma_pagamento:     FormaPagamento
  valor_dinheiro?:     number
  valor_pix?:          number
  valor_cartao?:       number
  troco?:              number
  status:              StatusVenda
  motivo_cancelamento?: string
  cancelado_por?:      string
  cancelado_em?:       string
  created_at:          string
}

export interface ItemCarrinho {
  produto_id: string
  nome:       string
  preco:      number
  quantidade: number
}

// ── Financeiro ────────────────────────────────────────
export type StatusConta = 'aberta' | 'paga' | 'recebida' | 'vencida' | 'cancelada'
export type TipoConta   = 'unica' | 'parcelada' | 'recorrente'

export interface ContaPagar {
  id:               string
  filial_id:        string
  fornecedor_id?:   string
  descricao:        string
  categoria?:       string
  tipo:             TipoConta
  valor_total:      number
  valor_parcela:    number
  num_parcelas:     number
  parcela_atual:    number
  vencimento:       string
  data_pagamento?:  string
  status:           StatusConta
  forma_pagamento?: string
  lancado_por?:     string
  updated_by?:      string
  created_at:       string
  updated_at?:      string
}

export interface ContaReceber {
  id:                string
  filial_id:         string
  cliente_id?:       string
  pedido_id?:        string
  descricao:         string
  categoria?:        string
  tipo:              TipoConta
  valor_total:       number
  valor_parcela:     number
  vencimento:        string
  data_recebimento?: string
  status:            StatusConta
  lancado_por?:      string
  updated_by?:       string
  created_at:        string
  updated_at?:       string
}

// ── Entregas ──────────────────────────────────────────
export type StatusEntrega =
  | 'pendente'
  | 'saiu'
  | 'entregue'
  | 'problema'
  | 'cancelada'
  | 'falhou'

export interface Entregador {
  id:            string
  filial_id?:    string
  nome:          string
  telefone?:     string
  cpf?:          string
  cnh?:          string
  veiculo_tipo?: string
  veiculo_placa?: string
  area_atuacao?: string
  ativo:         boolean
  created_by?:   string
  updated_by?:   string
  created_at:    string
  updated_at?:   string
}

export interface Entrega {
  id:                  string
  filial_id:           string
  pedido_id?:          string
  entregador_id?:      string
  rota_id?:            string
  ordem_rota?:         number
  status:              StatusEntrega
  endereco_completo:   string
  cliente_nome?:       string
  cliente_tel?:        string
  hora_saida?:         string
  hora_entrega?:       string
  avaliacao?:          number
  motivo_problema?:    string
  tempo_estimado_min?: number
  observacoes?:        string
  created_by?:         string
  updated_by?:         string
  created_at:          string
}

// ── WhatsApp ──────────────────────────────────────────
export type WppEvento =
  | 'pedido_confirmado'
  | 'pedido_producao'
  | 'pedido_saiu_entrega'
  | 'pedido_entregue'
  | 'pedido_cancelado'
  | 'cobranca_vencida'
  | 'cobranca_lembrete'
  | 'pedido_interno_aprovado'
  | 'pedido_interno_enviado'
  | 'pedido_compra_aprovado'
  | 'pedido_compra_recusado'

export type StatusWppFila = 'pendente' | 'enviado' | 'erro' | 'cancelado'

export interface WppFilaItem {
  id:              string
  filial_id?:      string
  telefone:        string
  mensagem:        string
  evento?:         WppEvento
  referencia_id?:  string
  referencia_tipo?: string
  status:          StatusWppFila
  tentativas:      number
  erro_msg?:       string
  agendado_para?:  string
  enviado_em?:     string
  created_at:      string
}

// ── IA ────────────────────────────────────────────────
export type TipoAnaliseIA =
  | 'vendas'
  | 'reposicao'
  | 'churn'
  | 'financeiro'
  | 'geral'

export interface IAAnalise {
  id:          string
  filial_id?:  string
  tipo:        TipoAnaliseIA
  titulo:      string
  conteudo:    string
  dados_json?: Record<string, unknown>
  gerado_em:   string
  valido_ate?: string
  visualizado: boolean
  created_by?: string
}

export interface IAConversa {
  id:            string
  usuario_id:    string
  filial_id?:    string
  mensagem:      string
  resposta:      string
  tokens_usados?: number
  created_at:    string
}

// ── Dashboard ─────────────────────────────────────────
export interface DashboardResumo {
  filial_id:               string
  filial_nome:             string
  faturamento_hoje:        number
  faturamento_mes:         number
  faturamento_mes_ant:     number
  variacao_mes_pct:        number
  vendas_pdv_hoje:         number
  pedidos_b2b_hoje:        number
  pedidos_mes:             number
  aprovacoes_pendentes:    number
  produtos_estoque_critico: number
  entregas_hoje:           number
  entregas_concluidas:     number
  entregas_em_rota:        number
  entregas_pendentes:      number
  clientes_risco_churn:    number
}

// ── Utilitários ───────────────────────────────────────
export type UUID = string
export type ISODate = string
export type ISODateTime = string

export interface SelectOption {
  value: string
  label: string
}

export interface PaginationParams {
  page:     number
  pageSize: number
}

export interface ApiResponse<T> {
  data?:    T
  error?:   string
  success:  boolean
}
