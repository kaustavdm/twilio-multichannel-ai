// Create the Conversation Orchestrator configuration.
//
// Usage:
//   node helpers/setup/2_create_conversation_config.js
//   node helpers/setup/2_create_conversation_config.js <TWILIO_MEMORY_STORE_ID>
//   npm run setup:conversation-config
//
// Docs: https://www.twilio.com/docs/conversations/conversation-orchestrator

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

const CONVERSATION_CONFIG_URL = 'https://conversations.twilio.com/v2/ControlPlane/Configurations';

export async function createConversationConfig({ memoryStoreId } = {}) {
  const twilioPhoneNumber = requireEnv('TWILIO_PHONE_NUMBER');
  const storeId = memoryStoreId || requireEnv('TWILIO_MEMORY_STORE_ID');

  const displayName = `${process.env.CONVERSATION_CONFIG_NAME || 'OwlAir'}-${timestampSlug()}`;
  const captureRules = [
    { from: twilioPhoneNumber, to: '*', metadata: {} },
    { from: '*', to: twilioPhoneNumber, metadata: {} },
  ];

  const body = {
    displayName,
    description: 'Owl Airlines omnichannel Conversation Orchestrator configuration',
    conversationGroupingType: 'GROUP_BY_PROFILE',
    memoryStoreId: storeId,
    memoryExtractionEnabled: true,
    channelSettings: {
      SMS: {
        captureRules,
        statusTimeouts: { inactive: 10, closed: 60 },
      },
      WHATSAPP: {
        captureRules,
        statusTimeouts: { inactive: 10, closed: 60 },
      },
      RCS: {
        captureRules,
        statusTimeouts: { inactive: 10, closed: 60 },
      },
      // VOICE has no passive capture rules because TAC/ConversationRelay
      // performs active ingestion.
      VOICE: { statusTimeouts: null },
    },
  };

  console.log(`Creating Conversation Configuration: ${displayName}`);
  console.log(`POST ${CONVERSATION_CONFIG_URL}`);
  prettyPrint(body);
  console.log('');
  console.log('Note: VOICE has no passive captureRules because TAC/ConversationRelay uses active ingestion.');
  console.log('');

  const response = await twilioRequest('POST', CONVERSATION_CONFIG_URL, body);
  prettyPrint(response);
  console.log('');

  const id = await extractOperationResultId(response, 'Conversation Configuration creation');
  return { id, displayName, response };
}

if (isMainModule(import.meta.url)) {
  loadEnv();
  requireTwilioAuth();
  const memoryStoreId = process.argv[2] || undefined;
  const { id } = await createConversationConfig({ memoryStoreId });
  console.log('Conversation Configuration created:');
  console.log(`TWILIO_CONVERSATION_CONFIGURATION_ID=${id}`);
}
