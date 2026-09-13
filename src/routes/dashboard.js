import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';

import { listConversations, getConversation } from '../repositories/conversations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_HTML_PATH = join(__dirname, '..', 'static', 'dashboard.html');

export async function registerDashboardRoutes(fastify) {
  fastify.get('/', async (_request, reply) => {
    const html = await readFile(DASHBOARD_HTML_PATH, 'utf8');
    reply.type('text/html; charset=utf-8').send(html);
  });

  fastify.get('/api/conversations', async () => {
    return { conversations: listConversations() };
  });

  fastify.get('/api/conversations/:id', async (request, reply) => {
    const conversation = getConversation(request.params.id);
    if (!conversation) {
      reply.code(404);
      return { error: 'not_found', id: request.params.id };
    }
    return conversation;
  });

  fastify.get('/healthz', async () => ({ status: 'ok' }));
}
