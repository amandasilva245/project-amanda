# Implantação do Curtain na Vercel (Services)

Este guia cobre a configuração inicial de frontend React/Vite e backend FastAPI no mesmo domínio. **Não significa que a implantação já foi realizada.** O Docker Compose continua disponível para desenvolvimento local.

## Serviços e rotas

| Serviço | Diretório | Acesso |
| --- | --- | --- |
| `frontend` | `frontend/` | Público em `/` (React/Vite) |
| `backend` | `backend/` | Público em `/api/*` (FastAPI) |

- `/api/v1/*` é encaminhado sem retirar o prefixo; as rotas Python já incluem `/api/v1`.
- O frontend já envia chamadas relativas para `/api/v1/*` por padrão. Deixe `VITE_API_BASE_URL` vazio.
- As rotas internas da SPA (`/login`, `/productions/:id` etc.) têm fallback para `/index.html` dentro do serviço frontend.
- Não há chamadas servidor→servidor entre `backend` e `frontend` que exijam um binding Vercel. O browser consome a API pública.

## Dependências persistentes (fora da Vercel Functions)

O `docker-compose.yml` usa PostgreSQL em `db:5432` e Redis em `redis:6379`. Esses hostnames Docker **não funcionam** na Vercel. Provisione PostgreSQL gerenciado e Redis compatível externamente; use as URLs e credenciais privadas fornecidas por seus provedores. Não migre credenciais para o repositório.

As migrações Alembic e a criação do administrador são feitas por `backend/migrate.py` e `backend/init_db.py`. Rode-as **uma vez**, em ambiente seguro com acesso ao mesmo banco de produção, antes de disponibilizar a API. Não rode migrações destrutivas nem crie usuários administrativos a cada requisição.

## Variáveis de ambiente na Vercel

Configure pelo painel de Environment Variables, sem inserir valores reais no Git:

| Variável | Obrigatória? | Orientação |
| --- | --- | --- |
| `DATABASE_URL` | Sim | URL PostgreSQL gerenciado e acessível pelo backend |
| `SECRET_KEY` | Sim | Segredo JWT forte, gerado aleatoriamente |
| `ENVIRONMENT` | Sim | `production` |
| `DEBUG` | Recomendada | `false` |
| `REDIS_URL` | Recomendada | URL Redis externo; o fallback em memória não é adequado a várias instâncias |
| `CORS_ORIGINS` | Opcional | Origens autorizadas, se clientes externos à mesma origem forem usados |
| `VITE_API_BASE_URL` | Opcional | Não configurar, ou deixar vazio, para usar o domínio atual |

A variável `VITE_API_BASE_URL` é lida no build de Vite; nunca coloque segredos nas variáveis `VITE_*`. O `DATABASE_URL` é consumido em runtime pelo backend. As variáveis `db` e `redis` do Compose não são bindings Vercel.

## Fluxo de implantação

1. Revise e mescle a PR com o arquivo `vercel.json`.
2. Configure um projeto na Vercel vinculado à branch desejada do repositório e com o **diretório raiz no repositório**, onde está `vercel.json`.
3. Configure PostgreSQL e Redis persistentes externos; configure as variáveis acima.
4. Em execução segura separada, aplique `alembic upgrade head` ou o script `backend/migrate.py` com as variáveis corretas e execute `backend/init_db.py` apenas após revisar sua criação de administrador.
5. Faça deploy na Vercel e verifique a URL de deploy. Para teste local, use `vercel dev -L` com variáveis seguras configuradas.
6. Confirme `/api/v1/system/*` ou outra rota documentada da API, faça login e teste as páginas de produções, finanças e ingressos, inclusive atualizando o navegador numa rota interna.

## Pontos de atenção antes de usar dados reais

- O backend ainda usa um pool SQLAlchemy de até 30 conexões por instância; avalie ajuste específico para ambiente serverless e limites do banco antes de produção.
- `STORAGE_BACKEND=local` / `MEDIA_ROOT=media` não oferece persistência garantida em funções; arquivos enviados devem usar armazenamento externo se a funcionalidade for ativada.
- A proteção de tentativas de login usa Redis, com fallback em memória por processo. Em Vercel, esse fallback não é compartilhado entre instâncias.
- Migrações, dados fictícios de demonstração, configuração do banco, testes integrados e deploy devem ser validados separadamente.
- Se senhas reais tiverem sido publicadas no Git, rotacione-as; apagar o arquivo atual não remove segredos do histórico.

Documentação: https://vercel.com/docs/services
