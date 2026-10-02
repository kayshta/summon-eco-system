import { maskSecret, writeEnvValues } from './env-config.js';

const DEFAULT_API_URL = 'https://textlinksms.com/api/send-sms';

export function getTextLinkConfig() {
  const apiKey = process.env.TEXTLINK_API_KEY || '';

  return {
    apiKeyMasked: maskSecret(apiKey),
    hasApiKey: Boolean(apiKey),
    apiUrl: process.env.TEXTLINK_API_URL || DEFAULT_API_URL,
    simCardId: process.env.TEXTLINK_SIM_CARD_ID || ''
  };
}

export function updateTextLinkConfig({
  apiKey,
  apiUrl,
  simCardId,
  updateApiKey = false
}) {
  const envUpdates = {};

  if (updateApiKey && apiKey !== undefined) {
    envUpdates.TEXTLINK_API_KEY = apiKey.trim();
  }

  if (apiUrl !== undefined) {
    envUpdates.TEXTLINK_API_URL = apiUrl.trim() || DEFAULT_API_URL;
  }

  if (simCardId !== undefined) {
    envUpdates.TEXTLINK_SIM_CARD_ID = simCardId.trim();
  }

  if (Object.keys(envUpdates).length === 0) {
    return getTextLinkConfig();
  }

  writeEnvValues(envUpdates);
  return getTextLinkConfig();
}
