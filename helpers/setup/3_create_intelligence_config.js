// Create the Conversation Intelligence configuration.
//
// Usage:
//   node helpers/setup/3_create_intelligence_config.js
//   npm run setup:intelligence-config
//
// Docs: https://www.twilio.com/docs/conversations/conversation-intelligence

import {
  extractOperationResultId,
  isMainModule,
  loadEnv,
  prettyPrint,
  requireEnv,
  requireTwilioAuth,
  timestampSlug,
  twilioRequest,
} from '../common.js';

const INTELLIGENCE_CONFIG_URL = 'https://intelligence.twilio.com/v3/ControlPlane/Configurations';

export async function createIntelligenceConfig() {
  const sentimentOperatorId = requireEnv('TWILIO_INTELLIGENCE_SENTIMENT_OPERATOR_ID');
  const summaryOperatorId = requireEnv('TWILIO_INTELLIGENCE_SUMMARY_OPERATOR_ID');
  const nextBestResponseOperatorId = requireEnv('TWILIO_INTELLIGENCE_NEXT_BEST_RESPONSE_OPERATOR_ID');

  const displayName = `${process.env.INTELLIGENCE_CONFIG_NAME || 'OwlAir-Intelligence'}-${timestampSlug()}`;

  const webhookUrl = process.env.TWILIO_INTELLIGENCE_WEBHOOK_URL;
  const actions = webhookUrl
    ? [{ type: 'WEBHOOK', method: 'POST', url: webhookUrl }]
    : [];

  const body = {
    displayName,
    description: 'Owl Airlines sentiment, next best response, and summary',
    rules: [
      {
        operators: [{ id: sentimentOperatorId }],
        triggers: [{ on: 'COMMUNICATION', parameters: { count: 1 } }],
        actions,
        context: { memory: { enabled: true } },
      },
      {
        operators: [{ id: nextBestResponseOperatorId }],
        triggers: [{ on: 'COMMUNICATION', parameters: { count: 1 } }],
        actions,
        context: { memory: { enabled: true } },
      },
      {
        operators: [{ id: summaryOperatorId }],
        triggers: [{ on: 'CONVERSATION_END' }],
        actions,
        context: { memory: { enabled: true } },
      },
    ],
  };

  console.log(`Creating Intelligence Configuration: ${displayName}`);
  console.log(`POST ${INTELLIGENCE_CONFIG_URL}`);
  prettyPrint(body);
  console.log('');

  const response = await twilioRequest('POST', INTELLIGENCE_CONFIG_URL, body);
  prettyPrint(response);
  console.log('');

  const id = await extractOperationResultId(response, 'Intelligence Configuration creation');
  return { id, displayName, response };
}

if (isMainModule(import.meta.url)) {
  loadEnv();
  requireTwilioAuth();
  const { id } = await createIntelligenceConfig();
  console.log('Intelligence Configuration created:');
  console.log(`TWILIO_INTELLIGENCE_CONFIGURATION_ID=${id}`);
}
