// Attach a Conversation Intelligence configuration to the Conversation
// Orchestrator configuration.
//
// Usage:
//   node helpers/setup/4_update_conversation_config.js
//   node helpers/setup/4_update_conversation_config.js <INTELLIGENCE_CONFIG_ID>
//   node helpers/setup/4_update_conversation_config.js <CONVERSATION_CONFIG_ID> <INTELLIGENCE_CONFIG_ID>
//   npm run setup:attach-intelligence

import {
  isMainModule,
  loadEnv,
  parseTrailingIdArgs,
  prettyPrint,
  requireTwilioAuth,
  sleep,
  twilioRequest,
  waitForOperation,
} from '../common.js';

export async function attachIntelligenceConfig({
  conversationConfigId,
  intelligenceConfigId,
} = {}) {
  const convoId = conversationConfigId || process.env.TWILIO_CONVERSATION_CONFIGURATION_ID;
  const intelId = intelligenceConfigId || process.env.TWILIO_INTELLIGENCE_CONFIGURATION_ID;

  if (!convoId) {
    console.error('Missing TWILIO_CONVERSATION_CONFIGURATION_ID.');
    process.exit(1);
  }
  if (!intelId) {
    console.error('Missing TWILIO_INTELLIGENCE_CONFIGURATION_ID.');
    process.exit(1);
  }

  const url = `https://conversations.twilio.com/v2/ControlPlane/Configurations/${convoId}`;

  console.log('Reading Conversation Configuration...');
  console.log(`GET ${url}`);
  console.log('');

  const current = await twilioRequest('GET', url);

  const pick = ({
    displayName,
    description,
    conversationGroupingType,
    memoryStoreId,
    memoryExtractionEnabled,
    channelSettings,
    statusCallbacks,
    conversationsV1Bridge,
  }) => ({
    displayName,
    description,
    conversationGroupingType,
    memoryStoreId,
    memoryExtractionEnabled,
    channelSettings,
    statusCallbacks,
    conversationsV1Bridge,
  });

  const requestBody = Object.fromEntries(
    Object.entries(pick(current)).filter(([, v]) => v !== null && v !== undefined),
  );
  requestBody.description = 'Owl Airlines Conversation Orchestrator with Memory and Intelligence';
  requestBody.memoryExtractionEnabled = true;
  requestBody.intelligenceConfigurationIds = [intelId];

  console.log('Attaching Intelligence Configuration...');
  console.log(`PUT ${url}`);
  prettyPrint(requestBody);
  console.log('');

  const response = await twilioRequest('PUT', url, requestBody);
  prettyPrint(response);

  if (response?.statusUrl) {
    await waitForOperation(response.statusUrl, 'Conversation Configuration update');
  }

  console.log('');
  console.log('Verifying Conversation Configuration...');

  for (let attempt = 1; attempt <= 5; attempt++) {
    const updated = await twilioRequest('GET', url);
    const attached = Array.isArray(updated?.intelligenceConfigurationIds)
      && updated.intelligenceConfigurationIds.includes(intelId);

    if (attached) {
      console.log('Verified Intelligence Configuration is attached.');
      return { conversationConfigId: convoId, intelligenceConfigId: intelId };
    }

    if (attempt === 5) {
      console.error('Could not verify Intelligence Configuration attachment yet.');
      console.error('Check the Conversation Configuration manually:');
      console.error(url);
      process.exit(1);
    }

    console.log('Waiting for Conversation Configuration to reflect the update...');
    await sleep(3000);
  }
  return { conversationConfigId: convoId, intelligenceConfigId: intelId };
}

if (isMainModule(import.meta.url)) {
  loadEnv();
  requireTwilioAuth();

  const options = parseTrailingIdArgs(process.argv, 'conversationConfigId', 'intelligenceConfigId');
  const result = await attachIntelligenceConfig(options);
  console.log('');
  console.log('Conversation Configuration linked to Intelligence:');
  console.log(`TWILIO_CONVERSATION_CONFIGURATION_ID=${result.conversationConfigId}`);
  console.log(`TWILIO_INTELLIGENCE_CONFIGURATION_ID=${result.intelligenceConfigId}`);
}
