import { writeEnvValues } from './env-config.js';

const VALID_PROVIDERS = ['twilio', 'textlink'];

export function getMessagingProvider() {
  const provider = (process.env.MESSAGING_PROVIDER || 'twilio').toLowerCase();
  return VALID_PROVIDERS.includes(provider) ? provider : 'twilio';
}

export function getMessagingConfig() {
  const provider = getMessagingProvider();
  return {
    provider,
    label: provider === 'textlink' ? 'TextLink' : 'Twilio'
  };
}

export function updateMessagingProvider(provider) {
  const normalized = String(provider || '').toLowerCase();
  if (!VALID_PROVIDERS.includes(normalized)) {
    throw new Error('Messaging provider must be "twilio" or "textlink"');
  }

  writeEnvValues({ MESSAGING_PROVIDER: normalized });
  return getMessagingConfig();
}
