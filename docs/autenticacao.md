# Autenticação, sessões e autorização

Este documento descreve o ciclo de vida de contas e sessões e o controle de acesso implementado em `models/`, `infra/controller.js` e nos endpoints de `pages/api/v1/`.

## Visão geral

O sistema separa três conceitos:

- **Cadastro:** cria uma conta ainda não ativada e envia um link por e-mail.
- **Autenticação:** valida e-mail e senha e cria uma sessão identificada pelo cookie `session_id`.
- **Autorização:** verifica se o usuário possui a _feature_ necessária para executar uma operação.

Estar autenticado não significa ter acesso a todas as operações. As permissões são armazenadas no campo `users.features` e avaliadas por `models/authorization.js`.

## Senhas

### Como a senha é armazenada

```text
senha informada
    │ HMAC-SHA256, com PASSWORD_PEPPER
    ▼
resumo em Base64
    │ bcrypt
    ▼
hash armazenado em users.password
```

- O `PASSWORD_PEPPER` é um segredo da aplicação, separado do banco de dados.
- O HMAC-SHA256 é aplicado antes do bcrypt; o resumo tem tamanho fixo.
- O bcrypt usa **14 rounds em produção** e **4 rounds nos demais ambientes**.
- O bcrypt gera seu próprio salt aleatório.
- A comparação repete o HMAC e verifica o resultado com bcrypt.

Gere um pepper aleatório com pelo menos 32 bytes:

```bash
openssl rand -base64 32
```

Ou com Node.js:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

**Não altere o pepper depois que houver usuários cadastrados** sem um plano de migração dos hashes. Sem `PASSWORD_PEPPER`, as funções de hash e comparação lançam `ConfigurationError`; o cliente recebe o erro interno genérico (500), e a causa fica no log do servidor.

## Cadastro e ativação

### 1. Cadastro

`POST /api/v1/users` recebe:

```json
{
  "username": "jhow",
  "email": "jhow@example.com",
  "password": "uma-senha"
}
```

O nome de usuário e o e-mail são verificados quanto à unicidade sem diferenciar maiúsculas de minúsculas. O e-mail também passa por validação estrutural. A senha é armazenada com HMAC e bcrypt.

Uma conta recém-criada recebe somente a feature:

```json
["read:activation_token"]
```

O endpoint cria um token de ativação e envia um e-mail com um link. A resposta de cadastro não inclui e-mail nem hash da senha; contém `id`, `username`, `features`, `created_at` e `updated_at`.

### 2. Token de ativação

O token é armazenado em `user_activation_tokens` e possui:

- Identificador UUID.
- `user_id` da conta relacionada.
- `expires_at`, definido para 15 minutos após a criação.
- `used_at`, inicialmente nulo e preenchido quando utilizado.

O endpoint `PATCH /api/v1/activations/{token_id}` valida o token, ativa a conta e marca o token como utilizado. Tokens inexistentes, expirados ou já utilizados não podem ser reaproveitados.

### 3. Permissões após a ativação

A ativação substitui as permissões iniciais pelas features padrão de uma conta ativa:

```json
["create:session", "read:session", "update:user"]
```

Assim, a conta pode iniciar sessões, consultar a própria sessão autenticada e atualizar os próprios dados. Permissões administrativas não são concedidas automaticamente.

## Login

`POST /api/v1/sessions` recebe `email` e `password`.

1. `models/authentication.js` procura o usuário pelo e-mail, sem diferenciar maiúsculas de minúsculas.
2. A senha é comparada com o hash armazenado.
3. O usuário precisa possuir `create:session`; contas ainda não ativadas não recebem essa permissão.
4. Uma sessão é criada e o token é enviado no cookie `session_id`.

Credenciais incorretas retornam `401 UnauthorizedError` com a mesma mensagem, independentemente de o e-mail não existir ou de a senha estar errada. Quando o e-mail não é encontrado, o fluxo executa uma comparação contra um hash descartável para aproximar o tempo de resposta.

## Sessões

| Item         | Implementação                                                     |
| ------------ | ----------------------------------------------------------------- |
| Token        | 48 bytes aleatórios, representados por 96 caracteres hexadecimais |
| Validade     | 30 dias                                                           |
| Persistência | Tabela `sessions`                                                 |
| Validação    | Token correspondente e `expires_at > NOW()`                       |
| Renovação    | `GET /api/v1/user` renova a validade para mais 30 dias            |
| Encerramento | `DELETE /api/v1/sessions` antecipa a expiração da sessão          |

### Cookie `session_id`

| Atributo   | Valor                        |
| ---------- | ---------------------------- |
| `Path`     | `/`                          |
| `Max-Age`  | 2.592.000 segundos (30 dias) |
| `HttpOnly` | `true`                       |
| `SameSite` | `Lax`                        |
| `Secure`   | Ativado em produção          |

As respostas que criam, renovam ou limpam o cookie também recebem:

```http
Cache-Control: no-store, no-cache, max-age=0, must-revalidate
```

### Consulta e renovação da sessão

`GET /api/v1/user` exige uma sessão válida e a feature `read:session`. O endpoint renova a expiração no banco, reenvia o cookie e retorna os dados do próprio usuário: `id`, `username`, `email`, `features`, `created_at` e `updated_at`.

### Logout

`DELETE /api/v1/sessions` procura a sessão válida associada ao cookie, antecipa sua expiração e envia um cookie `session_id` inválido com `Max-Age=-1`, removendo-o do navegador. A sessão permanece registrada no banco; não há exclusão física do registro.

### Limpeza de cookie em erros 401

O tratamento central de erros limpa o cookie sempre que uma requisição termina em `UnauthorizedError`. Isso também ocorre em uma tentativa de login com credenciais inválidas: se o cliente já enviar um cookie de sessão, ele será removido na resposta.

## Autorização por features

O model `models/authorization.js` centraliza as permissões conhecidas. As features atualmente declaradas são:

| Feature                 | Finalidade                                              |
| ----------------------- | ------------------------------------------------------- |
| `create:user`           | Permite iniciar um cadastro                             |
| `read:user`             | Permite obter a representação pública de um usuário     |
| `read:user:self`        | Permite obter dados privados do próprio usuário         |
| `update:user`           | Permite atualizar o próprio usuário                     |
| `update:user:others`    | Permite atualizar usuários diferentes do próprio        |
| `create:session`        | Permite criar uma sessão                                |
| `read:session`          | Permite consultar a própria sessão                      |
| `read:activation_token` | Permite utilizar o fluxo de ativação                    |
| `create:migration`      | Permite aplicar migrations                              |
| `read:migration`        | Permite consultar migrations pendentes                  |
| `read:status`           | Identifica acesso de usuário ao status                  |
| `read:status:all`       | Permite incluir a versão do banco na resposta de status |

### Perfis iniciais

| Situação                            | Features                                                 |
| ----------------------------------- | -------------------------------------------------------- |
| Visitante sem cookie                | `create:session`, `create:user`, `read:activation_token` |
| Conta cadastrada, ainda não ativada | `read:activation_token`                                  |
| Conta ativada                       | `create:session`, `read:session`, `update:user`          |
| Conta privilegiada                  | Features adicionais atribuídas explicitamente            |

A lista de features de um usuário pode ser alterada pelo model `user.setFeatures` ou ampliada por `user.addFeatures`. A concessão de permissões administrativas deve ser feita por um fluxo controlado; não existe endpoint público de administração de features.

### Regras de acesso por endpoint

| Endpoint                        | Regra                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET /status`                   | Público; a versão do banco só aparece com `read:status:all`                                       |
| `POST /users`                   | Exige `create:user`; disponível ao visitante padrão                                               |
| `GET /users/{username}`         | Público; retorna somente a representação pública                                                  |
| `PATCH /users/{username}`       | Exige `update:user`; o model também verifica se é o próprio usuário ou se há `update:user:others` |
| `PATCH /activations/{token_id}` | Exige `read:activation_token`; o token precisa estar válido e não utilizado                       |
| `POST /sessions`                | Exige `create:session`                                                                            |
| `DELETE /sessions`              | Exige sessão válida na prática; encerra a sessão identificada pelo cookie                         |
| `GET /user`                     | Exige `read:session`                                                                              |
| `GET /migrations`               | Exige `read:migration`                                                                            |
| `POST /migrations`              | Exige `create:migration`                                                                          |

A autorização de saída também é centralizada em `authorization.filterOutput`. Ela define quais campos podem ser devolvidos para cada tipo de recurso. A representação pública de usuário não inclui e-mail ou hash da senha; a representação privada do próprio usuário inclui o e-mail, mas não a senha.

## Cuidados e limitações conhecidas

- Não há _rate limiting_ para tentativas de login.
- O código não implementa política de complexidade ou tamanho mínimo de senha.
- Campos obrigatórios ausentes não possuem validação de entrada uniforme e podem resultar em erro 500.
- O valor de e-mail é validado após `trim()`, mas o valor armazenado não é normalizado; a unicidade é verificada sem diferenciar maiúsculas de minúsculas.
- O corpo de `POST /api/v1/sessions` e de `DELETE /api/v1/sessions` inclui o token da sessão. Embora o cookie seja `HttpOnly`, devolver o token no JSON reduz o benefício dessa proteção e deve ser revisto antes de considerar o fluxo endurecido para produção.
- O controller limpa o cookie em qualquer erro 401, inclusive login inválido.
- As sessões encerradas permanecem no banco com data de expiração antecipada; não há rotina de limpeza física documentada ou implementada.

Consulte também o [guia da API](api/README.md) para exemplos de requisições e respostas.
