export const adminSections = [
  {
    id: "users",
    title: "Gerenciar usuários",
    description:
      "Consulte contas e gerencie dados, status e permissões conforme suas autorizações.",
    href: "/admin/users",
    icon: "fa-users-cog",
    requiredFeature: "read:user:others",
  },
  {
    id: "features",
    title: "Gerenciar features",
    description: "Consulte, cadastre e gerencie as permissões do sistema.",
    href: "/admin/features",
    icon: "fa-key",
    requiredFeature: "read:feature",
  },
  {
    id: "migrations",
    title: "Gerenciar migrations",
    description:
      "Consulte e aplique as alterações pendentes do banco de dados.",
    href: "/admin/migrations",
    icon: "fa-database",
    requiredFeature: "read:migration",
  },
  {
    id: "audit",
    title: "Auditoria",
    description: "Consulte ações administrativas e de segurança do sistema.",
    href: "/admin/audit",
    icon: "fa-clipboard-list",
    requiredFeature: "read:audit",
  },
  {
    id: "assessed-values",
    title: "Valores venais",
    description:
      "Consulte, cadastre, atualize e importe os valores venais anuais.",
    href: "/admin/assessed-values",
    icon: "fa-calculator",
    requiredFeature: "read:assessed_value",
  },
  {
    id: "real-estate-properties",
    title: "Imóveis",
    description: "Consulte e gerencie os dados cadastrais dos imóveis.",
    href: "/admin/real-estate-properties",
    icon: "fa-home",
    requiredFeature: "read:real_estate_property",
  },
  {
    id: "positions",
    title: "Gerenciar cargos",
    description: "Consulte e mantenha os cargos disponíveis no sistema.",
    href: "/admin/positions",
    icon: "fa-id-badge",
    requiredFeature: "read:position",
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
