module.exports = {
  root: true,
  extends: 'airbnb-base',
  env: {
    browser: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    allowImportExportEverywhere: true,
    sourceType: 'module',
    requireConfigFile: false,
  },
  rules: {
    'import/extensions': ['error', { js: 'always' }], // require js file extensions in imports
    'linebreak-style': ['error', 'unix'], // enforce unix linebreaks
    'no-param-reassign': [2, { props: false }], // allow modifying properties of param
    'import/prefer-default-export': 'off', // disable prefer default export rule
    'import/no-relative-packages': 'off', // disable prefer default export rule
    'no-restricted-syntax': 'off', // enable for loops
  },
  overrides: [
    {
      files: ['tests/**/*.test.js'],
      env: {
        jest: true,
        es2020: true,
        es2021: true,
        es2022: true,
        es2023: true,
      },
      parserOptions: {
        ecmaVersion: 'latest',
      },
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
