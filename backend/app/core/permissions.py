"""Grupos de papéis usados nas rotas (RNF03).

Fonte única para o backend; o frontend espelha estes grupos em
`frontend/src/utils/permissions.js` para decidir o que mostrar no menu.
"""

from app.models.user import UserRole as R

ALL_ROLES = tuple(R)

# Produções e elenco
PRODUCTION_WRITE = (R.ADMIN, R.PRODUCER, R.DIRECTOR)
PRODUCTION_DELETE = (R.ADMIN, R.PRODUCER)
PEOPLE_DIRECTORY = (R.ADMIN, R.PRODUCER, R.DIRECTOR)
# Papéis que só enxergam as produções das quais participam (RF11)
PARTICIPANT_ONLY = (R.ACTOR, R.TECHNICIAN)

# Companhias e recursos
COMPANY_WRITE = (R.ADMIN, R.PRODUCER)
RESOURCE_WRITE = (R.ADMIN, R.PRODUCER, R.DIRECTOR, R.TECHNICIAN)
# Tarefas: quem coordena cria e distribui; o responsável atualiza o andamento
TASK_WRITE = (R.ADMIN, R.PRODUCER, R.DIRECTOR)

# Agenda
SCHEDULE_WRITE = (R.ADMIN, R.PRODUCER, R.DIRECTOR)

# Financeiro
FINANCE_WRITE = (R.ADMIN, R.PRODUCER, R.FINANCIAL_MANAGER)
FINANCE_GLOBAL = (R.ADMIN, R.PRODUCER, R.FINANCIAL_MANAGER)
FINANCE_DELETE = (R.ADMIN, R.FINANCIAL_MANAGER)

# Ingressos
TICKETS_MANAGE = (R.ADMIN, R.PRODUCER, R.FINANCIAL_MANAGER)
TICKETS_CHECKIN = (R.ADMIN, R.PRODUCER, R.FINANCIAL_MANAGER, R.DIRECTOR, R.TECHNICIAN)

# Análises
INSIGHTS = (R.ADMIN, R.PRODUCER, R.FINANCIAL_MANAGER, R.DIRECTOR)
