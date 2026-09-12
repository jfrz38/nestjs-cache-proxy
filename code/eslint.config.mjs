import js from '@eslint/js';
import cleanArchitecture from '@jfrz38/eslint-plugin-clean-architecture-highlighter';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));
const coreImportRestrictions = {
  patterns: [
    {
      group: ['@nestjs/*', 'cache-manager'],
      message:
        'Framework and cache backend dependencies belong in the nest layer.',
    },
  ],
};

export default tseslint.config(
  {
    ignores: ['.artifacts/', 'coverage/', 'dist/', 'node_modules/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['scripts/*.mjs'],
        },
        tsconfigRootDir,
      },
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: {
      'clean-architecture-highlighter': cleanArchitecture,
    },
    rules: {
      'clean-architecture-highlighter/no-layer-violation': 'error',
    },
  },
  {
    files: ['src/{domain,application}/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', coreImportRestrictions],
    },
  },
  prettier,
);
