import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Sitio 100 % estático (RNF-07). Los ganchos ?date=, ?seed=, ?ai= solo existen con VITE_TEST_HOOKS=1 (DEC-17):
// sin la variable, `import.meta.env.VITE_TEST_HOOKS` queda como `undefined` y el código de los ganchos se elimina del build.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    // Sin `modulepreload` para las importaciones dinámicas (las del HTML inicial se quedan): los trozos que se traen en reposo
    // (combate, ventanas, campaña) llevaban sus dependencias precargadas y, con la máquina cargada, WebKit avisaba en consola de
    // «preloaded but not used within a few seconds» (E2E-01 y E2E-19 fallaban a ratos, también en main). Se piden igual al importar.
    modulePreload: { resolveDependencies: (_file, deps, { hostType }) => (hostType === 'html' ? deps : []) },
  },
})
