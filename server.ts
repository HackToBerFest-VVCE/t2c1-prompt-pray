import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { solanaRegistryBackend } from './src/server/solanaRegistryBackend.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. Health & Status Route
  app.get('/api/registry/status', async (_req, res) => {
    try {
      const status = await solanaRegistryBackend.getRegistryStatus();
      res.json(status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message, connected: false });
    }
  });

  // 2. List Real Registered Agents
  app.get('/api/registry/agents', async (req, res) => {
    try {
      const limit = parseInt(String(req.query.limit || '40'), 10);
      const skip = parseInt(String(req.query.skip || '0'), 10);
      const agents = await solanaRegistryBackend.getAgents(limit, skip);
      res.json({ agents, total: agents.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: message, agents: [] });
    }
  });

  // 3. Search Real Agents by Capability / Query
  app.get('/api/registry/search', async (req, res) => {
    try {
      const query = String(req.query.q || '');
      const limit = parseInt(String(req.query.limit || '30'), 10);
      const agents = await solanaRegistryBackend.searchAgents(query, limit);
      res.json({ query, agents, total: agents.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: message, agents: [] });
    }
  });

  // 4. Get Agent by On-Chain ID / Asset Pubkey
  app.get('/api/registry/agent/:id', async (req, res) => {
    try {
      const agent = await solanaRegistryBackend.getAgentById(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found in registry' });
      }
      res.json(agent);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // 5. Skill Extraction Route (Gemini with deterministic fallback)
  app.post('/api/registry/extract-skills', async (req, res) => {
    try {
      const query = String(req.body.query || '');
      const extracted = await solanaRegistryBackend.extractSkillsWithGemini(query);
      res.json(extracted);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // Vite Integration: Middleware in dev, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Intelligent Agent Discovery server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
