import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'docs/**'] },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },

  // Style lives here rather than in a separate formatter, so every complaint
  // names a rule and can be suppressed per line when it is wrong.
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: false,
    jsx: true,
    arrowParens: true,
    braceStyle: '1tbs',
    quoteProps: 'as-needed',
    commaDangle: 'never'
  }),

  {
    files: ['src/react/**/*.{ts,tsx}', 'examples/react/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },

  {
    rules: {
      '@stylistic/max-len': [
        'error',
        { code: 100, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }
      ],

      // A resolver or mutator's body is often synchronous while its signature stays
      // async, and the factories accept both. Requiring an await would fight that
      // on purpose.
      '@typescript-eslint/require-await': 'off',

      // Single quotes, except where that would mean escaping an apostrophe.
      // @stylistic's customize() defaults avoidEscape to false, which rewrites
      // "the function's result" into an escaped, harder-to-read single-quoted form.
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: 'always' }],

      // A leading underscore marks a parameter kept for position, not use.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ]
    }
  },

  {
    files: ['eslint.config.js', 'jest.config.js'],
    extends: [tseslint.configs.disableTypeChecked]
  },

  {
    // A Jest environment module, loaded via require() regardless of the repo's
    // own "type": "module" — Jest's environment resolution predates ESM support.
    files: ['examples/client/jsdom-fetch-environment.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        fetch: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
)
