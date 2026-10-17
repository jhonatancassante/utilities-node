# utilities-node

Nova implementação dos meus utilitários de trabalho, originalmente desenvolvidos com HTML, CSS e JavaScript, agora utilizando Node.js, autenticação e práticas modernas de desenvolvimento.

**Aplicação publicada:** <https://utilities-node.vercel.app>

> **Status do projeto: em construção.** Hoje a aplicação tem uma página inicial provisória, uma página de status do sistema e uma API com endpoints de infraestrutura (`status` e `migrations`), de usuários (`users`) e de login (`sessions`). Os utilitários serão migrados aos poucos.

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

- Página inicial provisória ("Em construção"), em `pages/index.js`, com tema claro e escuro.
- Página de status (`/status`): painel de monitoramento do sistema e do banco de dados, atualizado automaticamente a cada 5 segundos.
- `GET /api/v1/status`: verifica a saúde da aplicação e do banco de dados.
- `GET` e `POST /api/v1/migrations`: consulta e aplica as migrations do banco.
- `POST /api/v1/users`, `GET` e `PATCH /api/v1/users/{username}`: cadastro, consulta e atualização de usuários. As senhas são guardadas com HMAC (pepper) e bcrypt.
- `POST /api/v1/sessions`: login por email e senha. Cria uma sessão no banco e devolve o token no cookie `session_id`.
- Ambiente de desenvolvimento com PostgreSQL em Docker, testes de integração, lint, hooks de commit, verificação de segredos e CI.

O que está previsto: proteger as rotas com autenticação (a de migrations será uma rota protegida) e acrescentar as demais funcionalidades que utilizam o banco de dados. Hoje **nenhum endpoint exige autenticação**; veja a seção [API](#api).

## Tecnologias

| Área           | Ferramenta                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| Framework      | [Next.js](https://nextjs.org/) 16 (Pages Router) e React 19                                                        |
| Runtime        | Node.js 24                                                                                                         |
| Interface      | React com CSS Modules e CSS global; [SWR](https://swr.vercel.app/) para buscar dados da API                        |
| Banco de dados | PostgreSQL 16 (Docker no desenvolvimento), cliente `pg`, sem ORM                                                   |
| Migrations     | [node-pg-migrate](https://github.com/salsita/node-pg-migrate)                                                      |
| Senhas         | [bcryptjs](https://github.com/dcodeIO/bcrypt.js) com HMAC-SHA256 e pepper                                          |
| Rotas da API   | [next-connect](https://github.com/hoangvvo/next-connect) e [cookie](https://github.com/jshttp/cookie)              |
| Testes         | [Jest](https://jestjs.io/) (testes de integração) e [Faker](https://fakerjs.dev/)                                  |
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
  "updated_at": "2026-10-17T13:06:00.000Z",
  "dependencies": {
    "database": {
      "status": "Online",
      "max_connections": 100,
      "opened_connections": 1
    }
  }
}
```

Os mesmos dados aparecem, em formato de painel, em <http://localhost:3000/status>.

> Os valores do ambiente local ficam em `.env.development`, que é versionado de propósito: são credenciais do banco e um _pepper_ de senhas descartáveis, usados só no desenvolvimento e nos testes. Nunca coloque valores reais nesse arquivo.

## Testes

```bash
npm test
```

O comando sobe o banco, inicia o servidor do Next.js, roda o Jest e, ao final, para os containers. Para rodar os testes continuamente enquanto você programa, deixe o ambiente de pé com `npm run dev` em um terminal e use `npm run test:watch` em outro.

Pontos de atenção:

- Os testes de integração fazem requisições reais para `http://localhost:3000`. Feche qualquer outro servidor que esteja usando a porta 3000 antes de rodar `npm test`.
- Os testes **apagam e recriam o schema `public`** do banco configurado em `.env.development` (alguns também aplicam as migrations em seguida). Nunca aponte essas variáveis para um banco com dados que você queira manter.
- O teste de status espera `max_connections` igual a `100` (valor da imagem do Docker) e uma única conexão aberta. Se mudar a imagem em `infra/compose.yaml`, ajuste o teste.

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
├── components/           # AppHead, Header, Footer, Layout e ThemeToggle
├── configs/
│   └── site.js           # Nome do site e textos padrão
├── docs/                 # Documentação do projeto
├── infra/
│   ├── compose.yaml      # PostgreSQL local (Docker Compose)
│   ├── controller.js     # Roteamento e tratamento de erros dos endpoints
│   ├── database.js       # Conexão e consultas ao banco
│   ├── errors.js         # Classes de erro da aplicação
│   ├── migrations/       # Migrations do banco (node-pg-migrate)
│   └── scripts/          # Scripts auxiliares dos comandos npm
├── models/               # Regras de negócio: authentication, migrator, password, session e user
├── pages/
│   ├── api/v1/           # Endpoints da API: status, migrations, users e sessions
│   ├── status/           # Página de status do sistema (/status)
│   ├── _app.js           # Carrega os estilos globais
│   ├── _document.js      # HTML base: idioma, ícones e aplicação do tema salvo
│   └── index.js          # Página inicial
├── styles/
│   ├── globals.css       # Variáveis de cor (tema claro e escuro), fonte e reset
│   └── shared.module.css # Estilos compartilhados entre as páginas
├── tests/
│   ├── integration/      # Testes de integração da API
│   └── orchestrator.js   # Utilitários dos testes (espera o servidor, limpa o banco, cria usuários)
├── .env.development      # Variáveis do ambiente local (valores descartáveis)
├── .gitleaks.toml        # Configuração do Gitleaks
├── next.config.js        # Configuração do Next.js (inclui as migrations no build da Vercel)
└── package.json
```

## Variáveis de ambiente

| Variável            | Onde é usada                | Descrição                                                                   |
| ------------------- | --------------------------- | --------------------------------------------------------------------------- |
| `POSTGRES_HOST`     | Desenvolvimento e testes    | Host do banco (`localhost`)                                                 |
| `POSTGRES_PORT`     | Desenvolvimento e testes    | Porta do banco (`5432`)                                                     |
| `POSTGRES_USER`     | Desenvolvimento e testes    | Usuário do banco                                                            |
| `POSTGRES_DB`       | Desenvolvimento e testes    | Nome do banco                                                               |
| `POSTGRES_PASSWORD` | Desenvolvimento e testes    | Senha do banco                                                              |
| `DATABASE_URL`      | Produção e preview (Vercel) | URL de conexão completa. É obrigatória nesses ambientes                     |
| `PASSWORD_PEPPER`   | Todos os ambientes          | Segredo usado antes do bcrypt. Sem ele, cadastro e login respondem erro 500 |

Em desenvolvimento e testes (`NODE_ENV` igual a `development` ou `test`), a aplicação usa as variáveis `POSTGRES_*`. Em qualquer outro ambiente, usa `DATABASE_URL` com `sslmode=verify-full` e lança erro se ela não estiver definida. Mais detalhes em [docs/arquitetura.md](docs/arquitetura.md).

O `PASSWORD_PEPPER` do `.env.development` é um valor de exemplo. Em produção, gere um valor próprio e cadastre-o na Vercel; como gerar e os cuidados estão em [docs/autenticacao.md](docs/autenticacao.md).

## API

| Método  | Caminho                    | Descrição                                               |
| ------- | -------------------------- | ------------------------------------------------------- |
| `GET`   | `/api/v1/status`           | Verificação de saúde da aplicação e do banco de dados   |
| `GET`   | `/api/v1/migrations`       | Lista as migrations pendentes, sem aplicá-las (dry-run) |
| `POST`  | `/api/v1/migrations`       | Aplica as migrations pendentes                          |
| `POST`  | `/api/v1/users`            | Cadastra um usuário                                     |
| `GET`   | `/api/v1/users/{username}` | Consulta um usuário pelo nome de usuário                |
| `PATCH` | `/api/v1/users/{username}` | Atualiza nome de usuário, email e/ou senha              |
| `POST`  | `/api/v1/sessions`         | Autentica por email e senha e cria uma sessão           |

A página `/status` consome o `GET /api/v1/status`.

> **Atenção:** hoje **nenhum endpoint exige autenticação**. O de migrations será uma rota protegida, e as rotas de usuários também precisarão de proteção, já que as respostas atuais incluem o hash da senha. Veja os detalhes e as limitações conhecidas no [guia da API](docs/api/README.md).

A especificação completa está em [docs/api/openapi.yaml](docs/api/openapi.yaml).

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

A aplicação é publicada na Vercel em <https://utilities-node.vercel.app>. Nas variáveis de ambiente do projeto na Vercel ficam a `DATABASE_URL` (conexão com o banco, no Neon) e o `PASSWORD_PEPPER`.

Quando um Pull Request cria uma migration, ela **não é aplicada sozinha em produção**: depois do deploy, aplique-a com `POST /api/v1/migrations`. O `next.config.js` inclui a pasta `infra/migrations` no pacote da função serverless; sem isso, a rota de migrations falha em produção com `ENOENT`.

## Documentação completa

- [Índice da documentação](docs/README.md)
- [Guia de desenvolvimento](docs/desenvolvimento.md)
- [Arquitetura](docs/arquitetura.md)
- [Autenticação e senhas](docs/autenticacao.md)
- [API](docs/api/README.md) e [especificação OpenAPI](docs/api/openapi.yaml)

## Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE).
