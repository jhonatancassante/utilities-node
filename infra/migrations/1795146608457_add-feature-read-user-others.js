export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO features (
      name,
      label,
      group_name,
      description,
      is_removable,
      is_privileged,
      is_protected
    )
    VALUES (
      'read:user:others',
      'Consultar outros usuários',
      'Privilégios',
      'Permite consultar os dados de outras contas, sem permitir alterá-los.',
      true,
      true,
      true
    );
  `);
};

export const down = false;
