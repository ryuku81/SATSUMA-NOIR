create or replace function public.create_order(
  p_customer text,
  p_email text,
  p_address text,
  p_note text,
  p_items jsonb,
  p_total integer,
  p_payment text,
  p_auth_user_id uuid default null,
  p_payment_status text default 'pending',
  p_payment_intent_id text default ''
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

  insert into public.orders (auth_user_id, customer, email, address, note, items, total, payment, payment_status, payment_intent_id)
  values (
    new_auth_user_id,
    coalesce(p_customer, ''),
    coalesce(p_email, ''),
    coalesce(p_address, ''),
    coalesce(p_note, ''),
    coalesce(p_items, '[]'::jsonb),
    coalesce(p_total, 0),
    coalesce(p_payment, ''),
    case
      when p_payment_status in ('pending', 'paid', 'failed', 'cod', 'demo') then p_payment_status
      else 'pending'
    end,
    coalesce(p_payment_intent_id, '')
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

grant execute on function public.create_order(text, text, text, text, jsonb, integer, text, uuid, text, text) to anon, authenticated;
