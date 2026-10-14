# Arquitetura

Visão da organização atual do código. O projeto ainda é pequeno: duas páginas (inicial e de status), dois endpoints e a camada de acesso ao banco.

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
| `pages/index.js`          | Página inicial provisória ("Em construção"), com estilos em `pages/index.module.css`                               |
| `pages/status/`           | Página `/status`, painel de monitoramento em tempo real (veja [Interface](#interface))                             |
| `pages/_app.js`           | Carrega os estilos globais em todas as páginas                                                                     |
| `pages/api/v1/status`     | Endpoint de saúde da aplicação                                                                                     |
| `pages/api/v1/migrations` | Endpoint para consultar e aplicar migrations                                                                       |
| `components/AppHead/`     | Componente que define o título e a descrição (`<head>`) de cada página                                             |
| `configs/site.js`         | Configurações do site: nome, separador de título e descrição padrão                                                |
| `styles/`                 | `globals.css` (variáveis de cor, fonte e reset) e `shared.module.css` (estilos compartilhados entre as páginas)    |
| `infra/database.js`       | Configuração da conexão e funções `query` e `getNewClient`                                                         |
| `infra/errors.js`         | Classes de erro da aplicação                                                                                       |
| `infra/migrations/`       | Migrations do banco                                                                                                |
| `infra/compose.yaml`      | Container do PostgreSQL local                                                                                      |
| `infra/scripts/`          | `dev.js` (ambiente de desenvolvimento), `spawn.js` (execução e encerramento de processos) e `wait-for-postgres.js` |
| `tests/`                  | Testes de integração e o `orchestrator.js`                                                                         |

A API é versionada no caminho (`/api/v1/...`), o que permite lançar uma `v2` sem quebrar quem usa a `v1`.

## Interface

### Estrutura das páginas

- **`pages/_app.js`** importa `styles/globals.css`, que vale para todas as páginas.
- **`components/AppHead`** monta o `<title>` e a descrição da página. O título sai como `Nome do site | Título da página`; sem título, usa só o nome do site. Se a descrição não for informada, usa a padrão de `configs/site.js`.
- **`configs/site.js`** guarda o nome do site (`Utilities`), o separador do título e a descrição padrão. O objeto é congelado (`Object.freeze`).

### Estilos

- `styles/globals.css` define as variáveis de cor em `:root` (fundo, superfície, cor primária, textos e as cores de sucesso, alerta e erro), carrega a fonte Fira Sans (Google Fonts) e faz o reset de estilos.
- `styles/shared.module.css` reúne estilos usados por mais de uma página (container, cartão, ícone e selo).
- Cada página tem o seu CSS Module (`pages/index.module.css`, `pages/status/index.module.css`) para o que é específico dela.
- O ESLint valida o CSS e aceita variáveis ainda não declaradas no mesmo arquivo (`allowUnknownVariables`), já que elas vêm do `globals.css`.

### Página de status (`/status`)

Consome `GET /api/v1/status` com o [SWR](https://swr.vercel.app/), repetindo a consulta a cada 5 segundos (`refreshInterval: 5000`). Qualquer resposta que não seja de sucesso (`response.ok` falso) é tratada como erro.

| Situação            | Selo no topo          | O que a página mostra                                                    |
| ------------------- | --------------------- | ------------------------------------------------------------------------ |
| Carregando          | `CARREGANDO...`       | Barra de progresso no lugar das métricas do banco                        |
| Sucesso             | `SISTEMA OPERACIONAL` | Versão, máximo de conexões e conexões abertas, mais a última atualização |
| Falha na requisição | `ERRO NO SISTEMA`     | A mensagem "Não foi possível conectar ao banco de dados."                |

Cada métrica aparece com a etiqueta `OK`. A de conexões abertas muda para `CARGA ALTA` quando passa de 80% do máximo, e qualquer valor ausente aparece como `N/A`, com a etiqueta `ERROR`.

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

- **`/api/v1/status`** serve apenas para verificar a saúde da aplicação. Hoje reporta a situação do banco e alimenta a página `/status`. A aplicação ainda vai ganhar login e outras funcionalidades que usam o banco de dados, e a resposta organizada em `dependencies` permite acrescentar novos itens sem alterar o que já existe.
- **`/api/v1/migrations`** é uma ferramenta de manutenção do banco. Hoje está **sem proteção**; o plano é torná-lo uma rota protegida. Até lá, qualquer cliente que alcance a URL pode executar `POST` e aplicar migrations.

Detalhes de cada um estão no [guia da API](api/README.md).

## Tratamento de erros

O arquivo `infra/errors.js` define a classe `InternalServerError`, com os campos:

| Campo        | Valor                                     |
| ------------ | ----------------------------------------- |
| `name`       | `InternalServerError`                     |
| `message`    | `Um erro interno não esperado aconteceu.` |
| `action`     | `Entre em contato com o suporte.`         |
| `statusCode` | `500`                                     |

O erro original fica guardado em `cause`, para registro no log, e **não** vai para a resposta: o `toJSON` expõe só os quatro campos acima.

Situação atual por endpoint:

- **`/api/v1/status`:** captura qualquer falha, registra o erro no console e responde `500` com o JSON do `InternalServerError`.
- **`/api/v1/migrations`:** responde `405` com `{ "error": "..." }` para métodos diferentes de `GET` e `POST`. Nas demais falhas, registra o erro e o relança, e o Next.js responde `500` com um corpo que não é JSON.

Ou seja, ainda não existe um padrão único de resposta de erro: só o endpoint de status usa o `InternalServerError`.

## Importações

Há duas formas de importar módulos do projeto, ambas configuradas para funcionar:

- **`@/`:** alias para a raiz do projeto, definido em `jsconfig.json`. Exemplo: `import database from "@/infra/database.js"`. É o usado no código da aplicação.
- **Caminho a partir da raiz** (`infra/...`, `tests/...`): funciona nos testes, porque o `jest.config.js` inclui a raiz em `moduleDirectories`.

## Qualidade de código

| Ferramenta          | Função                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| EditorConfig        | Indentação de 2 espaços, quebra de linha final e remoção de espaços no fim das linhas                                  |
| Prettier            | Formatação automática                                                                                                  |
| ESLint              | Análise de JavaScript (com as regras do Next.js e do Jest), JSON, Markdown e CSS                                       |
| Husky + lint-staged | Rodam as verificações antes de cada commit                                                                             |
| ggshield e Gitleaks | Impedem que segredos sejam commitados: nos hooks de commit (os dois) e no Pull Request (Gitleaks, pelo GitHub Actions) |
