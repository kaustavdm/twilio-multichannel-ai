// Create a demo Owl Airlines passenger profile.
//
// Usage:
//   node helpers/profile/2_create_profile.js
//   node helpers/profile/2_create_profile.js <TWILIO_MEMORY_STORE_ID>
//   npm run profile:create

import {
  isMainModule,
  loadEnv,
  prettyPrint,
  promptYesNo,
  requireEnv,
  requireTwilioAuth,
  twilioRequest,
} from '../common.js';

export async function createPassengerProfile({ memoryStoreId } = {}) {
  const storeId = memoryStoreId || requireEnv('TWILIO_MEMORY_STORE_ID');
  const phone =
    process.env.DEMO_PASSENGER_PHONE_NUMBER ||
    process.env.DEMO_CALLER_PHONE_NUMBER ||
    '+15557654321';

  const url = `https://memory.twilio.com/v1/Stores/${storeId}/Profiles`;
  const body = {
    traits: {
      Contact: {
        firstName: 'Avery',
        lastName: 'Stone',
        phone,
        email: 'avery.stone@example.com',
      },
      Loyalty: {
        memberNumber: 'OWL-4821',
        tier: 'Gold',
        milesBalance: 84200,
      },
      Travel: {
        seatPreference: 'window seat near the front',
        mealPreference: 'vegetarian',
        accessibilityNeeds: 'none',
      },
    },
  };

  console.log('Creating Passenger Profile...');
  console.log(`POST ${url}`);
  prettyPrint(body);
  console.log('');

  let response;
  try {
    response = await twilioRequest('POST', url, body);
  } catch (err) {
    if (/already exists/i.test(err.message || '')) {
      console.log('');
      console.log('Passenger Profile appears to already exist:');
      console.log(err.message);
      console.log('');
      const reuse = await promptYesNo('Reuse the existing Passenger Profile and continue?');
      if (!reuse) {
        console.error('Aborting: user declined to reuse existing Passenger Profile.');
        process.exit(1);
      }
      const existingId = process.env.TWILIO_MEMORY_PROFILE_ID;
      if (!existingId) {
        console.error('No TWILIO_MEMORY_PROFILE_ID configured to reuse.');
        console.error('Set TWILIO_MEMORY_PROFILE_ID in .env, then rerun.');
        process.exit(1);
      }
      return { id: existingId, memoryStoreId: storeId, response: null };
    }
    throw err;
  }
  prettyPrint(response);
  console.log('');

  const profileId = response?.id || response?.profileId;
  if (!profileId) {
    throw new Error('Could not find profile ID in response.');
  }
  return { id: profileId, memoryStoreId: storeId, response };
}

if (isMainModule(import.meta.url)) {
  loadEnv();
  requireTwilioAuth();
  const memoryStoreId = process.argv[2] || undefined;
  const { id } = await createPassengerProfile({ memoryStoreId });
  console.log('Passenger Profile created:');
  console.log(`TWILIO_MEMORY_PROFILE_ID=${id}`);
}
