
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente do sistema e do arquivo .env
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Injeta explicitamente a API_KEY para o código do cliente
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      // Polyfill global de 'process' para compatibilidade com bibliotecas Node-like (Gemini SDK)
      'process.env': JSON.stringify(env)
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-ui': ['recharts', 'jspdf', 'jspdf-autotable'],
            'vendor-db': ['@supabase/supabase-js'],
            'vendor-ai': ['@google/genai']
          }
        }
      }
    },
    server: {
      port: 5173,
      strictPort: true
    }
  }
})
