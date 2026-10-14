# Documentação

Índice da documentação do **utilities-node**. Para uma visão rápida do projeto e de como rodá-lo, comece pelo [README principal](../README.md).

| Documento                                     | Conteúdo                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [Guia de desenvolvimento](desenvolvimento.md) | Ambiente local, fluxo de trabalho, testes, migrations, commits, hooks, CI e solução de problemas |
| [Arquitetura](arquitetura.md)                 | Organização do código, acesso ao banco, configuração por ambiente e convenções                   |
| [API](api/README.md)                          | Guia dos endpoints, convenções e como visualizar a especificação                                 |
| [Especificação OpenAPI](api/openapi.yaml)     | Descrição formal dos endpoints, no padrão OpenAPI 3.1                                            |

## Como manter esta documentação

- Alterou ou criou um endpoint? Atualize o [openapi.yaml](api/openapi.yaml) no mesmo Pull Request.
- Mudou um script, uma variável de ambiente ou um pré-requisito? Atualize o [README principal](../README.md) e o [guia de desenvolvimento](desenvolvimento.md).
- Tomou uma decisão técnica relevante? Registre o motivo em [arquitetura.md](arquitetura.md).
