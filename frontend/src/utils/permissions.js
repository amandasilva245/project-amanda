/**
 * Espelho de backend/app/core/permissions.py. Decide o que aparece no menu
 * e nos botões; a API continua sendo quem de fato autoriza (403).
 */
export const ROLES = {
  PRODUCTION_WRITE: ['admin', 'producer', 'director'],
  PRODUCTION_DELETE: ['admin', 'producer'],
  PEOPLE_DIRECTORY: ['admin', 'producer', 'director'],
  PEOPLE_ADMIN: ['admin'],
  COMPANY_WRITE: ['admin', 'producer'],
  RESOURCE_WRITE: ['admin', 'producer', 'director', 'technician'],
  TASK_WRITE: ['admin', 'producer', 'director'],
  SCHEDULE_WRITE: ['admin', 'producer', 'director'],
  FINANCE_WRITE: ['admin', 'producer', 'financial_manager'],
  FINANCE_GLOBAL: ['admin', 'producer', 'financial_manager'],
  FINANCE_DELETE: ['admin', 'financial_manager'],
  TICKETS_MANAGE: ['admin', 'producer', 'financial_manager'],
  TICKETS_CHECKIN: ['admin', 'producer', 'financial_manager', 'director', 'technician'],
  INSIGHTS: ['admin', 'producer', 'financial_manager', 'director'],
}

/** can(user, 'FINANCE_WRITE') → true/false */
export function can(user, permission) {
  const allowed = ROLES[permission]
  return !!user && !!allowed && allowed.includes(user.role)
}
