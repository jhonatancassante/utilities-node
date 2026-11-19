export const adminSections = [
  {
    id: "users",
    title: "Gerenciar usuários",
    description: "Pesquise contas e altere dados, senhas e permissões.",
    href: "/admin/users",
    icon: "fa-users-cog",
    requiredFeature: "update:user:others",
  },
  {
    id: "status",
    title: "Status do sistema",
    description: "Acesse as métricas do sistema e a versão do banco de dados.",
    href: "/status",
    icon: "fa-chart-line",
    requiredFeature: "read:status:all",
  },
];
