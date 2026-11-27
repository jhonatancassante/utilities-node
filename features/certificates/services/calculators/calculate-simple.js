import { ValidationError } from "@/infra/errors.js";

const CONSTRUCTION_TYPES = {
  10: "residential",
  11: "commercial",
  12: "industrial",
  13: "commercial",
  14: "commercial",
};

const LAND_SECTOR_COLUMNS = new Set([
  "sector_1",
  "sector_2",
  "sector_3",
  "sector_4",
  "sector_5",
  "sector_6",
  "sector_7",
  "sector_8",
  "sector_9",
  "sector_9a",
  "sector_10",
  "sector_11",
  "sector_11a",
  "sector_11b",
  "sector_12",
  "sector_13",
  "sector_14",
  "sector_15",
  "sector_16",
  "sector_17",
]);

function getConstructionCategory(constructionType) {
  if (
    constructionType === null ||
    constructionType === undefined ||
    constructionType === 0
  )
    return null;
  const category = CONSTRUCTION_TYPES[constructionType];
  if (!category) {
    throw new ValidationError({
      message:
        "O tipo de construção do imóvel não possui uma classificação válida.",
      action: "Revise o tipo de construção no cadastro do imóvel.",
    });
  }
  return category;
}

function getPropertyClassification(points, year, category) {
  if (!Number.isInteger(points) || points <= 0) {
    throw new ValidationError({
      message:
        "A pontuação do imóvel é necessária para calcular o valor da construção.",
      action:
        "Informe uma pontuação válida no cadastro do imóvel e tente novamente.",
    });
  }

  if (year <= 2015) {
    if (points <= 35) return "precarious";
    if (points <= 45) return "simple";
    if (points <= 65) return "regular";
    if (points <= 95) return "medium";
    if (points <= 140) return "good";
    return "sophisticated";
  }

  if (category === "residential") {
    if (points <= 35) return "precarious";
    if (points <= 45) return "simple";
    if (points <= 95) return "medium";
    if (points <= 140) return "good";
    return "sophisticated";
  }

  if (points <= 45) return "simple";
  if (points <= 95) return "medium";
  return "good";
}

function roundMoney(value) {
  return Number(value.toFixed(2));
}

function calculateSimple(property, assessedValues, requestedYear) {
  const landColumn = "sector_" + property.land_sector;
  if (!LAND_SECTOR_COLUMNS.has(landColumn)) {
    throw new ValidationError({
      message:
        "O setor do terreno não possui uma coluna de valor venal correspondente.",
      action: "Revise o setor do terreno no cadastro do imóvel.",
    });
  }

  const landPrice = assessedValues[landColumn];
  if (landPrice === null || landPrice === undefined) {
    throw new ValidationError({
      message: `O valor venal do terreno para o setor ${property.land_sector} não está cadastrado em ${requestedYear}.`,
      action: "Revise a tabela de valores venais do exercício solicitado.",
    });
  }

  const builtArea = Number(property.built_area || 0);
  let buildingPrice = 0;

  if (
    builtArea > 0 &&
    property.construction_type !== null &&
    property.construction_type !== undefined
  ) {
    const category = getConstructionCategory(property.construction_type);
    if (category) {
      const classification = getPropertyClassification(
        property.points,
        requestedYear,
        category,
      );
      const buildingColumn = category + "_" + classification;
      const configuredPrice = assessedValues[buildingColumn];
      if (configuredPrice === null || configuredPrice === undefined) {
        throw new ValidationError({
          message: `O valor venal da construção (${buildingColumn}) não está cadastrado em ${requestedYear}.`,
          action: "Revise a tabela de valores venais do exercício solicitado.",
        });
      }
      buildingPrice = Number(configuredPrice);
    }
  }

  const landValue = Number(landPrice) * Number(property.ideal_fraction || 0);
  const buildingValue = buildingPrice * builtArea;

  return {
    land_value: roundMoney(landValue),
    building_value: roundMoney(buildingValue),
    total_value: roundMoney(landValue + buildingValue),
  };
}

export { calculateSimple, getConstructionCategory, getPropertyClassification };
