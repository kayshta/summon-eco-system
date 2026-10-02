# WhatsApp Integration Diagnostic Guide

This guide will help you diagnose and fix your Twilio WhatsApp integration issues.

## Step 1: Run the Diagnostic Script

First, run the diagnostic script to check your setup:

```bash
cd backend
node scripts/diagnose-whatsapp.js
```

This will check:
- ✅ .env file existence
- ✅ Twilio credentials configuration
- ✅ Twilio package installation
- ✅ Credential validity
- ✅ Phone number format requirements

## Step 2: Check WhatsApp Status Endpoint

Call the `/api/teachers/whatsapp-status` endpoint to see the current configuration:

```bash
# Using curl (replace with your auth token)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3000/api/teachers/whatsapp-status

# Or use your frontend/admin panel
```

### Understanding the Response

The endpoint returns:

```json
{
  "mode": "twilio" | "mock",
  "twilio": {
    "accountSidConfigured": true/false,
    "authTokenConfigured": true/false,
    "fromNumberConfigured": true/false,
    "joinCodeConfigured": true/false,
    "available": true/false
  },
  "message": "Status message",
  "instructions": "What to do next"
}
```

**What each field means:**

- `mode: "mock"` → Running in mock mode (messages logged, not sent)
- `mode: "twilio"` → Twilio is configured and ready
- `accountSidConfigured: false` → Missing `TWILIO_ACCOUNT_SID` in .env
- `authTokenConfigured: false` → Missing `TWILIO_AUTH_TOKEN` in .env
- `fromNumberConfigured: false` → Missing `TWILIO_WHATSAPP_FROM` in .env
- `available: false` → Twilio client failed to initialize (check package or credentials)

## Step 3: Check Backend Console Logs

When sending a WhatsApp message, watch your backend console for these log messages:

### Success Logs:
```
[WhatsApp] Twilio client initialized
[WhatsApp] Using FROM number: whatsapp:+14155238886
[WhatsApp] Sending message to: whatsapp:+91XXXXXXXXXX (original: +91XXXXXXXXXX)
[WhatsApp] Message sent successfully. SID: SM..., Status: queued
```

### Error Logs to Look For:

#### 1. Missing Credentials
```
[WhatsApp] Twilio credentials not found. Running in MOCK mode
[WhatsApp] MOCK MODE: Message not actually sent
```
**Fix:** Add Twilio credentials to `.env`

#### 2. Invalid FROM Number
```
Twilio error: Could not find the channel with the specified from address
```
**Fix:** Check `TWILIO_WHATSAPP_FROM` format and number

#### 3. Sandbox Not Joined (Error 21608/21614)
```
UNSUBSCRIBED: This phone number has not joined the Twilio WhatsApp sandbox
NOT_REGISTERED: This WhatsApp number is not registered in the Twilio sandbox
```
**Fix:** Recipient must join sandbox first

#### 4. Invalid Phone Format (Error 21211)
```
Invalid phone number format. Please ensure the number includes country code
```
**Fix:** Use format `+91XXXXXXXXXX` (with country code)

#### 5. Missing Twilio Package
```
[WhatsApp] Twilio package not available or initialization failed
```
**Fix:** Run `npm install twilio`

## Step 4: Common Issues & Fixes

### Issue 1: Missing Twilio Package

**Symptom:** `mode: "mock"` even with credentials set

**Fix:**
```bash
cd backend
npm install twilio
```

### Issue 2: Missing .env File

**Symptom:** All credentials show as `false`

**Fix:**
```bash
cd backend
cp env.example .env
# Then edit .env and add your Twilio credentials
```

### Issue 3: Wrong FROM Number Format

**Symptom:** Error: "Could not find the channel"

**Current (Wrong):**
```env
TWILIO_WHATSAPP_FROM=+14155238886
```

**Fix:**
```env
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

**Or:**
```env
TWILIO_WHATSAPP_FROM=whatsapp:+[your_twilio_whatsapp_number]
```

### Issue 4: Invalid Phone Number Format

**Symptom:** Error 21211 or messages not sending

**Wrong formats:**
- `XXXXXXXXXX` (missing country code)
- `91XXXXXXXXXX` (missing +)

**Correct format:**
- `+91XXXXXXXXXX` (with + and country code)

**Note:** The system auto-converts `91XXXXXXXXXX` to `+91XXXXXXXXXX`, but `+91` is preferred.

### Issue 5: Sandbox Not Joined

**Symptom:** Error 21608 or 21614

**Fix:**
1. Get join code from Twilio Console:
   - Go to: https://console.twilio.com/
   - Navigate: Messaging → Try it out → Send a WhatsApp message
   - Copy the join code (e.g., "join mother-load")

2. Add to .env:
   ```env
   TWILIO_WHATSAPP_JOIN_CODE=join mother-load
   ```

3. Have recipient send the join code to your Twilio WhatsApp number from their phone

4. Wait for confirmation from Twilio

5. Retry sending the message

### Issue 6: Trial Account Restrictions

**Symptom:** Messages fail with trial account errors

**Fix:**
- Twilio trial accounts can only send to verified numbers
- Upgrade your Twilio account or verify recipient numbers
- For sandbox: Recipients must join the sandbox (see Issue 5)

## Step 5: Required .env Configuration

Create or update `backend/.env` with these values:

```env
# Required for WhatsApp to work
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Optional but recommended
TWILIO_WHATSAPP_JOIN_CODE=join your-code-here
DEFAULT_COUNTRY_CODE=91
```

**Where to get these values:**

1. **TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN:**
   - Go to: https://console.twilio.com/
   - Dashboard shows Account SID
   - Auth Token: Click to reveal (or regenerate)

2. **TWILIO_WHATSAPP_FROM:**
   - Go to: Messaging → Try it out → Send a WhatsApp message
   - Copy the WhatsApp number shown (usually `+14155238886`)
   - Format: `whatsapp:+14155238886`

3. **TWILIO_WHATSAPP_JOIN_CODE:**
   - Same page as above
   - Copy the join code (e.g., "join mother-load")

## Step 6: Restart Backend

After making changes to `.env`, **always restart your backend server**:

```bash
# If using npm run dev (nodemon)
# Just save .env - nodemon will auto-restart

# If using npm start
# Stop server (Ctrl+C) and restart:
cd backend
npm start

# Or for development:
npm run dev
```

## Step 7: Test Again

1. **Check status:**
   ```bash
   GET /api/teachers/whatsapp-status
   ```
   Should show `mode: "twilio"` and `available: true`

2. **Try sending a test message:**
   - Create a summon request
   - Or verify a teacher's WhatsApp number
   - Watch backend console for logs

3. **Check logs:**
   - Look for success messages
   - If errors, match them to the issues above

## Step 8: Verify Phone Numbers in Database

Make sure teacher phone numbers are stored correctly:

```sql
SELECT id, name, phone_number, phone_verified FROM teachers;
```

**Phone numbers should be:**
- Format: `+91XXXXXXXXXX` (with country code)
- Or: `91XXXXXXXXXX` (will be auto-converted)

**To fix phone numbers:**
```sql
-- Example: Update phone number to include country code
UPDATE teachers 
SET phone_number = CONCAT('+91', phone_number) 
WHERE phone_number NOT LIKE '+%' AND phone_number LIKE '9%';
```

## Quick Diagnostic Checklist

- [ ] `.env` file exists in `backend/` directory
- [ ] `TWILIO_ACCOUNT_SID` is set in `.env`
- [ ] `TWILIO_AUTH_TOKEN` is set in `.env`
- [ ] `TWILIO_WHATSAPP_FROM` is set in `.env` (format: `whatsapp:+14155238886`)
- [ ] `twilio` package is installed (`npm install twilio`)
- [ ] Backend server restarted after `.env` changes
- [ ] `/api/teachers/whatsapp-status` shows `mode: "twilio"` and `available: true`
- [ ] Phone numbers in database include country code (`+91XXXXXXXXXX`)
- [ ] Recipients have joined WhatsApp sandbox (for testing)
- [ ] Twilio account has credits/balance

## Still Not Working?

1. **Run the diagnostic script:**
   ```bash
   cd backend
   node scripts/diagnose-whatsapp.js
   ```

2. **Check backend console logs** when sending a message

3. **Verify Twilio account:**
   - Log in to https://console.twilio.com/
   - Check account status
   - Verify WhatsApp is enabled
   - Check account balance

4. **Test with Twilio Console:**
   - Try sending a test message from Twilio Console
   - If it works there but not in your app, check your code
   - If it doesn't work there, it's a Twilio account issue

5. **Check error codes:**
   - Match error codes from logs to the issues above
   - Common codes: 21211 (invalid number), 21608/21614 (sandbox), 21212 (invalid FROM)

## Need More Help?

- Check `TWILIO_WHATSAPP_SETUP.md` for detailed setup instructions
- Review backend console logs for specific error messages
- Check Twilio documentation: https://www.twilio.com/docs/whatsapp

