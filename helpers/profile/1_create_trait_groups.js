// Create trait groups for the Owl Airlines demo passenger profile.
//
// Usage:
//   node helpers/profile/1_create_trait_groups.js
//   node helpers/profile/1_create_trait_groups.js <TWILIO_MEMORY_STORE_ID>
//   npm run profile:trait-groups

import {
  isAlreadyExistsError,
  isMainModule,
  loadEnv,
  prettyPrint,
  promptYesNo,
  requireEnv,
  requireTwilioAuth,
  twilioRequest,
  waitForOperation,
} from '../common.js';

const LOYALTY_BODY = {
  displayName: 'Loyalty',
  traits: {
    memberNumber: { dataType: 'STRING', description: 'Owl Club member number' },
    tier: { dataType: 'STRING', description: 'Owl Club loyalty tier' },
    milesBalance: { dataType: 'NUMBER', description: 'Current loyalty miles balance' },
  },
};

const TRAVEL_BODY = {
  displayName: 'Travel',
  traits: {
    seatPreference: { dataType: 'STRING', description: 'Preferred aircraft seat type' },
    mealPreference: { dataType: 'STRING', description: 'Preferred in-flight meal' },
    accessibilityNeeds: { dataType: 'STRING', description: 'Accessibility or assistance needs' },
  },
};

async function findExistingTraitGroup(url, name) {
  const listing = await twilioRequest('GET', url);
  const found = [];
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value !== 'object') return;
    if (value.displayName === name || value.name === name) {
      found.push(value);
      return;
    }
    for (const v of Object.values(value)) visit(v);
  };
  visit(listing);
  return found[0] || null;
}

async function createTraitGroup(url, name, body) {
  console.log(`Creating Trait Group: ${name}`);
  console.log(`POST ${url}`);
  prettyPrint(body);
  console.log('');

  let response;
  try {
    response = await twilioRequest('POST', url, body);
  } catch (err) {
    console.error(err.message || err);
    throw err;
  }
  prettyPrint(response);
  console.log('');

  if (response?.statusUrl) {
    console.log(`Waiting for Trait Group to finish registering...`);
    try {
      await waitForOperation(response.statusUrl, `${name} Trait Group creation`);
    } catch (err) {
      if (isAlreadyExistsError(err)) {
        console.log('');
        console.log(`Trait Group "${name}" already exists on this Memory Store.`);
        console.log(`  code: ${err.errorCode}`);
        console.log(`  title: ${err.errorTitle}`);
        console.log(`  detail: ${err.errorDetail}`);
        console.log('');

        const existing = await findExistingTraitGroup(url, name);
        if (existing) {
          console.log('Existing Trait Group:');
          prettyPrint(existing);
        } else {
          console.log('Could not fetch existing Trait Group details from the listing.');
        }
        console.log('');

        const reuse = await promptYesNo(`Use existing "${name}" Trait Group and continue?`);
        if (!reuse) {
          console.error(`Aborting: user declined to reuse existing "${name}" Trait Group.`);
          process.exit(1);
        }
        console.log(`Reusing existing "${name}" Trait Group.`);
        console.log('');
        return;
      }
      console.error(JSON.stringify(err.response ?? { message: err.message }, null, 2));
      throw err;
    }
    console.log('');
  }
}

export async function createTraitGroups({ memoryStoreId } = {}) {
  const storeId = memoryStoreId || requireEnv('TWILIO_MEMORY_STORE_ID');
  const url = `https://memory.twilio.com/v1/ControlPlane/Stores/${storeId}/TraitGroups`;

  await createTraitGroup(url, 'Loyalty', LOYALTY_BODY);
  await createTraitGroup(url, 'Travel', TRAVEL_BODY);

  return { memoryStoreId: storeId };
}

if (isMainModule(import.meta.url)) {
  loadEnv();
  requireTwilioAuth();
  const memoryStoreId = process.argv[2] || undefined;
  const { memoryStoreId: id } = await createTraitGroups({ memoryStoreId });
  console.log('Trait groups created for:');
  console.log(`TWILIO_MEMORY_STORE_ID=${id}`);
}
