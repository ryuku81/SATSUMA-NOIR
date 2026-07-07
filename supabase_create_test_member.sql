do $$
declare
  new_user_id uuid := gen_random_uuid();
  member_email text := 'member@test.com';
  member_password text := 'member123';
begin
  if exists (select 1 from auth.users where email = member_email) then
    update auth.users
    set
      encrypted_password = crypt(member_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = '',
      raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      raw_user_meta_data = jsonb_build_object('name', 'テスト会員', 'email_verified', true),
      updated_at = now()
    where email = member_email
    returning id into new_user_id;
  else
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user,
      is_anonymous
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      member_email,
      crypt(member_password, gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('name', 'テスト会員', 'email_verified', true),
      now(),
      now(),
      false,
      false
    );
  end if;

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    new_user_id::text,
    new_user_id,
    jsonb_build_object(
      'sub', new_user_id::text,
      'email', member_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider, provider_id) do update
  set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    updated_at = now();

  insert into public.users (auth_user_id, email, name, role)
  values (new_user_id, member_email, 'テスト会員', 'member')
  on conflict (email) do update
  set
    auth_user_id = excluded.auth_user_id,
    name = excluded.name,
    role = 'member',
    updated_at = now();
end $$;
