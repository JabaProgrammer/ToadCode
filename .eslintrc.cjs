module.exports = {
  env: { es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  extends: ['eslint:recommended'],
  rules: { 'no-var': 'error', 'prefer-const': 'error', 'no-unused-vars': 'off' }
};
