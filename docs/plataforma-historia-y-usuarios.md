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

## 5. Matriz de permisos v1

| Módulo / acción | super_admin | community_admin | community_member |
|-----------------|:-----------:|:---------------:|:----------------:|
| Auth — invitar usuarios | sí | no | no |
| Auth — login (email / magic / Google) | sí | sí | sí |
| Perfil propio | sí | sí | sí |
| Perfil linktree público/privado | propio | propio | sí |
| Ver perfiles de integrantes | sí | sí | sí |
| CRM — ver todos los leads | sí | no | no |
| CRM — ver leads delegados | sí | sí | no |
| CRM — delegar leads | sí | no | no |
| Gestión integrantes | sí | parcial | no |
| Eliminar usuarios | sí | no | no |
| Crear admins de comunidad | sí | no | no |
| Contenido comunidad — publicar | sí | sí | no |
| Contenido comunidad — consumir | sí | sí | sí |
| Eventos principales — crear | sí | no | no |
| Terapia — capturar inputs | sí | sí | no |
| Terapia — generar PDF (IA) | sí | sí | no |
| Terapia — recibir PDF | sí | sí | si invitado |
| Landing — mensaje semanal | sí | no | no |
| Configuración global | sí | no | no |

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
| Entregable | Documento PDF con conclusiones y recomendaciones de la sesión |
| Delegación | Asignación de un lead del super admin a un admin de comunidad |

---

## 9. Preguntas abiertas (TBD — no bloquean Fase 1)

1. Moderador de sesión: ¿rol fijo (cofundador) o asignable por evento?
2. Entrega PDF al invitado: ¿solo portal, solo email, o ambos en v1?
3. Admin comunidad: ¿puede dar de baja integrantes o solo super admin?
4. Pilares en perfil integrante: ¿etiqueta obligatoria o solo taxonomía de contenido?
5. Límites de storage para audios/fotos en Terapia Organizacional.
