import { getEffectivePermissions, type Permission } from './matrix'
import type { Role } from './roles'

/** `profile_module_grants` embebido vía PostgREST → permisos efectivos. Un
 *  solo punto para esta conversión — antes se repetía (mapear el array de
 *  grants + llamar getEffectivePermissions) en session.ts, api.ts y los dos
 *  resolvers de acceso de Entregables, con el riesgo real de que una
 *  corrección de criterio se aplicara en unos y se olvidara en otro. */
export function resolvePermissionsFromGrants(
  role: Role,
  grants: readonly { module_key: string }[] | null | undefined
): Permission[] {
  const grantedModules = (grants ?? []).map((g) => g.module_key)
  return getEffectivePermissions(role, grantedModules)
}
