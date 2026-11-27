export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO features (
      name,
      label,
      group_name,
      description,
      is_self_removable,
      is_privileged,
      is_protected
    )
    VALUES
      (
        'create:position',
        'Cadastrar cargos',
        'Cargos',
        'Permite cadastrar novos cargos no sistema.',
        true,
        true,
        false
      ),
      (
        'read:position',
        'Consultar cargos',
        'Cargos',
        'Permite consultar os cargos cadastrados no sistema.',
        true,
        true,
        false
      ),
      (
        'update:position',
        'Alterar cargos',
        'Cargos',
        'Permite alterar os cargos cadastrados no sistema.',
        true,
        true,
        false
      ),
      (
        'delete:position',
        'Excluir cargos',
        'Cargos',
        'Permite excluir logicamente os cargos cadastrados no sistema.',
        true,
        true,
        false
      );
  `);
};

export const down = false;
