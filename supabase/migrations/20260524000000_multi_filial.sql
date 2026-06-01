-- ============================================================================
-- 00 · FUNDAÇÃO MULTI-FILIAL (TENANT)
-- Bendito Lanches ERP · Fase 5 (preparação)
-- ============================================================================

create extension if not exists "uuid-ossp";

create or replace function public.set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create table if not exists public.filiais (
  id            uuid primary key default uuid_generate_v4(),
  nome          text not null,
  cnpj          text unique,
  endereco      text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

drop trigger if exists trg_filiais_atualizado on public.filiais;
create trigger trg_filiais_atualizado
  before update on public.filiais
  for each row execute function public.set_atualizado_em();

do $$
begin
  if not exists (select 1 from pg_type where typname = 'papel_filial') then
    create type public.papel_filial as enum
      ('admin','gerente','operador','entregador','vendedor','financeiro');
  end if;
end$$;

create table if not exists public.usuarios_filiais (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  filial_id  uuid not null references public.filiais(id) on delete cascade,
  papel      public.papel_filial not null default 'operador',
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  unique (user_id, filial_id)
);

create index if not exists idx_usuarios_filiais_user   on public.usuarios_filiais(user_id);
create index if not exists idx_usuarios_filiais_filial on public.usuarios_filiais(filial_id);

create or replace function public.filiais_do_usuario()
returns setof uuid language sql stable security definer set search_path = public as $$
  select filial_id from public.usuarios_filiais
  where user_id = auth.uid() and ativo = true;
$$;

create or replace function public.pertence_filial(p_filial_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios_filiais
    where user_id = auth.uid() and filial_id = p_filial_id and ativo = true
  );
$$;

create or replace function public.eh_gestor_filial(p_filial_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios_filiais
    where user_id = auth.uid() and filial_id = p_filial_id
      and papel in ('admin','gerente') and ativo = true
  );
$$;

alter table public.filiais          enable row level security;
alter table public.usuarios_filiais enable row level security;

drop policy if exists filiais_select on public.filiais;
create policy filiais_select on public.filiais for select using (public.pertence_filial(id));

drop policy if exists filiais_admin on public.filiais;
create policy filiais_admin on public.filiais for all
  using (public.eh_gestor_filial(id)) with check (public.eh_gestor_filial(id));

drop policy if exists usuarios_filiais_select on public.usuarios_filiais;
create policy usuarios_filiais_select on public.usuarios_filiais
  for select using (user_id = auth.uid() or public.eh_gestor_filial(filial_id));

drop policy if exists usuarios_filiais_admin on public.usuarios_filiais;
create policy usuarios_filiais_admin on public.usuarios_filiais for all
  using (public.eh_gestor_filial(filial_id)) with check (public.eh_gestor_filial(filial_id));

create or replace function public.aplicar_tenant(p_tabela regclass)
returns void language plpgsql as $$
declare v_nome text := p_tabela::text;
begin
  execute format('alter table %s add column if not exists filial_id uuid references public.filiais(id)', v_nome);
  execute format('create index if not exists %I on %s(filial_id)', 'idx_' || replace(v_nome,'.','_') || '_filial', v_nome);
  execute format('alter table %s enable row level security', v_nome);
  execute format('drop policy if exists tenant_isolation on %s', v_nome);
  execute format($f$ create policy tenant_isolation on %s for all
    using (public.pertence_filial(filial_id)) with check (public.pertence_filial(filial_id)) $f$, v_nome);
end;
$$;
