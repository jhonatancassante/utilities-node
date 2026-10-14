# utilities-node

Nova implementação dos meus utilitários de trabalho, originalmente desenvolvidos com HTML, CSS e JavaScript, agora utilizando Node.js, autenticação e práticas modernas de desenvolvimento.

**Aplicação publicada:** <https://utilities-node.vercel.app>

> **Status do projeto: em construção.** Hoje a aplicação tem uma página inicial provisória, uma página de status do sistema e dois endpoints de infraestrutura (`/api/v1/status` e `/api/v1/migrations`). Os utilitários serão migrados aos poucos.

## Sumário

- [utilities-node](#utilities-node)
  - [Sumário](#sumário)
  - [Visão geral](#visão-geral)
  - [Tecnologias](#tecnologias)
  - [Pré-requisitos](#pré-requisitos)
  - [Primeiros passos](#primeiros-passos)
  - [Testes](#testes)
  - [Scripts disponíveis](#scripts-disponíveis)
  - [Estrutura de pastas](#estrutura-de-pastas)
  - [Variáveis de ambiente](#variáveis-de-ambiente)
  - [API](#api)
  - [Como contribuir](#como-contribuir)
  - [Deploy](#deploy)
  - [Documentação completa](#documentação-completa)
  - [Licença](#licença)

## Visão geral

O que existe hoje:

- Página inicial provisória ("Em construção"), em `pages/index.js`.
- Página de status (`/status`): painel de monitoramento do sistema e do banco de dados, atualizado automaticamente a cada 5 segundos.
- `GET /api/v1/status`: verifica a saúde da aplicação e do banco de dados.
- `GET` e `POST /api/v1/migrations`: consulta e aplica as migrations do banco.
- Ambiente de desenvolvimento com PostgreSQL em Docker, testes de integração, lint, hooks de commit, verificação de segredos e CI.

O que está previsto: login de usuários e outras funcionalidades que utilizam o banco de dados. O endpoint de migrations será uma rota protegida.

## Tecnologias

| Área           | Ferramenta                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| Framework      | [Next.js](https://nextjs.org/) 16 (Pages Router) e React 19                                                        |
| Runtime        | Node.js 24                                                                                                         |
| Interface      | React com CSS Modules e CSS global; [SWR](https://swr.vercel.app/) para buscar dados da API                        |
| Banco de dados | PostgreSQL 16 (Docker no desenvolvimento), cliente `pg`                                                            |
| Migrations     | [node-pg-migrate](https://github.com/salsita/node-pg-migrate)                                                      |
| Testes         | [Jest](https://jestjs.io/) (testes de integração)                                                                  |
| Qualidade      | ESLint, Prettier, EditorConfig                                                                                     |
| Commits        | Conventional Commits (Commitizen e Commitlint), Husky                                                              |
| Segredos       | [GitGuardian ggshield](https://github.com/GitGuardian/ggshield) e [Gitleaks](https://github.com/gitleaks/gitleaks) |
| CI/CD          | GitHub Actions e Vercel                                                                                            |

## Pré-requisitos

- **Node.js 24.14.1.** A versão está no arquivo `.nvmrc`; com o [nvm](https://github.com/nvm-sh/nvm) basta rodar `nvm use`.
- **Docker** com o Docker Compose, para subir o PostgreSQL local.
- **Git.**
- **ggshield** instalado e autenticado (`ggshield auth login`). O hook de pre-commit executa `ggshield secret scan pre-commit` e falha se o programa não estiver disponível. Veja a [instalação do ggshield](https://github.com/GitGuardian/ggshield#installation).
- **Gitleaks** instalado e disponível no `PATH`. O hook de pre-commit executa `gitleaks protect --staged` e bloqueia o commit se o programa não for encontrado. Veja a [instalação do Gitleaks](https://github.com/gitleaks/gitleaks#installing).

## Primeiros passos

```bash
# 1. Clonar o repositório
git clone https://github.com/jhonatancassante/utilities-node.git
cd utilities-node

# 2. Usar a versão correta do Node.js
nvm use

# 3. Instalar as dependências (também instala os hooks do Husky)
npm install

# 4. Subir o ambiente de desenvolvimento
npm run dev
```

O `npm run dev` faz tudo o que é preciso, na ordem:

1. Sobe o PostgreSQL em um container Docker (`npm run services:up`).
2. Aguarda o banco aceitar conexões.
3. Aplica as migrations pendentes.
4. Inicia o servidor do Next.js em <http://localhost:3000>.

Para encerrar, pressione `Ctrl+C`. O script também para o container do banco antes de devolver o terminal.

Para conferir que está tudo certo, acesse <http://localhost:3000/api/v1/status>. A resposta deve ser parecida com esta:

```json
{
  "updated_at": "2026-10-13T13:06:00.000Z",
  "dependencies": {
    "database": {
      "version": "16.0",
      "max_connections": 100,
      "opened_connections": 1
    }
  }
}
```

Os mesmos dados aparecem, em formato de painel, em <http://localhost:3000/status>.

> Os valores de acesso ao banco local ficam em `.env.development`, que é versionado de propósito: são credenciais descartáveis, usadas só no container de desenvolvimento. Nunca coloque credenciais reais nesse arquivo.

## Testes

```bash
npm test
```

O comando sobe o banco, inicia o servidor do Next.js, roda o Jest e, ao final, para os containers. Para rodar os testes continuamente enquanto você programa, deixe o ambiente de pé com `npm run dev` em um terminal e use `npm run test:watch` em outro.

Pontos de atenção:

- Os testes de integração fazem requisições reais para `http://localhost:3000`. Feche qualquer outro servidor que esteja usando a porta 3000 antes de rodar `npm test`.
- Os testes de migrations **apagam e recriam o schema `public`** do banco configurado em `.env.development`. Nunca aponte essas variáveis para um banco com dados que você queira manter.
- O teste de status espera PostgreSQL `16.0`, `max_connections` igual a `100` e uma única conexão aberta. Se mudar a imagem do Docker em `infra/compose.yaml`, ajuste o teste.

## Scripts disponíveis

| Script                                | O que faz                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run dev`                         | Ambiente de desenvolvimento completo (banco, migrations e Next.js) com limpeza dos serviços ao encerrar |
| `npm run dev:raw`                     | Mesmo fluxo do `dev`, sem a camada que encerra os serviços. Usado internamente pelo `dev`               |
| `npm test`                            | Sobe os serviços e o servidor, roda o Jest uma vez e para os serviços (`posttest`)                      |
| `npm run test:watch`                  | Jest em modo contínuo. Exige banco e servidor já em execução                                            |
| `npm run services:up`                 | Sobe o PostgreSQL via Docker Compose, em segundo plano                                                  |
| `npm run services:stop`               | Para os containers, mantendo-os criados                                                                 |
| `npm run services:down`               | Para e remove os containers                                                                             |
| `npm run services:wait:database`      | Aguarda o PostgreSQL aceitar conexões                                                                   |
| `npm run migrations:create -- <nome>` | Cria um novo arquivo de migration em `infra/migrations`                                                 |
| `npm run migrations:up`               | Aplica as migrations pendentes no banco local                                                           |
| `npm run migrations:up:dry`           | Simula a aplicação das migrations, sem alterar o banco                                                  |
| `npm run build`                       | Gera o build de produção do Next.js                                                                     |
| `npm run lint:prettier:check`         | Verifica a formatação com o Prettier                                                                    |
| `npm run lint:prettier:fix`           | Corrige a formatação com o Prettier                                                                     |
| `npm run lint:eslint:check`           | Roda o ESLint sem aceitar avisos                                                                        |
| `npm run secrets:scan`                | Procura segredos nos arquivos do projeto com o ggshield                                                 |
| `npm run secrets:history`             | Procura segredos em todo o histórico do repositório com o ggshield                                      |
| `npm run commit`                      | Assistente do Commitizen para escrever a mensagem de commit                                             |

## Estrutura de pastas

```text
.
├── .github/workflows/    # CI: lint (linting.yaml), testes (tests.yaml) e segredos (gitleaks.yaml)
├── .husky/               # Hooks do Git: pre-commit e commit-msg
├── components/
│   └── AppHead/          # Título e descrição (<head>) das páginas
├── configs/
│   └── site.js           # Nome do site e textos padrão
├── docs/                 # Documentação do projeto
├── infra/
│   ├── compose.yaml      # PostgreSQL local (Docker Compose)
│   ├── database.js       # Conexão e consultas ao banco
│   ├── errors.js         # Classes de erro da aplicação
│   ├── migrations/       # Migrations do banco (node-pg-migrate)
│   └── scripts/          # Scripts auxiliares dos comandos npm
├── pages/
│   ├── api/v1/           # Endpoints da API (status e migrations)
│   ├── status/           # Página de status do sistema (/status)
│   ├── _app.js           # Carrega os estilos globais
│   └── index.js          # Página inicial
├── styles/
│   ├── globals.css       # Variáveis de cor, fonte e reset
│   └── shared.module.css # Estilos compartilhados entre as páginas
├── tests/
│   ├── integration/      # Testes de integração da API
│   └── orchestrator.js   # Utilitários dos testes (espera o servidor e limpa o banco)
├── .env.development      # Variáveis do ambiente local (valores descartáveis)
├── .gitleaks.toml        # Configuração do Gitleaks
└── package.json
```

## Variáveis de ambiente

| Variável            | Onde é usada                | Descrição                                               |
| ------------------- | --------------------------- | ------------------------------------------------------- |
| `POSTGRES_HOST`     | Desenvolvimento e testes    | Host do banco (`localhost`)                             |
| `POSTGRES_PORT`     | Desenvolvimento e testes    | Porta do banco (`5432`)                                 |
| `POSTGRES_USER`     | Desenvolvimento e testes    | Usuário do banco                                        |
| `POSTGRES_DB`       | Desenvolvimento e testes    | Nome do banco                                           |
| `POSTGRES_PASSWORD` | Desenvolvimento e testes    | Senha do banco                                          |
| `DATABASE_URL`      | Produção e preview (Vercel) | URL de conexão completa. É obrigatória nesses ambientes |

Em desenvolvimento e testes (`NODE_ENV` igual a `development` ou `test`), a aplicação usa as variáveis `POSTGRES_*`. Em qualquer outro ambiente, usa `DATABASE_URL` com `sslmode=verify-full` e lança erro se ela não estiver definida. Mais detalhes em [docs/arquitetura.md](docs/arquitetura.md).

## API

| Método | Caminho              | Descrição                                               |
| ------ | -------------------- | ------------------------------------------------------- |
| `GET`  | `/api/v1/status`     | Verificação de saúde da aplicação e do banco de dados   |
| `GET`  | `/api/v1/migrations` | Lista as migrations pendentes, sem aplicá-las (dry-run) |
| `POST` | `/api/v1/migrations` | Aplica as migrations pendentes                          |

A página `/status` consome o `GET /api/v1/status`.

> **Atenção:** o endpoint de migrations hoje **não tem proteção**. Ele será uma rota protegida no futuro.

A especificação completa está em [docs/api/openapi.yaml](docs/api/openapi.yaml) e o guia de leitura em [docs/api/README.md](docs/api/README.md).

## Como contribuir

1. Crie uma branch a partir da `main`.
2. Faça as alterações e rode `npm test` e os checks de lint.
3. Faça o commit com `npm run commit`, que guia a escrita da mensagem no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (por exemplo `feat: adiciona login` ou `docs: atualiza o README`).
4. Abra um Pull Request.

Hooks do Git (instalados pelo Husky):

- **pre-commit:** o `ggshield` e o `gitleaks` procuram segredos no que será commitado e o `lint-staged` formata e valida os arquivos alterados.
- **commit-msg:** o Commitlint rejeita mensagens fora do padrão.

No Pull Request, o GitHub Actions executa Prettier, ESLint, Commitlint, os testes do Jest e o Gitleaks. Detalhes em [docs/desenvolvimento.md](docs/desenvolvimento.md).

## Deploy

A aplicação é publicada na Vercel em <https://utilities-node.vercel.app>. Em produção e nos previews, a conexão com o banco usa a variável `DATABASE_URL`, configurada nas variáveis de ambiente do projeto na Vercel.

## Documentação completa

- [Índice da documentação](docs/README.md)
- [Guia de desenvolvimento](docs/desenvolvimento.md)
- [Arquitetura](docs/arquitetura.md)
- [API](docs/api/README.md) e [especificação OpenAPI](docs/api/openapi.yaml)

## Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE).
