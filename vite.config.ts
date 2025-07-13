import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        test: 'test_sim.html',
      }
    }
  },
  server: {
    port: 8000
  }
})
