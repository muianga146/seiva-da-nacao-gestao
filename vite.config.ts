
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    define: {
      // Injeta a API Key de forma segura no código client-side
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill para evitar crashes de bibliotecas que esperam Node.js process
      'process.env': JSON.stringify({})
    },
    build: {
      // Aumenta o limite de aviso de chunk para evitar warnings no log de build
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'recharts', '@supabase/supabase-js'],
            pdf: ['jspdf', 'jspdf-autotable'],
            ai: ['@google/genai']
          }
        }
      }
    }
  }
})
