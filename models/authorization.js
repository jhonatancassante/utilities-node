import { InternalServerError } from "@/infra/errors.js";
import { adminSections } from "@/configs/admin.js";

function can(user, feature, resource) {
  validateUser(user);
  validateFeature(feature);

  let authorized = false;

  if (user.features.includes(feature)) {
    authorized = true;
  }

  if (feature === "update:user" && resource) {
    authorized = false;

    if (user.id === resource.id || can(user, "update:user:others")) {
      authorized = true;
    }
  }

  if (feature === "update:certificate" && resource) {
    authorized =
      user.features.includes("update:certificate") &&
      (user.id === resource.user_id ||
        can(user, "update:certificate:others"));
  }

  return authorized;
}

export function hasAdminAccess(user) {
  return Boolean(user?.privileged_features?.length);
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

function filterOutput(user, feature, resource) {
  validateUser(user);
  validateFeature(feature);
  validateResource(resource);

  if (feature === "read:user") {
    return {
      id: resource.id,
      username: resource.username,
      features: resource.features,
      created_at: resource.created_at,
      updated_at: resource.updated_at,
      ...(resource.profile_photo_url
        ? { profile_photo_url: resource.profile_photo_url }
        : {}),
    };
  }

  if (feature === "read:user:others") {
    const filterUser = (userObject) => ({
      id: userObject.id,
      username: userObject.username,
      email: userObject.email,
      features: userObject.features,
      privileged_features: userObject.privileged_features ?? [],
      banned_at: userObject.banned_at,
      timeout_until: userObject.timeout_until,
      ...(userObject.profile_photo_url
        ? { profile_photo_url: userObject.profile_photo_url }
        : {}),
      created_at: userObject.created_at,
      updated_at: userObject.updated_at,
    });

    return Array.isArray(resource)
      ? resource.map(filterUser)
      : filterUser(resource);
  }

  if (feature === "read:user:self") {
    if (user.id === resource.id) {
      return {
        id: resource.id,
        username: resource.username,
        email: resource.email,
        features: resource.features,
        privileged_features: resource.privileged_features ?? [],
        ...(resource.profile_photo_url
          ? { profile_photo_url: resource.profile_photo_url }
          : {}),
        created_at: resource.created_at,
        updated_at: resource.updated_at,
      };
    }
  }

  if (feature === "read:session") {
    if (user.id === resource.user_id) {
      return {
        id: resource.id,
        user_id: resource.user_id,
        expires_at: resource.expires_at,
        created_at: resource.created_at,
        updated_at: resource.updated_at,
      };
    }
  }

  if (feature === "read:activation_token") {
    return {
      id: resource.id,
      user_id: resource.user_id,
      created_at: resource.created_at,
      updated_at: resource.updated_at,
      expires_at: resource.expires_at,
      used_at: resource.used_at,
    };
  }

  if (feature === "read:migration") {
    return resource.map((migration) => ({
      path: migration.path,
      name: migration.name,
      timestamp: migration.timestamp,
    }));
  }

  if (feature === "read:audit") {
    const filterEvent = (event) => {
      if ("name" in event && "run_on" in event) {
        return {
          id: event.id,
          name: event.name,
          run_on: event.run_on,
        };
      }

      return {
        id: event.id,
        user_id: event.user_id,
        actor_user_id: event.actor_user_id,
        action: event.action,
        username: event.username,
        email: event.email,
        account_created_at: event.account_created_at,
        actor_username: event.actor_username,
        actor_email: event.actor_email,
        created_at: event.created_at,
        is_currently_banned: event.is_currently_banned,
        current_banned_at: event.current_banned_at,
      };
    };

    return Array.isArray(resource)
      ? resource.map(filterEvent)
      : filterEvent(resource);
  }

  if (feature === "read:feature") {
    const filterFeature = (featureObject) => ({
      id: featureObject.id,
      name: featureObject.name,
      label: featureObject.label,
      group_name: featureObject.group_name,
      description: featureObject.description,
      is_self_removable: featureObject.is_self_removable,
      is_privileged: featureObject.is_privileged,
      is_protected: featureObject.is_protected,
      created_at: featureObject.created_at,
      updated_at: featureObject.updated_at,
    });

    return Array.isArray(resource)
      ? resource.map(filterFeature)
      : filterFeature(resource);
  }

  if (feature === "read:assessed_value") {
    const filterAssessedValue = (item) => ({
      id: item.id,
      year: item.year,
      decree: item.decree,
      sector_1: item.sector_1,
      sector_2: item.sector_2,
      sector_3: item.sector_3,
      sector_4: item.sector_4,
      sector_5: item.sector_5,
      sector_6: item.sector_6,
      sector_7: item.sector_7,
      sector_8: item.sector_8,
      sector_9: item.sector_9,
      sector_9a: item.sector_9a,
      sector_10: item.sector_10,
      sector_11: item.sector_11,
      sector_11a: item.sector_11a,
      sector_11b: item.sector_11b,
      sector_12: item.sector_12,
      sector_13: item.sector_13,
      sector_14: item.sector_14,
      sector_15: item.sector_15,
      sector_16: item.sector_16,
      sector_17: item.sector_17,
      residential_precarious: item.residential_precarious,
      residential_simple: item.residential_simple,
      residential_regular: item.residential_regular,
      residential_medium: item.residential_medium,
      residential_good: item.residential_good,
      residential_sophisticated: item.residential_sophisticated,
      commercial_precarious: item.commercial_precarious,
      commercial_simple: item.commercial_simple,
      commercial_regular: item.commercial_regular,
      commercial_medium: item.commercial_medium,
      commercial_good: item.commercial_good,
      commercial_sophisticated: item.commercial_sophisticated,
      industrial_precarious: item.industrial_precarious,
      industrial_simple: item.industrial_simple,
      industrial_regular: item.industrial_regular,
      industrial_medium: item.industrial_medium,
      industrial_good: item.industrial_good,
      industrial_sophisticated: item.industrial_sophisticated,
      cleaning: item.cleaning,
      garbage: item.garbage,
      rural: item.rural,
      created_at: item.created_at,
      updated_at: item.updated_at,
    });
    return Array.isArray(resource)
      ? resource.map(filterAssessedValue)
      : filterAssessedValue(resource);
  }

  if (feature === "read:real_estate_property") {
    const filterProperty = (item) => ({
      id: item.id,
      year: item.year,
      physical_property_id: item.physical_property_id,
      physical_registration: item.physical_registration,
      ctm: item.ctm,
      ctm_count: item.ctm_count,
      grouping: item.grouping,
      property_block: item.property_block,
      property_lots: item.property_lots,
      land_area: item.land_area,
      built_area: item.built_area,
      property_neighborhood: item.property_neighborhood,
      owner_name: item.owner_name,
      promissory_buyer: item.promissory_buyer,
      land_sector: item.land_sector,
      property_street: item.property_street,
      property_number: item.property_number,
      property_complement: item.property_complement,
      construction_type: item.construction_type,
      ideal_fraction: item.ideal_fraction,
      points: item.points,
      annual: item.annual,
      created_at: item.created_at,
      updated_at: item.updated_at,
    });
    return Array.isArray(resource)
      ? resource.map(filterProperty)
      : filterProperty(resource);
  }


  if (feature === "read:certificate") {
    const filterCertificate = (item) => ({
      id: item.id,
      user_id: item.user_id,
      protocol_number: item.protocol_number,
      protocol_year: item.protocol_year,
      applicant_name: item.applicant_name,
      year: item.year,
      purpose: item.purpose,
      real_estate_property_id: item.real_estate_property_id,
      property_number: item.property_number,
      applicant_rg: item.applicant_rg,
      observations: item.observations,
      validity_days: item.validity_days,
      is_updated: item.is_updated,
      created_at: item.created_at,
      updated_at: item.updated_at,
    });
    return Array.isArray(resource)
      ? resource.map(filterCertificate)
      : filterCertificate(resource);
  }

  if (feature === "read:status") {
    const output = {
      updated_at: resource.updated_at,
      dependencies: {
        database: {
          max_connections: resource.dependencies.database.max_connections,
          opened_connections: resource.dependencies.database.opened_connections,
        },
      },
    };

    if (can(user, "read:status:all")) {
      output.dependencies.database.version =
        resource.dependencies.database.version;
    }

    return output;
  }
}

function validateUser(user) {
  if (!user || !user.features) {
    throw new InternalServerError({
      cause: "É necessário fornecer `user` no model `authorization`.",
    });
  }
}

function validateFeature(feature) {
  if (typeof feature !== "string" || !feature.trim()) {
    throw new InternalServerError({
      cause:
        "É necessário fornecer uma `feature` válida no model `authorization`.",
    });
  }
}

function validateResource(resource) {
  if (!resource) {
    throw new InternalServerError({
      cause: "É necessário fornecer `resource` no model `authorization`.",
    });
  }
}

const authorization = {
  can,
  filterOutput,
  hasAdminAccess,
  hasAdminSectionAccess,
  getAvailableAdminSections,
};

export default authorization;
