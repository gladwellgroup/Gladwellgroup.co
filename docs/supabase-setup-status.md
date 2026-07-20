# Estado de Supabase — contexto de la sesión de setup

Proyecto: `ovvcvcdqjvawoircfpif` (`.env.local` → `NEXT_PUBLIC_SUPABASE_URL`). Este documento resume qué se corrió, en qué orden, qué bugs aparecieron y cómo se corrigieron, y qué queda pendiente. Los archivos de migración en `supabase/migrations/` ya reflejan el estado final corregido — este doc explica el *por qué* detrás de esas versiones.

## Estado actual (checklist)

| # | Migración | Estado |
|---|---|---|
| 1 | `20250707_profiles_roles.sql` | ✅ Aplicada + parche de recursión RLS aplicado |
| 2 | `20250707_invitations.sql` | ✅ Aplicada |
| 3 | `20250707_leads_delegation.sql` | ✅ Aplicada |
| 4 | `20250707_therapy_sessions.sql` | ✅ Aplicada (con `moderator_id not null` ya incluido) |
| 6 | `20260707_walking_list_leads_rls.sql` | ✅ Aplicada y verificada |
| 7 | Bootstrap invitación (`gladwell.group1@gmail.com`, `super_admin`) | ✅ Aplicada, vigente, sin usar (`accepted_at: null`) |
| 5 | `20260707_profiles_signup_trigger.sql` | ⚠️ Primer intento falló (ver bug #3). Versión corregida ya está en el archivo del repo — **falta confirmar que se corrió en Supabase y que un "Create user" de prueba funciona sin error.** |
| — | `20250603_walking_list_whatsapp.sql` (preexistente, no parte de los 7) | ✅ Aplicada como fix urgente (ver bug #1) |

**Lo único pendiente de confirmar en Supabase ahora mismo:** volver a correr la versión corregida del script 5 (con 2 triggers separados, ver bug #3) y probar crear un usuario desde el Dashboard sin que dé error de FK.

## Bugs encontrados y su fix (importante para no repetirlos)

### 1. Columnas de WhatsApp faltantes en `walking_list_leads` (bug preexistente, no relacionado a los 7 scripts)
`app/api/walking-list/route.ts` inserta `whatsapp_pais/indicativo/numero/e164`, pero la migración `20250603_walking_list_whatsapp.sql` nunca se había aplicado. El formulario público de Walking List estaba fallando en producción. Se aplicó ese script como fix urgente, separado del resto.

### 2. Recursión infinita en RLS de `profiles`
Una policy sobre `profiles` que hace `exists (select ... from profiles where ...)` **dentro de una policy de la propia tabla `profiles`** causa recursión infinita (`42P17`). Se resolvió creando una función `security definer` (`public.is_super_admin()`) que bypassa RLS en su lookup interno, y la policy de `profiles` la usa en vez de inlinear el `exists`. Las demás tablas (`invitations`, `therapy_sessions`, `walking_list_leads`) SÍ pueden usar el `exists` inline sin problema porque consultan `profiles` desde una policy de *otra* tabla — ahí no hay auto-referencia.

### 3. Trigger `before insert` no puede insertar en `profiles` (bug más reciente, en corrección)
El trigger de creación de perfil estaba unificado como un solo `before insert on auth.users`. Problema: en un trigger `BEFORE`, la fila de `new` todavía no existe físicamente en `auth.users` — así que el `insert into profiles (id, ...) values (new.id, ...)` viola el FK `profiles_id_fkey` (`23503`), porque ese `id` aún no está en `auth.users`.

**Fix:** separar en dos triggers:
- `check_invitation_before_signup` — `BEFORE INSERT`, solo valida y hace `raise exception` si no hay invitación vigente (no toca `profiles`).
- `handle_new_user` — `AFTER INSERT`, crea el perfil y marca la invitación como aceptada (para entonces la fila ya existe en `auth.users`, el FK se satisface).

Este es el cambio que está en el archivo actual del repo pero que falta confirmar en Supabase.

## Decisiones de diseño deliberadas (no son bugs, no cambiarlas sin discutirlo)

- **Signup 100% por invitación (modo estricto).** Sin invitación vigente en `invitations` (no aceptada, no expirada), el registro se rechaza por completo. Decisión explícita del usuario, no un default — implica que **cualquier usuario nuevo necesita un `insert into invitations` manual** hasta que exista una pantalla de invitaciones (fuera de alcance por ahora).
- **RLS en `walking_list_leads` y `profiles` es defensa en profundidad, no cambia el comportamiento actual de la app** — todo el código de la app (`/api/walking-list`, CRM, terapia) usa `getSupabaseServer()` (`service_role`, bypassa RLS). Las policies protegen contra un hipotético acceso directo con la `anon key` (que es pública, va en el JS del cliente).
- **`moderator_id` en `therapy_sessions` es obligatorio y seleccionable**, no siempre el creador de la sesión. Un `super_admin` (o `community_admin`) puede asignar a cualquier otro admin como moderador desde un dropdown en `components/portal/therapy-dashboard.tsx`. Cambio de código relacionado, ya implementado: `lib/validations/therapy.ts`, `app/api/therapy/sessions/route.ts`, ambas páginas `*/terapia-organizacional/page.tsx`.

## Pendiente / no resuelto todavía

1. **Confirmar el fix del bug #3** (correr la versión de 2 triggers, probar "Create user" en el Dashboard sin error).
2. **Email no configurado**: el proyecto no tiene SMTP propio (Resend, SendGrid, etc.) conectado en Authentication → Settings → SMTP. El servicio de correo por defecto de Supabase es muy limitado (pensado solo para pruebas) y probablemente no entrega el magic link de forma confiable. Dos salidas posibles, sin decidir aún:
   - Agregar login con contraseña a `/login` (hoy solo tiene magic link + Google OAuth, sin campo de contraseña).
   - Confirmar si Google OAuth ya está configurado en Authentication → Providers (no depende de SMTP).
3. **No existe pantalla de invitaciones** — invitar a alguien nuevo hoy requiere un `insert` manual en `invitations` vía SQL Editor.
