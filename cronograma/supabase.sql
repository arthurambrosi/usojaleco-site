-- Estrutura simples para sincronização de estado do cronograma
-- Execute no SQL Editor do Supabase

create table if not exists public.study_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.study_state enable row level security;

-- Política permissiva para uso pessoal com anon key.
-- Para segurança real, ajuste para autenticação e regras por usuário.
drop policy if exists "allow all anon personal" on public.study_state;
create policy "allow all anon personal"
  on public.study_state
  for all
  using (true)
  with check (true);
