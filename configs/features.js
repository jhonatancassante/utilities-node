export const featureCatalog = [
  {
    name: "create:user",
    label: "Criar usuários",
    group: "Usuários",
    description: "Permite criar novas contas.",
  },
  {
    name: "read:user",
    label: "Consultar usuários",
    group: "Usuários",
    description: "Permite consultar informações públicas de usuários.",
  },
  {
    name: "read:user:self",
    label: "Consultar próprio usuário",
    group: "Usuários",
    description: "Permite consultar os dados da própria conta.",
  },
  {
    name: "update:user",
    label: "Alterar próprio usuário",
    group: "Usuários",
    description: "Permite alterar os dados da própria conta.",
  },
  {
    name: "update:user:others",
    label: "Administrar outros usuários",
    group: "Privilégios",
    description:
      "Permite pesquisar, alterar e remover outras contas e suas permissões.",
  },
  {
    name: "create:session",
    label: "Criar sessão",
    group: "Sessões",
    description: "Permite iniciar uma sessão autenticada.",
  },
  {
    name: "read:session",
    label: "Consultar sessão",
    group: "Sessões",
    description: "Permite consultar os dados da própria sessão.",
  },
  {
    name: "read:activation_token",
    label: "Consultar token de ativação",
    group: "Ativação",
    description: "Permite consultar o token de ativação da própria conta.",
  },
  {
    name: "create:migration",
    label: "Executar migrations",
    group: "Banco de dados",
    description: "Permite executar migrations do banco de dados.",
  },
  {
    name: "read:migration",
    label: "Consultar migrations",
    group: "Banco de dados",
    description: "Permite consultar o histórico de migrations.",
  },
  {
    name: "read:status",
    label: "Consultar status",
    group: "Sistema",
    description: "Permite consultar as métricas públicas do sistema.",
  },
  {
    name: "read:status:all",
    label: "Consultar status completo",
    group: "Privilégios",
    description:
      "Permite visualizar informações completas, incluindo a versão do banco de dados.",
  },
];

export const availableFeatures = featureCatalog.map((feature) => feature.name);

export const privilegedFeatures = [
  "update:user:others",
  "read:status:all",
];
