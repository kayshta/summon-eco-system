import axios from 'axios';

function normalizeSmsPhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    throw new Error('Phone number is required');
  }

  let cleaned = phoneNumber.replace(/^whatsapp:/i, '').replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  if (cleaned.startsWith('00')) {
    return `+${cleaned.substring(2)}`;
  }

  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || '91';
  if (cleaned.length === 10) {
    return `+${defaultCountryCode}${cleaned}`;
  }

  return `+${defaultCountryCode}${cleaned}`;
}

export async function sendTextLinkMessage(to, text) {
  const apiKey = process.env.TEXTLINK_API_KEY;
  const apiUrl = process.env.TEXTLINK_API_URL || 'https://textlinksms.com/api/send-sms';

  if (!apiKey) {
    return {
      messageId: null,
      status: 'failed',
      to,
      error: 'TextLink API key is not configured',
      provider: 'textlink'
    };
  }

  try {
    const phoneNumber = normalizeSmsPhoneNumber(to.trim());
    const payload = {
      phone_number: phoneNumber,
      text
    };

    if (process.env.TEXTLINK_SIM_CARD_ID) {
      payload.sim_card_id = parseInt(process.env.TEXTLINK_SIM_CARD_ID, 10);
    }

    console.log(`[TextLink] Sending SMS to: ${phoneNumber}`);

    const response = await axios.post(apiUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      timeout: 30000
    });

    if (response.data?.ok === false) {
      return {
        messageId: null,
        status: 'failed',
        to: phoneNumber,
        error: response.data.message || 'TextLink rejected the message',
        provider: 'textlink'
      };
    }

    console.log('[TextLink] Message sent successfully');

    return {
      messageId: response.data?.id || `textlink-${Date.now()}`,
      status: 'sent',
      to: phoneNumber,
      error: null,
      provider: 'textlink',
      mockMode: false
    };
  } catch (error) {
    const errorMessage = error.response?.data?.message
      || error.response?.data?.error
      || error.message
      || 'Failed to send TextLink message';

    console.error('[TextLink] Send error:', errorMessage);

    return {
      messageId: null,
      status: 'failed',
      to,
      error: errorMessage,
      provider: 'textlink'
    };
  }
}
