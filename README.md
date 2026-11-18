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

Na primeira subida, o `init_db.py` cria o administrador inicial:

| Campo | Valor |
|---|---|
| E-mail | `ADMIN_EMAIL` do `.env` (padrão `admin@curtain.app`) |
| Senha | `ADMIN_PASSWORD` do `.env`; se vazio, uma senha forte é gerada e gravada em `backend/.admin-initial-password` |
| Papel | Administrador |

Depois do primeiro login, troque a senha em **Configurações** e apague o arquivo `.admin-initial-password`.
Bancos que já tinham um administrador não são alterados.

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

# Aplicar migrações e criar o admin inicial (idempotente, não apaga dados)
docker compose exec backend python init_db.py

# Só as migrações
docker compose exec backend python migrate.py

# Acessar o banco PostgreSQL
docker compose exec db psql -U curtain_user -d curtain_db
```

---

## Testes e Migrações

### Testes do backend (pytest)

Os testes usam um banco **separado**, cujo nome precisa terminar em `test`
(todas as tabelas dele são esvaziadas entre os testes):

```bash
docker compose exec db createdb -U curtain_user curtain_test
docker compose exec -e TEST_DATABASE_URL=postgresql://curtain_user:${DB_PASSWORD}@db:5432/curtain_test \
  backend sh -c "pip install -q -r requirements-dev.txt && pytest"
```

### Migrações (Alembic)

- `python migrate.py` aplica as migrações pendentes. Um banco criado antes das
  migrações (inclusive com a tabela `alembic_version` vazia) é reconhecido e
  marcado como `0001` sem nenhuma alteração. Faça um `pg_dump` antes, por garantia.
- Nova migração depois de mudar um modelo: `alembic revision --autogenerate -m "descrição"`.
- Desfazer a última: `alembic downgrade -1`.

## Venda online de ingressos (Mercado Pago, sandbox)

A página pública fica em `/ingressos`. Ela mostra as sessões à venda das
produções marcadas como **"Mostrar na página pública"** (editar produção).

1. Crie uma conta de teste no [painel de desenvolvedores do Mercado Pago](https://www.mercadopago.com.br/developers/panel)
   e copie a **credencial de teste** (Access Token que começa com `TEST-`).
2. No `.env`: `PUBLIC_SALES_ENABLED=true` e `MERCADOPAGO_ACCESS_TOKEN=TEST-...`.
3. Opcional, com a API publicada em https: `PUBLIC_API_URL=https://seu-dominio`
   e, no painel, ative Webhooks (evento "Pagamentos") para
   `https://seu-dominio/api/v1/public/payments/mercadopago/webhook`; copie a
   assinatura secreta para `MERCADOPAGO_WEBHOOK_SECRET`.
4. Pague com os [cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards).

Garantias: credencial de produção (`APP_USR-`) é recusada; nenhum dado de
cartão passa pelo Curtain; os lugares ficam guardados por 30 minutos
(`ORDER_HOLD_MINUTES`) e voltam à venda se o pagamento não sair; o status do
pagamento é sempre lido na API do Mercado Pago. Os pedidos aparecem em
**Bilheteria › Venda online**.

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
