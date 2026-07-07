alter table public.orders
add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create index if not exists orders_auth_user_id_idx on public.orders(auth_user_id);

create or replace function public.create_order(
  p_customer text,
  p_email text,
  p_address text,
  p_note text,
  p_items jsonb,
  p_total integer,
  p_payment text,
  p_auth_user_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
  new_auth_user_id uuid;
begin
  new_auth_user_id := case
    when auth.uid() is not null then auth.uid()
    when p_auth_user_id is not null and exists (select 1 from auth.users where id = p_auth_user_id) then p_auth_user_id
    else null
  end;

  insert into public.orders (auth_user_id, customer, email, address, note, items, total, payment)
  values (
    new_auth_user_id,
    coalesce(p_customer, ''),
    coalesce(p_email, ''),
    coalesce(p_address, ''),
    coalesce(p_note, ''),
    coalesce(p_items, '[]'::jsonb),
    coalesce(p_total, 0),
    coalesce(p_payment, '')
  )
  returning id into new_id;

  insert into public.customers (name, email)
  select coalesce(p_customer, ''), coalesce(p_email, '')
  where coalesce(p_email, '') <> ''
  on conflict (email) do update
  set name = case
    when public.customers.name = '' then excluded.name
    else public.customers.name
  end;

  return new_id;
end;
$$;

grant execute on function public.create_order(text, text, text, text, jsonb, integer, text, uuid) to anon, authenticated;

drop policy if exists "orders select own or admin" on public.orders;
create policy "orders select own or admin" on public.orders
for select to authenticated
using (
  auth.uid() = auth_user_id
  or (
    auth_user_id is null
    and email = public.current_user_email()
  )
  or public.current_user_is_admin()
);
