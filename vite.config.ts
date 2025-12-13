import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente (como API_KEY) para uso no código cliente
  // Using '.' instead of process.cwd() to prevent TypeScript errors about missing types
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    define: {
      // Garante que process.env.API_KEY funcione no navegador conforme as diretrizes
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    }
  }
})