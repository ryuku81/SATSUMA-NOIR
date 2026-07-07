create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (auth_user_id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    'member'
  )
  on conflict (email) do update
  set
    auth_user_id = excluded.auth_user_id,
    name = case
      when public.users.name = '' then excluded.name
      else public.users.name
    end,
    updated_at = now();

  insert into public.customers (name, email)
  values (
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, '')
  )
  on conflict (email) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
