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
        'read:assessed_values',
        'Consultar valores venais',
        'Valores venais',
        'Permite consultar os valores venais cadastrados no sistema.',
        true,
        true,
        false
      ),
      (
        'create:assessed_values',
        'Cadastrar valores venais',
        'Valores venais',
        'Permite cadastrar novos valores venais no sistema.',
        true,
        true,
        false
      ),
      (
        'update:assessed_values',
        'Alterar valores venais',
        'Valores venais',
        'Permite alterar os valores venais cadastrados no sistema.',
        true,
        true,
        false
      ),
      (
        'delete:assessed_values',
        'Excluir valores venais',
        'Valores venais',
        'Permite excluir logicamente os valores venais cadastrados no sistema.',
        true,
        true,
        false
      );
  `);
};

export const down = false;
