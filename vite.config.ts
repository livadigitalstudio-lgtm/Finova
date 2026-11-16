import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'suppress-vite-hmr-client-ws',
        transformIndexHtml: {
          order: 'pre' as const,
          handler() {
            return [
              {
                tag: 'script',
                attrs: { type: 'text/javascript' },
                children: `
                  (function() {
                    var NativeWebSocket = window.WebSocket;
                    if (!NativeWebSocket) return;
                    window.WebSocket = function(url, protocols) {
                      if (protocols === 'vite-hmr' || (typeof url === 'string' && (url.includes('token=') || url.includes(':24678') || url.includes('/@vite/')))) {
                        var target = new EventTarget();
                        target.binaryType = 'blob';
                        target.readyState = 1;
                        target.url = url;
                        target.protocol = protocols || '';
                        target.send = function() {};
                        target.close = function() { target.readyState = 3; };
                        setTimeout(function() {
                          target.dispatchEvent(new Event('open'));
                        }, 5);
                        return target;
                      }
                      return new NativeWebSocket(url, protocols);
                    };
                    window.WebSocket.prototype = NativeWebSocket.prototype;
                    window.WebSocket.CONNECTING = 0;
                    window.WebSocket.OPEN = 1;
                    window.WebSocket.CLOSING = 2;
                    window.WebSocket.CLOSED = 3;
                  })();
                `,
                injectTo: 'head-prepend' as const,
              },
            ];
          },
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'Finova - Control Financiero & Negocios',
          short_name: 'Finova',
          description: 'Plataforma inteligente para control de ventas, inventario, balances y finanzas comerciales.',
          theme_color: '#f59e0b',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,jpg}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
