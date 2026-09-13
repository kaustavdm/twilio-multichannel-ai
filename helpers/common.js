// Shared helpers for the Twilio setup scripts.
//
// Loads `.env` from the repo root, exposes a Twilio-authenticated JSON
// request helper backed by the `twilio` npm package, and mirrors the
// operation-polling / resource-id extraction that the previous shell
// helpers (`helpers/common.sh`) implemented with curl + jq.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import twilio from 'twilio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const HELPERS_DIR = __dirname;
export const REPO_ROOT = path.resolve(__dirname, '..');
export const ENV_FILE = process.env.ENV_FILE || path.join(REPO_ROOT, '.env');

let envLoaded = false;
export function loadEnv() {
  if (envLoaded) return;
  dotenv.config({ path: ENV_FILE });
  envLoaded = true;
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}.`);
    console.error(`Set it in ${ENV_FILE} or export it before running setup.`);
    process.exit(1);
  }
  return value;
}

export function requireTwilioAuth() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN.');
    console.error(`Set them in ${ENV_FILE} or export them before running setup.`);
    process.exit(1);
  }
}

let cachedClient = null;
export function getTwilioClient() {
  if (cachedClient) return cachedClient;
  requireTwilioAuth();
  cachedClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );
  return cachedClient;
}

// Performs a JSON request against a Twilio API using the twilio SDK's
// underlying HTTP client. Absolute URLs are supported (needed for the
// memory/intelligence/conversations control-plane hosts).
export async function twilioRequest(method, url, body = null) {
  const client = getTwilioClient();
  const opts = {
    method,
    uri: url,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };
  if (body !== null && body !== undefined) {
    opts.data = body;
  }

  let response;
  try {
    response = await client.request(opts);
  } catch (err) {
    const status = err.status ?? err.statusCode ?? '???';
    const detail = err.details ?? err.body ?? err.message ?? '';
    const detailText = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
    throw new Error(
      `Twilio API request failed: ${method} ${url} -> HTTP ${status}\n${detailText}`,
    );
  }

  const body_ = response.body;
  if (typeof body_ === 'string') {
    try {
      return JSON.parse(body_);
    } catch {
      return body_;
    }
  }
  return body_;
}

export function extractResourceId(response) {
  if (!response || typeof response !== 'object') return null;
  return (
    response.related?.configurationId ||
    response.result?.id ||
    response.resource?.id ||
    response.id ||
    null
  );
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OperationFailedError extends Error {
  constructor(label, response) {
    super(`${label} failed.`);
    this.name = 'OperationFailedError';
    this.label = label;
    this.response = response;
    const err = response?.error || {};
    this.errorCode = err.code;
    this.errorTitle = err.title;
    this.errorDetail = err.detail;
  }
}

// Twilio Memory returns 520055 for a duplicate trait group. Other services
// use different codes but tend to include "already exists" in the title or
// detail, so match text as a fallback.
const ALREADY_EXISTS_CODES = new Set([520055]);
export function isAlreadyExistsError(err) {
  if (!(err instanceof OperationFailedError)) return false;
  if (ALREADY_EXISTS_CODES.has(Number(err.errorCode))) return true;
  const haystack = `${err.errorTitle || ''} ${err.errorDetail || ''}`.toLowerCase();
  return haystack.includes('already exists');
}

export async function waitForOperation(statusUrl, label, {
  maxAttempts = 30,
  delayMs = 2000,
} = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await twilioRequest('GET', statusUrl);
    const status = String(response?.status || '').toUpperCase();

    if (status === 'COMPLETED') {
      return response;
    }
    if (status === 'FAILED') {
      throw new OperationFailedError(label, response);
    }

    console.error(`  ${label} status: ${status.toLowerCase() || 'pending'} (${attempt}/${maxAttempts})`);
    await sleep(delayMs);
  }
  throw new Error(`${label} timed out: ${statusUrl}`);
}

// Interactive Y/n prompt. Returns the default in non-TTY environments so
// pipelines don't hang; prints the decision so the log stays honest.
export async function promptYesNo(question, { defaultYes = true } = {}) {
  const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
  if (!process.stdin.isTTY) {
    console.log(`${question}${suffix}(non-interactive; using default ${defaultYes ? 'yes' : 'no'})`);
    return defaultYes;
  }
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(question + suffix)).trim().toLowerCase();
    if (!answer) return defaultYes;
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

// If the initial response already carries a resource id, return it.
// Otherwise poll `statusUrl` until the async operation completes and
// then extract the id from the completed operation payload.
export async function extractOperationResultId(response, label) {
  const inline = extractResourceId(response);
  if (inline) return inline;

  const statusUrl = response?.statusUrl;
  if (!statusUrl) {
    console.error(JSON.stringify(response, null, 2));
    throw new Error(`Could not find resource ID or statusUrl in ${label} response.`);
  }

  const operation = await waitForOperation(statusUrl, label);
  const opId = extractResourceId(operation);
  if (!opId) {
    console.error(JSON.stringify(operation, null, 2));
    throw new Error(`Could not find resource ID in completed ${label} operation.`);
  }
  return opId;
}

export function timestampSlug(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function isMainModule(importMetaUrl) {
  const modulePath = fileURLToPath(importMetaUrl);
  const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
  return modulePath === scriptPath;
}

export function prettyPrint(value) {
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}
