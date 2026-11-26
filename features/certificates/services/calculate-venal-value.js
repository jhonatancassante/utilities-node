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
  if (!Number.isInteger(requestedYear) || requestedYear < 1 || requestedYear > 9999) {
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
      action: "Informe true para utilizar o cadastro atualizado ou false para utilizar o lançamento anual.",
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
      message: "O imóvel não foi encontrado no exercício solicitado nem no cadastro do ano corrente.",
      action: "Confira o código físico informado e verifique se o imóvel está cadastrado.",
    });
  }

  const assessedValues = await assessedValue.findOneByYear(requestedYear);
  let properties = [property];

  if (property.ctm_count > 1) {
    let groupedProperties = await realEstateProperty.findByCtmAndYear(
      property.ctm,
      propertyYear,
      annual,
    );

    if (groupedProperties.length !== Number(property.ctm_count)) {
      const normalizedCtm = String(property.ctm).replace(/\\D/g, "");
      const allProperties = await realEstateProperty.findAll();
      const matchingProperties = allProperties.filter(
        (item) =>
          String(item.ctm).replace(/\\D/g, "") === normalizedCtm &&
          Number(item.year) === propertyYear &&
          item.annual === annual,
      );

      if (matchingProperties.length > groupedProperties.length) {
        groupedProperties = matchingProperties;
      }
    }

    if (groupedProperties.length !== Number(property.ctm_count)) {
      throw new ValidationError({
        message: `O imóvel informa ${property.ctm_count} cadastros vinculados ao CTM, mas foram encontrados ${groupedProperties.length} cadastros ativos no exercício utilizado.`,
        action: "Revise os cadastros do imóvel englobado antes de emitir a certidão.",
      });
    }

    if (groupedProperties.length > 1) {
      properties = sortPropertiesByRegistration(groupedProperties);
      const mainProperty = properties.find((item) =>
        item.physical_registration.endsWith(".01"),
      );

      if (!mainProperty) {
        throw new ValidationError({
          message: "O cadastro principal do imóvel englobado, terminado em 01, não foi encontrado.",
          action: "Revise os cadastros vinculados ao mesmo CTM antes de emitir a certidão.",
        });
      }

      properties = [
        mainProperty,
        ...properties.filter((item) => item.id !== mainProperty.id),
      ];
    }
  }

  const calculated = properties.map((item) =>
    calculateSimple(item, assessedValues, requestedYear),
  );
  const landValue = sum(calculated.map((item) => item.land_value));
  const buildingValue = sum(calculated.map((item) => item.building_value));

  const totalBuiltArea = sum(properties.map((item) => Number(item.built_area || 0)));
  const firstProperty = properties[0];

  return {
    year: requestedYear,
    physical_property_id: physicalPropertyId,
    physical_registration: formatPhysicalRegistration(properties),
    owner_name: firstProperty.owner_name,
    promissory_buyer: firstProperty.promissory_buyer || firstProperty.owner_name,
    property_street: firstProperty.property_street,
    property_number: firstProperty.property_number == null ? null : Number(firstProperty.property_number),
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
