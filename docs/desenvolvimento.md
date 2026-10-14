# Guia de desenvolvimento

Este guia complementa o [README](../README.md) com os detalhes do dia a dia de desenvolvimento.

## Ambiente local

### Versões

- **Node.js:** 24.14.1, definido em `.nvmrc`. O `package.json` exige Node 24 (`engines`).
- **PostgreSQL:** 16.0 (`postgres:16.0-alpine3.18`), definido em `infra/compose.yaml`. Roda em um container chamado `postgres-dev`, na porta `5432`.

### Variáveis de ambiente

O arquivo `.env.development` é versionado e contém apenas credenciais do banco local, descartáveis. Ele é lido pelo Docker Compose (que cria o banco com esses dados), pelos scripts de migration e pelo Jest.

O `.gitguardian.yaml` define quais caminhos o ggshield ignora (`node_modules` e `.next`). Se o ggshield acusar as credenciais locais como segredo, o próprio arquivo traz, comentado, o formato para ignorar essa ocorrência específica.

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

Também é possível consultar e aplicar migrations pela API, com `GET` e `POST` em `/api/v1/migrations`. Veja o [guia da API](api/README.md). O controle de quais migrations já rodaram fica na tabela `pgmigrations`.

Hoje existe uma única migration, `1791773509988_teste.js`, vazia, que serve de ponto de partida.

### Testes

```bash
npm test
```

O comando executa `npm run services:up` e, em paralelo, o servidor (`next dev`) e o Jest (`jest --runInBand --verbose`). Ao terminar, o `posttest` roda `npm run services:stop`. A opção `--runInBand` faz os testes rodarem em sequência, porque todos compartilham o mesmo banco.

Os testes ficam em `tests/integration/api/v1/` e seguem a estrutura dos endpoints:

| Arquivo                   | O que verifica                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `status/get.test.js`      | Resposta 200, formato de `updated_at`, versão, limite e conexões abertas do banco   |
| `migrations/get.test.js`  | `GET` devolve 200 e a lista de migrations pendentes                                 |
| `migrations/post.test.js` | Primeiro `POST` devolve 201 e a lista aplicada; o segundo devolve 200 e lista vazia |

O arquivo `tests/orchestrator.js` espera o servidor responder em `/api/v1/status` (até 100 tentativas) antes de os testes começarem.

Cuidados:

- Os testes de migrations executam `drop schema if exists public cascade; create schema public;`. Rodam contra o banco do `.env.development`, então esse arquivo nunca deve apontar para um banco com dados reais.
- O teste de status verifica a versão `16.0` e `max_connections` igual a `100`. Esses valores vêm da imagem do Docker.

## Padrão de commits

O projeto usa [Conventional Commits](https://www.conventionalcommits.org/pt-br/). O jeito mais simples de seguir o padrão é o assistente:

```bash
git add .
npm run commit
```

Os tipos mais comuns são `feat` (nova funcionalidade), `fix` (correção), `docs` (documentação), `refactor`, `test` e `chore`. Exemplo: `docs: adiciona documentação da API`.

## Hooks do Git

Instalados pelo Husky no `npm install` (script `prepare`):

| Hook         | O que executa                                                  |
| ------------ | -------------------------------------------------------------- |
| `pre-commit` | `ggshield secret scan pre-commit` e, depois, `npx lint-staged` |
| `commit-msg` | `npx commitlint --edit` (valida a mensagem)                    |

O `lint-staged` roda o Prettier (`--write`) e o ESLint (sem avisos permitidos) nos arquivos `js`, `jsx`, `ts`, `tsx`, `css` e `md` do commit, e o Prettier nos demais `json`.

## Integração contínua

Dois workflows do GitHub Actions rodam em todo Pull Request:

| Workflow        | Arquivo                          | Jobs                                                |
| --------------- | -------------------------------- | --------------------------------------------------- |
| Linting         | `.github/workflows/linting.yaml` | Prettier, ESLint e Commitlint (das mensagens do PR) |
| Automated Tests | `.github/workflows/tests.yaml`   | Jest, com `npm test` no Node 24.14.1                |

Para reproduzir os checks localmente antes de abrir o PR:

```bash
npm run lint:prettier:check
npm run lint:eslint:check
npm test
```

## Solução de problemas

| Sintoma                                       | O que verificar                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| O banco não sobe ou o `dev` fica esperando    | O Docker está em execução? A porta `5432` está livre (outro PostgreSQL local pode estar usando)? |
| `npm test` falha logo no início               | A porta `3000` está livre? Um `npm run dev` aberto em outro terminal ocupa essa porta            |
| Teste de status falha em `opened_connections` | Há outra conexão aberta no banco local (um cliente de banco, por exemplo)                        |
| O commit falha em `ggshield`                  | O ggshield está instalado e autenticado (`ggshield auth login`)?                                 |
| O commit falha em `commitlint`                | A mensagem segue o padrão `tipo: descrição`? Use `npm run commit`                                |
| Avisos de versão do Node ao instalar          | Rode `nvm use` para usar a versão do `.nvmrc`                                                    |
