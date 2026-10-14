# API

Guia de leitura dos endpoints. A descrição formal, no padrão OpenAPI 3.1, está em [openapi.yaml](openapi.yaml).

## Convenções

- **Caminho base:** `/api/v1`. A versão faz parte do caminho.
- **Formato:** as respostas de sucesso são JSON (`application/json`).
- **Ambientes:**
  - Produção: `https://utilities-node.vercel.app`
  - Local: `http://localhost:3000`
- **Autenticação:** ainda não existe. Veja a observação sobre o endpoint de migrations.

## Resumo dos endpoints

| Método | Caminho              | Descrição                                     | Proteção                      |
| ------ | -------------------- | --------------------------------------------- | ----------------------------- |
| `GET`  | `/api/v1/status`     | Saúde da aplicação e do banco de dados        | Pública                       |
| `GET`  | `/api/v1/migrations` | Lista as migrations pendentes, sem aplicá-las | Sem proteção (será protegida) |
| `POST` | `/api/v1/migrations` | Aplica as migrations pendentes                | Sem proteção (será protegida) |

## `GET /api/v1/status`

Verifica a saúde da aplicação. É o endpoint para saber se o sistema está no ar e conseguindo falar com o banco de dados. O objetivo é apenas esse: não altera nenhum dado.

Hoje a aplicação depende só do banco. Conforme ela ganhar login e outras funcionalidades que usam o banco de dados, esse endpoint continua sendo a referência de saúde do sistema.

A página [`/status`](https://utilities-node.vercel.app/status) do site consome este endpoint a cada 5 segundos para montar o painel de monitoramento.

**Resposta `200`**

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

| Campo                                      | Tipo    | Descrição                                                                  |
| ------------------------------------------ | ------- | -------------------------------------------------------------------------- |
| `updated_at`                               | texto   | Momento em que a resposta foi gerada, em ISO 8601 (UTC)                    |
| `dependencies.database.version`            | texto   | Versão do PostgreSQL (`SHOW server_version`)                               |
| `dependencies.database.max_connections`    | inteiro | Limite de conexões simultâneas do banco (`SHOW max_connections`)           |
| `dependencies.database.opened_connections` | inteiro | Conexões abertas hoje no banco da aplicação (inclui a da própria consulta) |

A contagem de conexões considera o banco indicado em `POSTGRES_DB` e, se a variável não existir, o banco `postgres`.

**Resposta `500`:** qualquer falha ao consultar o banco (por exemplo, banco inacessível) resulta em um JSON padronizado. O erro original é registrado no console do servidor e não é exposto na resposta.

```json
{
  "name": "InternalServerError",
  "message": "Um erro interno não esperado aconteceu.",
  "action": "Entre em contato com o suporte.",
  "statusCode": 500
}
```

| Campo        | Tipo    | Descrição                            |
| ------------ | ------- | ------------------------------------ |
| `name`       | texto   | Tipo do erro (`InternalServerError`) |
| `message`    | texto   | O que aconteceu                      |
| `action`     | texto   | O que fazer a respeito               |
| `statusCode` | inteiro | Código HTTP da resposta (`500`)      |

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
    "path": "/app/infra/migrations/1791773509988_teste.js",
    "name": "1791773509988_teste",
    "timestamp": 1791773509988
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

| Código | Quando                                                       | Corpo                                                               |
| ------ | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `201`  | Havia migrations pendentes e foram aplicadas                 | Lista das migrations aplicadas                                      |
| `200`  | Nenhuma migration pendente                                   | Lista vazia (`[]`)                                                  |
| `500`  | Falha ao executar (banco inacessível, erro em uma migration) | Definido pelo Next.js (não é JSON, ao contrário do `500` do status) |

```bash
curl -X POST http://localhost:3000/api/v1/migrations
```

A operação é repetível: executá-la de novo, sem migrations novas, devolve `200` e `[]`.

### Métodos não permitidos

Qualquer método diferente de `GET` e `POST` em `/api/v1/migrations` recebe `405`:

```json
{
  "error": "Método \"DELETE\" não permitido."
}
```

### Proteção do endpoint

> **Atenção:** hoje o endpoint de migrations **não exige autenticação**. Isso significa que qualquer cliente que alcance a URL pode consultar as migrations pendentes e executar o `POST`. A intenção é transformá-lo em uma **rota protegida** no futuro.
>
> Quando a proteção for implementada, atualize esta página e o `openapi.yaml`, descrevendo o esquema de autenticação (`components.securitySchemes`) e as respostas `401` e `403`.

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

O comando deve terminar sem erros. Quatro avisos são esperados e podem ser ignorados: um sobre o servidor `localhost` (é o ambiente de desenvolvimento) e três sobre operações sem resposta `4XX` (os endpoints atuais não têm erros de cliente documentáveis, exceto o `405` descrito acima).
