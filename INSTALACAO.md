# 📘 INSTALAÇÃO — BENDITO LANCHES ERP
**Versão Final — Fases A + B + C + Módulo de Precificação**

Sistema B2B completo em **Next.js 14 + Supabase + Vercel** com 3 áreas de acesso:
**Admin/Matriz**, **Vendedor** e **Cliente Lojista**, mais módulo completo de Precificação.

---

## 🔑 USUÁRIOS PRÉ-CRIADOS

| Perfil | E-mail | Senha | Redireciona para |
|--------|--------|-------|------------------|
| **Admin/Matriz** | `admin@benditolanches.com.br` | `Admin@2026` | `/dashboard` (acesso total) |
| **Vendedor** | `carlos@bendito.com` | `Vendedor@2026` | `/vendedor` (apenas seus clientes) |
| **Cliente** | `bomsabor@cliente.com` | `Cliente@2026` | `/cliente` (apenas seus pedidos) |

---

## 1️⃣ RODAR LOCALMENTE

```bash
unzip bendito-erp-final.zip
cd bendito-fase-c
npm install
npm run dev
```

Acesse em `http://localhost:3000`.

---

## 2️⃣ BANCO DE DADOS — 3 MIGRATIONS (OBRIGATÓRIO, EM ORDEM)

Acesse: https://supabase.com/dashboard/project/upzwgohtaybgycyigwlw/editor

Execute cada arquivo no SQL Editor:

### Migration 1 — Sistema Principal
`supabase/migrations/20260524000000_multi_filial.sql`
Cria: filiais, perfis, pedidos, produtos, estoque, comissões, RLS.

### Migration 2 — WhatsApp / Z-API
`supabase/migrations/20260601000000_whatsapp_config.sql`
Cria: tabela configuracoes e whatsapp_logs.

### Migration 3 — Precificação
`supabase/migrations/20260602000000_precificacao.sql`
Cria: pricing_settings, pricing_fixed_costs, pricing_inputs, pricing_products,
pricing_product_inputs, pricing_direct_products, pricing_budgets, pricing_budget_items.

---

## 3️⃣ VARIÁVEIS DE AMBIENTE — VERCEL

| Name | Value |
|------|-------|
| NEXT_PUBLIC_SUPABASE_URL | https://upzwgohtaybgycyigwlw.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwendnb2h0YXliZ3ljeWlnd2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MjU3NzYsImV4cCI6MjA5NDUwMTc3Nn0.wGTmtLtxT6edYOh9Q8vksvLI7JrAym4ngWUTIASps9g |
| NEXT_PUBLIC_APP_URL | https://<sua-url>.vercel.app |

Cole a ANON_KEY sem quebra de linha. Após salvar, faça Redeploy.

---

## 4️⃣ GITHUB + VERCEL

```bash
git init && git add . && git commit -m "feat: Bendito Lanches ERP versao final"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/bendito-lanches-erp.git
git push -u origin main
```

Vercel: https://vercel.com/new → importe → adicione variáveis → Deploy.

---

## 5️⃣ SUPABASE — AUTORIZAR URL DA VERCEL

Authentication → URL Configuration:
- Site URL: https://<seu-projeto>.vercel.app
- Redirect URLs: https://<seu-projeto>.vercel.app/** e http://localhost:3000/**

---

## 6️⃣ WHATSAPP Z-API

1. /dashboard/configuracoes → seção WhatsApp
2. Preencha Instance ID, Token e Client Token (de app.z-api.io)
3. Ative o toggle "Ativo"
4. Edite as mensagens (variaveis: {{nome_loja}} {{numero_pedido}} {{data_entrega}} {{horario}})
5. Use "Enviar teste" para validar
6. Salvar

Dispara automaticamente ao mudar status para: confirmado, producao, saiu_entrega, entregue.

---

## 7️⃣ MÓDULO DE PRECIFICAÇÃO — SETUP INICIAL

Acesse /dashboard/precificacao como admin:

1. CUSTOS FIXOS: cadastre faturamento estimado + todos os custos fixos mensais
2. INSUMOS: cadastre matérias-primas (unidade de compra, quantidade, valor, unidade da receita)
3. PRODUTOS: crie produto → clique na seta → monte a ficha técnica com ingredientes
4. DIRETA (opcional): produtos de revenda sem ficha técnica
5. ORÇAMENTOS: crie propostas para clientes usando os preços cadastrados

---

## 🗺️ MAPA DE TELAS

### Admin/Matriz (/dashboard)
- / → Dashboard avançado (KPIs, entregas hoje, produção amanhã, alertas)
- /pedidos → Pedidos + notificação WhatsApp ao mudar status
- /agenda → Agenda por rota/bairro + avance rápido de status
- /producao → Produção
- /estoque → Estoque
- /produtos → Catálogo
- /precificacao → Dashboard de precificação (KPIs, breakeven, top produtos)
- /precificacao/custos → Custos fixos e taxa de rateio
- /precificacao/insumos → Banco de insumos
- /precificacao/produtos → Ficha técnica e precificação
- /precificacao/produtos/[id] → Ficha técnica detalhada
- /precificacao/direta → Precificação direta/revenda
- /precificacao/orcamentos → Gerador de orçamentos
- /clientes → Gestão de clientes
- /vendedores → Vendedores e comissões
- /financeiro → Financeiro
- /relatorios → Relatórios
- /ia → IA Previsões
- /configuracoes → Config + WhatsApp Z-API

### Vendedor (/vendedor)
- / → Painel com alertas
- /clientes → Clientes + botão WhatsApp + novo pedido
- /pedidos → Pedidos dos clientes
- /pedidos/novo → Criar pedido para cliente
- /agenda → Agenda de entregas
- /evolucao → Evolução de compras com mini-gráfico
- /comissoes → Comissões

### Cliente (/cliente)
- / → Home com atalhos
- /pedido-novo → Novo pedido
- /pedidos → Histórico + cancelar + falar com vendedor
- /favoritos → Pedidos favoritos
- /dados-loja → Endereço e contato

---

## 🆘 PROBLEMAS COMUNS

- "Invalid API key" → Cole ANON_KEY sem espaços; Redeploy
- Login não funciona → Configure Site URL no Supabase Auth
- Tela vazia → Usuário precisa ter registro em profiles com papel correto
- WhatsApp não envia → Verifique credenciais Z-API e toggle Ativo em Configurações
- Tabelas pricing_ não existem → Execute migration 20260602000000_precificacao.sql
- Custo fixo = 0 → Cadastre custos e faturamento em /precificacao/custos

---

Projeto Supabase: upzwgohtaybgycyigwlw (sa-east-1)
Z-API Instance: 3F270655F5F201F4306062108CBB360D
