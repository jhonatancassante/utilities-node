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
        'read:real_estate_property',
        'Consultar imóveis',
        'Imóveis',
        'Permite consultar os dados cadastrais dos imóveis.',
        true,
        true,
        false
      ),
      (
        'create:real_estate_property',
        'Cadastrar imóveis',
        'Imóveis',
        'Permite cadastrar os dados cadastrais dos imóveis.',
        true,
        true,
        false
      ),
      (
        'update:real_estate_property',
        'Alterar imóveis',
        'Imóveis',
        'Permite alterar os dados cadastrais dos imóveis.',
        true,
        true,
        false
      ),
      (
        'delete:real_estate_property',
        'Excluir imóveis',
        'Imóveis',
        'Permite excluir logicamente os dados cadastrais dos imóveis.',
        true,
        true,
        false
      );
  `);
};

export const down = false;
