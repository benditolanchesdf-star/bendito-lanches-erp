-- ====================================================================
-- Vínculo entre produtos do catálogo e módulo de precificação
-- Migration: 20260603000000_produto_pricing_link.sql
-- ====================================================================

-- Adiciona coluna de vínculo na tabela produtos
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS pricing_product_id UUID NULL REFERENCES pricing_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pricing_direct_product_id UUID NULL REFERENCES pricing_direct_products(id) ON DELETE SET NULL;

-- Comentário: quando pricing_product_id ou pricing_direct_product_id estiver preenchido,
-- o app lê o applied_price da tabela de precificação como preco_varejo,
-- ignorando o campo preco_varejo local do produto.
