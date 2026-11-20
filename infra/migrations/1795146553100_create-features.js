export const up = (pgm) => {
  pgm.createTable("features", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    name: {
      type: "varchar(50)",
      notNull: true,
      unique: true,
    },
    label: {
      type: "varchar(50)",
      notNull: true,
    },
    group_name: {
      type: "varchar(50)",
      notNull: true,
    },
    description: {
      type: "text",
      notNull: true,
    },
    is_removable: {
      type: "boolean",
      notNull: true,
      default: true,
    },
    is_privileged: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    is_protected: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    deleted_at: {
      type: "timestamptz",
      notNull: false,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

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
    VALUES
      (
        'create:user',
        'Criar usuários',
        'Usuários',
        'Permite criar novas contas.',
        true,
        false,
        false
      ),
      (
        'read:user',
        'Consultar usuários',
        'Usuários',
        'Permite consultar informações públicas de usuários.',
        true,
        false,
        false
      ),
      (
        'read:user:self',
        'Consultar próprio usuário',
        'Usuários',
        'Permite consultar os dados da própria conta.',
        true,
        false,
        false
      ),
      (
        'update:user',
        'Alterar próprio usuário',
        'Usuários',
        'Permite alterar os dados da própria conta.',
        false,
        false,
        false
      ),
      (
        'update:user:others',
        'Administrar outros usuários',
        'Privilégios',
        'Permite pesquisar e alterar os dados e as permissões de outras contas.',
        true,
        true,
        true
      ),
      (
        'create:session',
        'Criar sessão',
        'Sessões',
        'Permite iniciar uma sessão autenticada.',
        false,
        false,
        false
      ),
      (
        'read:session',
        'Consultar sessão',
        'Sessões',
        'Permite consultar os dados da própria sessão.',
        false,
        false,
        false
      ),
      (
        'read:activation_token',
        'Consultar token de ativação',
        'Ativação',
        'Permite consultar o token de ativação da própria conta.',
        true,
        false,
        false
      ),
      (
        'create:migration',
        'Executar migrations',
        'Banco de dados',
        'Permite executar migrations do banco de dados.',
        true,
        false,
        false
      ),
      (
        'read:migration',
        'Consultar migrations',
        'Banco de dados',
        'Permite consultar o histórico de migrations.',
        true,
        false,
        false
      ),
      (
        'read:status',
        'Consultar status',
        'Sistema',
        'Permite consultar as métricas públicas do sistema.',
        true,
        false,
        false
      ),
      (
        'read:status:all',
        'Consultar status completo',
        'Privilégios',
        'Permite visualizar informações completas, incluindo a versão do banco de dados.',
        true,
        true,
        false
      ),
      (
        'create:feature',
        'Criar feature',
        'Privilégios',
        'Permite cadastrar novas features no sistema.',
        true,
        true,
        true
      ),
      (
        'read:feature',
        'Consultar features',
        'Privilégios',
        'Permite consultar as features cadastradas no sistema.',
        true,
        true,
        true
      ),
      (
        'update:feature',
        'Alterar feature',
        'Privilégios',
        'Permite alterar as informações das features cadastradas no sistema.',
        true,
        true,
        true
      ),
      (
        'delete:feature',
        'Excluir feature',
        'Privilégios',
        'Permite excluir logicamente as features cadastradas no sistema.',
        true,
        true,
        true
      );
  `);
};

export const down = false;
