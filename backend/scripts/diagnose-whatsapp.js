/**
 * WhatsApp Integration Diagnostic Script
 * 
 * This script checks all aspects of your Twilio WhatsApp integration
 * and provides detailed diagnostics.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

console.log('\n========================================');
console.log('WhatsApp Integration Diagnostics');
console.log('========================================\n');

// Check 1: .env file exists
console.log('1. Checking .env file...');
if (fs.existsSync(envPath)) {
  console.log('   ✅ .env file exists');
} else {
  console.log('   ❌ .env file NOT FOUND');
  console.log('   📝 ACTION: Copy backend/env.example to backend/.env');
  console.log('   📝 Then fill in your Twilio credentials\n');
}

// Check 2: Twilio credentials
console.log('\n2. Checking Twilio credentials...');
const hasAccountSid = !!process.env.TWILIO_ACCOUNT_SID;
const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
const hasFromNumber = !!process.env.TWILIO_WHATSAPP_FROM;
const hasJoinCode = !!process.env.TWILIO_WHATSAPP_JOIN_CODE;

if (hasAccountSid) {
  console.log(`   ✅ TWILIO_ACCOUNT_SID is set: ${process.env.TWILIO_ACCOUNT_SID.substring(0, 10)}...`);
} else {
  console.log('   ❌ TWILIO_ACCOUNT_SID is MISSING');
  console.log('   📝 ACTION: Add TWILIO_ACCOUNT_SID=your_account_sid to .env');
}

if (hasAuthToken) {
  console.log(`   ✅ TWILIO_AUTH_TOKEN is set: ${process.env.TWILIO_AUTH_TOKEN.substring(0, 10)}...`);
} else {
  console.log('   ❌ TWILIO_AUTH_TOKEN is MISSING');
  console.log('   📝 ACTION: Add TWILIO_AUTH_TOKEN=your_auth_token to .env');
}

if (hasFromNumber) {
  console.log(`   ✅ TWILIO_WHATSAPP_FROM is set: ${process.env.TWILIO_WHATSAPP_FROM}`);
  
  // Validate format
  if (process.env.TWILIO_WHATSAPP_FROM.startsWith('whatsapp:+')) {
    console.log('   ✅ Format is correct (starts with whatsapp:+)');
  } else if (process.env.TWILIO_WHATSAPP_FROM.startsWith('+')) {
    console.log('   ⚠️  Format missing "whatsapp:" prefix');
    console.log('   📝 ACTION: Change to: whatsapp:' + process.env.TWILIO_WHATSAPP_FROM);
  } else {
    console.log('   ❌ Invalid format');
    console.log('   📝 ACTION: Should be: whatsapp:+14155238886 (or your Twilio WhatsApp number)');
  }
} else {
  console.log('   ❌ TWILIO_WHATSAPP_FROM is MISSING');
  console.log('   📝 ACTION: Add TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 to .env');
  console.log('   📝 Get your number from: Twilio Console > Messaging > Try it out > Send a WhatsApp message');
}

if (hasJoinCode) {
  console.log(`   ✅ TWILIO_WHATSAPP_JOIN_CODE is set: ${process.env.TWILIO_WHATSAPP_JOIN_CODE}`);
} else {
  console.log('   ⚠️  TWILIO_WHATSAPP_JOIN_CODE is not set (optional but recommended)');
  console.log('   📝 ACTION: Add TWILIO_WHATSAPP_JOIN_CODE=join your-code to .env');
  console.log('   📝 Get from: Twilio Console > Messaging > Try it out > Send a WhatsApp message');
}

// Check 3: Twilio package
console.log('\n3. Checking Twilio package...');
try {
  const twilioModule = await import('twilio');
  console.log('   ✅ Twilio package is installed');
} catch (error) {
  console.log('   ❌ Twilio package is NOT installed');
  console.log('   📝 ACTION: Run: npm install twilio');
  console.log(`   📝 Error: ${error.message}`);
}

// Check 4: Try to initialize Twilio
console.log('\n4. Testing Twilio initialization...');
if (hasAccountSid && hasAuthToken) {
  try {
    const twilioModule = await import('twilio');
    const twilio = twilioModule.default;
    const testClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    console.log('   ✅ Twilio client initialized successfully');
    
    // Try to fetch account info (this validates credentials)
    try {
      const account = await testClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      console.log(`   ✅ Credentials are valid (Account: ${account.friendlyName || 'N/A'})`);
      console.log(`   ✅ Account Status: ${account.status}`);
    } catch (authError) {
      console.log('   ❌ Credentials are INVALID');
      console.log(`   📝 Error: ${authError.message}`);
      console.log('   📝 ACTION: Check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    }
  } catch (initError) {
    console.log('   ❌ Failed to initialize Twilio client');
    console.log(`   📝 Error: ${initError.message}`);
  }
} else {
  console.log('   ⚠️  Cannot test - missing credentials');
}

// Check 5: Phone number format
console.log('\n5. Phone number format requirements...');
console.log('   📝 Phone numbers should be in E.164 format:');
console.log('      ✅ Correct: +91XXXXXXXXXX (with country code)');
console.log('      ✅ Correct: 91XXXXXXXXXX (will be auto-converted)');
console.log('      ❌ Wrong: XXXXXXXXXX (missing country code)');
console.log('   📝 Default country code: ' + (process.env.DEFAULT_COUNTRY_CODE || '91'));

// Check 6: Sandbox requirements
console.log('\n6. WhatsApp Sandbox requirements...');
console.log('   📝 For testing, recipients MUST join the sandbox:');
console.log('      1. Get join code from Twilio Console');
console.log('      2. Send join code to your Twilio WhatsApp number from recipient\'s phone');
console.log('      3. Wait for confirmation');
console.log('      4. Then messages will work');

// Summary
console.log('\n========================================');
console.log('Summary & Next Steps');
console.log('========================================\n');

const issues = [];
if (!fs.existsSync(envPath)) issues.push('Create .env file');
if (!hasAccountSid) issues.push('Add TWILIO_ACCOUNT_SID');
if (!hasAuthToken) issues.push('Add TWILIO_AUTH_TOKEN');
if (!hasFromNumber) issues.push('Add TWILIO_WHATSAPP_FROM');

try {
  await import('twilio');
} catch {
  issues.push('Install twilio package: npm install twilio');
}

if (issues.length === 0) {
  console.log('✅ All basic checks passed!');
  console.log('\n📝 Next steps:');
  console.log('   1. Restart your backend server');
  console.log('   2. Test by calling /api/teachers/whatsapp-status');
  console.log('   3. Try sending a test WhatsApp message');
  console.log('   4. Check backend console logs for detailed error messages');
} else {
  console.log('❌ Issues found:');
  issues.forEach((issue, i) => {
    console.log(`   ${i + 1}. ${issue}`);
  });
  console.log('\n📝 After fixing, restart your backend server');
}

console.log('\n========================================\n');

