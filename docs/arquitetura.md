# Arquitetura

Visão da organização atual do **utilities-node**. O projeto utiliza Next.js com Pages Router, PostgreSQL e separação entre interface, funcionalidades das ferramentas, endpoints HTTP, infraestrutura e regras de negócio.

## Visão geral

```text
Cliente HTTP
    │
    ▼
pages/api/v1/...       Endpoints: recebem a requisição e montam a resposta
    │
    ▼
infra/controller.js    Middlewares, contexto de usuário, autorização e erros
    │
    ▼
models/                Regras de negócio, autenticação, autorização e persistência
    │
    ▼
infra/database.js      Cliente pg e consultas parametrizadas
    │
    ▼
PostgreSQL             Docker local / banco remoto via DATABASE_URL
```

Fora do backend, `lib/client/` reúne o que só roda no navegador (cliente HTTP, sessão, ativação e download de arquivos), `lib/shared/` guarda o que é usado nos dois lados (a validação de usuário, importada por `models/user.js` e pelas páginas) e `hooks/use-user.js` é a fonte única do usuário autenticado nas telas (chave `/api/v1/user` do SWR, com `refreshUser`, `setUser` e `clearUser`).

Os endpoints usam `next-connect` por meio de `infra/controller.js`. Cada rota declara os métodos aceitos, middlewares compartilhados e handlers. As regras de negócio ficam nos models; a infraestrutura concentra conexão, e-mail, erros e configuração do servidor.

## Estrutura relevante

| Caminho                               | Responsabilidade                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `pages/api/v1/status`                 | Saúde do banco e informações de status                                               |
| `pages/api/v1/migrations`             | Consulta e aplicação de migrations                                                   |
| `pages/api/v1/users`                  | Cadastro de usuários                                                                 |
| `pages/api/v1/users/[username]`       | Consulta pública e atualização autorizada                                            |
| `pages/api/v1/admin/users`            | Pesquisa administrativa de usuários por nome ou e-mail                               |
| `pages/api/v1/admin/users/[username]` | Consulta, atualização de dados/features e remoção administrativa                     |
| `pages/api/v1/activations/[token_id]` | Ativação de contas                                                                   |
| `pages/api/v1/sessions`               | Criação e encerramento de sessões                                                    |
| `pages/api/v1/user`                   | Consulta do usuário autenticado e renovação da sessão                                |
| `models/user.js`                      | Cadastro, consulta, atualização e gerenciamento interno de features                  |
| `models/password.js`                  | HMAC-SHA256 com pepper e bcrypt                                                      |
| `models/authentication.js`            | Validação das credenciais                                                            |
| `models/authorization.js`             | Verificação de acesso, identificação de privilégios e filtragem de saída              |
| `configs/features.js`                 | Catálogo único de features e lista de privilégios administrativos                    |
| `configs/admin.js`                    | Registro extensível das seções e permissões do painel administrativo                 |
| `models/session.js`                   | Criação, validação, renovação e expiração de sessões                                 |
| `models/activation.js`                | Tokens de ativação, e-mail e ativação da conta                                       |
| `models/migrator.js`                  | Execução e listagem de migrations                                                    |
| `infra/controller.js`                 | Middlewares de usuário anônimo/autenticado, verificação de features, cookies e erros |
| `infra/database.js`                   | Conexão PostgreSQL e execução de consultas                                           |
| `infra/email.js`                      | Transporte SMTP via Nodemailer                                                       |
| `infra/webserver.js`                  | Origem usada nos links de ativação                                                   |
| `infra/errors.js`                     | Classes de erro e serialização JSON                                                  |
| `infra/migrations/`                   | Histórico versionado do esquema do banco                                             |
| `infra/compose.yaml`                  | PostgreSQL e Mailcatcher locais                                                      |
| `tests/`                              | Testes de integração, unidade e fluxo completo de cadastro                           |

A API é versionada no caminho `/api/v1`.

## Contexto de requisição e autorização

As rotas que usam `injectAnonymousOrUser` recebem um usuário em `request.context.user`.

- Sem cookie `session_id`, o controller injeta o perfil anônimo com `create:session`, `create:user` e `read:activation_token`.
- Com cookie, o controller procura uma sessão não expirada e carrega o usuário correspondente.
- Um token inválido ou expirado gera `UnauthorizedError` nas rotas que usam esse middleware. O middleware `injectUserOrAnonymousOnInvalidSession` (usado em `POST /api/v1/sessions`, `POST /api/v1/users`, `PATCH /api/v1/activations/{token_id}` e `GET /api/v1/status`) trata sessões inexistentes ou expiradas como visitante anônimo e remove o cookie antigo. `DELETE /api/v1/sessions` também usa esse middleware, mas o próprio handler ainda exige uma sessão válida para concluir o logout.
- `canRequest(feature)` verifica a feature necessária e gera `ForbiddenError` quando não há permissão.

O model `authorization.js` mantém o catálogo de features e a função `can(user, feature, resource)`. Para atualização de usuário, a autorização considera o recurso: o próprio usuário pode ser atualizado com `update:user`; outro usuário exige `update:user:others`.

A função `filterOutput(user, feature, resource)` controla os campos que podem ser enviados em cada resposta. A representação pública de usuário não inclui e-mail ou hash de senha; a representação privada do próprio usuário inclui e-mail, mas não senha. A representação de sessão não inclui o token: ele é enviado exclusivamente no cookie `session_id`, configurado como `HttpOnly`.

### Painel administrativo

A interface fica em `pages/admin/`. O menu do avatar exibe o acesso à administração quando o usuário possui ao menos uma feature listada como privilegiada em `configs/features.js`. As opções disponíveis são registradas em `configs/admin.js`, cada uma com sua própria `requiredFeature`; adicionar uma nova seção exige incluir seu registro e sua página/endpoint correspondente.

A área de gerenciamento de usuários exige `update:user:others` tanto na interface quanto nos endpoints `pages/api/v1/admin/users`. A pesquisa retorna até dez contas por trecho de username ou e-mail. O editor permite alterar username, e-mail, senha e a lista completa de features. O catálogo de permissões é compartilhado entre o backend e a interface. A remoção é transacional e elimina sessões e tokens de ativação associados; a própria conta não pode ser removida pelo painel.

### Features conhecidas

`create:user`, `read:user`, `read:user:self`, `update:user`, `update:user:others`, `create:session`, `read:session`, `read:activation_token`, `create:migration`, `read:migration`, `read:status` e `read:status:all`. As features `update:user:others` e `read:status:all` compõem atualmente o conjunto de privilégios administrativos.

O cadastro recebe `read:activation_token`; após ativação, recebe `create:session`, `read:session` e `update:user`. Features administrativas não são concedidas automaticamente.

**Observação de implementação:** `read:status` está no catálogo e nos testes, mas o endpoint `GET /status` não chama `canRequest`; portanto, a rota é pública. `read:status:all` é consultada pela filtragem de saída para decidir se a versão do PostgreSQL pode ser incluída.

## Interface

- `pages/_app.js` carrega estilos globais.
- `pages/_document.js` define o documento HTML e aplica o tema salvo antes da primeira pintura.
- `components/Layout` compõe cabeçalho, conteúdo e rodapé.
- `components/ThemeToggle` alterna tema claro/escuro.
- `components/AppHead` define título e descrição.
- `components/Header` reúne a navegação principal, o submenu de ferramentas e o seletor de tema; `components/Footer` apresenta os links externos e os créditos.
- `pages/status` apresenta o painel alimentado por SWR, com atualização a cada cinco segundos.
- `pages/diario-oficial/edicao-0012026` apresenta a edição 001/2026 do Diário Oficial em um leitor PDF do navegador, com opção de download e metadados `noindex, nofollow`.

### Catálogo e ferramentas

O catálogo de ferramentas é exibido em `/tools`, implementado por `pages/tools/index.js`. A lista é mantida em `configs/tools.js`: cada item possui `slug`, título, descrição, ícone e status (`available` ou `soon`). O módulo deriva o caminho (`href`) e a disponibilidade (`isAvailable`), evitando manter essas informações em mais de um lugar. O cabeçalho e o catálogo consomem o mesmo registro.

As páginas individuais ficam em `pages/tools/<slug>/index.js` e utilizam `components/ToolPage` para compartilhar título, descrição, ícone e layout. A implementação específica fica em `features/<slug>/`, separando componentes React de funções auxiliares em `lib/`.

O Gerador de QR Code está em `features/qr-code/components/`; a validação e normalização de URLs ficam em `lib/url.js`, e a captura para PNG em `lib/download.js`. O QR Code é renderizado com `qrcode.react`; o download utiliza `html2canvas`, carregado dinamicamente porque depende do DOM. O processamento ocorre no navegador, sem envio do link a um endpoint da aplicação.

O Divisor de PDF está em `features/pdf-splitter/`: a interface fica em `components/PdfSplitter/` e as regras (validação do intervalo, seleção de arquivos, extração de páginas e geração do ZIP) em `lib/pdf.js`. Utiliza `pdf-lib` e `jszip`, carregados dinamicamente, e os arquivos não são enviados a nenhum endpoint. Arquivos com menos páginas que o intervalo pedido são extraídos até a última página, ou ignorados quando não chegam à página inicial, e aparecem em um aviso ao final do processamento.

O Unificador de PDF fica em `features/pdf-merger/`: `lib/pdf.js` valida e ordena os arquivos por nome com comparação numérica natural e os combina com `pdf-lib`, carregado sob demanda. Há uma opção para inserir uma página em branco após cada PDF com número ímpar de páginas, mantendo a paridade individual dos documentos. O processamento ocorre no navegador.

O Gerador de AR e Etiquetas fica em `features/ar-generator/`: a interface mantém os cadastros de destinatários e remetente, consulta CEP pelo ViaCEP e localidades pela API do IBGE, e usa `lib/pdf.js` para gerar ARs e etiquetas em PDF A4 com códigos de barras Code 128. A geração ocorre no navegador; a conferência de alinhamento e impressão em escala real deve ser feita manualmente.

Os conversores de arquivos também ficam isolados em `features/`. O Conversor de CSV para JSON utiliza `features/csv-to-json/`, com interpretação e geração do JSON em `lib/csv.js`. O Conversor de JSON para CSV utiliza `features/json-to-csv/`: `lib/json.js` normaliza objetos e listas em registros, coleta as colunas na ordem de primeira ocorrência, converte valores aninhados em texto e gera o CSV com Papa Parse. O Conversor de TXT para CSV utiliza `features/txt-to-csv/`: `lib/txt.js` detecta a codificação UTF-8 ou Windows-1252, identifica as posições das colunas pelo cabeçalho e converte os registros de largura fixa em CSV. As três ferramentas utilizam componentes compartilhados e processam os arquivos inteiramente no navegador. O Testador de CPF fica em `features/cpf-tester/`: `lib/cpf.js` concentra a formatação, o cálculo dos dígitos verificadores, a validação e a geração de variações por alteração de uma posição. A interface usa componentes compartilhados e executa todo o processamento localmente.

Componentes e utilitários compartilhados entre ferramentas: `components/FileDropzone` (envio por clique ou arrastar e soltar), `components/StatusMessage` (mensagens de andamento, sucesso e erro), `components/WarningList` (aviso amarelo com lista rolável), `components/HelpToggle` (caixa "Como funciona?") e `lib/client/files.js` (`getFormattedTimestamp` e `downloadBlob`).

Para incluir novas ferramentas, consulte o [guia Adicionando uma nova ferramenta](adicionando-ferramentas.md).

## Banco de dados

`infra/database.js` exporta:

- `query(queryObject)`: abre um cliente PostgreSQL, executa a consulta e fecha a conexão no `finally`. Erros são encapsulados em `ServiceError`.
- `transaction(callback)`: abre um cliente, inicia uma transação com `BEGIN`, executa o callback, confirma com `COMMIT` ou desfaz com `ROLLBACK` em caso de erro e encerra a conexão. Erros que já possuem `statusCode` são repassados; falhas do banco são encapsuladas em `ServiceError`.
- `getNewClient()`: retorna um cliente conectado; quem chama deve executar `client.end()`. É utilizado pelo migrador.

Não há pool de conexões: cada chamada a `query` abre e fecha uma conexão. Consultas que recebem valores externos devem utilizar parâmetros (`$1`, `$2` etc.).

### Configuração

| Ambiente               | Origem                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `development` e `test` | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` |
| Demais ambientes       | `DATABASE_URL`, com `sslmode=verify-full`                                             |

## Esquema e migrations

As migrations são executadas por `node-pg-migrate`, ficam em `infra/migrations` e têm seu histórico na tabela `pgmigrations`. O endpoint `GET /api/v1/migrations` usa `dryRun`; `POST` aplica as pendentes. No deploy da Vercel, a pasta de migrations e o `package.json` são incluídos no pacote serverless por `next.config.js`.

Migrations atualmente presentes:

1. Criação da tabela `users`.
2. Renomeação de `createdAt` e `updatedAt` para `created_at` e `updated_at`.
3. Criação da tabela `sessions`.
4. Inclusão da coluna `features` em `users`.
5. Criação da tabela `user_activation_tokens`.

| Tabela                   | Campos relevantes                                                             |
| ------------------------ | ----------------------------------------------------------------------------- |
| `users`                  | `id`, `username`, `email`, `password`, `features`, `created_at`, `updated_at` |
| `sessions`               | `id`, `token`, `user_id`, `expires_at`, `created_at`, `updated_at`            |
| `user_activation_tokens` | `id`, `user_id`, `expires_at`, `used_at`, `created_at`, `updated_at`          |
| `pgmigrations`           | Histórico gerenciado pelo `node-pg-migrate`                                   |

Os identificadores são UUID. `username` tem até 30 caracteres, `email` até 254, `password` armazena hash de 60 caracteres, `sessions.token` tem 96 caracteres. As migrations atuais declaram `down = false`: não há rollback automático. Nunca altere uma migration já aplicada; crie outra.

## E-mail e ativação

`infra/email.js` cria um transporter Nodemailer a partir de `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER` e `EMAIL_SMTP_PASSWORD`. Em produção, `secure` é habilitado. Falhas de envio são encapsuladas em `ServiceError`, com contexto do envio.

No desenvolvimento, o Docker Compose inicia Mailcatcher: SMTP na porta `1025` e interface web na porta `1080`. `models/activation.js` gera tokens de 15 minutos, envia o link de ativação e marca o token como usado após a ativação.

A origem do link é definida por `infra/webserver.js`: localhost em desenvolvimento/teste, URL de preview da Vercel em preview e domínio de produção definido no código.

## Tratamento de erros

O controller serializa erros com `name`, `message`, `action` e `status_code`.

| Classe                  | HTTP          | Tratamento                                             |
| ----------------------- | ------------- | ------------------------------------------------------ |
| `ValidationError`       | 400           | Devolvida ao cliente                                   |
| `UnauthorizedError`     | 401           | Devolvida ao cliente e limpa cookie de sessão          |
| `ForbiddenError`        | 403           | Devolvida ao cliente                                   |
| `NotFoundError`         | 404           | Devolvida ao cliente                                   |
| `MethodNotAllowedError` | 405           | Devolvida com cabeçalho `Allow`                        |
| `InternalServerError`   | 500           | Mensagem genérica                                      |
| `ServiceError`          | 503 na classe | Tratada pelo controller como erro interno genérico 500 |
| `ConfigurationError`    | 500           | Tratada como erro interno genérico                     |

Erros inesperados são registrados no servidor; detalhes internos não devem ser expostos ao cliente.
