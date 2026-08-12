-- Migración 20260809191140_profiles
-- Volcado del esquema ya aplicado en el proyecto remoto (SPEC 04, paso 1).
-- Perfil público de cada jugador: el nombre que se muestra en el Nav y en el
-- Salón de la Fama. El correo y la contraseña viven en auth.users, no aquí.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(username) between 1 and 10),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Lectura pública: el Salón de la Fama mostrará nombres ajenos.
create policy "perfiles legibles por cualquiera"
  on public.profiles for select using (true);

-- Cada quien edita solo el suyo.
create policy "cada usuario edita su perfil"
  on public.profiles for update using (auth.uid() = id);

-- El perfil lo crea este trigger, nunca el cliente: no hay política de insert.
-- El nombre sale de options.data.username del signUp; si no viene, del correo.
-- Aquí se normaliza a mayúsculas y se corta a 10 caracteres.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    upper(left(coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    ), 10))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
