import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';

const typescriptFiles = ['src/**/*.ts', 'tests/**/*.ts', 'benchmarks/**/*.ts', 'examples/**/*.ts'];

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', '.bench-dist/**'],
  },
  {
    files: ['scripts/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['demo/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.browser, sourceType: 'module' },
  },
  {
    files: typescriptFiles,
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
  { files: typescriptFiles, rules: { curly: ['error', 'all'] } },
);
