# Gladwell — Plataforma: historia, usuarios y permisos

Documento de producto y fuente de verdad para el desarrollo del portal interno Gladwell.

---

## 1. Historia y visión

### 1.1 Qué es Gladwell

Gladwell es una firma de estrategia con tres pilares públicos:

- **Xperience** — vivencias y encuentros transformadores entre estrategas.
- **Consulting** — consultoría estratégica para organizaciones.
- **Education** — formación y desarrollo profesional.

La landing ([gladwellgroup.co](https://www.gladwellgroup.co)) es la puerta de entrada pública: presenta la marca, el equipo, los pilares y captura interesados vía Walking List.

### 1.2 Problema que resuelve el portal

Los leads de Walking List quedan en base de datos sin CRM interno ni flujos por rol. El portal centraliza:

1. **Captación** (landing) → **gestión** (super admin / admin comunidad).
2. **Curación** de integrantes seleccionados para hacer negocios en comunidad.
3. **Terapia Organizacional** — sesiones con invitados y entregable PDF al cierre.
4. **Identidad de comunidad** — perfiles tipo linktree para networking interno.

### 1.3 Evolución por fases

| Fase | Superficie | Descripción |
|------|------------|-------------|
| Fase 0 (actual) | Landing pública | Marketing, pilares, formulario Walking List → lead en Supabase |
| Fase 1 (v1 portal) | Sistema interno autenticado | Roles, rutas modulares, MVP: entregables de Terapia Organizacional |
| Fase 2 | Comunidad activa | Perfiles linktree, contenido, eventos, mensaje semanal en landing |
| Fase 3 | Automatización | Agente IA para gestión y delegación de leads |

### 1.4 Modelo de comunidad

Una sola comunidad Gladwell en v1, organizada conceptualmente bajo los tres pilares (Xperience, Consulting, Education). El diseño queda preparado para múltiples cohortes en el futuro.

---

## 2. Flujos principales

### 2.1 Walking List → CRM → delegación

1. El visitante completa la Walking List (nombre, correo, WhatsApp, red social).
2. El lead entra al CRM del super administrador.
3. El super admin delega el lead a un administrador de comunidad (fase temprana: manual).
4. Futuro: un agente IA gestiona el lead y propone delegación al admin de comunidad.
5. Tras curación, el super admin envía invitación para que la persona se una como integrante.

### 2.2 Acceso al portal (auth)

- Primera vez: solo por **invitación** (no hay registro público al portal).
- Sesiones posteriores: email + contraseña, magic link o Google OAuth.

### 2.3 Terapia Organizacional → entregable PDF

1. Super admin o admin comunidad captura los inputs de la sesión.
2. La IA genera un borrador de contenido estructurado.
3. Se renderiza un PDF con las conclusiones y recomendaciones.
4. Se entrega a los invitados de la sesión.

Aprobación colectiva por asistentes: **v2** (fuera de v1).

### 2.4 Encuentros: Terapia, Education y Charlas Catárticas

La sección **Encuentros** del portal (antes «Entregables») agrupa los espacios en vivo de la comunidad y su
calendario común. Son tres tipos, cada uno con su módulo (se otorga por persona desde `/super/usuarios`):

| Tipo | Módulo | Qué es | Entregable |
|------|--------|--------|------------|
| Terapia Organizacional | Encuentros · Terapia | Sesión de feedback a fundadores | Sí (PDF a la empresa invitada) |
| Gladwell Education | Encuentros · Educación | Sesión formativa con ponente | Sí (a los asistentes registrados) |
| Charlas Catárticas | Encuentros · Charlas Catárticas | Espacio abierto de la comunidad, sin guion | **No** |

Una **Charla Catártica** es solo nombre, fecha, foto y asistencia: lo que importa es tenerlas mapeadas en el
calendario y saber quién asistió. La asistencia se registra con un **código QR**: quien lo escanea deja su nombre
y correo en una página pública (sin login) que muestra la foto y el nombre de la charla; el código vence a las
24 horas y se regenera con un botón. Quien gestiona charlas ve la lista de asistentes (y puede quitar un registro
equivocado); quien solo tiene el calendario ve cuántas personas asistieron, nunca quiénes.

Las rutas viven en `/super/encuentros` y `/admin/encuentros`; las anteriores `…/entregables/…` redirigen.

---

## 3. Catálogo de usuarios (roles)

Roles en inglés en código y DB; UI en español.

| Rol técnico | Nombre UI | Quién es |
|-------------|-----------|----------|
| `super_admin` | Super administrador | Equipo fundador / operación central Gladwell |
| `community_admin` | Administrador de comunidad | Gestiona leads delegados, contenido y apoya sesiones |
| `community_member` | Integrante de comunidad | Miembro curado; perfil tipo linktree y networking interno |

### 3.1 Super administrador (`super_admin`)

**Objetivo:** operar la plataforma, la comunidad y los entregables de Terapia Organizacional.

**Labores principales:**

- Ver todos los leads y usuarios inscritos (CRM global).
- Delegar leads a administradores de comunidad.
- Crear administradores de comunidad y enviar invitaciones a nuevos integrantes.
- Eliminar usuarios de la plataforma.
- Crear eventos principales de la comunidad.
- Crear entregables de Terapia Organizacional (PDF al cierre de sesión).
- Publicar mensaje semanal en un bloque de la landing visible para la comunidad.
- Gestionar su perfil propio.

**Límites:** ninguno operativo en v1 (acceso total).

### 3.2 Administrador de comunidad (`community_admin`)

**Objetivo:** operar el día a día de la comunidad y los leads asignados.

**Labores principales:**

- Gestionar leads delegados (seguimiento, contacto, estado).
- Gestionar integrantes de la comunidad (en su ámbito).
- Publicar y gestionar contenido de comunidad.
- Crear entregables de Terapia Organizacional (misma capacidad que super admin).
- Gestionar su perfil propio.

**Límites:**

- Su base fija es mínima (perfil, directorio, leer y publicar contenido): CRM, Encuentros, Parrilla y calendario se los otorga el super admin por persona (ver §5.2).
- No crea otros super admins ni admins de comunidad.
- No elimina usuarios globalmente.
- No configura el mensaje semanal de la landing (solo super admin).
- Solo ve leads delegados a sí mismo.

### 3.3 Integrante de comunidad (`community_member`)

**Objetivo:** presencia curada en la comunidad y networking entre integrantes seleccionados.

**Perfil tipo linktree:**

- Público (visible para cualquiera) o privado (solo integrantes Gladwell).
- Enlaces a páginas y redes sociales.
- Texto de presentación para que otros integrantes lo conozcan.
- Refuerza que los miembros Gladwell están curados para hacer negocios y crecer juntos.

**Labores principales:**

- Crear y editar su perfil (público/privado, links, bio).
- Ver perfiles de otros integrantes (según visibilidad).
- Consumir contenido de comunidad asignado o publicado.
- Recibir entregables PDF si fue invitado a una Terapia Organizacional.

**Límites:**

- Sin acceso a CRM, delegación de leads ni gestión de usuarios.
- Sin creación de entregables ni eventos.
- Sin publicación de contenido global de comunidad.

---

## 4. Terapia Organizacional — datos y entregable

### 4.1 Información capturada de invitados

| Campo | Descripción |
|-------|-------------|
| Audios de la comunidad | Material de audio de la sesión / comunidad |
| Material fotográfico | Imágenes de la sesión |
| Red social | Instagram u otra red del invitado/empresa |
| Empresa | Descripción básica de la organización |
| Reto o problema | Problema que trae el invitado |
| Feedback cofundadores | Observaciones de los cofundadores Gladwell |
| Tipo de producto/servicio | Clasificación del negocio del invitado |

### 4.2 Contenido del entregable PDF

Generado de forma concreta a partir del input, incluyendo:

1. Qué se abordó en la sesión (problema real identificado).
2. Camino que tomó la sesión.
3. Recomendaciones generales.
4. Recomendaciones incómodas (redactadas por el moderador de la sesión).
5. Foto de grupo al cierre de la sesión.

### 4.3 Generación IA (v1)

- Prompt estructurado con los inputs de la sesión.
- La IA genera contenido concreto; el moderador aporta recomendaciones incómodas manualmente.
- Render a PDF en servidor.
- Preview antes de confirmar y entregar.

### 4.4 Aprobación colectiva (v2)

Flujo para que todos los asistentes aprueben el entregable antes de publicarlo. Fuera de v1.

---

## 5. Matriz de permisos

> **La fuente de verdad es el código** (`lib/permissions/roles.ts`, `matrix.ts` y `modules.ts`). Las tablas de esta sección las comprueba `tests/permissions-doc.test.ts`: al añadir o quitar un permiso, un módulo o un rol, o al cambiar lo que alguien recibe, la prueba falla hasta que se actualicen.

### 5.1 Permisos y quién los tiene

- `super_admin` tiene todos.
- `community_admin` y `community_member` traen una **base fija** pequeña («sí»). Lo demás se otorga **por persona** con los módulos de §5.2 («módulo»). Hoy el panel de usuarios solo los asigna a administradores de comunidad: para el integrante, todo lo que no es base es «no».
- **Reservado** quiere decir que el permiso existe en la matriz, pero ninguna pantalla ni ruta lo comprueba todavía.

| Permiso | Qué permite | super_admin | community_admin | community_member |
|---------|-------------|:-----------:|:---------------:|:----------------:|
| `users:invite` | Invitar usuarios nuevos. **Reservado**: el alta de cuentas hoy va por `users:create_admin`. | sí | no | no |
| `users:create_admin` | Crear cuentas, editar su cargo y módulos y restablecer contraseñas (`/super/usuarios`). | sí | no | no |
| `users:delete` | Eliminar usuarios de la plataforma. **Reservado**: todavía no hay pantalla. | sí | no | no |
| `users:list` | Ver la lista de usuarios (`/super/usuarios`). | sí | no | no |
| `profile:edit_own` | Editar el perfil propio. **Reservado**: `/perfil` solo exige sesión. | sí | sí | sí |
| `profile:view_members` | Ver el directorio de integrantes (`/comunidad/directorio`). | sí | sí | sí |
| `leads:read_all` | Ver todos los leads: CRM global (`/super/crm`). | sí | no | no |
| `leads:read_delegated` | Ver los leads delegados a sí mismo (`/admin/leads`). | sí | módulo | no |
| `leads:delegate` | Delegar un lead a un administrador de comunidad. | sí | no | no |
| `leads:update_status` | Cambiar el estado de contacto de un lead. | sí | módulo | no |
| `therapy:create` | Crear y editar sesiones de Terapia Organizacional y sus entregables. | sí | módulo | no |
| `therapy:deliver` | Entregar (aprobar y enviar) el entregable de Terapia. **Reservado**: hoy la aprobación depende de ser el moderador o un coadministrador de esa sesión. | sí | módulo | no |
| `therapy:read_own` | Ver las propias terapias. **Reservado**: ninguna pantalla lo comprueba todavía. | sí | sí | sí |
| `education:create` | Crear y editar sesiones de Education y sus entregables. | sí | módulo | no |
| `education:deliver` | Entregar (aprobar y enviar) el entregable de Education. **Reservado**: hoy la aprobación depende de ser el moderador o un coadministrador de esa sesión. | sí | módulo | no |
| `charlas:manage` | Crear y gestionar Charlas Catárticas: nombre, foto y asistencia por QR. | sí | módulo | no |
| `content:publish` | Publicar y gestionar el contenido de la comunidad (`/admin/contenido`); también abre `/admin/integrantes`. | sí | sí | no |
| `content:read` | Consumir el contenido de la comunidad (`/comunidad/contenido`). | sí | sí | sí |
| `events:create` | Crear eventos principales (`/super/eventos`). | sí | no | no |
| `landing:weekly_message` | Publicar el mensaje semanal de la landing (`/super/landing-mensaje`). | sí | no | no |
| `config:global` | Configuración global. **Reservado**: todavía no hay pantalla. | sí | no | no |
| `parrilla:manage` | Gestionar la Parrilla de contenido y las Frases (`/admin/parrilla`, `/api/parrilla`). | sí | módulo | no |
| `sessions:read_community` | Ver el calendario de todas las sesiones de la comunidad y abrir el detalle de cualquiera en modo lectura. | sí | módulo | no |
| `sessions:delegate_admin` | Designar coadministradores de una sesión concreta (Terapia o Education). | sí | no | no |

### 5.2 Módulos que se otorgan por persona

El super administrador los activa o los quita por persona en `/super/usuarios` (tabla `profile_module_grants`). Las claves son las que están guardadas en la base: renombrarlas dejaría sin acceso a quien ya lo tiene, así que el panel solo cambia la etiqueta.

| Módulo (clave) | Etiqueta en el panel | Permisos que concede |
|----------------|----------------------|----------------------|
| `crm` | CRM / Leads | `leads:read_delegated`, `leads:update_status` |
| `entregables_terapia` | Encuentros · Terapia | `therapy:create`, `therapy:deliver`, `sessions:read_community` |
| `entregables_educacion` | Encuentros · Educación | `education:create`, `education:deliver`, `sessions:read_community` |
| `charlas` | Encuentros · Charlas Catárticas | `charlas:manage`, `sessions:read_community` |
| `parrilla` | Parrilla de contenido | `parrilla:manage` |
| `calendario_sesiones` | Calendario de sesiones | `sessions:read_community` |

### 5.3 Límites que conviene conocer

- **Los módulos los hace cumplir la aplicación** (páginas y rutas del servidor, que usan la llave `service_role`). Las políticas RLS de la base distinguen por **rol**, no por módulo: son defensa en profundidad frente a la llave pública, no el reparto fino.
- **`/audio/[id]` es público** (sin sesión): lo abre quien tenga el enlace que viaja en el entregable. La dirección lleva el identificador de la sesión (no se adivina) y no se indexa, pero no hay un token aparte.
- **Una sesión revocada se sigue viendo hasta que vence su token** (hasta 1 h): las páginas verifican la firma del token en local (`getClaims()`). Las rutas de API que escriben vuelven a validarla contra Supabase Auth.
- **Hay listas sin tope** (Parrilla, Encuentros, Usuarios): con miles de filas habría que paginarlas, como ya se hizo en el CRM.

---

## 6. Mapa de rutas objetivo

```
app/
  (public)/                    # Landing actual — sin auth
  (auth)/
    login/
    invite/[token]/            # Aceptar invitación
  (portal)/
    layout.tsx                 # requireAuth + shell del portal
    perfil/                    # Los 3 roles
    super/
      crm/
      usuarios/
      eventos/
      terapia-organizacional/
      landing-mensaje/
    admin/
      leads/
      integrantes/
      contenido/
      terapia-organizacional/
    comunidad/
      perfil/                  # Linktree integrante
      directorio/
      contenido/
```

---

## 7. Fuera de alcance v1

- Flujo de aprobación colectiva de entregables por asistentes.
- Agente IA para gestión y delegación automática de leads.
- Múltiples comunidades independientes con aislamiento por tenant.
- App móvil nativa.
- Pagos / facturación.
- Chat en tiempo real.
- Notificaciones push avanzadas.
- Moderador como rol técnico separado.

---

## 8. Glosario

| Término | Definición |
|---------|------------|
| Walking List | Lista de espera / comunidad; formulario público de captación |
| Lead | Persona inscrita vía landing aún no integrante activo |
| Integrante | `community_member` con acceso al portal |
| Terapia Organizacional | Sesión con invitados; produce entregable PDF |
| Encuentros | Sección del portal con los tres tipos de espacio en vivo y su calendario común |
| Charla Catártica | Espacio abierto de la comunidad, sin guion ni entregable; se registra su asistencia por QR |
| Entregable | Documento PDF con conclusiones y recomendaciones de la sesión |
| Delegación | Asignación de un lead del super admin a un admin de comunidad |

---

## 9. Preguntas abiertas (TBD — no bloquean Fase 1)

1. Moderador de sesión: ¿rol fijo (cofundador) o asignable por evento?
2. Entrega PDF al invitado: ¿solo portal, solo email, o ambos en v1?
3. Admin comunidad: ¿puede dar de baja integrantes o solo super admin?
4. Pilares en perfil integrante: ¿etiqueta obligatoria o solo taxonomía de contenido?
5. Límites de storage para audios/fotos en Terapia Organizacional.
