-- ====================================================================
-- MÓDULO DE PRECIFICAÇÃO — Bendito Lanches ERP
-- Migration: 20260602000000_precificacao.sql
-- ====================================================================

-- 1. Configurações globais de precificação por filial
CREATE TABLE IF NOT EXISTS pricing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filial_id UUID NOT NULL REFERENCES public.filiais(id) ON DELETE CASCADE,
  estimated_monthly_revenue NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_filial_pricing_settings UNIQUE (filial_id)
);

-- 2. Custos fixos
CREATE TABLE IF NOT EXISTS pricing_fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filial_id UUID NOT NULL REFERENCES public.filiais(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  category TEXT NOT NULL CHECK (category IN ('Despesas Fixas','Pessoas','Marketing','Outros')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active'
);

-- 3. Insumos / matérias-primas
CREATE TABLE IF NOT EXISTS pricing_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filial_id UUID NOT NULL REFERENCES public.filiais(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purchase_unit TEXT NOT NULL DEFAULT 'und',
  purchase_quantity NUMERIC(12,4) NOT NULL DEFAULT 1.0000,
  purchase_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  recipe_unit TEXT NOT NULL DEFAULT 'und',
  -- Custo por unidade de medida da receita (calculado no app, não gerado)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active'
);

-- 4. Produtos com ficha técnica
CREATE TABLE IF NOT EXISTS pricing_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filial_id UUID NOT NULL REFERENCES public.filiais(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  yield NUMERIC(12,4) NOT NULL DEFAULT 1.0000,
  packaging_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ideal_markup NUMERIC(5,4) NOT NULL DEFAULT 1.0000,
  tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  card_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  delivery_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  applied_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active'
);

-- 5. Itens da ficha técnica (ingredientes)
CREATE TABLE IF NOT EXISTS pricing_product_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES pricing_products(id) ON DELETE CASCADE,
  input_id UUID NOT NULL REFERENCES pricing_inputs(id) ON DELETE RESTRICT,
  required_quantity NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Produtos de precificação direta (revenda sem ficha técnica)
CREATE TABLE IF NOT EXISTS pricing_direct_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filial_id UUID NOT NULL REFERENCES public.filiais(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purchase_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  packaging_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ideal_markup NUMERIC(5,4) NOT NULL DEFAULT 1.0000,
  tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  card_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  delivery_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  applied_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active'
);

-- 7. Orçamentos / pedidos
CREATE TABLE IF NOT EXISTS pricing_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filial_id UUID NOT NULL REFERENCES public.filiais(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_address TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending'
);

-- 8. Itens do orçamento
CREATE TABLE IF NOT EXISTS pricing_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES pricing_budgets(id) ON DELETE CASCADE,
  product_id UUID NULL,
  direct_product_id UUID NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(12,4) NOT NULL DEFAULT 1.0000,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  total_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ====================================================================
-- TRIGGERS updated_at
-- ====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pricing_settings_updated_at') THEN
    CREATE TRIGGER update_pricing_settings_updated_at BEFORE UPDATE ON pricing_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pricing_fixed_costs_updated_at') THEN
    CREATE TRIGGER update_pricing_fixed_costs_updated_at BEFORE UPDATE ON pricing_fixed_costs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pricing_inputs_updated_at') THEN
    CREATE TRIGGER update_pricing_inputs_updated_at BEFORE UPDATE ON pricing_inputs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pricing_products_updated_at') THEN
    CREATE TRIGGER update_pricing_products_updated_at BEFORE UPDATE ON pricing_products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pricing_direct_products_updated_at') THEN
    CREATE TRIGGER update_pricing_direct_products_updated_at BEFORE UPDATE ON pricing_direct_products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pricing_budgets_updated_at') THEN
    CREATE TRIGGER update_pricing_budgets_updated_at BEFORE UPDATE ON pricing_budgets FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;

-- ====================================================================
-- RLS
-- ====================================================================
ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_product_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_direct_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_budget_items ENABLE ROW LEVEL SECURITY;

-- Políticas abertas (mesmo padrão das outras tabelas do projeto)
CREATE POLICY IF NOT EXISTS "pricing_settings_all" ON pricing_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "pricing_fixed_costs_all" ON pricing_fixed_costs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "pricing_inputs_all" ON pricing_inputs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "pricing_products_all" ON pricing_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "pricing_product_inputs_all" ON pricing_product_inputs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "pricing_direct_products_all" ON pricing_direct_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "pricing_budgets_all" ON pricing_budgets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "pricing_budget_items_all" ON pricing_budget_items FOR ALL USING (true) WITH CHECK (true);

-- Seed: configuração inicial para a filial principal
INSERT INTO pricing_settings (filial_id, estimated_monthly_revenue)
SELECT id, 20000.00 FROM public.filiais LIMIT 1
ON CONFLICT (filial_id) DO NOTHING;
