import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import dynamicImport from 'vite-plugin-dynamic-import';


export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({ include: ['fs', 'stream', 'buffer', 'util', 'http', 'https'] }),
    commonjs(),
    dynamicImport()
  ],
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version)
  }
});
