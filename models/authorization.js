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
    };
  }

  if (feature === "read:user:self") {
    if (user.id === resource.id) {
      return {
        id: resource.id,
        username: resource.username,
        email: resource.email,
        features: resource.features,
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
        "É necessário fornecer `feature` conhecida no model `authorization`.",
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
