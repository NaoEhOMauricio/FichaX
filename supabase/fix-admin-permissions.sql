-- Corrige erro 403: "permission denied for function is_admin"
-- Execute no Supabase SQL Editor.

-- 1) Garante função de verificação de admin com search_path seguro
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt()->>'email' = 'leonardo.clemente.braga@gmail.com', false);
$$;

-- 2) Garante permissão de execução da função para requisições autenticadas
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to anon;
grant execute on function public.is_admin() to service_role;

-- 3) Garante policy de leitura admin em user_profiles sem operações destrutivas
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'Admin vê todos os user_profiles'
  ) then
    execute 'alter policy "Admin vê todos os user_profiles" on public.user_profiles using (public.is_admin())';
  else
    execute 'create policy "Admin vê todos os user_profiles" on public.user_profiles for select using (public.is_admin())';
  end if;
end
$$;

-- 4) Opcional: mesma lógica para profiles
-- drop policy if exists "Admin vê todos os perfis" on public.profiles;
-- create policy "Admin vê todos os perfis"
--   on public.profiles
--   for select
--   using (public.is_admin());
