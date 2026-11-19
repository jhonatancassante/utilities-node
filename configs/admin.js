import { privilegedFeatures } from "@/configs/features.js";

export const adminSections = [
  {
    id: "users",
    title: "Gerenciar usuários",
    description: "Pesquise contas e altere dados, senhas e permissões.",
    href: "/admin/usuarios",
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

export function hasAdminAccess(user) {
  return Boolean(
    user?.features?.some((feature) => privilegedFeatures.includes(feature)),
  );
}

export function hasAdminSectionAccess(user, sectionId) {
  const section = adminSections.find((item) => item.id === sectionId);
  return Boolean(section && user?.features?.includes(section.requiredFeature));
}

export function getAvailableAdminSections(user) {
  return adminSections.filter((section) =>
    hasAdminSectionAccess(user, section.id),
  );
}
