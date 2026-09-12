import js from '@eslint/js';
import cleanArchitecture from '@jfrz38/eslint-plugin-clean-architecture-highlighter';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
import {
  architectureRuleOptions,
  coreImportRestrictions,
} from './architecture-layers.mjs';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

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
      'clean-architecture-highlighter/no-layer-violation': [
        'error',
        architectureRuleOptions,
      ],
    },
  },
  {
    files: ['src/{key,policy,runtime}/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', coreImportRestrictions],
    },
  },
  prettier,
);
