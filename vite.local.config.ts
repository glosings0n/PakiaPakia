/**
 * Local playground: `npm run dev:local`, then open http://localhost:5173
 * Serves the real client and runs the real API routes against in-memory mocks
 * of Redis and the Reddit API (see tools/local). Not used by Devvit builds.
 */
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

type LocalApi = { handle: (req: IncomingMessage, res: ServerResponse) => Promise<void> };

const localApi = (): Plugin => ({
  name: 'pakia-local-api',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url ?? '/';
      if (url === '/' || url.startsWith('/?')) {
        res.statusCode = 302;
        res.setHeader('Location', `/game.html${url.slice(1)}`);
        res.end();
        return;
      }
      if (!url.startsWith('/api/') && !url.startsWith('/__dev/')) {
        next();
        return;
      }
      server
        .ssrLoadModule(here('./tools/local/localApi.ts'))
        .then((mod) => (mod as LocalApi).handle(req, res))
        .catch((error: unknown) => next(error));
    });
  },
});

export default defineConfig({
  root: here('./src/client'),
  plugins: [react(), tailwind(), localApi()],
  resolve: {
    alias: [
      { find: '@devvit/web/client', replacement: here('./tools/local/mockClient.ts') },
      { find: '@devvit/web/server', replacement: here('./tools/local/mockServer.ts') },
    ],
  },
  server: { port: 5173, strictPort: false, host: 'localhost' },
});
