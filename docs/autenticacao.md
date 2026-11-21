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

O endpoint `PATCH /api/v1/activations/{token_id}` valida o token, ativa a conta e marca o token como utilizado. As duas alterações acontecem na mesma transação do PostgreSQL (`activation.activate()`): se qualquer passo falhar, nada é gravado e o token continua válido. Se duas requisições chegarem ao mesmo tempo com o mesmo token, só uma tem sucesso e a outra recebe `404`. Tokens inexistentes, expirados ou já utilizados não podem ser reaproveitados.

### 3. Permissões após a ativação

A ativação substitui as permissões iniciais pelas features padrão de uma conta ativa:

```json
["create:session", "read:session", "update:user"]
```

Assim, a conta pode iniciar sessões, consultar a própria sessão autenticada e atualizar os próprios dados. Permissões administrativas não são concedidas automaticamente.

## Login

`POST /api/v1/sessions` recebe um objeto JSON com `email` e `password`, ambos como strings não vazias. Corpo ausente, `null`, array, valor primitivo, campos ausentes, vazios ou com tipo diferente de string retornam `400 ValidationError`. Espaços no início e no fim do e-mail são removidos antes da consulta.

1. `models/authentication.js` procura o usuário pelo e-mail, sem diferenciar maiúsculas de minúsculas.
2. A senha é comparada com o hash armazenado.
3. O usuário precisa possuir `create:session`; contas ainda não ativadas não recebem essa permissão.
4. Uma sessão é criada e o token é enviado **somente** no cookie `session_id` (`HttpOnly`); o corpo da resposta não inclui o token.

Se a requisição trouxer um cookie `session_id` inválido ou expirado, o login o trata como visitante anônimo, segue para a verificação de e-mail e senha e remove o cookie antigo. Assim, ninguém precisa tentar entrar duas vezes. O mesmo comportamento de tolerância a cookies antigos é aplicado ao cadastro (`POST /api/v1/users`), à ativação (`PATCH /api/v1/activations/{token_id}`) e à consulta de status (`GET /api/v1/status`). No status, o usuário anônimo recebe a resposta pública sem a versão do PostgreSQL.

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

`GET /api/v1/user` exige uma sessão válida e a feature `read:session`. Sem cookie, o visitante anônimo não possui essa feature e recebe `403`; com cookie inválido ou sessão expirada, recebe `401`. O endpoint renova a expiração no banco, reenvia o cookie e retorna os dados do próprio usuário: `id`, `username`, `email`, `features`, `created_at` e `updated_at`.

### Logout

`DELETE /api/v1/sessions` procura a sessão válida associada ao cookie, antecipa sua expiração e envia um cookie `session_id` inválido com `Max-Age=-1`, removendo-o do navegador. A sessão permanece registrada no banco; não há exclusão física do registro.

### Limpeza de cookie em erros 401

O tratamento central de erros limpa o cookie sempre que uma requisição termina em `UnauthorizedError`. Isso também ocorre em uma tentativa de login com credenciais inválidas: se o cliente já enviar um cookie de sessão, ele será removido na resposta.

## Autorização por features

O model `models/authorization.js` centraliza as permissões conhecidas. As features atualmente declaradas são:

| Feature                 | Finalidade                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `create:user`           | Permite iniciar um cadastro                                                                                  |
| `read:user`             | Permite obter a representação pública de um usuário                                                          |
| `read:user:self`        | Seleciona a representação privada do próprio usuário em `filterOutput`; não é exigida por middleware de rota |
| `update:user`           | Permite atualizar o próprio usuário                                                                          |
| `update:user:others`    | Permite atualizar usuários diferentes do próprio                                                             |
| `create:session`        | Permite criar uma sessão                                                                                     |
| `read:session`          | Permite consultar a própria sessão                                                                           |
| `read:activation_token` | Permite utilizar o fluxo de ativação                                                                         |
| `create:migration`      | Permite aplicar migrations                                                                                   |
| `read:migration`        | Permite consultar migrations pendentes                                                                       |
| `read:status`           | Seleciona a representação do status; não restringe o endpoint público                                        |
| `read:status:all`       | Permite incluir a versão do banco na resposta de status                                                      |
| `read:audit`            | Permite consultar a trilha de auditoria de banimentos e desbanimentos                                      |

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
| `POST /admin/users/{username}/ban` | Exige `update:user:others`; bane outra conta                                                      |
| `DELETE /admin/users/{username}/ban` | Exige `update:user:others`; desbane outra conta                                                 |
| `GET /admin/audit/banned`         | Exige `read:audit`                                                                                 |
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

## Banimento de contas

O campo `users.banned_at` registra quando a conta foi banida. Um administrador com `update:user:others` pode banir outra conta, mas não a própria. A operação expira todas as sessões existentes e registra o evento em `user_ban_events` dentro da mesma transação.

Uma conta banida não consegue iniciar sessão. A criação e a renovação de sessões também verificam o estado de banimento, e sessões existentes deixam de ser válidas. A tentativa de login com senha correta retorna `403 BannedUserError`; credenciais incorretas continuam recebendo a resposta genérica de autenticação.

O desbanimento remove `banned_at` e registra o evento, mas não reativa sessões anteriores. O usuário precisa autenticar-se novamente. Operações repetidas que não alteram o estado não geram eventos duplicados. A auditoria preserva snapshots mesmo após a exclusão da conta; eventos anteriores à implantação podem não identificar o responsável. A consulta exige `read:audit` e não é armazenável em cache.

## Cuidados e limitações conhecidas

- Não há _rate limiting_ para tentativas de login.
- As senhas devem ter de 12 a 64 caracteres, com pelo menos 2 letras minúsculas, 2 maiúsculas, 2 números e 2 caracteres especiais. Termos comuns conhecidos também são rejeitados.
- A validação estrutural do corpo ainda não é uniforme em todos os endpoints. O login e a atualização de usuário retornam `400 ValidationError` para corpo ausente ou que não seja objeto; já `POST /api/v1/users` não verifica explicitamente um corpo de nível superior `null` ou ausente antes de acessar suas propriedades, o que pode resultar em `500`.
- O e-mail é armazenado com a capitalização enviada (após `trim()`); a unicidade é verificada sem diferenciar maiúsculas de minúsculas.
- Cookie `session_id` inválido ou expirado é tolerado em login, cadastro, ativação e consulta de status, onde a requisição segue como visitante anônimo e o cookie é removido. Nas demais rotas, um cookie inválido resulta em `401`; o logout (`DELETE /api/v1/sessions`) também exige sessão válida.
- O controller limpa o cookie `session_id` em qualquer resposta `401`, inclusive em um login com credenciais inválidas: quem já está logado e erra a senha ao tentar entrar de novo perde o cookie no navegador (a sessão continua válida no banco, mas deixa de ser enviada).
- Um JSON sintaticamente inválido pode ser rejeitado pelo parser de corpo do Next.js antes de chegar ao controller; nesse caso, a resposta `400` pode não seguir o envelope JSON padronizado da API.
- As sessões encerradas permanecem no banco com data de expiração antecipada; não há rotina de limpeza física documentada ou implementada.

Consulte também o [guia da API](api/README.md) para exemplos de requisições e respostas.
