export const ENTERTAINMENT_BASE_PATH = "/entertainment";

const entertainmentAppsList = [
  {
    slug: "mtg-adventure-creator",
    title: "Criador de Aventuras de Magic",
    description:
      "Transforme cinco cartas aleatórias de Magic: The Gathering no ponto de partida de uma aventura de RPG.",
    icon: "fa-hat-wizard",
    href: "/entertainment/mtg-adventure-creator",
  },
];

export const entertainmentApps = Object.freeze(
  entertainmentAppsList.map((app) => Object.freeze({ ...app })),
);

export function getEntertainmentAppBySlug(slug) {
  return entertainmentApps.find((app) => app.slug === slug);
}
