module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react', 'react-hooks'],
  extends: ['plugin:react/recommended', 'plugin:react/jsx-runtime', 'plugin:react-hooks/recommended'],
  settings: { react: { version: '18.3' } },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'react/prop-types': ['error', { skipUndeclared: true }],
  },
};
