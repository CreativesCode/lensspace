import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import { fixupConfigRules } from '@eslint/compat'

const config = [
  // Some bundled React/import rules still use the older context API.
  ...fixupConfigRules([...nextVitals, ...nextTypescript]),
  {
    // Design Canvas exports are immutable visual references with their own runtime.
    ignores: ['.next/**', 'out/**', 'next-env.d.ts', 'docs/design/**'],
  },
  {
    // UI 2.0: feature code uses the semantic tokens in tailwind.config.ts, never raw hex.
    // The landing keeps its own art direction (prp-ui-2-0-design-migration, D3).
    files: ['src/features/**/*.{ts,tsx}'],
    ignores: ['src/features/landing/**'],
    rules: {
      'no-restricted-syntax': ['error',
        { selector: 'Literal[value=/(^|[[_])#[0-9A-Fa-f]{6}/]', message: 'Usa un token de color (tailwind.config.ts) en lugar de un hex.' },
        { selector: 'TemplateElement[value.raw=/(^|[[_])#[0-9A-Fa-f]{6}/]', message: 'Usa un token de color (tailwind.config.ts) en lugar de un hex.' },
      ],
    },
  },
]

export default config
