import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function versionMetaPlugin(): Plugin {
  const now = new Date();
  const buildTime = now.getTime();
  const buildDate = now.toISOString();
  const buildId = `rel_${buildTime.toString(36)}`;
  const buildInfo = {
    version: '1.2.0',
    buildTime,
    buildDate,
    buildId
  };

  return {
    name: 'version-meta-plugin',
    config() {
      return {
        define: {
          __APP_BUILD_INFO__: JSON.stringify(buildInfo)
        }
      };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/version.json')) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.end(JSON.stringify(buildInfo, null, 2));
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(buildInfo, null, 2)
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), versionMetaPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand', 'axios'],
          markdown: ['react-markdown', 'remark-gfm', 'rehype-highlight', 'highlight.js'],
          dnd: ['@hello-pangea/dnd'],
          icons: ['lucide-react']
        }
      }
    }
  }
});
