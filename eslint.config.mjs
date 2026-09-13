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
]

export default config
