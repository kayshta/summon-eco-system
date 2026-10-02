import { maskSecret, writeEnvValues } from './env-config.js';
import { resetTwilioClient, invalidateTwilioQuotaCache } from './whatsapp.js';

const ENV_KEYS = {
  accountSid: 'TWILIO_ACCOUNT_SID',
  authToken: 'TWILIO_AUTH_TOKEN',
  whatsappFrom: 'TWILIO_WHATSAPP_FROM',
  whatsappToPrefix: 'TWILIO_WHATSAPP_TO_PREFIX'
};

export function getTwilioConfig() {
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';

  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authTokenMasked: maskSecret(authToken),
    hasAuthToken: Boolean(authToken),
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
    whatsappToPrefix: process.env.TWILIO_WHATSAPP_TO_PREFIX || 'whatsapp:'
  };
}

export function updateTwilioConfig({
  accountSid,
  authToken,
  whatsappFrom,
  whatsappToPrefix,
  updateAuthToken = false
}) {
  const envUpdates = {};

  if (accountSid !== undefined) {
    envUpdates[ENV_KEYS.accountSid] = accountSid.trim();
  }

  if (updateAuthToken && authToken !== undefined) {
    envUpdates[ENV_KEYS.authToken] = authToken.trim();
  }

  if (whatsappFrom !== undefined) {
    envUpdates[ENV_KEYS.whatsappFrom] = whatsappFrom.trim();
  }

  if (whatsappToPrefix !== undefined) {
    envUpdates[ENV_KEYS.whatsappToPrefix] = whatsappToPrefix.trim();
  }

  if (Object.keys(envUpdates).length === 0) {
    return getTwilioConfig();
  }

  writeEnvValues(envUpdates);
  resetTwilioClient();
  invalidateTwilioQuotaCache();

  return getTwilioConfig();
}
