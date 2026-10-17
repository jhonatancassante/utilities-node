# Guia de desenvolvimento

Este guia complementa o [README](../README.md) com os detalhes do dia a dia de desenvolvimento.

## Ambiente local

### Versões

- **Node.js:** 24.14.1, definido em `.nvmrc`. O `package.json` exige Node 24 (`engines`).
- **PostgreSQL:** 16.0 (`postgres:16.0-alpine3.18`), definido em `infra/compose.yaml`. Roda em um container chamado `postgres-dev`, na porta `5432`.
- **npm:** o arquivo `.npmrc` ativa `legacy-peer-deps=true`, então a instalação ignora conflitos de _peer dependencies_.

### Variáveis de ambiente

O arquivo `.env.development` é versionado e contém apenas valores de desenvolvimento, descartáveis:

| Variável                                                                              | Para que serve                                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` | Conexão com o banco local; o Docker Compose cria o banco com esses dados |
| `DATABASE_URL`                                                                        | Montada a partir das variáveis acima. Usada pelo `node-pg-migrate`       |
| `PASSWORD_PEPPER`                                                                     | Segredo aplicado às senhas antes do bcrypt (valor de exemplo)            |

O arquivo é lido pelo Docker Compose, pelos scripts de migration e pelo Jest.

Os verificadores de segredos já levam isso em conta: o Gitleaks ignora o `.env.development` (veja `.gitleaks.toml`) e o `.gitguardian.yaml` define os caminhos que o ggshield ignora (`node_modules` e `.next`). Se o ggshield acusar os valores locais como segredo, o `.gitguardian.yaml` traz, comentado, o formato para ignorar essa ocorrência específica.

Em produção, as variáveis ficam no painel da Vercel. O arquivo `.env` está no `.gitignore`.

## Fluxo de trabalho

### Subir o ambiente

```bash
npm run dev
```

Por trás, o `npm run dev` executa `infra/scripts/dev.js`, que roda o `dev:raw` e, quando ele termina, para os containers:

| Etapa | Comando                          | O que acontece                                             |
| ----- | -------------------------------- | ---------------------------------------------------------- |
| 1     | `npm run services:up`            | Sobe o PostgreSQL com `docker compose`                     |
| 2     | `npm run services:wait:database` | Consulta o `pg_isready` no container até o banco responder |
| 3     | `npm run migrations:up`          | Aplica as migrations pendentes                             |
| 4     | `next dev`                       | Inicia o servidor em `http://localhost:3000`               |

Com o servidor no ar, a página inicial fica em `http://localhost:3000` e o painel de status em `http://localhost:3000/status`.

Ao pressionar `Ctrl+C`, o script executa `npm run services:stop` e exibe a mensagem "Pressione 'Enter' para voltar ao console...".

### Migrations

As migrations ficam em `infra/migrations` e usam o [node-pg-migrate](https://github.com/salsita/node-pg-migrate). O nome de cada arquivo começa com um timestamp, que define a ordem de execução.

```bash
# Criar uma nova migration
npm run migrations:create -- nome-da-migration

# Ver o que seria aplicado, sem alterar o banco
npm run migrations:up:dry

# Aplicar as migrations pendentes
npm run migrations:up
```

Também é possível consultar e aplicar migrations pela API, com `GET` e `POST` em `/api/v1/migrations` (implementado em `models/migrator.js`). Veja o [guia da API](api/README.md). O controle de quais migrations já rodaram fica na tabela `pgmigrations`.

Migrations existentes:

| Arquivo                                                          | O que faz                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `1792077675178_create-users.js`                                  | Cria a tabela `users` (`id`, `username`, `email`, `password`, datas)     |
| `1792179953104_altera-nomes-de-colunas-createdAt-e-updatedAt.js` | Renomeia `createdAt` e `updatedAt` para `created_at` e `updated_at`      |
| `1792247067512_create-sessions.js`                               | Cria a tabela `sessions` (`id`, `token`, `user_id`, `expires_at`, datas) |

Regras do projeto:

- **Nunca edite uma migration que já rodou em produção.** Corrija com uma migration nova (foi assim com a renomeação das colunas de `users`).
- As migrations não têm reversão: todas exportam `down = false`.
- **Em produção a migration não roda sozinha.** Depois do deploy de um PR que cria migration, chame `POST /api/v1/migrations`.
- O `next.config.js` inclui `infra/migrations` e o `package.json` no pacote da rota de migrations (`outputFileTracingIncludes`). O `node-pg-migrate` lê a pasta pelo sistema de arquivos, algo que o Next não detecta sozinho; sem essa configuração, a rota falha na Vercel com `ENOENT: no such file or directory, scandir '/var/task/infra/migrations/'`.

### Testes

```bash
npm test
```

O comando executa `npm run services:up` e, em paralelo, o servidor (`next dev`) e o Jest (`jest --runInBand --verbose`). Ao terminar, o `posttest` roda `npm run services:stop`. A opção `--runInBand` faz os testes rodarem em sequência, porque todos compartilham o mesmo banco. O tempo limite de cada teste é de 60 segundos (`jest.config.cjs`).

Os testes ficam em `tests/integration/api/v1/` e seguem a estrutura dos endpoints:

| Arquivo                          | O que verifica                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `status/get.test.js`             | Resposta 200, formato de `updated_at`, `status` "Online", limite e conexões abertas do banco             |
| `status/post.test.js`            | `POST` devolve 405, com o cabeçalho `Allow: GET` e o corpo de `MethodNotAllowedError`                    |
| `migrations/get.test.js`         | `GET` devolve 200 e a lista de migrations pendentes                                                      |
| `migrations/post.test.js`        | Primeiro `POST` devolve 201 e a lista aplicada; o segundo devolve 200 e lista vazia                      |
| `migrations/delete.test.js`      | `DELETE` devolve 405, com `Allow: GET, POST`                                                             |
| `users/post.test.js`             | Cadastro válido (201, senha com hash), nome de usuário duplicado, email inválido e email duplicado       |
| `users/[username]/get.test.js`   | Consulta com o mesmo "case", com "case" diferente e usuário inexistente (404)                            |
| `users/[username]/patch.test.js` | Usuário inexistente, duplicidades, email inválido e atualização de nome de usuário, email e senha        |
| `sessions/post.test.js`          | Login com email incorreto, senha incorreta, ambos incorretos (401) e credenciais corretas (201 e cookie) |

Padrão de escrita: cada arquivo tem um `describe` com o método e o caminho (por exemplo, `"GET /api/v1/status"`), dentro dele um `describe` por tipo de usuário (hoje só `"Usuário anônimo"`) e, por fim, os `test`. Quando existirem rotas protegidas, os novos cenários entram como outro tipo de usuário.

O arquivo `tests/orchestrator.js` reúne os utilitários dos testes:

- **`waitForAllServices()`:** espera o servidor responder em `/api/v1/status` (até 100 tentativas) antes de os testes começarem.
- **`clearDatabase()`:** apaga e recria o schema `public`, deixando o banco vazio.
- **`runPendingMigrations()`:** aplica as migrations pendentes, para os testes que precisam das tabelas.
- **`createUser(userObject)`:** cria um usuário pelo model, com nome de usuário e email fictícios (Faker em português) e uma senha padrão, quando você não informa os campos.

Cuidados:

- Os testes chamam `orchestrator.clearDatabase()`, que executa `drop schema if exists public cascade; create schema public;`. Rodam contra o banco do `.env.development`, então esse arquivo nunca deve apontar para um banco com dados reais.
- O teste de status verifica `max_connections` igual a `100` e uma conexão aberta. Esses valores vêm da imagem do Docker.
- Fora de produção, o bcrypt usa 4 rounds, o que mantém os testes rápidos. Em produção são 14 (veja [autenticação](autenticacao.md)).
- Ainda não há testes para a página `/status` nem para a resposta `500` dos endpoints.

## Padrão de commits

O projeto usa [Conventional Commits](https://www.conventionalcommits.org/pt-br/). O jeito mais simples de seguir o padrão é o assistente:

```bash
git add .
npm run commit
```

Os tipos mais comuns são `feat` (nova funcionalidade), `fix` (correção), `docs` (documentação), `refactor`, `test` e `chore`. Exemplo: `docs: adiciona documentação da API`.

## Proteção contra vazamento de segredos

Duas ferramentas se complementam, e as duas rodam a cada commit:

| Ferramenta             | Onde roda                                      | Configuração        |
| ---------------------- | ---------------------------------------------- | ------------------- |
| ggshield (GitGuardian) | Hook de pre-commit e scripts `npm run secrets` | `.gitguardian.yaml` |
| Gitleaks               | Hook de pre-commit e CI de Pull Requests       | `.gitleaks.toml`    |

Varreduras sob demanda com o ggshield:

```bash
# Procura segredos nos arquivos do projeto
npm run secrets:scan

# Procura segredos em todo o histórico do repositório
npm run secrets:history
```

O `.gitleaks.toml` usa as regras padrão do Gitleaks e define uma lista de exceções (_allowlist_):

- pastas que não são código do projeto (`node_modules`, `dist`, `build`, `coverage`, `tmp`, `cache`, `vendor` e `.git`);
- o arquivo `.env.development`;
- valores que contêm termos de exemplo, como `changeme`, `placeholder`, `example_password` ou `your_api_key`.

Se o Gitleaks bloquear um commit, confira primeiro se é um segredo de verdade. Sendo, tire-o do commit e troque a credencial, porque ela deve ser considerada exposta. Sendo um falso positivo, ajuste a lista de exceções em `.gitleaks.toml` em vez de pular os hooks.

## Hooks do Git

Instalados pelo Husky no `npm install` (script `prepare`):

| Hook         | O que executa                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | 1. `ggshield secret scan pre-commit`; 2. `npx lint-staged`; 3. `gitleaks protect --staged --config=.gitleaks.toml --redact` (bloqueia o commit se o `gitleaks` não estiver instalado) |
| `commit-msg` | `npx commitlint --edit` (valida a mensagem)                                                                                                                                           |

O `lint-staged` roda o Prettier (`--write`) e o ESLint (sem avisos permitidos) nos arquivos `js`, `jsx`, `ts`, `tsx`, `css` e `md` do commit, e o Prettier nos demais `json`.

## Integração contínua

Três workflows do GitHub Actions rodam em todo Pull Request:

| Workflow        | Arquivo                           | Jobs                                                                                        |
| --------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| Linting         | `.github/workflows/linting.yaml`  | Prettier, ESLint e Commitlint (das mensagens do PR)                                         |
| Automated Tests | `.github/workflows/tests.yaml`    | Jest, com `npm test` no Node 24.14.1                                                        |
| Gitleaks        | `.github/workflows/gitleaks.yaml` | `Scan for secrets`: varre o histórico do repositório com a configuração de `.gitleaks.toml` |

Para reproduzir os checks localmente antes de abrir o PR:

```bash
npm run lint:prettier:check
npm run lint:eslint:check
npm test
```

## Solução de problemas

| Sintoma                                                 | O que verificar                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| O banco não sobe ou o `dev` fica esperando              | O Docker está em execução? A porta `5432` está livre (outro PostgreSQL local pode estar usando)? |
| `npm test` falha logo no início                         | A porta `3000` está livre? Um `npm run dev` aberto em outro terminal ocupa essa porta            |
| Teste de status falha em `opened_connections`           | Há outra conexão aberta no banco local (um cliente de banco, por exemplo)                        |
| Cadastro ou login respondem 500 com a mensagem genérica | O `PASSWORD_PEPPER` está definido? O motivo (`ConfigurationError`) aparece só no log do servidor |
| `GET /api/v1/migrations` falha em produção com `ENOENT` | O `next.config.js` precisa manter o `outputFileTracingIncludes` da rota de migrations            |
| Tabela nova não existe em produção                      | As migrations não rodam sozinhas no deploy: chame `POST /api/v1/migrations`                      |
| O commit falha em `ggshield`                            | O ggshield está instalado e autenticado (`ggshield auth login`)?                                 |
| O commit falha com "Gitleaks não encontrado"            | O `gitleaks` está instalado e no `PATH`? Teste com `gitleaks version`                            |
| O commit falha por segredo detectado                    | Veja a seção "Proteção contra vazamento de segredos" acima                                       |
| O commit falha em `commitlint`                          | A mensagem segue o padrão `tipo: descrição`? Use `npm run commit`                                |
| Avisos de versão do Node ao instalar                    | Rode `nvm use` para usar a versão do `.nvmrc`                                                    |
