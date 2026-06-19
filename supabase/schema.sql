-- GrifoSys v2 — esquema Supabase
-- Ejecuta este archivo en el SQL Editor de tu proyecto Supabase
-- (Dashboard → SQL Editor → New query → pega y RUN).

-- ============================================================
-- Tabla de sesiones (turnos). Una fila por turno; el documento
-- completo vive en `data` (jsonb) y las demás columnas son espejo
-- indexable para filtrar por día / estado.
-- El id es determinístico: ${dia}_${isla}_${turno}.
-- ============================================================
create table if not exists public.sesiones (
  id            text primary key,
  dia_operativo text  not null,
  cerrada       boolean not null default false,
  created_at    bigint not null,
  updated_at    bigint not null,
  data          jsonb  not null
);

create index if not exists sesiones_dia_idx     on public.sesiones (dia_operativo);
create index if not exists sesiones_cerrada_idx on public.sesiones (cerrada);

-- ============================================================
-- Tabla de configuración global: precios y trabajadores.
-- ============================================================
create table if not exists public.config (
  key   text primary key,
  value jsonb not null
);

-- Semilla opcional (puedes editar precios/trabajadores luego desde el panel admin)
insert into public.config (key, value) values
  ('precios', '{"bio":15.0,"regular":16.0,"premium":17.5,"glp":2.5,"gasfull":60.0,"zetagas":58.0}'),
  ('trabajadores', '{"nombres":["Angel","Lenin","Miguel"]}')
on conflict (key) do nothing;

-- ============================================================
-- Tabla de backups (copias de seguridad). Cada fila es una
-- instantánea completa de TODAS las sesiones + la config en un
-- momento dado. Sirve para recuperar datos ante errores (sobre
-- todo los odómetros, que son continuos entre el turno noche de
-- un día y el turno mañana del siguiente). Se conservan como
-- máximo 3 copias (las más antiguas se podan en la app).
-- ============================================================
create table if not exists public.backups (
  id         text primary key,        -- bk_<timestamp>
  created_at bigint not null,
  dia        text   not null,         -- día operativo de la instantánea
  sesiones   jsonb  not null,         -- array de Sesion completas
  config     jsonb  not null default '{}'::jsonb
);

create index if not exists backups_created_idx on public.backups (created_at desc);

-- ============================================================
-- Realtime: publica cambios de ambas tablas.
-- ============================================================
alter publication supabase_realtime add table public.sesiones;
alter publication supabase_realtime add table public.config;

-- ============================================================
-- RLS. El sistema usa auth propia (nombre/contraseña), no Supabase
-- Auth, así que se permite acceso anónimo con la anon key. Si más
-- adelante migras a Supabase Auth, endurece estas políticas.
-- ============================================================
alter table public.sesiones enable row level security;
alter table public.config   enable row level security;
alter table public.backups  enable row level security;

drop policy if exists "sesiones_anon_all" on public.sesiones;
create policy "sesiones_anon_all" on public.sesiones
  for all using (true) with check (true);

drop policy if exists "config_anon_all" on public.config;
create policy "config_anon_all" on public.config
  for all using (true) with check (true);

drop policy if exists "backups_anon_all" on public.backups;
create policy "backups_anon_all" on public.backups
  for all using (true) with check (true);
