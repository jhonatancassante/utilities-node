# Documentação

Índice da documentação técnica do **utilities-node**. Para conhecer o projeto e iniciar o ambiente local, comece pelo [README principal](../README.md).

| Documento                                              | Conteúdo                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| [Guia de desenvolvimento](desenvolvimento.md)          | Ambiente local, variáveis, scripts, migrations, testes, hooks, CI e solução de problemas |
| [Arquitetura](arquitetura.md)                          | Organização do código, camadas, banco de dados, migrations, autorização e erros          |
| [Autenticação, sessões e autorização](autenticacao.md) | Senhas, ativação de cadastro, cookies, ciclo de vida das sessões e _features_            |
| [Guia da API](api/README.md)                           | Endpoints, regras de acesso, payloads, códigos HTTP e limitações conhecidas              |
| [Especificação OpenAPI](api/openapi.yaml)              | Contrato formal da API no padrão OpenAPI 3.1                                             |
| [Adicionando ferramentas](adicionando-ferramentas.md)  | Estrutura, registro, rotas, componentes e testes das ferramentas da interface            |

## Como manter esta documentação

A documentação deve acompanhar o comportamento efetivamente implementado, não o planejamento futuro.

- Alterou ou criou um endpoint? Atualize o [guia da API](api/README.md) e o [openapi.yaml](api/openapi.yaml) no mesmo Pull Request.
- Mudou autenticação, autorização, sessões, cookies ou ativação? Atualize [autenticacao.md](autenticacao.md) e os trechos correspondentes da documentação da API.
- Mudou scripts, dependências, variáveis, serviços locais ou workflows? Atualize o [README principal](../README.md) e [desenvolvimento.md](desenvolvimento.md).
- Mudou a organização de camadas, banco, migrations ou tratamento de erros? Atualize [arquitetura.md](arquitetura.md).
- Criou uma migration? Registre-a na seção de migrations de [desenvolvimento.md](desenvolvimento.md) e revise o esquema descrito em [arquitetura.md](arquitetura.md).
- Uma funcionalidade ainda não está implementada? Identifique-a explicitamente como pendência; não a descreva como comportamento atual.

Antes de concluir uma alteração documental, confira os endpoints e os testes de integração correspondentes. Exemplos de JSON, status HTTP, permissões e nomes de variáveis devem refletir o código atual.
