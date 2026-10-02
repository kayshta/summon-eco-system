# Update .env File Instructions

## Current Issue
Your `.env` has: `TWILIO_WHATSAPP_FROM=whatsapp:+12053465683`

But this number might not match what's in your Twilio Console.

## Steps to Fix

1. **Open Twilio Console:**
   - Go to: https://console.twilio.com/
   - Login to your account

2. **Find Your WhatsApp Number:**
   - Click: **Messaging** → **Try it out** → **Send a WhatsApp message**
   - Look for the WhatsApp number displayed (usually `+14155238886` or similar)
   - **Copy this EXACT number**

3. **Update backend/.env:**
   - Open `backend/.env` file
   - Find the line: `TWILIO_WHATSAPP_FROM=whatsapp:+12053465683`
   - Replace `+12053465683` with the number from Twilio Console
   - Format: `TWILIO_WHATSAPP_FROM=whatsapp:+[NUMBER_FROM_CONSOLE]`

4. **Example:**
   If Twilio Console shows: `+14155238886`
   Then update to: `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`

5. **Save the file**

6. **Restart backend server:**
   ```bash
   # Stop server (Ctrl+C)
   cd backend
   npm run dev
   ```

7. **Test again**

## Important
- The number MUST match exactly what's in Twilio Console
- Format must be: `whatsapp:+[number]` (with `whatsapp:` prefix and `+` sign)
- No spaces, dashes, or other characters

