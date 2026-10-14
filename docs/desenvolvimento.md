# Guia de desenvolvimento

Este guia complementa o [README](../README.md) com os detalhes do dia a dia de desenvolvimento.

## Ambiente local

### Versões

- **Node.js:** 24.14.1, definido em `.nvmrc`. O `package.json` exige Node 24 (`engines`).
- **PostgreSQL:** 16.0 (`postgres:16.0-alpine3.18`), definido em `infra/compose.yaml`. Roda em um container chamado `postgres-dev`, na porta `5432`.
- **npm:** o arquivo `.npmrc` ativa `legacy-peer-deps=true`, então a instalação ignora conflitos de _peer dependencies_.

### Variáveis de ambiente

O arquivo `.env.development` é versionado e contém apenas credenciais do banco local, descartáveis. Ele é lido pelo Docker Compose (que cria o banco com esses dados), pelos scripts de migration e pelo Jest.

Os verificadores de segredos já levam isso em conta: o Gitleaks ignora o `.env.development` (veja `.gitleaks.toml`) e o `.gitguardian.yaml` define os caminhos que o ggshield ignora (`node_modules` e `.next`). Se o ggshield acusar as credenciais locais como segredo, o `.gitguardian.yaml` traz, comentado, o formato para ignorar essa ocorrência específica.

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

Padrão de escrita: cada arquivo tem um `describe` com o método e o caminho (por exemplo, `"GET /api/v1/status"`), dentro dele um `describe` por tipo de usuário (hoje só `"Usuário anônimo"`) e, por fim, os `test`. Quando existir login, os novos cenários entram como outro tipo de usuário.

O arquivo `tests/orchestrator.js` reúne os utilitários dos testes:

- **`waitForAllServices()`:** espera o servidor responder em `/api/v1/status` (até 100 tentativas) antes de os testes começarem.
- **`clearDatabase()`:** apaga e recria o schema `public`, deixando o banco vazio.

Cuidados:

- Os testes de migrations chamam `orchestrator.clearDatabase()`, que executa `drop schema if exists public cascade; create schema public;`. Rodam contra o banco do `.env.development`, então esse arquivo nunca deve apontar para um banco com dados reais.
- O teste de status verifica a versão `16.0` e `max_connections` igual a `100`. Esses valores vêm da imagem do Docker.
- Ainda não há testes para a página `/status` nem para a resposta `500` do endpoint.

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

| Sintoma                                       | O que verificar                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| O banco não sobe ou o `dev` fica esperando    | O Docker está em execução? A porta `5432` está livre (outro PostgreSQL local pode estar usando)? |
| `npm test` falha logo no início               | A porta `3000` está livre? Um `npm run dev` aberto em outro terminal ocupa essa porta            |
| Teste de status falha em `opened_connections` | Há outra conexão aberta no banco local (um cliente de banco, por exemplo)                        |
| O commit falha em `ggshield`                  | O ggshield está instalado e autenticado (`ggshield auth login`)?                                 |
| O commit falha com "Gitleaks não encontrado"  | O `gitleaks` está instalado e no `PATH`? Teste com `gitleaks version`                            |
| O commit falha por segredo detectado          | Veja a seção "Proteção contra vazamento de segredos" acima                                       |
| O commit falha em `commitlint`                | A mensagem segue o padrão `tipo: descrição`? Use `npm run commit`                                |
| Avisos de versão do Node ao instalar          | Rode `nvm use` para usar a versão do `.nvmrc`                                                    |
