// Verify the demo passenger memory can be recalled.
//
// Usage:
//   node helpers/profile/4_verify_memory.js
//   node helpers/profile/4_verify_memory.js <TWILIO_MEMORY_PROFILE_ID>
//   node helpers/profile/4_verify_memory.js <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>
//   npm run profile:verify

import {
  isMainModule,
  loadEnv,
  prettyPrint,
  requireEnv,
  requireTwilioAuth,
  sleep,
  twilioRequest,
} from '../common.js';

const MAX_ATTEMPTS = 5;

export async function verifyPassengerMemory({ memoryStoreId, profileId } = {}) {
  const storeId = memoryStoreId || requireEnv('TWILIO_MEMORY_STORE_ID');
  const profId = profileId || requireEnv('TWILIO_MEMORY_PROFILE_ID');

  const url = `https://memory.twilio.com/v1/Stores/${storeId}/Profiles/${profId}/Recall`;
  const body = {
    query: 'Passenger seat preferences, upcoming trip, loyalty status, and rebooking needs',
    observationsLimit: 10,
    summariesLimit: 3,
  };

  console.log('Recalling Passenger Memory...');
  console.log(`POST ${url}`);
  prettyPrint(body);
  console.log('');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await twilioRequest('POST', url, body);
    const count = Array.isArray(response?.observations) ? response.observations.length : 0;

    if (count > 0) {
      prettyPrint(response);
      return response;
    }

    if (attempt === MAX_ATTEMPTS) {
      prettyPrint(response);
      console.error('');
      console.error('No observations returned yet. Observation processing may still be catching up.');
      process.exit(1);
    }

    console.log(`No observations returned yet. Waiting for Memory indexing... (${attempt}/${MAX_ATTEMPTS})`);
    await sleep(3000);
  }
}

if (isMainModule(import.meta.url)) {
  loadEnv();
  requireTwilioAuth();
  const [, , argA, argB] = process.argv;
  const options = argB
    ? { memoryStoreId: argA, profileId: argB }
    : argA
      ? { profileId: argA }
      : {};
  await verifyPassengerMemory(options);
}
