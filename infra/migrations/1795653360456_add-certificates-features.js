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
        'read:certificate',
        'Consultar certidões',
        'Certidões',
        'Permite consultar as certidões de valor venal cadastradas no sistema.',
        true,
        false,
        false
      ),
      (
        'create:certificate',
        'Cadastrar certidões',
        'Certidões',
        'Permite cadastrar certidões de valor venal no sistema.',
        true,
        false,
        false
      ),
      (
        'update:certificate',
        'Alterar certidões',
        'Certidões',
        'Permite alterar as certidões de valor venal cadastradas no sistema.',
        true,
        false,
        false
      ),
      (
        'delete:certificate',
        'Excluir certidões',
        'Certidões',
        'Permite excluir logicamente as certidões de valor venal cadastradas no sistema.',
        true,
        true,
        false
      ),
      (
        'update:certificate:others',
        'Alterar certidões de outros usuários',
        'Certidões',
        'Permite alterar certidões de valor venal cadastradas por outros usuários.',
        true,
        true,
        false
      );
  `);
};

export const down = false;
