import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://jdsojjjrxsknffuogdux.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkc29qampyeHNrbmZmdW9nZHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjEwNjMsImV4cCI6MjA4NjgzNzA2M30.zPPzQev60bopgiBlenNAezIsYfNg8m5IMAigfsDGIhs')
  }
})
