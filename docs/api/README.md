# API

Guia de leitura dos endpoints. A descrição formal, no padrão OpenAPI 3.1, está em [openapi.yaml](openapi.yaml).

## Convenções

- **Caminho base:** `/api/v1`. A versão faz parte do caminho.
- **Formato:** requisições com corpo usam JSON (`Content-Type: application/json`) e as respostas são JSON (`application/json`).
- **Ambientes:**
  - Produção: `https://utilities-node.vercel.app`
  - Local: `http://localhost:3000`
- **Autenticação:** ainda não existe. Nenhum endpoint exige login hoje. Veja [Limitações conhecidas](#limitações-conhecidas).
- **Nomes dos campos:** `snake_case` (`updated_at`, `max_connections`, `status_code`).

## Resumo dos endpoints

| Método  | Caminho                    | Descrição                                     | Proteção                      |
| ------- | -------------------------- | --------------------------------------------- | ----------------------------- |
| `GET`   | `/api/v1/status`           | Saúde da aplicação e do banco de dados        | Pública                       |
| `GET`   | `/api/v1/migrations`       | Lista as migrations pendentes, sem aplicá-las | Sem proteção (será protegida) |
| `POST`  | `/api/v1/migrations`       | Aplica as migrations pendentes                | Sem proteção (será protegida) |
| `POST`  | `/api/v1/users`            | Cadastra um usuário                           | Sem proteção                  |
| `GET`   | `/api/v1/users/{username}` | Consulta um usuário                           | Sem proteção                  |
| `PATCH` | `/api/v1/users/{username}` | Atualiza nome de usuário, email e/ou senha    | Sem proteção                  |
| `POST`  | `/api/v1/sessions`         | Autentica por email e senha e cria uma sessão | Pública (é o login)           |

## Formato dos erros

Todos os erros devolvem um JSON com os mesmos quatro campos:

```json
{
  "name": "ValidationError",
  "message": "O nome de usuário informado já está sendo utilizado.",
  "action": "Utilize outro nome de usuário para realizar esta operação.",
  "status_code": 400
}
```

| Campo         | Tipo    | Descrição                                            |
| ------------- | ------- | ---------------------------------------------------- |
| `name`        | texto   | Tipo do erro (`ValidationError`, `NotFoundError`...) |
| `message`     | texto   | O que aconteceu                                      |
| `action`      | texto   | O que fazer a respeito                               |
| `status_code` | inteiro | Código HTTP da resposta                              |

Códigos usados:

| Código | Erro                    | Quando                                                                                   |
| ------ | ----------------------- | ---------------------------------------------------------------------------------------- |
| `400`  | `ValidationError`       | Dados inválidos ou já em uso (nome de usuário, email)                                    |
| `401`  | `UnauthorizedError`     | Login com credenciais que não conferem                                                   |
| `404`  | `NotFoundError`         | Usuário não encontrado                                                                   |
| `405`  | `MethodNotAllowedError` | Método HTTP não aceito pelo endpoint. A resposta traz o cabeçalho `Allow` com os aceitos |
| `500`  | `InternalServerError`   | Qualquer falha inesperada (banco inacessível, configuração ausente...)                   |

O `500` sempre traz a mesma mensagem fixa ("Um erro interno não esperado aconteceu."). O erro original é registrado no console do servidor e não é exposto na resposta.

```json
{
  "name": "InternalServerError",
  "message": "Um erro interno não esperado aconteceu.",
  "action": "Entre em contato com o suporte.",
  "status_code": 500
}
```

Exemplo de `405` (`POST /api/v1/status`, com `Allow: GET`):

```json
{
  "name": "MethodNotAllowedError",
  "message": "Método não permitido para esse endpoint.",
  "action": "Verifique se o método HTTP é válido para este endpoint.",
  "status_code": 405
}
```

## `GET /api/v1/status`

Verifica a saúde da aplicação. É o endpoint para saber se o sistema está no ar e conseguindo falar com o banco de dados. O objetivo é apenas esse: não altera nenhum dado.

Hoje a aplicação depende só do banco. Conforme ela ganhar mais funcionalidades que usam o banco de dados, esse endpoint continua sendo a referência de saúde do sistema.

A página [`/status`](https://utilities-node.vercel.app/status) do site consome este endpoint a cada 5 segundos para montar o painel de monitoramento.

**Resposta `200`**

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

| Campo                                      | Tipo    | Descrição                                                                      |
| ------------------------------------------ | ------- | ------------------------------------------------------------------------------ |
| `updated_at`                               | texto   | Momento em que a resposta foi gerada, em ISO 8601 (UTC)                        |
| `dependencies.database.status`             | texto   | `"Online"` quando a consulta ao banco funcionou                                |
| `dependencies.database.max_connections`    | inteiro | Limite de conexões simultâneas do banco (`current_setting('max_connections')`) |
| `dependencies.database.opened_connections` | inteiro | Conexões abertas hoje no banco da aplicação (inclui a da própria consulta)     |

A versão do PostgreSQL deliberadamente **não** é informada, para não expor a versão em uso.

O `status` só aparece com `"Online"`: se o banco não responder, o endpoint devolve `500` em vez de um `200` com `"Offline"`.

A contagem de conexões considera o banco da conexão atual (`current_database()`).

**Resposta `500`:** qualquer falha ao consultar o banco (por exemplo, banco inacessível). Veja o [formato dos erros](#formato-dos-erros).

**Exemplo**

```bash
curl http://localhost:3000/api/v1/status
```

## `GET /api/v1/migrations`

Mostra quais migrations ainda **não foram aplicadas**, sem alterar o banco (execução em modo dry-run).

**Resposta `200`:** lista de migrations pendentes. Lista vazia significa que o banco está em dia.

```json
[
  {
    "path": "/app/infra/migrations/1792247067512_create-sessions.js",
    "name": "1792247067512_create-sessions",
    "timestamp": 1792247067512
  }
]
```

| Campo       | Tipo    | Descrição                                               |
| ----------- | ------- | ------------------------------------------------------- |
| `path`      | texto   | Caminho do arquivo da migration no servidor             |
| `name`      | texto   | Nome da migration, sem a extensão                       |
| `timestamp` | inteiro | Número do início do nome do arquivo, que define a ordem |

```bash
curl http://localhost:3000/api/v1/migrations
```

## `POST /api/v1/migrations`

**Aplica** as migrations pendentes ao banco.

| Código | Quando                                                       | Corpo                          |
| ------ | ------------------------------------------------------------ | ------------------------------ |
| `201`  | Havia migrations pendentes e foram aplicadas                 | Lista das migrations aplicadas |
| `200`  | Nenhuma migration pendente                                   | Lista vazia (`[]`)             |
| `500`  | Falha ao executar (banco inacessível, erro em uma migration) | `InternalServerError`          |

```bash
curl -X POST http://localhost:3000/api/v1/migrations
```

A operação é repetível: executá-la de novo, sem migrations novas, devolve `200` e `[]`.

Qualquer método diferente de `GET` e `POST` recebe `405`, com `Allow: GET, POST`.

> **Atenção:** este endpoint **não exige autenticação**. Qualquer cliente que alcance a URL pode consultar as migrations pendentes e executar o `POST`. A intenção é transformá-lo em uma **rota protegida**.

## `POST /api/v1/users`

Cadastra um usuário. A senha é guardada com hash (veja [autenticação](../autenticacao.md)).

**Corpo**

```json
{
  "username": "jhonatan",
  "email": "jhonatan@exemplo.com.br",
  "password": "uma-senha-forte"
}
```

| Campo      | Tipo  | Regras                                                                                          |
| ---------- | ----- | ----------------------------------------------------------------------------------------------- |
| `username` | texto | Único, sem diferenciar maiúsculas de minúsculas. Até 30 caracteres (limite do banco)            |
| `email`    | texto | Formato `nome@dominio.com`. Único, sem diferenciar maiúsculas de minúsculas. Até 254 caracteres |
| `password` | texto | Obrigatória                                                                                     |

**Respostas**

| Código | Quando                                                     |
| ------ | ---------------------------------------------------------- |
| `201`  | Usuário criado. O corpo é o usuário (veja abaixo)          |
| `400`  | Nome de usuário já usado, email inválido ou email já usado |
| `500`  | Falha inesperada, inclusive campos ausentes                |

**Resposta `201`**

```json
{
  "id": "5c5b0c0e-2f6e-4a39-9a4a-0d0d9d0a6f10",
  "username": "jhonatan",
  "email": "jhonatan@exemplo.com.br",
  "password": "$2b$14$Zl0...",
  "created_at": "2026-10-17T13:06:00.000Z",
  "updated_at": "2026-10-17T13:06:00.000Z"
}
```

> **Atenção:** o campo `password` da resposta é o **hash** da senha. Hoje ele é devolvido; deve deixar de sair quando as rotas forem protegidas.

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"username":"jhonatan","email":"jhonatan@exemplo.com.br","password":"uma-senha-forte"}'
```

## `GET /api/v1/users/{username}`

Consulta um usuário pelo nome de usuário. A busca **não diferencia maiúsculas de minúsculas**: `/users/MesmoCase` e `/users/mesmocase` encontram o mesmo usuário.

| Código | Quando                                                |
| ------ | ----------------------------------------------------- |
| `200`  | Usuário encontrado (mesmo corpo do `201` do cadastro) |
| `404`  | Nenhum usuário com esse nome                          |

```bash
curl http://localhost:3000/api/v1/users/jhonatan
```

## `PATCH /api/v1/users/{username}`

Atualiza o usuário. Envie só os campos que quer mudar (`username`, `email` e/ou `password`); os demais ficam como estão. O `updated_at` é atualizado.

```json
{
  "email": "novo@exemplo.com.br"
}
```

| Código | Quando                                                                 |
| ------ | ---------------------------------------------------------------------- |
| `200`  | Usuário atualizado (mesmo corpo do `201` do cadastro)                  |
| `400`  | Novo nome de usuário ou email já em uso, ou email com formato inválido |
| `404`  | Nenhum usuário com esse nome                                           |

A nova senha, quando enviada, também é guardada com hash.

```bash
curl -X PATCH http://localhost:3000/api/v1/users/jhonatan \
  -H "Content-Type: application/json" \
  -d '{"email":"novo@exemplo.com.br"}'
```

## `POST /api/v1/sessions`

Faz o login: confere email e senha, cria uma sessão no banco e envia o token no cookie `session_id`.

**Corpo**

```json
{
  "email": "jhonatan@exemplo.com.br",
  "password": "uma-senha-forte"
}
```

**Respostas**

| Código | Quando                                                            |
| ------ | ----------------------------------------------------------------- |
| `201`  | Credenciais corretas. Sessão criada e cookie enviado              |
| `401`  | Email ou senha não conferem (a mensagem é a mesma nos dois casos) |
| `500`  | Falha inesperada, inclusive campos ausentes                       |

**Resposta `201`**

```json
{
  "id": "0c7f0f3e-8e3b-4a58-93a7-3f1d4f3f5c21",
  "token": "token-placeholder-de-exemplo",
  "user_id": "5c5b0c0e-2f6e-4a39-9a4a-0d0d9d0a6f10",
  "expires_at": "2026-11-16T13:06:00.000Z",
  "created_at": "2026-10-17T13:06:00.000Z",
  "updated_at": "2026-10-17T13:06:00.000Z"
}
```

A resposta também traz o cabeçalho `Set-Cookie`:

```text
session_id=<token>; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax
```

Em produção o cookie também leva o atributo `Secure`. Detalhes sobre sessões e cookie em [autenticação](../autenticacao.md#sessões).

**Resposta `401`:** o corpo é o `UnauthorizedError` com a mensagem "Não foi possível autenticar seu usuário no sistema." Ela é a mesma quando o email não existe e quando a senha está errada, para não revelar quais emails estão cadastrados.

```bash
curl -i -X POST http://localhost:3000/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"email":"jhonatan@exemplo.com.br","password":"uma-senha-forte"}'
```

## Limitações conhecidas

Estado atual da API, para ninguém se surpreender:

- **Sem autenticação nas rotas.** O login cria a sessão e o cookie, mas nenhum endpoint exige a sessão. Em especial, `GET` e `PATCH` em `/api/v1/users/{username}` e `/api/v1/migrations` aceitam qualquer cliente. A proteção está prevista.
- **O hash da senha sai nas respostas de usuários**, e o token da sessão sai no corpo do login.
- **Campos ausentes não são validados.** Faltar `email`, `username` ou `password` no corpo resulta em `500` em vez de `400`.
- **No `PATCH`, reenviar o próprio email** (ou o próprio nome de usuário, mudando só as maiúsculas) resulta em `400`, porque a checagem de unicidade encontra o próprio registro.
- **O email não é normalizado.** A validação de formato ignora espaços nas pontas, mas o valor gravado é o enviado.
- **Sem limite de tentativas de login.**

## Visualizar a especificação OpenAPI

O arquivo [openapi.yaml](openapi.yaml) é legível como texto, mas dá para vê-lo como uma página navegável, com os botões "Try it out" (no Swagger):

| Opção                        | Como                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| **Editor online do Swagger** | Abra <https://editor.swagger.io> e cole o conteúdo do arquivo. Nada é instalado.           |
| **Extensão do VS Code**      | Instale a extensão _OpenAPI (Swagger) Editor_ e abra o arquivo para ver a pré-visualização |
| **Redocly, pelo terminal**   | Rode `npx @redocly/cli preview-docs docs/api/openapi.yaml` e abra o endereço mostrado      |

Para checar se o arquivo continua válido depois de uma alteração:

```bash
npx @redocly/cli lint docs/api/openapi.yaml
```

O comando deve terminar sem erros. Podem aparecer avisos sobre o servidor `localhost` (é o ambiente de desenvolvimento) e sobre operações sem resposta `4XX`; eles são esperados.
