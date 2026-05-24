import nextConfig from 'eslint-config-next'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...nextConfig,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // setMounted(true) in useEffect is the standard Next.js SSR-hydration pattern
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**'],
  }
)
