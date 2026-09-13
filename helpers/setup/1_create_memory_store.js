// Create a Memory Store for Owl Airlines customer profiles.
//
// Usage:
//   node helpers/setup/1_create_memory_store.js
//   npm run setup:memory-store
//
// Docs: https://www.twilio.com/docs/api/memory/v1/Store#create-store

import {
  extractOperationResultId,
  isMainModule,
  loadEnv,
  prettyPrint,
  requireTwilioAuth,
  timestampSlug,
  twilioRequest,
} from '../common.js';

const MEMORY_STORE_URL = 'https://memory.twilio.com/v1/ControlPlane/Stores';

export async function createMemoryStore() {
  const displayName = `${process.env.MEMORY_STORE_NAME || 'OwlAir'}-${timestampSlug()}`;
  const body = {
    displayName,
    description: 'Memory store for Owl Airlines customers',
  };

  console.log(`Creating Memory Store: ${displayName}`);
  console.log(`POST ${MEMORY_STORE_URL}`);
  prettyPrint(body);
  console.log('');

  const response = await twilioRequest('POST', MEMORY_STORE_URL, body);
  prettyPrint(response);
  console.log('');

  const id = await extractOperationResultId(response, 'Memory Store creation');
  return { id, displayName, response };
}

if (isMainModule(import.meta.url)) {
  loadEnv();
  requireTwilioAuth();
  const { id } = await createMemoryStore();
  console.log('');
  console.log('Memory Store created:');
  console.log(`TWILIO_MEMORY_STORE_ID=${id}`);
}
