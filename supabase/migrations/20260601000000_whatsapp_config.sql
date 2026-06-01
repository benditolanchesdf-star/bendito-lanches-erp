-- Tabela de configurações gerais por filial (chave-valor)
create table if not exists public.configuracoes (
    id          uuid primary key default gen_random_uuid(),
    filial_id   uuid references public.filiais(id) on delete cascade,
    chave       text not null,
    valor       text,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now(),
    unique(filial_id, chave)
);

-- Tabela de log de notificações WhatsApp enviadas
create table if not exists public.whatsapp_logs (
    id          uuid primary key default gen_random_uuid(),
    filial_id   uuid references public.filiais(id),
    pedido_id   uuid,  -- referência sem FK para evitar dependência de ordem de migration
    telefone    text,
    mensagem    text,
    status      text default 'enviado', -- enviado, erro
    erro        text,
    created_at  timestamptz default now()
);

-- RLS
alter table public.configuracoes enable row level security;
alter table public.whatsapp_logs enable row level security;

create policy "configuracoes_all" on public.configuracoes
    for all using (true) with check (true);

create policy "whatsapp_logs_all" on public.whatsapp_logs
    for all using (true) with check (true);

-- Inserir configurações padrão Z-API para a filial principal
insert into public.configuracoes (filial_id, chave, valor)
select
    id,
    chave,
    valor
from
    public.filiais,
    (values
        ('zapi_instance_id',    '3F270655F5F201F4306062108CBB360D'),
        ('zapi_token',          ''),
        ('zapi_client_token',   ''),
        ('zapi_ativo',          'false'),
        ('wpp_msg_confirmado',  'Olá {{nome_loja}}, seu pedido *#{{numero_pedido}}* foi *confirmado*! 🎉 Entrega prevista: *{{data_entrega}}*{{horario}}. Bendito Lanches agradece! 🥪'),
        ('wpp_msg_producao',    'Olá {{nome_loja}}, seu pedido *#{{numero_pedido}}* está *em produção*! 👨‍🍳 Já estamos preparando tudo com carinho. Bendito Lanches.'),
        ('wpp_msg_saiu',        'Olá {{nome_loja}}, seu pedido *#{{numero_pedido}}* *saiu para entrega*! 🚗 Em breve chegará até você{{horario}}. Bendito Lanches.'),
        ('wpp_msg_entregue',    'Olá {{nome_loja}}, seu pedido *#{{numero_pedido}}* foi *entregue*! ✅ Obrigado pela preferência. Bendito Lanches. 🥪❤️')
    ) as t(chave, valor)
on conflict (filial_id, chave) do nothing;
