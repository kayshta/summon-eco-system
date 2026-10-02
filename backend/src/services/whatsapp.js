import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMessagingProvider } from './messaging-config.js';
import { sendTextLinkMessage } from './textlink.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Conditionally initialize Twilio client
let client = null;
let twilioAvailable = false;
let twilioInitialized = false;

/**
 * Initialize Twilio client if credentials are available
 */
export async function initializeTwilio() {
  if (twilioInitialized) {
    return twilioAvailable;
  }
  
  twilioInitialized = true;
  
  try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      // Dynamic import for Twilio
      const twilioModule = await import('twilio');
      const twilio = twilioModule.default;
      client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      twilioAvailable = true;
      console.log('[WhatsApp] Twilio client initialized');
      return true;
    } else {
      console.log('[WhatsApp] Twilio credentials not found. Running in MOCK mode (messages will be logged only).');
      return false;
    }
  } catch (error) {
    console.warn('[WhatsApp] Twilio package not available or initialization failed. Running in MOCK mode:', error.message);
    twilioAvailable = false;
    return false;
  }
}

export function resetTwilioClient() {
  client = null;
  twilioAvailable = false;
  twilioInitialized = false;
  console.log('[WhatsApp] Twilio client reset — will reinitialize on next send');
}

const SCHOOL_NAME = process.env.SCHOOL_NAME || 'Shree Durga Sec.';
const MOCK_LOG_FILE = process.env.WHATSAPP_MOCK_LOG_FILE || path.join(__dirname, '../../whatsapp_mock_logs.txt');

// WhatsApp message templates
const templates = {
  summon_student: (data) => {
    return `[${SCHOOL_NAME}] — Student called to office

Name: ${data.student_name}
Class: ${data.class_name}  Roll: ${data.roll_no}
Section: ${data.section}
Reason: ${data.reason}
Time: ${data.timestamp}

Please send the student to the head office.`;
  },

  qr_scan_confirmation: (data) => {
    return `[${SCHOOL_NAME}] — QR scanned

Teacher: ${data.teacher_name}
Class: ${data.class_name}
Time: ${data.timestamp}`;
  },

  no_teacher_present: (data) => {
    return `[${SCHOOL_NAME}] — No teacher present for Class ${data.class_name}

Student: ${data.student_name} (Roll ${data.roll_no})
Please advise next steps.`;
  },

  sandbox_join_instructions: (data) => {
    const joinCode = data.join_code;
    const sandboxNumber = data.sandbox_number;
    
    if (joinCode) {
      // Auto-invitation with join code provided
      return `[${SCHOOL_NAME}] — WhatsApp Setup Required

Hello ${data.teacher_name},

To receive WhatsApp messages from ${SCHOOL_NAME}, please join our WhatsApp service by following these simple steps:

📱 STEP 1: Copy this message:
${joinCode}

📱 STEP 2: Open WhatsApp and send the above message to:
${sandboxNumber}

✅ STEP 3: Wait for confirmation from Twilio (usually instant)

Once you join, you'll automatically receive:
• Student summon notifications
• QR scan confirmations  
• Important school updates

If you have any questions, please contact the admin.

Thank you!`;
    } else {
      // Fallback to manual instructions if join code not configured
      return `[${SCHOOL_NAME}] — WhatsApp Setup Required

Hello ${data.teacher_name},

To receive WhatsApp messages from ${SCHOOL_NAME}, please join our WhatsApp service:

1. Get the join code from your Twilio Console:
   - Visit: https://console.twilio.com/
   - Go to: Messaging → Try it out → Send a WhatsApp message
   - Copy the join code (e.g., "join abc-xyz")

2. Send the join code to: ${sandboxNumber}

3. Wait for confirmation from Twilio

Once you join, you'll receive all school notifications via WhatsApp.

Thank you!`;
    }
  },

  whatsapp_verified_welcome: (data) => {
    return `[${SCHOOL_NAME}] — WhatsApp Verified ✅

Hello ${data.teacher_name},

Your WhatsApp number has been successfully verified!

You will now receive:
• Student summon notifications
• QR scan confirmations
• Important school updates

Your number: ${data.phone_number}

If you need to update your number, please contact the admin.

Welcome to ${SCHOOL_NAME} WhatsApp notifications!`;
  }
};

/**
 * Normalize phone number to E.164 format for WhatsApp
 * @param {string} phoneNumber - Phone number in any format
 * @returns {string} - Normalized phone number with country code
 */
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    throw new Error('Phone number is required');
  }

  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // If it already starts with +, return as is (assuming it's in E.164 format)
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If it starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
    return cleaned;
  }

  // If it doesn't start with +, assume it needs country code
  // For India, add +91 if number starts with 0 or doesn't have country code
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1); // Remove leading 0
  }

  // If number is 10 digits and doesn't have country code, use default country code
  const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || '91';
  if (cleaned.length === 10 && !cleaned.startsWith('+')) {
    cleaned = '+' + defaultCountryCode + cleaned;
  }

  // If still no + prefix, add default country code
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + defaultCountryCode + cleaned;
  }

  return cleaned;
}

let quotaCache = null;
let quotaCacheTime = 0;
const QUOTA_CACHE_MS = 60 * 1000;

/**
 * Count outbound WhatsApp messages from Twilio message history.
 */
async function countOutboundWhatsAppMessages(client, { thisMonthOnly = false } = {}) {
  let sent = 0;
  const listOptions = { pageSize: 100 };

  if (thisMonthOnly) {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    listOptions.dateSentAfter = startOfMonth;
  }

  await client.messages.each(listOptions, (message) => {
    const isWhatsApp = message.to?.includes('whatsapp') || message.from?.includes('whatsapp');
    const isOutbound = message.direction === 'outbound-api' || message.direction === 'outbound-reply';
    if (isWhatsApp && isOutbound) {
      sent += 1;
    }
  });

  return sent;
}

/**
 * Get Twilio WhatsApp message quota (trial free units or account balance).
 */
export async function getTwilioMessageQuota({ forceRefresh = false } = {}) {
  const provider = getMessagingProvider();

  if (provider === 'textlink') {
    const hasApiKey = Boolean(process.env.TEXTLINK_API_KEY);
    return {
      available: hasApiKey,
      mockMode: !hasApiKey,
      provider: 'textlink',
      message: hasApiKey
        ? 'Using TextLink SMS gateway'
        : 'TextLink API key not configured',
      sent: null,
      remaining: null,
      limit: null,
      accountType: hasApiKey ? 'TextLink' : null
    };
  }

  if (!forceRefresh && quotaCache && Date.now() - quotaCacheTime < QUOTA_CACHE_MS) {
    return quotaCache;
  }

  const hasTwilio = await initializeTwilio();
  if (!hasTwilio || !client) {
    const result = {
      available: false,
      mockMode: true,
      provider: 'twilio',
      message: 'Twilio not configured — running in mock mode',
      sent: 0,
      remaining: null,
      limit: null,
      accountType: null
    };
    quotaCache = result;
    quotaCacheTime = Date.now();
    return result;
  }

  try {
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    const isTrial = account.type === 'Trial';
    const limit = parseInt(process.env.TWILIO_WHATSAPP_MESSAGE_LIMIT || '100', 10);
    const sent = await countOutboundWhatsAppMessages(client, { thisMonthOnly: !isTrial });
    const remaining = isTrial ? Math.max(0, limit - sent) : null;

    let balance = null;
    let balanceCurrency = null;
    try {
      const balanceData = await client.balance.fetch();
      balance = Math.round(parseFloat(balanceData.balance) * 100) / 100;
      balanceCurrency = balanceData.currency;
    } catch (balanceError) {
      console.warn('[WhatsApp] Could not fetch Twilio balance:', balanceError.message);
    }

    const result = {
      available: true,
      mockMode: false,
      provider: 'twilio',
      accountType: account.type,
      accountStatus: account.status,
      limit: isTrial ? limit : null,
      sent,
      remaining,
      balance,
      balanceCurrency,
      lowQuota: isTrial && remaining !== null && remaining <= 10,
      message: isTrial
        ? `${remaining} of ${limit} trial WhatsApp messages remaining`
        : `Account balance: ${balance} ${balanceCurrency}. ${sent} WhatsApp messages sent this month.`
    };

    quotaCache = result;
    quotaCacheTime = Date.now();
    return result;
  } catch (error) {
    console.error('[WhatsApp] Error fetching message quota:', error);
    return {
      available: false,
      mockMode: false,
      error: error.message || 'Failed to fetch Twilio quota',
      sent: 0,
      remaining: null,
      limit: null
    };
  }
}

export function invalidateTwilioQuotaCache() {
  quotaCache = null;
  quotaCacheTime = 0;
}

/**
 * Log message to file in mock mode
 */
function logMockMessage(to, messageBody, templateName) {
  const timestamp = new Date().toISOString();
  const logEntry = `
========================================
[${timestamp}] MOCK WhatsApp Message
To: ${to}
Template: ${templateName}
----------------------------------------
${messageBody}
========================================

`;

  // Log to console
  console.log('\n📱 [MOCK WhatsApp Message]');
  console.log(`To: ${to}`);
  console.log(`Template: ${templateName}`);
  console.log('---');
  console.log(messageBody);
  console.log('---\n');

  // Log to file
  try {
    fs.appendFileSync(MOCK_LOG_FILE, logEntry, 'utf8');
    console.log(`[WhatsApp] Mock message logged to: ${MOCK_LOG_FILE}`);
  } catch (error) {
    console.warn(`[WhatsApp] Could not write to log file: ${error.message}`);
  }
}

export async function sendWhatsAppMessage(to, templateName, data) {
  const messageBody = templates[templateName](data);
  const provider = getMessagingProvider();

  if (provider === 'textlink') {
    return sendTextLinkMessage(to, messageBody);
  }

  let fromNumber = null; // Track FROM number for error reporting
  
  try {
    // Initialize Twilio if not already done
    const hasTwilio = await initializeTwilio();
    
    // If in mock mode (no Twilio), log the message instead
    if (!hasTwilio || !client) {
      logMockMessage(to, messageBody, templateName);
      
      console.warn(`[WhatsApp] MOCK MODE: Message not actually sent. To enable real WhatsApp messages, configure Twilio credentials in .env file.`);
      console.warn(`[WhatsApp] Message would be sent to: ${to}`);
      console.warn(`[WhatsApp] Template: ${templateName}`);
      
      return {
        messageId: 'mock-' + Date.now(),
        status: 'mock_sent',
        to,
        error: null,
        mockMode: true,
        warning: 'Running in MOCK mode. Configure Twilio credentials to send real messages.'
      };
    }

    // Validate WhatsApp FROM number is configured
    if (!process.env.TWILIO_WHATSAPP_FROM) {
      console.warn('TWILIO_WHATSAPP_FROM not configured. Using default sandbox number.');
      console.warn('Please set TWILIO_WHATSAPP_FROM in your .env file with your Twilio WhatsApp number.');
    }

    if (!to || !to.trim()) {
      throw new Error('Recipient phone number is required');
    }

    fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
    
    // Validate and normalize from number
    if (!fromNumber.startsWith('whatsapp:')) {
      // If it doesn't start with whatsapp:, add it
      if (fromNumber.startsWith('+')) {
        fromNumber = 'whatsapp:' + fromNumber;
      } else {
        throw new Error(`Invalid TWILIO_WHATSAPP_FROM format. Should be "whatsapp:+14155238886" or "+14155238886". Current: ${fromNumber}`);
      }
    }

    // Log the from number being used (for debugging)
    console.log(`[WhatsApp] Using FROM number: ${fromNumber}`);
    
    // Normalize phone number
    let normalizedPhone;
    try {
      normalizedPhone = normalizePhoneNumber(to.trim());
    } catch (normalizeError) {
      throw new Error(`Invalid phone number format: ${to}. ${normalizeError.message}`);
    }

    // Format for WhatsApp
    const toNumber = normalizedPhone.startsWith('whatsapp:') 
      ? normalizedPhone 
      : `whatsapp:${normalizedPhone}`;

    console.log(`[WhatsApp] Sending message to: ${toNumber} (original: ${to})`);

    if (!client) {
      throw new Error('Twilio client not initialized');
    }

    const message = await client.messages.create({
      from: fromNumber,
      to: toNumber,
      body: messageBody
    });

    console.log(`[WhatsApp] Message sent successfully. SID: ${message.sid}, Status: ${message.status}`);
    invalidateTwilioQuotaCache();

    return {
      messageId: message.sid,
      status: message.status,
      to: toNumber,
      error: null,
      mockMode: false
    };
  } catch (error) {
    // Extract detailed error information
    let errorMessage = 'Unknown error';
    let errorCode = null;

    if (error.response) {
      // Twilio API error
      errorCode = error.response.status;
      errorMessage = error.response.data?.message || error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Common Twilio error codes
    if (error.code) {
      errorCode = error.code;
      switch (error.code) {
        case 21211:
          errorMessage = 'Invalid phone number format. Please ensure the number includes country code (e.g., +91XXXXXXXXXX)';
          break;
        case 21608:
          errorMessage = 'UNSUBSCRIBED: This phone number has not joined the Twilio WhatsApp sandbox. The recipient must send the join code to Twilio first.';
          break;
        case 21614:
          errorMessage = 'NOT_REGISTERED: This WhatsApp number is not registered in the Twilio sandbox. The recipient must join the sandbox first.';
          break;
        case 21212:
          errorMessage = 'Invalid "from" phone number. Please check TWILIO_WHATSAPP_FROM in your .env file.';
          break;
        default:
          errorMessage = error.message || `Twilio error: ${error.code}`;
      }
    }

    // Check for specific error messages about channel/from address
    if (error.message && error.message.toLowerCase().includes('could not find the channel')) {
      const currentFrom = process.env.TWILIO_WHATSAPP_FROM || 'NOT SET';
      const fromNumberUsed = fromNumber || currentFrom;
      
      errorMessage = `Twilio WhatsApp channel not found. The FROM number "${fromNumberUsed}" is not available in your Twilio account.

FIX STEPS:
1. Go to Twilio Console: https://console.twilio.com/
2. Navigate to: Messaging → Try it out → Send a WhatsApp message
3. Copy the EXACT WhatsApp number shown there (e.g., +14155238886)
4. Update backend/.env: TWILIO_WHATSAPP_FROM=whatsapp:+[NUMBER_FROM_CONSOLE]
5. Make sure the number matches EXACTLY (including + sign)
6. Restart your backend server

Current FROM in .env: ${currentFrom}
FROM number used: ${fromNumberUsed}

The number in your .env must match EXACTLY what's shown in Twilio Console.`;
      errorCode = 'CHANNEL_NOT_FOUND';
      
      console.error('[WhatsApp] CHANNEL NOT FOUND ERROR:');
      console.error(`  FROM number used: ${fromNumberUsed}`);
      console.error(`  FROM in .env: ${currentFrom}`);
      console.error('  → The number must match EXACTLY what\'s in Twilio Console');
    }

    console.error('[WhatsApp] Send error details:', {
      code: errorCode,
      message: errorMessage,
      to: to,
      error: error
    });

    // Return error details instead of throwing
    return {
      messageId: null,
      status: 'failed',
      to: to,
      error: errorMessage,
      errorCode: errorCode,
      needsSandboxJoin: errorCode === 21608 || errorCode === 21614
    };
  }
}

/**
 * Get WhatsApp sandbox join code and instructions
 * This helps teachers join the Twilio WhatsApp sandbox
 */
export async function getWhatsAppSandboxInfo() {
  try {
    // Initialize Twilio if not already done
    const hasTwilio = await initializeTwilio();
    
    if (!hasTwilio || !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return {
        error: 'Twilio credentials not configured - running in MOCK mode',
        joinCode: null,
        instructions: 'In MOCK mode, WhatsApp messages are logged to console and file only. No actual messages are sent.',
        mockMode: true,
        sandboxNumber: 'N/A (Mock Mode)',
        fromNumber: 'N/A (Mock Mode)'
      };
    }

    // Get the FROM number (sandbox number)
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
    const sandboxNumber = fromNumber.replace('whatsapp:', '');

    // Get join code from environment variable if configured
    const joinCode = process.env.TWILIO_WHATSAPP_JOIN_CODE || null;

    // Generate instructions based on whether join code is available
    let instructions;
    if (joinCode) {
      instructions = `To join the WhatsApp sandbox:
1. Copy this message: ${joinCode}
2. Open WhatsApp and send it to: ${sandboxNumber}
3. Wait for confirmation from Twilio (usually instant)
4. After joining, you can receive messages from the system`;
    } else {
      instructions = `To join the WhatsApp sandbox:
1. Open your Twilio Console: https://console.twilio.com/
2. Go to Messaging → Try it out → Send a WhatsApp message
3. You'll see a join code (e.g., "join abc-xyz")
4. Send this code to ${sandboxNumber} from your WhatsApp
5. Twilio will confirm you've joined the sandbox
6. After joining, you can receive messages from the system`;
    }

    return {
      sandboxNumber: sandboxNumber,
      joinCode: joinCode || 'Get from Twilio Console',
      hasJoinCode: !!joinCode,
      instructions: instructions,
      fromNumber: fromNumber
    };
  } catch (error) {
    console.error('Error getting sandbox info:', error);
    return {
      error: error.message,
      joinCode: null,
      instructions: null
    };
  }
}

