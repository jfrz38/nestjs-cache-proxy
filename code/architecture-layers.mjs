export const architectureRuleOptions = {
  sourceFolder: 'src',
  layers: {
    domain: {
      aliases: ['key', 'policy'],
      allowedDependencies: ['domain'],
    },
    application: {
      aliases: ['runtime'],
      allowedDependencies: ['domain', 'application'],
    },
    infrastructure: {
      aliases: ['nest', '@nestjs', 'cache-manager'],
      allowedDependencies: ['domain', 'application', 'infrastructure'],
    },
  },
  ignoreTypeImports: false,
  ignoreExternalDependencies: false,
};

export const coreImportRestrictions = {
  patterns: [
    {
      group: ['@nestjs/*', 'cache-manager'],
      message:
        'Framework and cache backend dependencies belong in the nest layer.',
    },
  ],
};
