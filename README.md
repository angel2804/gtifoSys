# GrifoSys v2

Sistema de gestión para estación de servicios (grifo). Reescritura limpia de GrifoSys con **Supabase** (en lugar de Firebase), mismo dominio y lógica de negocio.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn (Base UI) · Zustand · Supabase (Postgres + Realtime) · exceljs.

## Puesta en marcha

1. **Crear proyecto en Supabase** → https://supabase.com
2. **Credenciales**: Project Settings → API. Copia `Project URL` y `anon public` key a `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   ```
3. **Crear las tablas**: en el Dashboard → SQL Editor → New query, pega el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) y pulsa **RUN**. Crea las tablas
   `sesiones` y `config`, los índices, Realtime y las políticas RLS.
4. `npm install`
5. `npm run dev` → http://localhost:3000

Sin credenciales, la app funciona en **modo local** (localStorage) sin sincronización en la nube.

## Accesos

- **Trabajador**: elige su nombre y arma su turno (isla + turno).
- **Admin**: contraseña (`NEXT_PUBLIC_ADMIN_PASSWORD`, por defecto `admin123`).
- **Configuraciones** (reset de BD, pruebas): segunda contraseña
  (`NEXT_PUBLIC_CONFIG_PASSWORD`, por defecto `angelccasa284`).

## Scripts

- `npm run dev` — desarrollo
- `npm run build` — build de producción
- `npm test` — pruebas unitarias del cuadre (vitest)
- `npm run lint` — eslint

## Arquitectura

- `src/lib/` — dominio puro (sin backend): `types`, `config`, `calc` (cuadre,
  día operativo 6am–6am, gating de turnos por cascada, reporte del día),
  `registro-columns`, `store` (Zustand + persist).
- `src/lib/supabase.ts` + `src/lib/db.ts` — única capa que habla con Supabase.
- `src/components/supabase-sync.tsx` — sincronización en vivo (Realtime).
- `src/app/` — `/` login, `/setup` selección de turno, `/dashboard` turno del
  trabajador, `/admin` panel, `/api/export-*` exportación a Excel.
- `supabase/schema.sql` — esquema de la base de datos.
