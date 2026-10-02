# WhatsApp Integration Fix Summary

## 🔍 Diagnosis Steps Completed

I've created diagnostic tools and documentation to help you fix your WhatsApp integration. Here's what to do:

## 📋 Step-by-Step Fix Instructions

### Step 1: Install Twilio Package (CRITICAL)

The `twilio` package is missing from your dependencies. Install it:

```bash
cd backend
npm install twilio
```

### Step 2: Create .env File

You don't have a `.env` file. Create it:

```bash
cd backend
cp env.example .env
```

### Step 3: Configure .env File

Edit `backend/.env` and ensure these values are set correctly:

```env
# Required - Get from https://console.twilio.com/
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# Required - Format: whatsapp:+14155238886
# Get from: Twilio Console > Messaging > Try it out > Send a WhatsApp message
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Optional but recommended
TWILIO_WHATSAPP_JOIN_CODE=join mother-load
DEFAULT_COUNTRY_CODE=91
```

**Important Notes:**
- `TWILIO_WHATSAPP_FROM` MUST start with `whatsapp:` prefix
- Get the exact number from your Twilio Console
- The join code is shown in the same Twilio Console page

### Step 4: Run Diagnostic Script

Check your configuration:

```bash
cd backend
node scripts/diagnose-whatsapp.js
```

This will tell you exactly what's missing or misconfigured.

### Step 5: Check WhatsApp Status Endpoint

Call this endpoint (requires admin authentication):

```bash
GET /api/teachers/whatsapp-status
```

**What to look for:**

✅ **Good Response:**
```json
{
  "mode": "twilio",
  "twilio": {
    "accountSidConfigured": true,
    "authTokenConfigured": true,
    "fromNumberConfigured": true,
    "available": true
  },
  "message": "Twilio is configured and ready to send messages"
}
```

❌ **Bad Response (Mock Mode):**
```json
{
  "mode": "mock",
  "twilio": {
    "accountSidConfigured": false,  // or true but available: false
    "available": false
  },
  "message": "Running in MOCK mode..."
}
```

### Step 6: Check Backend Console Logs

When you try to send a WhatsApp message, watch your backend console for:

**Success:**
```
[WhatsApp] Twilio client initialized
[WhatsApp] Using FROM number: whatsapp:+14155238886
[WhatsApp] Sending message to: whatsapp:+91XXXXXXXXXX
[WhatsApp] Message sent successfully. SID: SM..., Status: queued
```

**Common Errors:**

1. **Missing Package:**
   ```
   [WhatsApp] Twilio package not available
   ```
   **Fix:** `npm install twilio`

2. **Missing Credentials:**
   ```
   [WhatsApp] Twilio credentials not found. Running in MOCK mode
   ```
   **Fix:** Add credentials to `.env`

3. **Invalid FROM Number:**
   ```
   Could not find the channel with the specified from address
   ```
   **Fix:** Check `TWILIO_WHATSAPP_FROM` format (must be `whatsapp:+14155238886`)

4. **Sandbox Not Joined (Error 21608/21614):**
   ```
   UNSUBSCRIBED: This phone number has not joined the Twilio WhatsApp sandbox
   ```
   **Fix:** Recipient must send join code to Twilio WhatsApp number first

5. **Invalid Phone Format (Error 21211):**
   ```
   Invalid phone number format. Please ensure the number includes country code
   ```
   **Fix:** Use format `+91XXXXXXXXXX` (with country code)

### Step 7: Restart Backend

After making any `.env` changes, restart your backend:

```bash
# Stop the server (Ctrl+C if running)
# Then restart:
cd backend
npm run dev
# or
npm start
```

### Step 8: Verify Phone Number Format

Ensure phone numbers in your database are in correct format:

**Correct:** `+91XXXXXXXXXX` (with + and country code)  
**Also OK:** `91XXXXXXXXXX` (will be auto-converted)  
**Wrong:** `XXXXXXXXXX` (missing country code)

**To check:**
```sql
SELECT id, name, phone_number FROM teachers;
```

**To fix:**
```sql
-- Add country code if missing
UPDATE teachers 
SET phone_number = CONCAT('+91', phone_number) 
WHERE phone_number NOT LIKE '+%' 
  AND phone_number NOT LIKE '91%'
  AND LENGTH(phone_number) = 10;
```

## 🎯 Quick Checklist

Before testing, verify:

- [ ] `twilio` package installed (`npm install twilio`)
- [ ] `.env` file exists in `backend/` directory
- [ ] `TWILIO_ACCOUNT_SID` set in `.env`
- [ ] `TWILIO_AUTH_TOKEN` set in `.env`
- [ ] `TWILIO_WHATSAPP_FROM` set correctly (format: `whatsapp:+14155238886`)
- [ ] Backend server restarted after changes
- [ ] `/api/teachers/whatsapp-status` shows `mode: "twilio"` and `available: true`
- [ ] Phone numbers in database include country code

## 📝 What Each Status Response Means

### `/api/teachers/whatsapp-status` Response Fields:

| Field | Meaning | What to Do |
|-------|---------|------------|
| `mode: "mock"` | Running in mock mode | Add Twilio credentials to `.env` |
| `mode: "twilio"` | Twilio configured | ✅ Good! |
| `accountSidConfigured: false` | Missing `TWILIO_ACCOUNT_SID` | Add to `.env` |
| `authTokenConfigured: false` | Missing `TWILIO_AUTH_TOKEN` | Add to `.env` |
| `fromNumberConfigured: false` | Missing `TWILIO_WHATSAPP_FROM` | Add to `.env` |
| `available: false` | Twilio client failed to init | Check package install or credentials |

## 🔧 Common Fixes

### Fix 1: Missing Twilio Package
```bash
cd backend
npm install twilio
```

### Fix 2: Missing .env File
```bash
cd backend
cp env.example .env
# Then edit .env and add your credentials
```

### Fix 3: Wrong FROM Number Format
**Wrong:**
```env
TWILIO_WHATSAPP_FROM=+14155238886
```

**Correct:**
```env
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

### Fix 4: Sandbox Not Joined
1. Get join code from Twilio Console
2. Add to `.env`: `TWILIO_WHATSAPP_JOIN_CODE=join your-code`
3. Have recipient send join code to Twilio WhatsApp number
4. Wait for confirmation
5. Retry sending message

## 📚 Additional Resources

- **Full Diagnostic Guide:** See `WHATSAPP_DIAGNOSTIC_GUIDE.md`
- **Setup Guide:** See `TWILIO_WHATSAPP_SETUP.md`
- **Diagnostic Script:** Run `node backend/scripts/diagnose-whatsapp.js`

## 🚀 Next Steps

1. **Run the diagnostic script** to see current status
2. **Install Twilio package** if missing
3. **Create/update .env** with correct values
4. **Restart backend server**
5. **Check status endpoint** to verify configuration
6. **Test sending a message** and watch console logs
7. **Fix any errors** based on the logs

## 💡 Pro Tips

- Always restart backend after changing `.env`
- Check backend console logs for detailed error messages
- Use the diagnostic script to quickly identify issues
- Verify phone numbers include country code (`+91`)
- For testing, recipients must join WhatsApp sandbox first
- Check Twilio Console for account status and balance

---

**Need help?** Check the console logs - they contain detailed error messages that will tell you exactly what's wrong!

