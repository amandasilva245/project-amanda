# Curtain — Sistema ERP Teatral

Plataforma de gestão para companhias de teatro. Gerencia produções, elenco, finanças, ingressos e muito mais.

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | 24+ |
| [Docker Compose](https://docs.docker.com/compose/) | v2 (incluído no Docker Desktop) |

Não é necessário instalar Node.js, Python ou PostgreSQL localmente — tudo roda em contêineres.

---

## Iniciando o Sistema

### 1ª vez (ou após resetar o banco)

```bash
# Na raiz do projeto (onde está o docker-compose.yml)
docker compose up -d
```

Aguarde cerca de 30 segundos para o banco inicializar. Depois acesse:

| URL | Descrição |
|---|---|
| http://localhost | Interface principal (via nginx) |
| http://localhost:5173 | Frontend direto |
| http://localhost:8000/api/docs | Documentação da API (Swagger UI; disponível quando `ENVIRONMENT` não é `production`) |

### Parar o sistema

```bash
docker compose down
```

### Reiniciar após mudanças no backend

O backend tem hot-reload via volume mount — **não precisa reconstruir**.

### Reconstruir o frontend (após alterar arquivos em `frontend/src/`)

```bash
docker compose build frontend
docker compose up -d frontend nginx
```

---

## Credenciais de Acesso

| Campo | Valor |
|---|---|
| E-mail | `admin@curtain.app` |
| Senha | `Admin@123` |
| Papel | Administrador |

---

## Módulos

| Módulo | Rota | Descrição |
|---|---|---|
| **Dashboard** | `/` | Visão geral com métricas |
| **Produções** | `/productions` | Criar e gerenciar peças teatrais |
| **Elenco & Equipe** | `/cast` | Cadastro de pessoas, atribuição a produções |
| **Financeiro** | `/finance` | Receitas, despesas e saldo por produção |
| **Ingressos** | `/tickets` | Controle de vendas |
| **Insights** | `/insights` | Relatórios e análises |
| **Configurações** | `/settings` | Perfil, segurança e informações do sistema |

---

## Arquitetura

```
project amanda/
├── backend/                # FastAPI + Python 3.12 + SQLAlchemy 2
│   └── app/
│       ├── api/v1/         # Endpoints REST
│       ├── core/           # Segurança, configurações, dependências
│       ├── models/         # Modelos SQLAlchemy
│       └── schemas/        # Schemas Pydantic
├── frontend/               # React 18 + Vite 5
│   └── src/
│       ├── components/     # UI reutilizável (Button, Input, Modal, etc.)
│       ├── pages/          # Páginas (productions, cast, finance, settings…)
│       ├── store/          # Estado global Zustand
│       ├── services/       # Cliente Axios
│       └── styles/         # Tokens CSS globais
├── docker-compose.yml      # Orquestração dos 5 serviços
└── README.md
```

### Serviços Docker

| Serviço | Imagem | Porta |
|---|---|---|
| `db` | postgres:15-alpine | 5432 (interno) |
| `redis` | redis:7-alpine | 6379 (interno) |
| `backend` | Build local | 8000 |
| `frontend` | Build local (nginx) | 5173 |
| `nginx` | nginx:alpine | 80 |

---

## Comandos Úteis

```bash
# Ver logs de todos os serviços
docker compose logs -f

# Ver logs só do backend
docker compose logs -f backend

# Verificar estado dos contêineres
docker compose ps

# Recriar tudo do zero (⚠️ apaga o banco)
docker compose down
docker volume rm projectamanda_postgres_data
docker compose up -d

# Criar tabelas e usuário admin manualmente (após resetar banco)
docker compose exec backend python init_db.py
from app.db.session import SessionLocal
from app.models.user import User
import bcrypt
db = SessionLocal()
pw = bcrypt.hashpw(b'Admin@2026', bcrypt.gensalt(12)).decode()
u = User(email='admin@curtain.app', full_name='Admin', hashed_password=pw, role='admin', is_active=True)
db.add(u); db.commit()
print('Admin criado')
"

# Acessar o banco PostgreSQL
docker compose exec db psql -U curtain_user -d curtain_db
```

---

## Stack Tecnológica

**Backend**
- FastAPI · Python 3.12 · SQLAlchemy 2.x (async) · Pydantic v2
- JWT (python-jose) · bcrypt · Alembic (migrações)

**Frontend**
- React 18 · Vite 5 · React Router v6
- Zustand (estado) · Axios (HTTP) · Framer Motion (animações)
- CSS Modules com design tokens

**Infraestrutura**
- Docker Compose · PostgreSQL 15 · Redis 7 · Nginx

  #### Status Atual e Observações

Atualmente, o projeto está em desenvolvimento com as seguintes observações:

- Gestão de Peças: A regra de negócio está 100% operacional e testada.
- Cadastro de Funcionários: O cadastro de funcionários apresenta uma instabilidade devido a um erro de persistência no banco de dados (PostgreSQL). 
