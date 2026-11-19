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

| Método   | Caminho                          | Acesso                                                            |
| -------- | -------------------------------- | ----------------------------------------------------------------- |
| `GET`    | `/api/v1/status`                 | Público; detalhes de versão condicionados a `read:status:all`     |
| `GET`    | `/api/v1/migrations`             | Feature `read:migration`                                          |
| `POST`   | `/api/v1/migrations`             | Feature `create:migration`                                        |
| `POST`   | `/api/v1/users`                  | Feature `create:user` (visitante padrão)                          |
| `GET`    | `/api/v1/users/{username}`       | Público; saída filtrada                                           |
| `GET`    | `/api/v1/admin/users?search=...` | Feature `update:user:others`                                      |
| `GET`    | `/api/v1/admin/users/{username}` | Feature `update:user:others`                                      |
| `PATCH`  | `/api/v1/admin/users/{username}` | Feature `update:user:others`; inclui alteração de features        |
| `PATCH`  | `/api/v1/users/{username}`       | Feature `update:user`; próprio usuário ou `update:user:others`    |
| `PATCH`  | `/api/v1/activations/{token_id}` | Feature `read:activation_token`                                   |
| `POST`   | `/api/v1/sessions`               | Feature `create:session`                                          |
| `GET`    | `/api/v1/user`                   | Sessão válida e feature `read:session`                            |

## Autorização e erros

O middleware `injectAnonymousOrUser` injeta o visitante quando não há cookie ou carrega o usuário associado a uma sessão válida; se um cookie for inválido ou expirado, a requisição termina em `401`. O middleware `injectUserOrAnonymousOnInvalidSession` é mais tolerante: em `POST /api/v1/sessions`, `POST /api/v1/users`, `PATCH /api/v1/activations/{token_id}` e `GET /api/v1/status`, limpa o cookie inválido e continua como visitante anônimo. Essa tolerância não transforma o logout em operação pública: `DELETE /api/v1/sessions` ainda exige uma sessão válida. O middleware `canRequest(feature)` verifica a permissão exigida pelo endpoint. A autorização de atualização também compara o identificador do usuário autenticado com o recurso solicitado.

Os erros seguem o formato:

```json
{
  "name": "ForbiddenError",
  "message": "Você não possui permissão para executar esta ação.",
  "action": "Verifique se o seu usuário possui a feature \"read:migration\".",
  "status_code": 403
}
```

| Código | Erro                    | Significado                                               |
| ------ | ----------------------- | --------------------------------------------------------- |
| `400`  | `ValidationError`       | Dados inválidos ou duplicados                             |
| `401`  | `UnauthorizedError`     | Credenciais inválidas ou sessão inválida/expirada         |
| `403`  | `ForbiddenError`        | Feature necessária não concedida                          |
| `404`  | `NotFoundError`         | Usuário ou token não encontrado, expirado ou já utilizado |
| `405`  | `MethodNotAllowedError` | Método não aceito; a resposta informa `Allow`             |
| `500`  | `InternalServerError`   | Falha inesperada; detalhes ficam no log                   |

O controller limpa o cookie `session_id` em qualquer resposta `401`. O cookie inválido ou expirado é tolerado e removido em `POST /api/v1/sessions`, `POST /api/v1/users`, `PATCH /api/v1/activations/{token_id}` e `GET /api/v1/status`; nessas operações, a requisição continua como visitante anônimo. Nas demais rotas, um cookie inválido pode resultar em `401`. Em particular, `DELETE /api/v1/sessions` continua exigindo uma sessão válida, mesmo que use o middleware tolerante antes de executar o handler. As respostas que definem ou removem o cookie também usam `Cache-Control: no-store, no-cache, max-age=0, must-revalidate`.

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

Com `read:status:all`, a resposta inclui também `dependencies.database.version`. A rota é pública e não exige a feature `read:status`; essa feature consta no catálogo, mas não é verificada por middleware. Se a requisição trouxer um cookie `session_id` inválido ou expirado, a API o remove e continua como visitante anônimo. Se a consulta ao banco falhar, a API responde `500`.

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

O nome de usuário deve ter de 3 a 30 caracteres e aceitar somente letras sem acento, números, hífen e sublinhado. O e-mail deve ter formato válido e até 254 caracteres. Nome de usuário e e-mail precisam ser únicos, sem diferenciar maiúsculas de minúsculas. A senha deve ter de 12 a 64 caracteres, incluir pelo menos 2 letras minúsculas, 2 maiúsculas, 2 números e 2 caracteres especiais, e não pode conter termos comuns conhecidos (`password`, `admin`, `qwerty`, `letmein` ou `welcome`). Antes de armazená-la, a senha é normalizada em NFC, processada com HMAC-SHA256 e bcrypt.

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

Respostas relevantes: `201` criado; `400` dados obrigatórios ausentes, username/e-mail/senha inválidos ou duplicados; `500` falha inesperada, inclusive falha no envio do e-mail.

## Administração de usuários

Os endpoints administrativos exigem uma sessão válida e a feature `update:user:others`. A autorização é verificada no servidor; ocultar o acesso na interface não substitui essa validação.

### `GET /api/v1/admin/users?search=...`

Pesquisa usuários por trecho do nome de usuário ou do e-mail, sem diferenciar maiúsculas de minúsculas. O parâmetro `search` é obrigatório e deve conter ao menos dois caracteres. Retorna até 10 resultados com `id`, `username`, `email`, `features`, `created_at` e `updated_at`; não inclui a própria conta do administrador nem o hash de senha.

### `GET /api/v1/admin/users/{username}`

Consulta os dados administrativos de uma conta, incluindo e-mail e features, mas sem expor o hash da senha.

### `PATCH /api/v1/admin/users/{username}`

Permite alterar `username`, `email`, `password` e `features` de outras contas. A própria conta não pode ser alterada por esse endpoint; para isso, utilize o perfil. A senha segue as mesmas regras de validação e hash do fluxo de edição do perfil. A lista de features é validada contra o catálogo central em `configs/features.js`; valores desconhecidos são rejeitados com `400 ValidationError`. A lista enviada substitui integralmente as permissões atuais, inclusive quando vazia. Campos omitidos permanecem inalterados.

Os endpoints administrativos retornam `403` quando a sessão não possui `update:user:others`, `404` quando o usuário alvo não existe e `400` quando a pesquisa ou os dados enviados são inválidos.

## `PATCH /api/v1/activations/{token_id}`

Exige `read:activation_token`. O identificador é o UUID enviado no link por e-mail.

- O token tem validade de 15 minutos.
- Só pode ser utilizado uma vez. A ativação da conta e o consumo do token acontecem em uma única transação; com requisições simultâneas, só uma tem sucesso e as demais recebem `404`.
- Token inexistente, expirado ou já utilizado resulta em `404`.
- Token de conta que já foi ativada resulta em `403`.
- Em caso de sucesso, responde `200` com os dados do token de ativação, incluindo `used_at`.

A ativação substitui as permissões iniciais da conta por `create:session`, `read:session` e `update:user`.

## `GET /api/v1/users/{username}`

Consulta um usuário sem diferenciar maiúsculas de minúsculas. A rota é pública, mas a resposta é filtrada: inclui `id`, `username`, `features`, `created_at` e `updated_at`. Não inclui e-mail nem hash de senha.

Respostas: `200` encontrado; `404` usuário inexistente.

## `PATCH /api/v1/users/{username}`

Exige `update:user`. O usuário pode atualizar a própria conta; para alterar outra conta, precisa também de `update:user:others`.

O corpo deve ser um objeto JSON e aceita somente os campos `username`, `email` e `password`:

```json
{
  "email": "novo@example.com",
  "username": "novo-nome",
  "password": "nova-senha"
}
```

Campos protegidos ou desconhecidos (como `id`, `features` e `created_at`) fazem a requisição inteira ser rejeitada com `400 ValidationError`; eles não são ignorados. Corpos que não sejam objetos JSON também retornam `400`. Os campos não enviados permanecem inalterados. A senha, quando enviada, é novamente processada com HMAC e bcrypt. A resposta `200` usa a representação pública do usuário e não expõe e-mail nem hash.

Respostas: `200` atualizado; `400` validação ou duplicidade; `403` permissão insuficiente; `404` usuário inexistente.

## `POST /api/v1/sessions`

Exige `create:session`, portanto contas ainda não ativadas não podem iniciar sessão. Recebe um objeto JSON com `email` e `password`, ambos como strings não vazias:

```json
{
  "email": "jhow@example.com",
  "password": "uma-senha"
}
```

Corpo ausente, `null`, array, valor primitivo, campos ausentes, vazios ou com tipo diferente de string retornam `400 ValidationError`. O e-mail é consultado após a remoção de espaços no início e no fim.

Com sucesso, responde `201`, cria uma sessão de 30 dias e define o cookie `session_id`:

```http
Set-Cookie: session_id=<token>; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax
```

Em produção, inclui `Secure`. O corpo inclui os dados da sessão, sem o token, que só existe no cookie `HttpOnly`. Credenciais incorretas respondem `401` com mensagem genérica; dados de entrada ausentes ou com formato/tipo inválido respondem `400`. Se a requisição trouxer um cookie antigo inválido ou expirado, ele é ignorado durante o login e substituído pelo novo cookie quando a autenticação tem sucesso.

## `DELETE /api/v1/sessions`

Encerra a sessão identificada pelo cookie `session_id`. Exige que o token corresponda a uma sessão válida.

Em caso de sucesso:

- A expiração da sessão é antecipada no banco; o registro não é apagado.
- O cookie é removido com `Max-Age=-1`.
- A resposta é `200` e inclui os dados da sessão encerrada, sem o token.

Sessão inexistente ou expirada resulta em `401`.

## `GET /api/v1/user`

Exige sessão válida e `read:session`. Retorna os dados privados do próprio usuário (`id`, `username`, `email`, `features`, `created_at`, `updated_at`), sem senha.

A cada consulta, renova a sessão para mais 30 dias, reenvia o cookie e aplica cabeçalho `Cache-Control` para impedir armazenamento em cache. Sem cookie, o visitante anônimo não possui `read:session` e recebe `403`; com cookie inválido ou sessão expirada, recebe `401`.

## Limitações conhecidas e observações de segurança

- Não há _rate limiting_ para tentativas de login.
- A validação de senha já exige de 12 a 64 caracteres, ao menos 2 letras minúsculas, 2 maiúsculas, 2 números e 2 caracteres especiais, além de rejeitar os termos comuns listados em `lib/shared/user-validation.js`; não há verificação de vazamento em bases de senhas comprometidas.
- A validação do corpo ainda não é uniforme em todos os endpoints. O login e a atualização de usuário verificam o formato do objeto, mas `POST /api/v1/users` não valida explicitamente um corpo de nível superior `null` ou ausente antes de acessar suas propriedades, o que pode resultar em `500`.
- No cadastro, o e-mail é armazenado com a capitalização enviada (após `trim()`); a unicidade é verificada sem diferenciar maiúsculas de minúsculas.
- Um JSON sintaticamente inválido pode ser rejeitado pelo parser de corpo do Next.js antes de chegar ao controller; nesse caso, a resposta `400` pode não usar o envelope JSON padronizado da API.
- A feature `read:status` consta no catálogo e é usada nos testes, mas a rota de status não possui middleware `canRequest`; o acesso ao endpoint permanece público. A feature `read:status:all` controla apenas a inclusão da versão do banco.
- A administração de features é restrita aos endpoints administrativos e à feature `update:user:others`. O catálogo central em `configs/features.js` alimenta a validação do backend e a interface de seleção.

## Visualizar e validar o OpenAPI

Abra [Swagger Editor](https://editor.swagger.io) e cole o conteúdo de [openapi.yaml](openapi.yaml), ou use:

```bash
npx @redocly/cli lint docs/api/openapi.yaml
```
