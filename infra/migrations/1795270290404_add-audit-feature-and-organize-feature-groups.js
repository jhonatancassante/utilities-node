export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO features (
      name, label, group_name, description,
      is_self_removable, is_privileged, is_protected
    )
    VALUES (
      'read:audit',
      'Consultar Auditoria',
      'Sistema',
      'Permite consultar as informações de auditoria do sistema.',
      true,
      true,
      false
    );

    UPDATE features
    SET
      is_privileged = true,
      is_protected = true,
      updated_at = timezone('utc', now())
    WHERE
      name IN ('read:migration', 'create:migration');

    UPDATE features
    SET
      group_name = CASE name
        WHEN 'update:user:others' THEN 'Usuários'
        WHEN 'read:user:others' THEN 'Usuários'
        WHEN 'read:status:all' THEN 'Sistema'
        WHEN 'create:feature' THEN 'Features'
        WHEN 'read:feature' THEN 'Features'
        WHEN 'update:feature' THEN 'Features'
        WHEN 'delete:feature' THEN 'Features'
        ELSE group_name
      END,
      updated_at = timezone('utc', now())
    WHERE
      name IN (
        'update:user:others',
        'read:user:others',
        'read:status:all',
        'create:feature',
        'read:feature',
        'update:feature',
        'delete:feature'
      );
  `);
};

export const down = false;
