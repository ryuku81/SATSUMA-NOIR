drop policy if exists "users update own profile" on public.users;
create policy "users update own profile"
on public.users
for update to authenticated
using (auth.uid() = auth_user_id)
with check (
  auth.uid() = auth_user_id
  and role = 'member'
  and email = public.current_user_email()
);
