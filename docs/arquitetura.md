# Arquitetura

Visão da organização atual do código. O projeto ainda é pequeno: uma página, dois endpoints e a camada de acesso ao banco.

## Visão geral

A aplicação é um projeto [Next.js](https://nextjs.org/) com o **Pages Router**: as páginas ficam em `pages/` e os endpoints da API em `pages/api/`. Os dados ficam em um banco PostgreSQL, acessado diretamente pelo cliente `pg`, sem ORM.

```text
Navegador / cliente HTTP
        │
        ▼
pages/            Páginas e endpoints (Next.js)
        │
        ▼
infra/database.js Conexão e consultas
        │
        ▼
PostgreSQL        Docker (desenvolvimento) / banco da Vercel via DATABASE_URL (produção)
```

## Estrutura do código

| Caminho                   | Responsabilidade                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pages/index.js`          | Página inicial provisória, com estilos em `pages/index.module.css`                                                 |
| `pages/api/v1/status`     | Endpoint de saúde da aplicação                                                                                     |
| `pages/api/v1/migrations` | Endpoint para consultar e aplicar migrations                                                                       |
| `infra/database.js`       | Configuração da conexão e funções `query` e `getNewClient`                                                         |
| `infra/migrations/`       | Migrations do banco                                                                                                |
| `infra/compose.yaml`      | Container do PostgreSQL local                                                                                      |
| `infra/scripts/`          | `dev.js` (ambiente de desenvolvimento), `spawn.js` (execução e encerramento de processos) e `wait-for-postgres.js` |
| `tests/`                  | Testes de integração e o `orchestrator.js`                                                                         |

A API é versionada no caminho (`/api/v1/...`), o que permite lançar uma `v2` sem quebrar quem usa a `v1`.

## Acesso ao banco

O módulo `infra/database.js` expõe duas funções:

- **`query(queryObject)`:** abre uma conexão nova, executa a consulta, registra o erro no console se falhar (e o relança) e sempre fecha a conexão ao final. Aceita texto SQL ou um objeto `{ text, values }`, que deve ser usado com parâmetros (`$1`, `$2`...) sempre que houver valores vindos de fora.
- **`getNewClient()`:** devolve um cliente já conectado. Quem chama é responsável por fechá-lo com `client.end()`. É usado pelo endpoint de migrations, que precisa de uma conexão própria para o `node-pg-migrate`.

Como cada chamada a `query` abre e fecha uma conexão, não há pool de conexões. Isso é simples e suficiente para o volume atual; se a aplicação passar a fazer muitas consultas por requisição, vale reavaliar.

### Configuração por ambiente

A função `getConfig` escolhe a configuração conforme o `NODE_ENV`:

| Ambiente                                      | Origem da configuração                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `development` e `test`                        | Variáveis `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_DB` e `POSTGRES_PASSWORD` |
| Qualquer outro (produção e preview na Vercel) | `DATABASE_URL`, com `sslmode=verify-full`. Se a variável não existir, lança um erro              |

### Migrations

- Usam o `node-pg-migrate`, com os arquivos em `infra/migrations`.
- O histórico fica na tabela `pgmigrations`.
- Podem ser aplicadas pelo terminal (`npm run migrations:up`) ou pelo endpoint `POST /api/v1/migrations`.
- No endpoint, `GET` roda em modo `dryRun` (só lista) e `POST` aplica de fato.

## Endpoints atuais

Os dois endpoints têm papéis diferentes:

- **`/api/v1/status`** serve apenas para verificar a saúde da aplicação. Hoje reporta a situação do banco. A aplicação ainda vai ganhar login e outras funcionalidades que usam o banco de dados, e a resposta organizada em `dependencies` permite acrescentar novos itens sem alterar o que já existe.
- **`/api/v1/migrations`** é uma ferramenta de manutenção do banco. Hoje está **sem proteção**; o plano é torná-lo uma rota protegida. Até lá, qualquer cliente que alcance a URL pode executar `POST` e aplicar migrations.

Detalhes de cada um estão no [guia da API](api/README.md).

## Tratamento de erros

- `/api/v1/migrations` responde `405` com `{ "error": "..." }` para métodos diferentes de `GET` e `POST`.
- Nos demais casos de falha (por exemplo, banco fora do ar), o erro é registrado no console e relançado. O Next.js responde `500`.
- Ainda não existe um padrão único de resposta de erro para a API.

## Importações

Há duas formas de importar módulos do projeto, ambas configuradas para funcionar:

- **`@/`:** alias para a raiz do projeto, definido em `jsconfig.json`. Exemplo: `import database from "@/infra/database.js"`. É o usado no código da aplicação.
- **Caminho a partir da raiz** (`infra/...`, `tests/...`): funciona nos testes, porque o `jest.config.js` inclui a raiz em `moduleDirectories`.

## Qualidade de código

| Ferramenta          | Função                                                                                |
| ------------------- | ------------------------------------------------------------------------------------- |
| EditorConfig        | Indentação de 2 espaços, quebra de linha final e remoção de espaços no fim das linhas |
| Prettier            | Formatação automática                                                                 |
| ESLint              | Análise de JavaScript (com as regras do Next.js e do Jest), JSON, Markdown e CSS      |
| Husky + lint-staged | Rodam as verificações antes de cada commit                                            |
| ggshield            | Impede que segredos sejam commitados                                                  |
