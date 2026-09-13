import {
  checkTripAndSeatsSchema,
  checkTripAndSeats,
} from './airline.js';
import { sendTextMessageSchema, sendTextMessage } from './sms.js';

const SCHEMAS = [checkTripAndSeatsSchema, sendTextMessageSchema];
const HANDLERS = {
  [checkTripAndSeatsSchema.function.name]: checkTripAndSeats,
  [sendTextMessageSchema.function.name]: sendTextMessage,
};

export function allSchemas() {
  return SCHEMAS.slice();
}

export function allHandlers() {
  return { ...HANDLERS };
}
