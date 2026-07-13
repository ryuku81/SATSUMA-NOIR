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

create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.users;
begin
  if p_role not in ('admin', 'member') then
    raise exception 'Invalid role: %', p_role;
  end if;

  if not public.current_user_is_admin() then
    raise exception 'Admin permission required';
  end if;

  select *
    into target
    from public.users
    where id = p_user_id;

  if target.id is null then
    raise exception 'User not found';
  end if;

  if target.auth_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'Cannot remove your own admin role';
  end if;

  update public.users
    set role = p_role,
        updated_at = now()
    where id = p_user_id
    returning * into target;

  return target;
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;
