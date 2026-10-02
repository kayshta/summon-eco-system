# Twilio WhatsApp Setup Guide

## Common Error: "Could not find the channel with the specified from address"

This error occurs when Twilio cannot find the WhatsApp channel/number you're trying to use. Follow these steps to fix it:

## Step 1: Get Your WhatsApp Sandbox Number

1. Log in to your [Twilio Console](https://console.twilio.com/)
2. Go to **Messaging** → **Try it out** → **Send a WhatsApp message**
3. You'll see your WhatsApp Sandbox number (usually `+14155238886`)
4. Copy this number

## Step 2: Configure Your .env File

Open `backend/.env` and set:

```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

**Important:** 
- The format must be: `whatsapp:+[number]`
- Include the `whatsapp:` prefix
- Include the `+` before the country code
- Use the exact number from your Twilio Console

## Step 3: Verify Your Twilio Account

1. Make sure your Twilio account is active
2. Check that WhatsApp is enabled in your account
3. Verify you have credits/balance in your account

## Step 4: Set Up WhatsApp Sandbox (For Testing)

1. In Twilio Console → Messaging → Try it out → Send a WhatsApp message
2. You'll see a join code (e.g., "join <code>")
3. Send this code to your WhatsApp number from your phone
4. Twilio will confirm you've joined the sandbox

## Step 5: For Production (Optional)

If you want to use a production WhatsApp Business number:

1. Apply for WhatsApp Business API access in Twilio
2. Get your approved WhatsApp Business number
3. Update `TWILIO_WHATSAPP_FROM` with your production number

## Troubleshooting

### Error: "Could not find the channel"
- ✅ Check `TWILIO_WHATSAPP_FROM` is set correctly in `.env`
- ✅ Verify the number format: `whatsapp:+14155238886`
- ✅ Make sure the number matches your Twilio Console
- ✅ Restart your backend server after changing `.env`

### Error: "Unsubscribed recipient"
- ✅ The recipient must join the WhatsApp sandbox first
- ✅ Send the join code to their WhatsApp number
- ✅ They must reply with the code

### Error: "Invalid credentials"
- ✅ Check `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are correct
- ✅ Make sure there are no extra spaces in your `.env` file
- ✅ Verify your Twilio account is active

## Testing

After configuration, test by:
1. Going to Admin Panel → Teachers
2. Click "Verify WhatsApp" on a teacher
3. Check backend logs for detailed error messages

## Need Help?

Check the backend console logs - they will show:
- The FROM number being used
- Detailed error messages
- Suggestions for fixing the issue

