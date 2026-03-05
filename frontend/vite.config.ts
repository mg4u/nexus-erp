import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        // Allow connections from Docker host
        host: '0.0.0.0',
        proxy: {
            '/api': {
                // In Docker dev: VITE_BACKEND_URL=http://backend:3000
                // Locally without Docker: defaults to http://localhost:3000
                target: process.env.VITE_BACKEND_URL ?? 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
}));

