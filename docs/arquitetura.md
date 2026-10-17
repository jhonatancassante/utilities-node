# Arquitetura

Visão da organização atual do código. O projeto ainda é pequeno: duas páginas (inicial e de status), quatro grupos de endpoints, uma camada de regras de negócio (`models/`) e a camada de acesso ao banco.

## Visão geral

A aplicação é um projeto [Next.js](https://nextjs.org/) com o **Pages Router**: as páginas ficam em `pages/` e os endpoints da API em `pages/api/`. Os dados ficam em um banco PostgreSQL, acessado diretamente pelo cliente `pg`, sem ORM.

Cada requisição à API atravessa as mesmas camadas:

```text
Cliente HTTP
    │
    ▼
pages/api/v1/...      Endpoint: lê a requisição e escolhe a resposta
    │
    ▼
infra/controller.js   Roteamento por método (next-connect) e tratamento de erros
    │
    ▼
models/               Regras de negócio: validações, senhas, sessões, migrations
    │
    ▼
infra/database.js     Conexão e consultas
    │
    ▼
PostgreSQL            Docker (desenvolvimento) / Neon via DATABASE_URL (produção)
```

Os endpoints são finos: cada um declara os métodos que aceita e delega o trabalho a um model. Um `GET` em `/api/v1/users/{username}`, por exemplo, só chama `user.findOneByUsername` e devolve o resultado.

## Estrutura do código

| Caminho                    | Responsabilidade                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pages/index.js`           | Página inicial provisória ("Em construção"), com estilos em `pages/index.module.css`                               |
| `pages/status/`            | Página `/status`, painel de monitoramento em tempo real (veja [Interface](#interface))                             |
| `pages/_app.js`            | Carrega os estilos globais em todas as páginas                                                                     |
| `pages/_document.js`       | HTML base: idioma, ícones, fontes e script que aplica o tema salvo antes da primeira pintura                       |
| `pages/api/v1/status`      | Endpoint de saúde da aplicação                                                                                     |
| `pages/api/v1/migrations`  | Endpoint para consultar e aplicar migrations                                                                       |
| `pages/api/v1/users`       | Cadastro (`POST`), consulta e atualização (`GET` e `PATCH` em `[username]`) de usuários                            |
| `pages/api/v1/sessions`    | Login (`POST`): valida as credenciais, cria a sessão e envia o cookie                                              |
| `models/user.js`           | Criar, buscar (por nome de usuário e por email) e atualizar usuários, com as validações                            |
| `models/password.js`       | Hash e comparação de senhas (HMAC com pepper e bcrypt)                                                             |
| `models/authentication.js` | Autentica por email e senha, sem revelar qual dos dois falhou                                                      |
| `models/session.js`        | Cria sessões (token aleatório e validade de 30 dias)                                                               |
| `models/migrator.js`       | Lista e aplica migrations pelo `node-pg-migrate`                                                                   |
| `components/`              | `AppHead` (título e descrição), `Header`, `Footer`, `Layout` (une os três) e `ThemeToggle` (tema claro e escuro)   |
| `configs/site.js`          | Configurações do site: nome, separador de título e descrição padrão                                                |
| `styles/`                  | `globals.css` (variáveis de cor, fonte e reset) e `shared.module.css` (estilos compartilhados entre as páginas)    |
| `infra/controller.js`      | Roteamento por método e tratamento de erros dos endpoints                                                          |
| `infra/database.js`        | Configuração da conexão e funções `query` e `getNewClient`                                                         |
| `infra/errors.js`          | Classes de erro da aplicação                                                                                       |
| `infra/migrations/`        | Migrations do banco                                                                                                |
| `infra/compose.yaml`       | Container do PostgreSQL local                                                                                      |
| `infra/scripts/`           | `dev.js` (ambiente de desenvolvimento), `spawn.js` (execução e encerramento de processos) e `wait-for-postgres.js` |
| `tests/`                   | Testes de integração e o `orchestrator.js`                                                                         |
| `next.config.js`           | Inclui as migrations no pacote da rota de migrations na Vercel                                                     |

A API é versionada no caminho (`/api/v1/...`), o que permite lançar uma `v2` sem quebrar quem usa a `v1`.

## Interface

### Estrutura das páginas

- **`pages/_app.js`** importa `styles/globals.css`, que vale para todas as páginas.
- **`pages/_document.js`** define `lang="pt-BR"`, os ícones, a cor do tema e o Font Awesome (por CDN). Também executa, antes da primeira pintura, um script que lê o tema salvo no `localStorage` (chave `theme`) e o aplica em `<html data-theme="...">`, evitando o "flash" de tema claro para quem escolheu o escuro.
- **`components/Layout`** monta a página com `Header`, o conteúdo e `Footer`. O `Header` mostra o título, o ícone, o botão de voltar (quando a página informa `backHref`) e o `ThemeToggle`.
- **`components/ThemeToggle`** alterna entre tema claro e escuro, lendo e gravando o atributo `data-theme`. Se o `localStorage` estiver indisponível, o tema vale só para a sessão.
- **`components/AppHead`** monta o `<title>` e a descrição da página. O título sai como `Nome do site | Título da página`; sem título, usa só o nome do site. Se a descrição não for informada, usa a padrão de `configs/site.js`.
- **`configs/site.js`** guarda o nome do site (`Utilities`), o separador do título e a descrição padrão. O objeto é congelado (`Object.freeze`).

### Estilos

- `styles/globals.css` define as variáveis de cor em `:root` (superfícies, texto, marca e as cores de sucesso, alerta e erro), com uma versão para o tema escuro. Carrega as fontes Space Grotesk, Inter e JetBrains Mono (Google Fonts) e faz o reset de estilos.
- `styles/shared.module.css` reúne estilos usados por mais de uma página (container, cartão, ícone e selo).
- Cada página e componente tem o seu CSS Module (`pages/index.module.css`, `pages/status/index.module.css`, `components/*/index.module.css`) para o que é específico dele.
- O ESLint valida o CSS e aceita variáveis ainda não declaradas no mesmo arquivo (`allowUnknownVariables`), já que elas vêm do `globals.css`.

### Página de status (`/status`)

Consome `GET /api/v1/status` com o [SWR](https://swr.vercel.app/), repetindo a consulta a cada 5 segundos (`refreshInterval: 5000`). Qualquer resposta que não seja de sucesso (`response.ok` falso) é tratada como erro.

| Situação            | Selo no topo          | O que a página mostra                                                      |
| ------------------- | --------------------- | -------------------------------------------------------------------------- |
| Carregando          | `CARREGANDO...`       | Barra de progresso no lugar das métricas do banco                          |
| Sucesso             | `SISTEMA OPERACIONAL` | Situação, máximo de conexões e conexões abertas, mais a última atualização |
| Falha na requisição | `ERRO NO SISTEMA`     | A mensagem "Não foi possível conectar ao banco de dados."                  |

Cada métrica aparece com a etiqueta `OK`. A de conexões abertas muda para `WARNING` quando passa de 80% do máximo, e qualquer valor ausente aparece como `N/A`, com a etiqueta `ERROR`.

## Acesso ao banco

O módulo `infra/database.js` expõe duas funções:

- **`query(queryObject)`:** abre uma conexão nova, executa a consulta e sempre fecha a conexão ao final. Se algo falhar (conexão ou SQL), lança um `ServiceError` com o erro original em `cause`. Aceita texto SQL ou um objeto `{ text, values }`, que deve ser usado com parâmetros (`$1`, `$2`...) sempre que houver valores vindos de fora.
- **`getNewClient()`:** devolve um cliente já conectado. Quem chama é responsável por fechá-lo com `client.end()`. É usado pelo `models/migrator.js`, que precisa de uma conexão própria para o `node-pg-migrate`.

Como cada chamada a `query` abre e fecha uma conexão, não há pool de conexões. Isso é simples e suficiente para o volume atual; se a aplicação passar a fazer muitas consultas por requisição, vale reavaliar.

### Configuração por ambiente

A função `getConfig` escolhe a configuração conforme o `NODE_ENV`:

| Ambiente                                      | Origem da configuração                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `development` e `test`                        | Variáveis `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_DB` e `POSTGRES_PASSWORD` |
| Qualquer outro (produção e preview na Vercel) | `DATABASE_URL`, com `sslmode=verify-full`. Se a variável não existir, lança um erro              |

### Banco de dados e migrations

- Usam o `node-pg-migrate`, com os arquivos em `infra/migrations`.
- O histórico fica na tabela `pgmigrations`.
- Podem ser aplicadas pelo terminal (`npm run migrations:up`) ou pelo endpoint `POST /api/v1/migrations`.
- No endpoint, `GET` roda em modo `dryRun` (só lista) e `POST` aplica de fato. A lógica está em `models/migrator.js`.
- Nenhuma migration tem reversão (`down = false`) e, uma vez aplicada em produção, não deve ser editada.

Tabelas hoje:

| Tabela     | Colunas                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `users`    | `id` (uuid), `username` (até 30), `email` (até 254), `password` (60, o hash), `created_at`, `updated_at` |
| `sessions` | `id` (uuid), `token` (96, único), `user_id`, `expires_at`, `created_at`, `updated_at`                    |

`username` e `email` são únicos. A aplicação também valida a unicidade sem diferenciar maiúsculas de minúsculas, e as buscas por nome de usuário e por email usam `LOWER()`. A coluna `sessions.user_id` ainda não tem chave estrangeira para `users`.

## Endpoints atuais

Os grupos de endpoints têm papéis diferentes:

- **`/api/v1/status`** serve apenas para verificar a saúde da aplicação. Hoje reporta a situação do banco e alimenta a página `/status`. A resposta organizada em `dependencies` permite acrescentar novos itens sem alterar o que já existe. A versão do banco não é enviada, para não expor a versão em uso.
- **`/api/v1/migrations`** é uma ferramenta de manutenção do banco. Hoje está **sem proteção**; o plano é torná-lo uma rota protegida. Até lá, qualquer cliente que alcance a URL pode executar `POST` e aplicar migrations.
- **`/api/v1/users`** cuida do cadastro, da consulta e da atualização de usuários. Hoje também está **sem proteção**, e as respostas incluem o hash da senha.
- **`/api/v1/sessions`** faz o login: valida email e senha, cria a sessão e envia o cookie `session_id`. Veja [autenticação](autenticacao.md).

Detalhes de cada um estão no [guia da API](api/README.md).

## Tratamento de erros

Todos os endpoints passam pelo `infra/controller.js`, que registra os métodos aceitos e trata os erros de forma única. O arquivo `infra/errors.js` define as classes de erro, todas com os campos `name`, `message`, `action` e `statusCode`. No JSON da resposta, o código aparece como `status_code`.

| Classe                  | Código | Aparece para o cliente? | Quando acontece                                                                   |
| ----------------------- | ------ | ----------------------- | --------------------------------------------------------------------------------- |
| `ValidationError`       | 400    | Sim                     | Dados inválidos ou duplicados (nome de usuário, email)                            |
| `UnauthorizedError`     | 401    | Sim                     | Login com credenciais que não conferem                                            |
| `NotFoundError`         | 404    | Sim                     | Recurso inexistente (usuário não encontrado)                                      |
| `MethodNotAllowedError` | 405    | Sim                     | Método HTTP não aceito pelo endpoint (a resposta traz o cabeçalho `Allow`)        |
| `InternalServerError`   | 500    | Sim (mensagem fixa)     | Qualquer erro inesperado                                                          |
| `ServiceError`          | 503    | Não                     | Falha no banco. Vira `InternalServerError` na resposta                            |
| `ConfigurationError`    | 500    | Não                     | Configuração ausente (por exemplo, `PASSWORD_PEPPER`). Vira `InternalServerError` |

Regra do controller: só `ValidationError`, `UnauthorizedError` e `NotFoundError` são devolvidos como estão. Qualquer outro erro é registrado no console, com o erro original em `cause`, e a resposta é sempre o `InternalServerError` com a mensagem fixa "Um erro interno não esperado aconteceu.", status 500. Assim detalhes internos (banco, variáveis de ambiente) nunca vazam.

O `MethodNotAllowedError` é tratado à parte, quando o método não corresponde a nenhum registrado: o controller responde 405 e preenche o cabeçalho `Allow` com os métodos aceitos pelo endpoint.

## Importações

Há duas formas de importar módulos do projeto, ambas configuradas para funcionar:

- **`@/`:** alias para a raiz do projeto, definido em `jsconfig.json`. Exemplo: `import database from "@/infra/database.js"`. É o usado no código da aplicação.
- **Caminho a partir da raiz** (`infra/...`, `tests/...`): funciona nos testes, porque o `jest.config.cjs` inclui a raiz em `moduleDirectories`.

## Qualidade de código

| Ferramenta          | Função                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| EditorConfig        | Indentação de 2 espaços, quebra de linha final e remoção de espaços no fim das linhas                                  |
| Prettier            | Formatação automática                                                                                                  |
| ESLint              | Análise de JavaScript (com as regras do Next.js e do Jest), JSON, Markdown e CSS                                       |
| Husky + lint-staged | Rodam as verificações antes de cada commit                                                                             |
| ggshield e Gitleaks | Impedem que segredos sejam commitados: nos hooks de commit (os dois) e no Pull Request (Gitleaks, pelo GitHub Actions) |
