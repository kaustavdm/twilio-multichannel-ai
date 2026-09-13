import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import {
  TAC,
  TACConfig,
  TACServer,
  VoiceChannel,
  SMSChannel,
} from 'twilio-agent-connect';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { handleMessageReady } from './services/agent.js';
import { markConversationEnded } from './repositories/conversations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();

async function buildTac() {
  try {
    return await TAC.create({ config: TACConfig.fromEnv() });
  } catch (err) {
    const wrapped = new Error(
      `Failed to construct TAC from environment. Verify .env against .env.example: ${err?.message ?? err}`,
    );
    wrapped.cause = err;
    throw wrapped;
  }
}

export async function startServer() {
  const fastify = Fastify({ logger: true });

  await fastify.register(fastifyStatic, {
    root: path.resolve(__dirname, 'static'),
    prefix: '/static/',
  });

  await registerDashboardRoutes(fastify);

  const tac = await buildTac();
  // Voice uses ACTIVE TwiML via ConversationRelay; do NOT add passive VOICE
  // capture rules in the Orchestrator config or STT will be double-billed.
  const voiceChannel = new VoiceChannel(tac, { memoryMode: 'once' });
  const smsChannel = new SMSChannel(tac, { memoryMode: 'always' });
  tac.registerChannel(voiceChannel);
  tac.registerChannel(smsChannel);

  tac.onMessageReady(async (event) => handleMessageReady(event, { tac }));
  tac.onConversationEnded(({ session }) => markConversationEnded(session.conversationId));

  const server = new TACServer(tac, {
    voiceChannel,
    messagingChannels: [smsChannel],
    fastifyInstance: fastify,
    port: Number(process.env.PORT ?? 8000),
  });

  await server.start();
}
