export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO features (
      name, label, group_name, description,
      is_self_removable, is_privileged, is_protected
    )
    VALUES
      (
        'update:user:features',
        'Gerenciar features de usuários',
        'Usuários',
        'Permite conceder e remover features de outras contas.',
        true,
        true,
        true
      ),
      (
        'update:user:status',
        'Gerenciar status de usuários',
        'Usuários',
        'Permite banir, desbanir e aplicar ou remover timeout de outras contas.',
        true,
        true,
        false
      );
  `);
};

export const down = false;
