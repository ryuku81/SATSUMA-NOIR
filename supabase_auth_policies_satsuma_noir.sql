alter table public.users enable row level security;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users
    where auth_user_id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "users select own or admin" on public.users;
create policy "users select own or admin"
on public.users
for select
to authenticated
using (
  auth.uid() = auth_user_id
  or public.current_user_is_admin()
);

drop policy if exists "users update admin only" on public.users;
create policy "users update admin only"
on public.users
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());
