import { NotFoundError, ValidationError } from "@/infra/errors.js";
import assessedValue from "@/models/assessed-value.js";
import realEstateProperty from "@/models/real-estate-property.js";
import { calculateSimple } from "@/features/certificates/services/calculators/calculate-simple.js";

function validateRequest(physicalPropertyId, requestedYear) {
  if (!Number.isInteger(physicalPropertyId) || physicalPropertyId < 1) {
    throw new ValidationError({
      message: "O código físico do imóvel deve ser um número inteiro positivo.",
      action: "Informe um código físico válido.",
    });
  }
  if (
    !Number.isInteger(requestedYear) ||
    requestedYear < 1 ||
    requestedYear > 9999
  ) {
    throw new ValidationError({
      message: "O exercício da certidão deve ser um ano válido.",
      action: "Informe um exercício entre 1 e 9999.",
    });
  }
}

function sortPropertiesByRegistration(properties) {
  return [...properties].sort((first, second) =>
    first.physical_registration.localeCompare(
      second.physical_registration,
      undefined,
      { numeric: true },
    ),
  );
}

function formatPhysicalRegistration(properties) {
  const [first, ...remaining] = properties;
  return [
    first.physical_registration,
    ...remaining.map((property) => property.physical_registration.slice(-2)),
  ].join("/");
}

function sum(values) {
  return Number(values.reduce((total, value) => total + value, 0).toFixed(2));
}

async function calculateVenalValue({
  physical_property_id: physicalPropertyId,
  year,
  owner_rg: ownerRg = null,
  is_updated: isUpdated = true,
} = {}) {
  const requestedYear = year ?? new Date().getFullYear();
  validateRequest(physicalPropertyId, requestedYear);
  if (typeof isUpdated !== "boolean") {
    throw new ValidationError({
      message: "A opção Atualizado deve ser verdadeira ou falsa.",
      action:
        "Informe true para utilizar o cadastro atualizado ou false para utilizar o lançamento anual.",
    });
  }
  const annual = !isUpdated;

  let propertyYear = requestedYear;
  let property = await realEstateProperty.findByPhysicalPropertyIdAndYear(
    physicalPropertyId,
    requestedYear,
    annual,
  );

  if (!property) {
    propertyYear = new Date().getFullYear();
    property = await realEstateProperty.findByPhysicalPropertyIdAndYear(
      physicalPropertyId,
      propertyYear,
      annual,
    );
  }

  if (!property) {
    throw new NotFoundError({
      message:
        "O imóvel não foi encontrado no exercício solicitado nem no cadastro do ano corrente.",
      action:
        "Confira o código físico informado e verifique se o imóvel está cadastrado.",
    });
  }

  const ctmCount = Number(property.ctm_count);

  if (!Number.isInteger(ctmCount) || ctmCount < 1) {
    throw new ValidationError({
      message: `O CTM ${property.ctm} informa uma contagem inválida de ${property.ctm_count} cadastros vinculados.`,
      action:
        "Corrija a contagem de cadastros vinculados ao CTM antes de emitir a certidão.",
    });
  }

  const assessedValues = await assessedValue.findOneByYear(requestedYear);
  let properties = [property];

  if (ctmCount > 1) {
    let groupedProperties = await realEstateProperty.findByCtmAndYear(
      property.ctm,
      propertyYear,
      annual,
    );

    if (groupedProperties.length !== ctmCount) {
      const normalizedCtm = String(property.ctm).replace(/\D/g, "");
      const allProperties = await realEstateProperty.findAll();
      const matchingProperties = allProperties.filter(
        (item) =>
          String(item.ctm).replace(/\D/g, "") === normalizedCtm &&
          Number(item.year) === propertyYear &&
          item.annual === annual,
      );

      if (matchingProperties.length > groupedProperties.length) {
        groupedProperties = matchingProperties;
      }
    }

    if (groupedProperties.length !== ctmCount) {
      throw new ValidationError({
        message: `O CTM ${property.ctm} informa ${property.ctm_count} cadastros vinculados, mas foram encontrados ${groupedProperties.length} cadastros ativos no exercício utilizado.`,
        action:
          "Revise os cadastros vinculados ao CTM antes de emitir a certidão.",
      });
    }

    const inconsistentCountProperties = groupedProperties.filter(
      (item) => Number(item.ctm_count) !== ctmCount,
    );

    if (inconsistentCountProperties.length > 0) {
      const registrations = inconsistentCountProperties
        .map(
          (item) =>
            `${item.physical_registration} (contagem ${item.ctm_count})`,
        )
        .join(", ");

      throw new ValidationError({
        message: `O CTM ${property.ctm} possui contagens divergentes entre os cadastros: ${registrations}.`,
        action:
          "Corrija a contagem de cadastros vinculados em todos os imóveis do CTM antes de emitir a certidão.",
      });
    }

    const invalidGroupingProperties = groupedProperties.filter(
      (item) => !["I", "P", "A"].includes(item.grouping),
    );

    if (invalidGroupingProperties.length > 0) {
      const registrations = invalidGroupingProperties
        .map(
          (item) =>
            `${item.physical_registration} (englobamento ${item.grouping})`,
        )
        .join(", ");

      throw new ValidationError({
        message: `O CTM ${property.ctm} possui valores inválidos no campo de englobamento: ${registrations}.`,
        action:
          "Corrija o englobamento para I, P ou A antes de emitir a certidão.",
      });
    }

    const allIndividual = groupedProperties.every(
      (item) => item.grouping === "I",
    );

    if (!allIndividual) {
      const sortedProperties = sortPropertiesByRegistration(groupedProperties);
      const mainProperties = sortedProperties.filter(
        (item) => item.grouping === "P",
      );
      const invalidProperties = sortedProperties.filter((item) => {
        const isMainRegistration = String(item.physical_registration)
          .replace(/\D/g, "")
          .endsWith("01");
        return isMainRegistration
          ? item.grouping !== "P"
          : item.grouping !== "A";
      });

      if (mainProperties.length !== 1 || invalidProperties.length > 0) {
        const invalidRegistrations = sortedProperties
          .filter((item) => invalidProperties.includes(item))
          .map(
            (item) =>
              `${item.physical_registration} (englobamento ${item.grouping})`,
          );

        if (mainProperties.length === 0) {
          invalidRegistrations.push("nenhum cadastro marcado como P");
        } else if (mainProperties.length > 1) {
          invalidRegistrations.push("mais de um cadastro marcado como P");
        }

        throw new ValidationError({
          message: `O CTM ${property.ctm} possui inconsistências no englobamento: ${invalidRegistrations.join(", ")}.`,
          action:
            "Todos os cadastros devem ser I ou, no caso de englobamento, o cadastro terminado em .01 deve ser P e todos os demais devem ser A.",
        });
      }

      const mainProperty = mainProperties[0];
      properties = [
        mainProperty,
        ...sortedProperties.filter((item) => item.id !== mainProperty.id),
      ];
    }
  }

  const calculated = properties.map((item) =>
    calculateSimple(item, assessedValues, requestedYear),
  );
  const landValue = sum(calculated.map((item) => item.land_value));
  const buildingValue = sum(calculated.map((item) => item.building_value));

  const totalBuiltArea = sum(
    properties.map((item) => Number(item.built_area || 0)),
  );
  const firstProperty = properties[0];

  return {
    year: requestedYear,
    physical_property_id: physicalPropertyId,
    physical_registration: formatPhysicalRegistration(properties),
    owner_name: firstProperty.owner_name,
    promissory_buyer:
      firstProperty.promissory_buyer || firstProperty.owner_name,
    property_street: firstProperty.property_street,
    property_number:
      firstProperty.property_number == null
        ? null
        : Number(firstProperty.property_number),
    property_neighborhood: firstProperty.property_neighborhood,
    property_block: firstProperty.property_block,
    property_lots: firstProperty.property_lots,
    property_complement: firstProperty.property_complement,
    owner_rg: ownerRg,
    land_area: Number(firstProperty.land_area),
    built_area: totalBuiltArea,
    land_value: landValue,
    building_value: buildingValue,
    total_value: sum([landValue, buildingValue]),
  };
}

export default calculateVenalValue;
