import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

// Sengaja kecil: aturan bawaan ESLint + dua aturan hook React yang menangkap
// bug sungguhan (hook di dalam if, dependensi efek yang terlupa). Tidak ada
// aturan gaya — repo ini tidak memakai Prettier, dan perdebatan titik koma
// bukan yang menjaga uang kasir tetap benar.
export default [
  { ignores: ['dist/', 'node_modules/', '.vite/', 'build-twa/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, __VERSI_APP__: 'readonly' },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // catch kosong dipakai dengan sengaja di sini: localStorage yang
      // diblokir atau audio yang menolak dinyalakan tidak boleh menjatuhkan app.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Tanpa plugin React, ESLint tidak melihat <Icon/> sebagai pemakaian
      // Icon. Nama berhuruf besar = komponen, jadi dikecualikan.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    // Berkas yang jalan di Node (konfigurasi build) atau di service worker.
    files: ['vite.config.js', 'vitest.config.js', 'eslint.config.js', 'playwright.config.js', 'scripts/**/*.mjs', 'e2e/**'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker, __ASET__: 'readonly' } },
  },
  {
    files: ['src/__tests__/**'],
    languageOptions: { globals: { ...globals.node } },
  },
]
