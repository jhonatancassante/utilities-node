# Autenticação e senhas

Como o projeto guarda senhas e faz o login. Os arquivos envolvidos são `models/password.js`, `models/authentication.js`, `models/session.js` e os endpoints `pages/api/v1/users` e `pages/api/v1/sessions`.

## Resumo

- A senha nunca é guardada em texto puro. Antes de ir ao banco, ela passa por um **HMAC-SHA256 com um _pepper_** e depois por **bcrypt**.
- O login (`POST /api/v1/sessions`) confere email e senha, cria uma sessão no banco e envia o token no cookie `session_id`.
- Falhas de login respondem sempre com a mesma mensagem e com tempo de resposta parecido, para não revelar quais emails estão cadastrados.
- **Ainda não existe** verificação da sessão nas demais rotas, nem logout. Hoje o cookie é criado, mas nenhum endpoint o exige.

## Senhas

### Como a senha é guardada

```text
senha digitada
    │  HMAC-SHA256, usando o PASSWORD_PEPPER como chave
    ▼
resumo em base64 (44 caracteres)
    │  bcrypt (14 rounds em produção, 4 nos demais ambientes)
    ▼
hash de 60 caracteres, gravado em users.password
```

- O **pepper** é um segredo da aplicação, guardado fora do banco (variável de ambiente `PASSWORD_PEPPER`). Se alguém vazar só o banco, os hashes sozinhos não bastam para testar senhas.
- O **bcrypt** já inclui um _salt_ aleatório em cada hash e é lento de propósito. Com 14 rounds, cada hash leva em torno de um segundo no servidor.
- O HMAC antes do bcrypt também resolve o limite do bcrypt, que só considera os primeiros 72 bytes da entrada: o resumo tem sempre 44 caracteres, qualquer que seja o tamanho da senha.
- Fora de produção (`NODE_ENV` diferente de `production`), o bcrypt usa 4 rounds, só para os testes e o ambiente local ficarem rápidos.
- A comparação (`password.compare`) repete o HMAC com o mesmo pepper e compara com o hash guardado.

### Gerando o `PASSWORD_PEPPER`

Use um valor aleatório de pelo menos 32 bytes:

```bash
openssl rand -base64 32
```

Sem o `openssl`, o próprio Node.js gera:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Cuidados:

- **Desenvolvimento:** o `.env.development` traz um valor de exemplo, versionado de propósito.
- **Produção:** cadastre um valor próprio nas variáveis de ambiente da Vercel (Production e Preview). Não o coloque no repositório nem em logs, e guarde uma cópia em um gerenciador de senhas.
- **Não troque o pepper depois que existirem usuários.** Todos os hashes gravados deixariam de conferir e ninguém conseguiria entrar. Uma troca exigiria um plano de migração (por exemplo, aceitar os dois peppers por um tempo e regravar o hash a cada login).
- **Sem a variável**, `password.hash` e `password.compare` lançam `ConfigurationError`. O cliente recebe o `InternalServerError` genérico (500) e o motivo aparece só no log do servidor.

## Login

`POST /api/v1/sessions` recebe `email` e `password`:

1. `user.findOneByEmail` procura o usuário (sem diferenciar maiúsculas de minúsculas).
2. `password.compare` confere a senha com o hash guardado.
3. Com as credenciais corretas, `session.create` grava uma sessão e o endpoint responde `201` com o corpo da sessão e o cookie `session_id`.
4. Com qualquer falha de credencial, responde `401` com a **mesma mensagem**, não importa se o email não existe ou se a senha está errada:

```json
{
  "name": "UnauthorizedError",
  "message": "Não foi possível autenticar seu usuário no sistema.",
  "action": "Verifique se digitou o e-mail e a senha corretamente e tente novamente.",
  "status_code": 401
}
```

### Tempo de resposta

Se o email não existisse e o bcrypt não rodasse, essa resposta chegaria bem antes das outras e daria para descobrir quais emails estão cadastrados apenas medindo o tempo. Para evitar isso, quando o email não é encontrado o fluxo executa um `password.compare` contra um **hash descartável**.

O hash descartável é gerado uma única vez, quando o módulo `models/authentication.js` é carregado, com a mesma função `password.hash` dos usuários reais. Assim ele tem o mesmo custo (14 rounds em produção) e o caminho "email inexistente" leva o mesmo tempo do caminho "senha errada".

Detalhe: na Vercel, o módulo é carregado na requisição que causa o _cold start_. A primeira tentativa com email inexistente de cada instância ainda é cerca de um bcrypt mais lenta.

## Sessões

| Item          | Valor                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Token         | 48 bytes aleatórios (`crypto.randomBytes`), em 96 caracteres hexadecimais              |
| Validade      | 30 dias (`EXPIRATION_IN_MILLISECONDS`, em `models/session.js`)                         |
| Armazenamento | Tabela `sessions` (`id`, `token`, `user_id`, `expires_at`, `created_at`, `updated_at`) |

### Cookie `session_id`

| Atributo   | Valor                                                     |
| ---------- | --------------------------------------------------------- |
| `Path`     | `/`                                                       |
| `Max-Age`  | `2592000` (30 dias, em segundos)                          |
| `HttpOnly` | Sim. O JavaScript do navegador não consegue ler o cookie  |
| `SameSite` | `Lax`                                                     |
| `Secure`   | Só em produção. Em desenvolvimento o `localhost` usa HTTP |

O `Max-Age` é uma duração, em segundos inteiros, e não uma data. O valor sai da constante de validade da sessão.

O corpo da resposta de `POST /api/v1/sessions` também traz o `token`.

## Estado atual e pendências

O que ainda não existe, para evitar a impressão de que o login já protege alguma coisa:

- Nenhum endpoint lê o cookie `session_id` nem confere a validade da sessão.
- Não há logout nem renovação ou remoção de sessões expiradas.
- Os endpoints de usuários e o de migrations não exigem autenticação (veja o [guia da API](api/README.md#limitações-conhecidas)).
- Não há limite de tentativas de login (_rate limiting_). Igualar o tempo de resposta evita descobrir emails, mas não impede tentativas de senha em massa.
- A senha não é validada na criação ou na atualização (tamanho mínimo, por exemplo), e o campo ausente resulta em erro 500.
- As respostas de usuários incluem o hash da senha, e a de sessões inclui o token. Ambos devem sair das respostas quando as rotas forem protegidas.
