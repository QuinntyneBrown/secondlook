// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-config-prettier');

module.exports = defineConfig([
  {
    ignores: ['dist/**', 'coverage/**', '.angular/**', 'out-tsc/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
      prettier,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // Components alias inputs such as `title` so the class field doesn't
      // shadow a host/DOM name while templates keep the mock's attribute names.
      '@angular-eslint/no-input-rename': 'off',
      // `() => {}` is the idiomatic no-op default for ControlValueAccessor callbacks.
      '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'sl', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'sl', style: 'kebab-case' },
      ],
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      // Test doubles routinely stub partial framework/service shapes.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
]);
