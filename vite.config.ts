import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Sitio 100 % estático (RNF-07). Los ganchos ?date=, ?seed=, ?ai= solo existen con VITE_TEST_HOOKS=1 (DEC-17):
// sin la variable, `import.meta.env.VITE_TEST_HOOKS` queda como `undefined` y el código de los ganchos se elimina del build.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: { target: 'es2022' },
})
