# utilities-node

Nova implementação dos meus utilitários de trabalho, originalmente desenvolvidos com HTML, CSS e JavaScript, agora utilizando Node.js, autenticação e práticas modernas de desenvolvimento.

**Aplicação publicada:** <https://utilities-node.vercel.app>

> **Status do projeto: em construção.** A aplicação possui uma página inicial provisória, um catálogo de ferramentas em `/tools`, uma página de status e uma API com cadastro e ativação de usuários, autenticação por sessões, autorização baseada em _features_, consulta e execução de migrations. O Gerador de QR Code, o Divisor de PDF e os conversores de CSV, JSON e TXT já estão disponíveis. O Unificador de PDF e o Gerador de AR e Etiquetas foram implementados e aguardam validação prática; os demais utilitários serão implementados gradualmente.

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

- Página inicial provisória em `pages/index.js`, com tema claro e escuro.
- Catálogo de ferramentas em `/tools`, com registro centralizado em `configs/tools.js` e indicação dos recursos disponíveis e planejados.
- Gerador de QR Code em `/tools/qr-code`, com personalização de cores e download em PNG. A geração e a captura da imagem são realizadas no navegador.
- Divisor de PDF em `/tools/pdf-splitter`, que extrai um intervalo de páginas de um ou mais PDFs (resultado em PDF ou ZIP). O processamento é realizado no navegador.
- Unificador de PDF em `/tools/pdf-merger`, que combina dois ou mais PDFs em um único documento, com ordenação natural dos nomes e opção de inserir páginas em branco para manter a paridade de cada arquivo. O processamento é realizado no navegador.
- Conversor de TXT para CSV em `/tools/txt-to-csv`, que interpreta relatórios de largura fixa, detecta o cabeçalho e permite configurar separador, BOM UTF-8, exibição de datas e separador decimal. O processamento é realizado no navegador. 
- Testador de CPF em `/tools/cpf-tester`, que valida o número informado, calcula os dígitos verificadores da base e encontra combinações válidas ao substituir um dígito por vez. O processamento é realizado no navegador, sem envio dos dados ao servidor.
- Gerador de AR e Etiquetas em `/tools/ar-generator`, que cadastra destinatários e remetente, consulta CEP e localidades, e gera ARs e etiquetas em PDF A4 com código de barras Code 128. O processamento do PDF é realizado no navegador; a conferência visual e a impressão em escala real ainda precisam ser validadas.
- Página `/status`, com painel de monitoramento do banco de dados e atualização automática a cada 5 segundos.
- `GET /api/v1/status`: consulta a saúde do banco. A versão do PostgreSQL só é incluída para usuários com a feature `read:status:all`.
- `GET` e `POST /api/v1/migrations`: lista e aplica migrations, mediante as features `read:migration` e `create:migration`.
- `POST /api/v1/users`: cadastra usuários e envia um e-mail com link de ativação.
- `PATCH /api/v1/activations/{token_id}`: ativa o cadastro por meio de um token válido, de uso único e com validade de 15 minutos.
- `GET` e `PATCH /api/v1/users/{username}`: consulta dados públicos e atualiza usuários conforme as permissões.
- `POST` e `DELETE /api/v1/sessions`: cria e encerra sessões.
- `GET /api/v1/user`: consulta os dados do usuário autenticado e renova a sessão.
- Ambiente local com PostgreSQL e Mailcatcher em Docker, testes de integração, lint, hooks de commit, verificação de segredos e GitHub Actions.

O sistema de autorização é baseado em _features_. O cadastro começa com permissões limitadas; após a ativação, o usuário recebe as permissões padrão de uma conta ativa. Recursos administrativos, como migrations, exigem permissões adicionais. Consulte [Autenticação e autorização](docs/autenticacao.md).

## Tecnologias

| Área           | Ferramentas                                          |
| -------------- | ---------------------------------------------------- |
| Framework      | Next.js 16 (Pages Router) e React 19                 |
| Runtime        | Node.js 24                                           |
| Interface      | React, CSS Modules e SWR                             |
| Banco de dados | PostgreSQL 16 e cliente `pg`, sem ORM                |
| Migrations     | `node-pg-migrate`                                    |
| Senhas         | HMAC-SHA256 com pepper e `bcryptjs`                  |
| API            | `next-connect` e `cookie`                            |
| E-mail         | Nodemailer e Mailcatcher no desenvolvimento          |
| Testes         | Jest 30, Faker e testes de integração                |
| Qualidade      | ESLint, Prettier e EditorConfig                      |
| Commits        | Conventional Commits, Commitizen, Commitlint e Husky |
| Segurança      | GitGuardian ggshield e Gitleaks                      |
| CI/CD          | GitHub Actions e Vercel                              |

## Pré-requisitos

- **Node.js 24.** A versão principal está em `.nvmrc` e o requisito `engines` do `package.json`; com [nvm](https://github.com/nvm-sh/nvm), execute `nvm use`.
- **Docker** com Docker Compose.
- **Git**.
- **ggshield** instalado e autenticado (`ggshield auth login`). O hook de pre-commit executa `ggshield secret scan pre-commit`.
- **Gitleaks** instalado e disponível no `PATH`. O hook de pre-commit executa `gitleaks protect --staged`.

Veja as instruções oficiais de instalação do [ggshield](https://github.com/GitGuardian/ggshield#installation) e do [Gitleaks](https://github.com/gitleaks/gitleaks#installing).

## Primeiros passos

```bash
git clone https://github.com/jhonatancassante/utilities-node.git
cd utilities-node

nvm use
npm install
npm run dev
```

O comando `npm run dev` inicia o fluxo completo:

1. Sobe PostgreSQL e Mailcatcher pelo Docker Compose.
2. Aguarda o PostgreSQL aceitar conexões.
3. Aplica as migrations pendentes.
4. Inicia o Next.js em <http://localhost:3000>.

O painel do Mailcatcher fica em <http://localhost:1080>. Para encerrar o ambiente, pressione `Ctrl+C`; o script de desenvolvimento interrompe os containers.

O arquivo `.env.development` é versionado e contém somente valores descartáveis para desenvolvimento. **Nunca coloque credenciais reais nele.**

## Testes

```bash
npm test
```

O comando sobe os serviços, inicia o Next.js e executa o Jest em sequência (`--runInBand`). Ao final, o `posttest` interrompe os containers.

Para executar os testes continuamente, mantenha o ambiente ativo com `npm run dev` em um terminal e rode `npm run test:watch` em outro.

**Atenção:** os testes apagam e recriam o schema `public` do banco configurado no ambiente de teste. Nunca aponte as variáveis de teste para um banco com dados que devam ser preservados.

## Scripts disponíveis

| Script                                | Descrição                                                            |
| ------------------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                         | Inicia o ambiente completo e encerra os serviços ao sair             |
| `npm run dev:raw`                     | Sobe serviços, aguarda o banco, aplica migrations e inicia o Next.js |
| `npm test`                            | Sobe serviços e servidor, executa Jest e para os serviços            |
| `npm run test:watch`                  | Jest em modo contínuo; exige banco e servidor em execução            |
| `npm run services:up`                 | Sobe PostgreSQL e Mailcatcher                                        |
| `npm run services:stop`               | Para os containers, mantendo-os criados                              |
| `npm run services:down`               | Para e remove os containers                                          |
| `npm run services:wait:database`      | Aguarda o PostgreSQL aceitar conexões                                |
| `npm run migrations:create -- <nome>` | Cria uma migration em `infra/migrations`                             |
| `npm run migrations:up`               | Aplica migrations pendentes no banco local                           |
| `npm run migrations:up:dry`           | Simula a aplicação das migrations                                    |
| `npm run build`                       | Gera o build de produção                                             |
| `npm run lint:prettier:check`         | Verifica a formatação                                                |
| `npm run lint:prettier:fix`           | Corrige a formatação                                                 |
| `npm run lint:eslint:check`           | Executa o ESLint sem aceitar avisos                                  |
| `npm run secrets:scan`                | Procura segredos nos arquivos do projeto                             |
| `npm run secrets:history`             | Procura segredos no histórico Git                                    |
| `npm run commit`                      | Abre o assistente Commitizen                                         |

## Estrutura de pastas

```text
.
├── .github/workflows/    # Workflows de lint, testes e Gitleaks
├── .husky/               # Hooks pre-commit e commit-msg
├── components/           # Componentes compartilhados da interface
├── configs/              # Metadados do site e registro central das ferramentas
├── docs/                 # Documentação técnica, guias e especificação OpenAPI
├── features/             # Componentes e lógica isolada de cada ferramenta
├── infra/
│   ├── compose.yaml      # PostgreSQL e Mailcatcher
│   ├── controller.js     # Middlewares, autorização e tratamento de erros
│   ├── database.js       # Conexão e consultas PostgreSQL
│   ├── email.js          # Envio de e-mails com Nodemailer
│   ├── errors.js         # Classes de erro
│   ├── migrations/       # Histórico de alterações do banco
│   └── scripts/          # Inicialização e gerenciamento dos serviços
├── models/               # Regras de negócio e acesso aos dados
├── pages/
│   ├── api/v1/           # Endpoints versionados da API
│   ├── status/           # Painel de status
│   ├── tools/             # Catálogo e páginas individuais das ferramentas
│   └── ...               # Demais páginas da interface
├── styles/               # Estilos globais e compartilhados
└── tests/
    ├── integration/      # Testes da API, infraestrutura e fluxos
    ├── unit/             # Testes unitários dos models
    └── orchestrator.js   # Utilitários para os testes
```

## Variáveis de ambiente

| Variável                                                                              | Uso                                                       |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` | Conexão local e configuração do container PostgreSQL      |
| `DATABASE_URL`                                                                        | Conexão PostgreSQL em preview e produção                  |
| `PASSWORD_PEPPER`                                                                     | Segredo usado no processamento das senhas                 |
| `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`                                                  | Host e porta SMTP                                         |
| `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`                                              | Credenciais SMTP; podem ficar vazias no Mailcatcher local |

Em `development` e `test`, o banco usa as variáveis `POSTGRES_*`. Nos demais ambientes, usa `DATABASE_URL` com `sslmode=verify-full`. A aplicação exige `PASSWORD_PEPPER` para criar ou comparar senhas.

No ambiente local, o Mailcatcher recebe SMTP na porta `1025` e apresenta as mensagens em <http://localhost:1080>. Em produção, configure as variáveis SMTP com os dados do provedor de e-mail. O transporte usa conexão segura quando `NODE_ENV=production`.

A origem dos links de ativação é definida em `infra/webserver.js`: localmente é `http://localhost:3000`, em preview usa `VERCEL_URL` e em produção usa o domínio configurado no código.

## API

Todos os endpoints usam o prefixo `/api/v1`.

| Método           | Caminho                   | Descrição                                                 |
| ---------------- | ------------------------- | --------------------------------------------------------- |
| `GET`            | `/status`                 | Consulta o status do banco                                |
| `GET`, `POST`    | `/migrations`             | Lista e aplica migrations; exige features administrativas |
| `POST`           | `/users`                  | Cadastra usuário e envia e-mail de ativação               |
| `GET`, `PATCH`   | `/users/{username}`       | Consulta dados públicos e atualiza conforme autorização   |
| `PATCH`          | `/activations/{token_id}` | Ativa um cadastro com token válido                        |
| `POST`, `DELETE` | `/sessions`               | Cria e encerra sessões                                    |
| `GET`            | `/user`                   | Retorna o usuário autenticado e renova a sessão           |

A API usa autorização por _features_, não uma regra única de “estar logado”. Algumas operações são públicas, outras exigem sessão válida e outras exigem permissões específicas. Consulte o [guia da API](docs/api/README.md) e a [especificação OpenAPI](docs/api/openapi.yaml).

## Como contribuir

1. Crie uma branch a partir de `main`.
2. Faça as alterações e execute os testes e verificações de qualidade do projeto.
3. Use `npm run commit` para gerar uma mensagem no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/).
4. Abra um Pull Request.

O Husky executa verificações de segredos, lint-staged e Commitlint nos hooks locais. No Pull Request, o GitHub Actions executa Prettier, ESLint, Commitlint, Jest e Gitleaks. Mais detalhes em [Guia de desenvolvimento](docs/desenvolvimento.md).

## Deploy

A aplicação é publicada na Vercel em <https://utilities-node.vercel.app>. Configure no ambiente da Vercel:

- `DATABASE_URL`: conexão PostgreSQL (Neon), com SSL.
- `PASSWORD_PEPPER`: segredo persistente usado nos hashes.
- `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER` e `EMAIL_SMTP_PASSWORD`: dados do provedor SMTP.

Migrations novas **não são aplicadas automaticamente** no deploy. Após publicar uma alteração que inclua migration, execute `POST /api/v1/migrations` com uma sessão que possua a feature `create:migration`.

O `next.config.js` inclui `infra/migrations` e `package.json` no pacote da função serverless que atende a rota de migrations. Essa configuração é necessária porque o `node-pg-migrate` lê os arquivos em tempo de execução.

## Documentação completa

- [Índice da documentação](docs/README.md)
- [Guia de desenvolvimento](docs/desenvolvimento.md)
- [Arquitetura](docs/arquitetura.md)
- [Autenticação, sessões e autorização](docs/autenticacao.md)
- [Guia da API](docs/api/README.md)
- [Especificação OpenAPI](docs/api/openapi.yaml)
- [Adicionando ferramentas](docs/adicionando-ferramentas.md)

## Licença

Distribuído sob a licença MIT. Consulte [LICENSE](LICENSE).
