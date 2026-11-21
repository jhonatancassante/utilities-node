# Guia de desenvolvimento

Este guia descreve como preparar, executar, testar e manter o utilities-node. Para uma visão geral, consulte o [README](../README.md).

## Ambiente local

### Requisitos e versões

- **Node.js:** 24, definido em `.nvmrc` e exigido pelo campo `engines` do `package.json`. O workflow de testes e os workflows de lint leem a versão diretamente do `package.json`.
- **PostgreSQL:** imagem `postgres:16.0-alpine3.18`, container `postgres-dev`, porta `5432`.
- **Mailcatcher:** container `mailcatcher-dev`, SMTP na porta `1025` e interface web na porta `1080`.
- **Docker Compose**, Git e npm.
- **ggshield** instalado e autenticado e **Gitleaks** disponível no `PATH`, necessários para os hooks locais.

O arquivo `.npmrc` habilita `legacy-peer-deps=true`.

### Instalação e inicialização

```bash
git clone https://github.com/jhonatancassante/utilities-node.git
cd utilities-node
nvm use
npm install
npm run dev
```

O `npm run dev` executa `infra/scripts/dev.js`, que inicia `dev:raw` e encerra os serviços quando o processo termina. O fluxo `dev:raw`:

1. Executa `npm run services:up`.
2. Aguarda o PostgreSQL responder por meio de `services:wait:database`.
3. Aplica as migrations pendentes com `migrations:up`.
4. Inicia `next dev` em `http://localhost:3000`.

Ao pressionar `Ctrl+C`, o script encerra o processo e executa `npm run services:stop`. A interface do Mailcatcher fica em <http://localhost:1080>.

### Variáveis de ambiente

O arquivo `.env.development` é versionado intencionalmente com credenciais descartáveis de desenvolvimento. Não armazene segredos reais nele.

| Variável                                                                              | Finalidade                                                      |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` | Configuração do PostgreSQL local e do container                 |
| `DATABASE_URL`                                                                        | URL montada com as variáveis locais; usada pelo node-pg-migrate |
| `PASSWORD_PEPPER`                                                                     | Segredo usado no HMAC das senhas                                |
| `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`                                                  | Host e porta SMTP                                               |
| `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`                                              | Credenciais SMTP; no Mailcatcher local podem ficar vazias       |

Em `development` e `test`, `infra/database.js` usa as variáveis `POSTGRES_*`. Nos demais ambientes usa `DATABASE_URL`, adicionando `sslmode=verify-full`. A aplicação exige `PASSWORD_PEPPER` para hash e comparação das senhas.

O Nodemailer utiliza as quatro variáveis `EMAIL_SMTP_*`. O Mailcatcher local não exige autenticação. Em produção, configure as credenciais do provedor SMTP e use transporte seguro.

A origem dos links de ativação é determinada em `infra/webserver.js`: localhost em desenvolvimento/teste, `https://${VERCEL_URL}` em preview e `https://jhonatancassante.com.br` nos demais ambientes.

## Interface e ferramentas

Durante o desenvolvimento, a interface fica disponível em `http://localhost:3000`:

- `/`: página inicial provisória.
- `/tools`: catálogo de ferramentas registradas em `configs/tools.js`.
- `/tools/qr-code`: Gerador de QR Code.
- `/tools/pdf-splitter`: Divisor de PDF.
- `/tools/pdf-merger`: Unificador de PDF.
- `/tools/csv-to-json`: Conversor de CSV para JSON.
- `/tools/json-to-csv`: Conversor de JSON para CSV.
- `/tools/txt-to-csv`: Conversor de TXT para CSV.
- `/tools/cpf-tester`: Testador de CPF.
- `/tools/ar-generator`: Gerador de AR e Etiquetas.
- `/status`: painel de monitoramento da conexão com o banco de dados.
- `/admin`: painel administrativo, visível para usuários com ao menos uma feature privilegiada.
- `/admin/users`: pesquisa, edição de dados, gerenciamento de features, remoção e banimento/desbanimento de usuários; exige `update:user:others`.
- `/admin/audit`: área de auditoria administrativa; exige `read:audit`.
- `/admin/audit/banned`: histórico de banimentos e desbanimentos.
- `/diario-oficial/edicao-0012026`: página de leitura e download da edição 001/2026 do Diário Oficial.

As páginas de ferramentas seguem a estrutura `pages/tools/<slug>/index.js`, com componentes e lógica isolados em `features/<slug>/`. Para adicionar uma ferramenta, atualizar seu status ou conhecer os componentes compartilhados, consulte o [guia Adicionando uma nova ferramenta](adicionando-ferramentas.md).

O Gerador de QR Code executa a validação da URL e a renderização no navegador. A captura para PNG usa `html2canvas`, importado dinamicamente para não incluir a dependência no carregamento inicial.

O Unificador de PDF combina dois ou mais arquivos com `pdf-lib`, ordena os nomes com comparação numérica natural e oferece a inclusão de uma página em branco ao final de cada arquivo com quantidade ímpar de páginas. O processamento também ocorre no navegador.

O Divisor de PDF processa os arquivos no navegador com `pdf-lib` (extração das páginas) e `jszip` (ZIP quando há mais de um arquivo), ambos importados dinamicamente.

Os conversores de CSV e JSON processam os arquivos no navegador com Papa Parse. O Conversor de JSON para CSV aceita listas de objetos, listas de valores simples, objetos únicos e objetos que contenham uma única propriedade array. A seleção de colunas, o delimitador e a codificação do arquivo de saída são controlados na interface.

O Conversor de TXT para CSV interpreta relatórios de largura fixa: identifica o cabeçalho na primeira ou segunda linha, usa as posições das colunas para separar os registros e detecta UTF-8 ou Windows-1252. A interface permite escolher o separador do CSV, incluir BOM UTF-8, remover a hora de datas e trocar a vírgula decimal por ponto. A prévia mostra até 15 linhas e sinaliza registros possivelmente desalinhados.

O Gerador de AR e Etiquetas consulta CEP pelo ViaCEP e listas de UFs e municípios pela API do IBGE. Os dados são organizados na interface e convertidos em PDF no navegador, com ARs e etiquetas de endereçamento. Como o resultado é destinado à impressão, confira alinhamento e dimensões em escala real. A página do Diário Oficial exibe o PDF estático por meio do leitor do navegador e disponibiliza o download; ela usa `noindex, nofollow`.

## Scripts npm

| Script                              | Função                                                           |
| ----------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                       | Inicia o ambiente completo e encerra os serviços ao sair         |
| `npm run dev:raw`                   | Sobe serviços, aguarda banco, aplica migrations e inicia Next.js |
| `npm test`                          | Sobe serviços e Next.js, executa Jest e finaliza com `posttest`  |
| `npm run test:watch`                | Jest em modo contínuo; requer servidor e banco já ativos         |
| `npm run test:coverage`             | Executa Jest com cobertura e gera relatórios em `coverage/`      |
| `npm run services:up`               | Inicia PostgreSQL e Mailcatcher                                  |
| `npm run services:stop`             | Para os containers sem removê-los                                |
| `npm run services:down`             | Para e remove os containers                                      |
| `npm run services:wait:database`    | Aguarda o PostgreSQL aceitar conexões                            |
| `npm run migrations:create -- nome` | Cria uma migration                                               |
| `npm run migrations:up`             | Aplica migrations pendentes                                      |
| `npm run migrations:up:dry`         | Simula migrations sem alterar o banco                            |
| `npm run build`                     | Gera build de produção                                           |
| `npm run lint:prettier:check`       | Verifica formatação                                              |
| `npm run lint:prettier:fix`         | Formata arquivos                                                 |
| `npm run lint:eslint:check`         | Executa ESLint sem avisos permitidos                             |
| `npm run secrets:scan`              | Varre arquivos com ggshield                                      |
| `npm run secrets:history`           | Varre o histórico do repositório com ggshield                    |
| `npm run commit`                    | Abre o assistente Commitizen                                     |

## Migrations

Os arquivos ficam em `infra/migrations`, são executados por `node-pg-migrate` e seguem uma ordem definida pelo timestamp no nome.

```bash
npm run migrations:create -- nome-da-migration
npm run migrations:up:dry
npm run migrations:up
```

Migrations existentes na branch principal:

| Arquivo                                                          | Alteração                                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| `1792077675178_create-users.js`                                  | Cria a tabela `users`                                     |
| `1792179953104_altera-nomes-de-colunas-createdAt-e-updatedAt.js` | Renomeia colunas de data para `snake_case`                |
| `1792247067512_create-sessions.js`                               | Cria a tabela `sessions`                                  |
| `1792760460131_adiciona-features-na-tabela-users.js`             | Adiciona `users.features`                                 |
| `1792781687009_cria-tabela-user-activation-tokens.js`            | Cria `user_activation_tokens`                             |
| `1795263904008_rename-feature-is-removable.js`                   | Renomeia `features.is_removable` para `is_self_removable` |
| `1795266838572_add-banned-column-to-users-table.js`              | Adiciona `users.banned_at`                                |
| `1795270290404_add-audit-feature-and-organize-feature-groups.js` | Cria `read:audit` e reorganiza grupos/permissões          |
| `1795270639425_create-user-ban-audit-events.js`                  | Cria `user_ban_events` e importa os banimentos existentes |

O histórico das execuções fica em `pgmigrations`. As migrations atuais exportam `down = false`; não existe rollback automático.

Regras:

- Nunca altere uma migration já aplicada em produção. Crie uma migration nova.
- Nunca renomeie o arquivo de uma migration já aplicada: o `node-pg-migrate` compara os nomes com a tabela `pgmigrations` e passa a recusar o histórico. Os nomes em português acima ficam como estão.
- Migrations novas usam nome em inglês, no formato `create-...`, `add-...-to-...`, `rename-...` ou `drop-...`; tabelas e colunas em inglês e `snake_case`.
- Consultas que usam `LOWER(coluna)` não aproveitam o índice normal da coluna; se esse caminho passar a ser lento, crie um índice por expressão (`CREATE INDEX ... ON users (LOWER(username))`).
- Em produção, migrations não são executadas automaticamente no deploy. Após publicar uma alteração de esquema, execute `POST /api/v1/migrations` com uma sessão que possua `create:migration`.
- `next.config.js` inclui `infra/migrations` e `package.json` no pacote da função serverless da rota. Não remova essa configuração sem validar o funcionamento na Vercel.

## Testes

```bash
npm test
```

O script sobe os containers, inicia `next dev` e executa Jest com `--runInBand --verbose`. Os testes compartilham o mesmo banco, por isso são executados em sequência. O `posttest` para os serviços. Para executar com cobertura, use `npm run test:coverage`; são gerados relatórios de texto, LCOV e resumo JSON em `coverage/`, ignorado pelo Git. O percentual cobre os módulos instrumentados de `features/**/lib`, `infra`, `lib` e `models`; as rotas `pages/api` são exercitadas pelos testes de integração, mas não entram no cálculo porque o Next.js executa em processo separado.

Para modo contínuo, deixe `npm run dev` ativo em outro terminal e execute `npm run test:watch`.

### Organização dos testes

- `tests/integration/api/v1/`: testes dos endpoints, incluindo pesquisa, consulta, atualização, banimento e desbanimento administrativos, além da consulta da auditoria.
- `tests/integration/infra/email.test.js`: integração do serviço de e-mail.
- `tests/integration/_use-cases/registration-flow.test.js`: fluxo completo de cadastro, recebimento do e-mail, ativação, login e consulta do usuário.
- `tests/unit/models/`: testes unitários de `user`, `audit`, `password`, `session`, `activation`, `authentication` (hash falso contra timing attack) e `authorization`, sem banco de dados (as consultas são simuladas).
- `tests/unit/infra/`: testes unitários de `errors`, `database` e `controller`. Os testes de integração de `database.transaction()` e `activation.activate()` ficam em `tests/integration/infra/` e `tests/integration/models/`.
- `tests/unit/lib/client/` e `tests/unit/lib/shared/`: testes unitários do cliente HTTP, sessão, ativação, arquivos e validação de usuário.
- `tests/unit/features/qr-code/lib/`: testes unitários da normalização de URLs e da formatação do timestamp usado nos downloads.
- `tests/unit/features/pdf-splitter/lib/`: testes unitários das regras de validação, seleção de arquivos, extração de páginas e geração dos arquivos PDF e ZIP.
- `tests/unit/features/pdf-merger/lib/`: testes unitários para seleção, ordenação e unificação de PDFs, incluindo a inclusão opcional de páginas em branco.
- `tests/unit/features/ar-generator/lib/`: testes unitários para os códigos de barras Code 128 e a geração de ARs e etiquetas em PDF.
- `tests/unit/features/csv-to-json/lib/`: testes unitários da interpretação de CSV e geração de JSON.
- `tests/unit/features/json-to-csv/lib/`: testes unitários da normalização do JSON, coleta de colunas, conversão de valores, geração do CSV e codificação Latin1.
- `tests/unit/features/txt-to-csv/lib/`: testes unitários da detecção de codificação, interpretação de colunas de largura fixa, formatação de valores e geração do CSV.
- `tests/orchestrator.js`: utilitários compartilhados.

Os testes de API cobrem status, migrations, cadastro, consulta/atualização de usuários, banimento/desbanimento e consulta da auditoria, ativação, login, logout e consulta/renovação da sessão. Os testes unitários cobrem a validação/normalização de URLs do Gerador de QR Code, a formatação do nome dos arquivos baixados (`lib/client/files.js`), as regras do Divisor e do Unificador de PDF, a geração de ARs e etiquetas, o Testador de CPF e as conversões de CSV para JSON, JSON para CSV e TXT para CSV.

### Orchestrator

`tests/orchestrator.js` fornece:

- `API_URL`: origem da API versionada, derivada de `infra/webserver.js`.
- `waitForAllServices()`: aguarda o endpoint de status e a interface do Mailcatcher responderem.
- `clearDatabase()`: apaga e recria o schema `public`.
- `runPendingMigrations()`: aplica migrations pendentes.
- `createUser(userObject)`: cria usuário de teste pelo model.
- `activateUser(user)`: concede as features padrão de conta ativada para o usuário de teste.
- `createSession(user)`: cria sessão de teste.
- `deleteAllEmail()` e `getLastEmail()`: limpam e recuperam mensagens do Mailcatcher.
- `getSessionCookieObject(response)`: interpreta o cookie `session_id`.
- `extractUUID(emailText)`: extrai UUID do texto do e-mail.
- `addFeaturesToUser(user, features)`: adiciona permissões para cenários privilegiados.

**Cuidado:** `clearDatabase()` executa `DROP SCHEMA public CASCADE` e recria o schema. Os testes usam as variáveis do ambiente de teste; nunca aponte esse ambiente para um banco com dados que devam ser preservados.

O teste de status depende dos valores da imagem PostgreSQL: `max_connections=100` e uma conexão aberta no momento da consulta.

## Hooks locais

O Husky instala os hooks durante `npm install` (script `prepare`).

| Hook         | Execução                                     |
| ------------ | -------------------------------------------- |
| `pre-commit` | ggshield secret scan, lint-staged e Gitleaks |
| `commit-msg` | Commitlint valida a mensagem                 |

O lint-staged executa Prettier e ESLint nos arquivos JavaScript/TypeScript/CSS/Markdown e Prettier nos demais arquivos JSON abrangidos pela configuração.

Para escrever commits, use:

```bash
git add .
npm run commit
```

O projeto segue [Conventional Commits](https://www.conventionalcommits.org/pt-br/), por exemplo `docs: atualiza o guia de desenvolvimento`.

## Verificação de segredos

ggshield e Gitleaks são complementares:

- ggshield roda no hook local e também pode ser executado com `npm run secrets:scan` ou `npm run secrets:history`.
- Gitleaks roda no hook local com `.gitleaks.toml` e no workflow de Pull Request.

O `.gitleaks.toml` contém exclusões para artefatos e arquivos locais conhecidos, inclusive `.env.development`. Não use allowlist para ocultar um segredo real: remova a credencial e faça sua rotação.

## Integração contínua

Os workflows em `.github/workflows/` são:

| Workflow        | Arquivo         | Responsabilidade                   |
| --------------- | --------------- | ---------------------------------- |
| Linting         | `linting.yaml`  | Prettier, ESLint e Commitlint      |
| Automated Tests | `tests.yaml`    | Jest no Node.js 24                 |
| Gitleaks        | `gitleaks.yaml` | Varredura de segredos no histórico |

Antes de abrir um Pull Request, execute localmente:

```bash
npm run lint:prettier:check
npm run lint:eslint:check
npm test
```

## Solução de problemas

| Sintoma                                           | Verificação                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| PostgreSQL não inicia                             | Docker em execução e porta 5432 disponível                               |
| Mailcatcher não inicia ou testes ficam aguardando | Container `mailcatcher-dev` ativo e portas 1025/1080 disponíveis         |
| `npm test` falha no início                        | Porta 3000 disponível; encerre outro servidor Next.js                    |
| Teste de status falha na contagem                 | Nenhuma conexão extra aberta no banco de teste                           |
| Cadastro/login retorna 500                        | Verifique `PASSWORD_PEPPER` e logs do servidor                           |
| Cadastro falha ao enviar e-mail                   | Verifique variáveis `EMAIL_SMTP_*` e disponibilidade do SMTP/Mailcatcher |
| Migration não aparece em produção                 | Verifique `outputFileTracingIncludes` no `next.config.js`                |
| Nova tabela não existe após deploy                | Execute `POST /api/v1/migrations` com `create:migration`                 |
| Hook falha no ggshield                            | Instale e autentique ggshield com `ggshield auth login`                  |
| Hook informa Gitleaks ausente                     | Instale Gitleaks e confira `gitleaks version`                            |
| Commit é rejeitado                                | Use `npm run commit` e confira o padrão Conventional Commits             |
| Node em versão diferente                          | Execute `nvm use`                                                        |
