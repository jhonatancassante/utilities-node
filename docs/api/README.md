# API

Guia dos endpoints implementados. O contrato formal está em [openapi.yaml](openapi.yaml).

## Convenções

- **Prefixo:** `/api/v1`.
- **Formato:** JSON para corpos de requisição e respostas.
- **Produção:** `https://utilities-node.vercel.app`.
- **Desenvolvimento:** `http://localhost:3000`.
- **Autenticação:** cookie `session_id`, quando a operação exige uma sessão.
- **Autorização:** permissões granulares armazenadas em `users.features`; estar autenticado não concede acesso automaticamente.
- **Campos:** `snake_case`.

## Resumo dos endpoints

| Método | Caminho | Acesso |
| --- | --- | --- |
| `GET` | `/api/v1/status` | Público; detalhes de versão condicionados a `read:status:all` |
| `GET` | `/api/v1/migrations` | Feature `read:migration` |
| `POST` | `/api/v1/migrations` | Feature `create:migration` |
| `POST` | `/api/v1/users` | Feature `create:user` (visitante padrão) |
| `GET` | `/api/v1/users/{username}` | Público; saída filtrada |
| `PATCH` | `/api/v1/users/{username}` | Feature `update:user`; próprio usuário ou `update:user:others` |
| `PATCH` | `/api/v1/activations/{token_id}` | Feature `read:activation_token` |
| `POST` | `/api/v1/sessions` | Feature `create:session` |
| `DELETE` | `/api/v1/sessions` | Sessão válida |
| `GET` | `/api/v1/user` | Sessão válida e feature `read:session` |

## Autorização e erros

O middleware `injectAnonymousOrUser` identifica o visitante ou carrega o usuário associado a uma sessão válida. O middleware `canRequest(feature)` verifica a permissão exigida pelo endpoint. A autorização de atualização também compara o identificador do usuário autenticado com o recurso solicitado.

Os erros seguem o formato:

```json
{
  "name": "ForbiddenError",
  "message": "Você não possui permissão para executar esta ação.",
  "action": "Verifique se o seu usuário possui a feature \"read:migration\".",
  "status_code": 403
}
```

| Código | Erro | Significado |
| --- | --- | --- |
| `400` | `ValidationError` | Dados inválidos ou duplicados |
| `401` | `UnauthorizedError` | Credenciais inválidas ou sessão ausente, inválida ou expirada |
| `403` | `ForbiddenError` | Feature necessária não concedida |
| `404` | `NotFoundError` | Usuário ou token não encontrado, expirado ou já utilizado |
| `405` | `MethodNotAllowedError` | Método não aceito; a resposta informa `Allow` |
| `500` | `InternalServerError` | Falha inesperada; detalhes ficam no log |

O controller limpa o cookie `session_id` em qualquer resposta `401`. Nas rotas que injetam o usuário a partir do cookie, um token inválido enviado pelo cliente também resulta em `401`, mesmo quando a operação é pública para visitantes sem cookie. As respostas que definem ou removem o cookie também usam `Cache-Control: no-store, no-cache, max-age=0, must-revalidate`.

## `GET /api/v1/status`

Verifica a conectividade com o banco de dados. A página `/status` consulta o endpoint a cada cinco segundos.

**Resposta 200 para visitante ou usuário sem `read:status:all`:**

```json
{
  "updated_at": "2026-11-16T13:06:00.000Z",
  "dependencies": {
    "database": {
      "max_connections": 100,
      "opened_connections": 1
    }
  }
}
```

Com `read:status:all`, a resposta inclui também `dependencies.database.version`. Se a consulta ao banco falhar, a API responde `500`.

## `GET /api/v1/migrations`

Exige `read:migration`. Lista migrations pendentes em modo `dry-run`, sem alterar o banco. Retorna `200` e um array; array vazio significa que não há migrations pendentes.

## `POST /api/v1/migrations`

Exige `create:migration`. Aplica migrations pendentes em ordem:

- `201`: uma ou mais migrations foram aplicadas.
- `200`: nenhuma migration estava pendente; retorna `[]`.
- `403`: usuário não possui `create:migration`.

Em produção, a execução não ocorre automaticamente no deploy. É necessário chamar o endpoint com uma sessão que tenha a feature administrativa.

## `POST /api/v1/users`

Exige `create:user`, concedida ao visitante padrão. Recebe:

```json
{
  "username": "jhow",
  "email": "jhow@example.com",
  "password": "uma-senha"
}
```

O nome de usuário e o e-mail precisam ser únicos, sem diferenciar maiúsculas de minúsculas. O e-mail passa por validação estrutural e a senha é armazenada com HMAC-SHA256 e bcrypt.

O cadastro cria um token de ativação e envia um e-mail com o link correspondente. A resposta `201` contém apenas os campos públicos:

```json
{
  "id": "5c5b0c0e-2f6e-4a39-9a4a-0d0d9d0a6f10",
  "username": "jhow",
  "features": ["read:activation_token"],
  "created_at": "2026-11-16T13:06:00.000Z",
  "updated_at": "2026-11-16T13:06:00.000Z"
}
```

Respostas relevantes: `201` criado; `400` nome/email duplicado ou e-mail inválido; `500` falha inesperada, inclusive falha no envio do e-mail.

## `PATCH /api/v1/activations/{token_id}`

Exige `read:activation_token`. O identificador é o UUID enviado no link por e-mail.

- O token tem validade de 15 minutos.
- Só pode ser utilizado uma vez.
- Token inexistente, expirado ou já utilizado resulta em `404`.
- Token de conta que já foi ativada resulta em `403`.
- Em caso de sucesso, responde `200` com os dados do token de ativação, incluindo `used_at`.

A ativação substitui as permissões iniciais da conta por `create:session`, `read:session` e `update:user`.

## `GET /api/v1/users/{username}`

Consulta um usuário sem diferenciar maiúsculas de minúsculas. A rota é pública, mas a resposta é filtrada: inclui `id`, `username`, `features`, `created_at` e `updated_at`. Não inclui e-mail nem hash de senha.

Respostas: `200` encontrado; `404` usuário inexistente.

## `PATCH /api/v1/users/{username}`

Exige `update:user`. O usuário pode atualizar a própria conta; para alterar outra conta, precisa também de `update:user:others`.

O corpo aceita um ou mais campos:

```json
{
  "email": "novo@example.com",
  "username": "novo-nome",
  "password": "nova-senha"
}
```

Os campos não enviados permanecem inalterados. A senha, quando enviada, é novamente processada com HMAC e bcrypt. A resposta `200` usa a representação pública do usuário e não expõe e-mail nem hash.

Respostas: `200` atualizado; `400` validação ou duplicidade; `403` permissão insuficiente; `404` usuário inexistente.

## `POST /api/v1/sessions`

Exige `create:session`, portanto contas ainda não ativadas não podem iniciar sessão. Recebe:

```json
{
  "email": "jhow@example.com",
  "password": "uma-senha"
}
```

Com sucesso, responde `201`, cria uma sessão de 30 dias e define o cookie `session_id`:

```http
Set-Cookie: session_id=<token>; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax
```

Em produção, inclui `Secure`. O corpo inclui os dados da sessão, inclusive o token. Credenciais incorretas respondem `401` com mensagem genérica. A tentativa de login inválida também limpa eventual cookie enviado na requisição.

## `DELETE /api/v1/sessions`

Encerra a sessão identificada pelo cookie `session_id`. Exige que o token corresponda a uma sessão válida.

Em caso de sucesso:

- A expiração da sessão é antecipada no banco; o registro não é apagado.
- O cookie é removido com `Max-Age=-1`.
- A resposta é `200` e inclui os dados da sessão encerrada, inclusive o token.

Sessão inexistente ou expirada resulta em `401`.

## `GET /api/v1/user`

Exige sessão válida e `read:session`. Retorna os dados privados do próprio usuário (`id`, `username`, `email`, `features`, `created_at`, `updated_at`), sem senha.

A cada consulta, renova a sessão para mais 30 dias, reenvia o cookie e aplica cabeçalho `Cache-Control` para impedir armazenamento em cache. Sessão inválida ou expirada resulta em `401`.

## Limitações conhecidas e observações de segurança

- Não há *rate limiting* para tentativas de login.
- Não há política de complexidade ou tamanho mínimo de senha implementada.
- Campos obrigatórios ausentes não possuem validação uniforme e podem resultar em `500`.
- O e-mail é validado após `trim()`, mas o valor armazenado não é normalizado.
- O corpo de login e logout inclui o token de sessão, apesar do cookie ser `HttpOnly`. Isso reduz a proteção oferecida pelo atributo e merece revisão.
- O controller limpa o cookie em qualquer erro `401`, inclusive login inválido.
- A feature `read:status` consta no catálogo e é usada nos testes, mas a rota de status não possui middleware `canRequest`; o acesso ao endpoint permanece público. A feature `read:status:all` controla apenas a inclusão da versão do banco.
- Não existe endpoint público para administração das features. A atribuição de permissões privilegiadas é feita internamente.

## Visualizar e validar o OpenAPI

Abra [Swagger Editor](https://editor.swagger.io) e cole o conteúdo de [openapi.yaml](openapi.yaml), ou use:

```bash
npx @redocly/cli lint docs/api/openapi.yaml
```
