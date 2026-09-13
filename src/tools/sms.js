import twilio from 'twilio';
import { DEMO_CALLER_PHONE_NUMBER, TWILIO_PHONE_NUMBER } from '../core/config.js';

let cachedClient = null;

function client() {
  if (cachedClient) return cachedClient;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  if (!accountSid || !apiKey || !apiSecret) {
    throw new Error(
      'Twilio credentials missing: set TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET.',
    );
  }
  cachedClient = twilio(apiKey, apiSecret, { accountSid });
  return cachedClient;
}

function resolveCallerNumber(context) {
  const authorAddress =
    context?.authorInfo?.address ??
    context?.author_info?.address ??
    context?.author?.address;
  return authorAddress ?? DEMO_CALLER_PHONE_NUMBER;
}

export const sendTextMessageSchema = {
  type: 'function',
  function: {
    name: 'send_text_message',
    description:
      'Send the caller a short text message with useful information, a link, ' +
      'or next steps. Use when the caller asks for details in writing or when ' +
      'a text confirmation would help them continue after the call.',
    parameters: {
      type: 'object',
      properties: {
        message_body: {
          type: 'string',
          description:
            'The text message body. Keep it under 320 characters and include ' +
            "only information relevant to the caller's request.",
        },
      },
      required: ['message_body'],
    },
  },
};

export async function sendTextMessage(args, { context } = {}) {
  const messageBody = args?.message_body;
  const toNumber = resolveCallerNumber(context);
  if (!toNumber) {
    return { status: 'failed', error: 'No caller number available.' };
  }

  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const payload = { to: toNumber, body: messageBody };
  if (messagingServiceSid) {
    payload.messagingServiceSid = messagingServiceSid;
  } else if (TWILIO_PHONE_NUMBER) {
    payload.from = TWILIO_PHONE_NUMBER;
  } else {
    return {
      status: 'failed',
      error: 'No sender configured: set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER.',
    };
  }

  const message = await client().messages.create(payload);
  return {
    sid: message.sid,
    to: toNumber,
    status: message.status,
    body: messageBody,
  };
}
