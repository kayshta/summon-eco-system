import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { sendWhatsAppMessage, getWhatsAppSandboxInfo, initializeTwilio } from '../services/whatsapp.js';

const router = express.Router();

// Get all teachers
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [teachers] = await pool.execute(
      'SELECT id, name, phone_number, email, phone_verified, created_at FROM teachers ORDER BY name'
    );
    res.json(teachers);
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// Get single teacher
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // Teachers can only view their own profile unless admin
    if (req.user.userType === 'teacher' && req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [teachers] = await pool.execute(
      'SELECT id, name, phone_number, email, phone_verified, created_at FROM teachers WHERE id = ?',
      [req.params.id]
    );
    
    if (teachers.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    res.json(teachers[0]);
  } catch (error) {
    console.error('Get teacher error:', error);
    res.status(500).json({ error: 'Failed to fetch teacher' });
  }
});

// Create teacher
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, phone_number, email, password } = req.body;

    if (!name || !phone_number || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      'INSERT INTO teachers (name, phone_number, email, password_hash) VALUES (?, ?, ?, ?)',
      [name, phone_number, email, password_hash]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      phone_number,
      email
    });
  } catch (error) {
    console.error('Create teacher error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email or phone number already exists' });
    }
    res.status(500).json({ error: 'Failed to create teacher' });
  }
});

// Update teacher
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // Teachers can only update their own profile unless admin
    if (req.user.userType === 'teacher' && req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, phone_number, email, password } = req.body;
    const updates = [];
    const values = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }
    if (phone_number) {
      updates.push('phone_number = ?');
      values.push(phone_number);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      values.push(password_hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    await pool.execute(
      `UPDATE teachers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ message: 'Teacher updated successfully' });
  } catch (error) {
    console.error('Update teacher error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email or phone number already exists' });
    }
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

// Delete teacher
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM teachers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    res.status(500).json({ error: 'Failed to delete teacher' });
  }
});

// Verify WhatsApp number
router.post('/:id/verify-whatsapp', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const teacherId = req.params.id;

    // Get teacher info
    const [teachers] = await pool.execute(
      'SELECT id, name, phone_number, phone_verified FROM teachers WHERE id = ?',
      [teacherId]
    );

    if (teachers.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacher = teachers[0];

    if (!teacher.phone_number || !teacher.phone_number.trim()) {
      return res.status(400).json({ error: 'Teacher has no phone number configured' });
    }

    // Try to send a verification message
    // If successful, the number has WhatsApp
    try {
      const messageResult = await sendWhatsAppMessage(
        teacher.phone_number,
        'qr_scan_confirmation',
        {
          teacher_name: teacher.name,
          class_name: 'Verification',
          timestamp: new Date().toLocaleString()
        }
      );

      // Check if message was sent successfully
      if (messageResult.status === 'failed' || messageResult.error) {
        // Check for specific error codes that indicate WhatsApp is not available
        const errorCode = messageResult.errorCode;
        const errorMessage = messageResult.error;

        if (errorCode === 21608 || errorCode === 21614) {
          // Unsubscribed or not registered - number exists but not in WhatsApp sandbox
          await pool.execute(
            'UPDATE teachers SET phone_verified = FALSE WHERE id = ?',
            [teacherId]
          );
          
          // Get sandbox join instructions
          const sandboxInfo = await getWhatsAppSandboxInfo();
          
          // Automatically send joining message to teacher
          let joinMessageSent = false;
          let joinMessageId = null;
          let joinMessageError = null;
          
          try {
            const joinMessageResult = await sendWhatsAppMessage(
              teacher.phone_number,
              'sandbox_join_instructions',
              {
                teacher_name: teacher.name,
                sandbox_number: sandboxInfo.sandboxNumber || 'the Twilio WhatsApp number',
                join_code: sandboxInfo.joinCode && sandboxInfo.hasJoinCode ? sandboxInfo.joinCode : null
              }
            );

            if (joinMessageResult.status !== 'failed' && !joinMessageResult.error) {
              joinMessageSent = true;
              joinMessageId = joinMessageResult.messageId;
              console.log(`[WhatsApp] Sandbox join instructions sent to ${teacher.name} (${teacher.phone_number})`);
            } else {
              joinMessageError = joinMessageResult.error;
              console.warn(`[WhatsApp] Failed to send sandbox join instructions to ${teacher.name}:`, joinMessageResult.error);
            }
          } catch (joinError) {
            console.error(`[WhatsApp] Error sending sandbox join instructions to ${teacher.name}:`, joinError);
            joinMessageError = joinError.message;
            // Continue even if join message fails
          }
          
          // Build response message based on whether join message was sent
          let responseMessage = 'This phone number has not joined the Twilio WhatsApp sandbox.';
          let statusMessage = 'needs_setup'; // Use a clearer status instead of "failed"
          
          if (joinMessageSent) {
            responseMessage += ' A joining message with instructions has been sent to the teacher.';
            statusMessage = 'invitation_sent';
          } else {
            responseMessage += ` The teacher must join the sandbox first by sending "${sandboxInfo.joinCode}" to ${sandboxInfo.sandboxNumber} from their WhatsApp.`;
            if (joinMessageError) {
              // If error is about sandbox join (21608/21614), it's expected, not a real failure
              if (joinMessageError.includes('UNSUBSCRIBED') || joinMessageError.includes('NOT_REGISTERED')) {
                statusMessage = 'needs_setup';
                responseMessage += ' (This is expected - they need to join the sandbox first before receiving messages)';
              } else {
                statusMessage = 'invitation_failed';
                responseMessage += ` (Could not send WhatsApp message automatically: ${joinMessageError})`;
              }
            }
          }

          return res.json({
            verified: false,
            message: responseMessage,
            status: statusMessage, // Clear status indicator
            error: errorMessage,
            needsSandboxJoin: true,
            sandboxInfo: {
              ...sandboxInfo,
              joinCode: sandboxInfo.joinCode, // Always include join code
              instructions: sandboxInfo.instructions
            },
            joinMessageSent: joinMessageSent,
            joinMessageId: joinMessageId,
            joinMessageError: joinMessageError,
            manualInstructions: {
              joinCode: sandboxInfo.joinCode,
              sandboxNumber: sandboxInfo.sandboxNumber,
              steps: [
                `1. Open WhatsApp on the teacher's phone`,
                `2. Send this message to ${sandboxInfo.sandboxNumber}:`,
                `   "${sandboxInfo.joinCode}"`,
                `3. Wait for confirmation from Twilio`,
                `4. After joining, verify the WhatsApp number again`
              ]
            }
          });
        } else if (errorCode === 21211) {
          // Invalid number format
          await pool.execute(
            'UPDATE teachers SET phone_verified = FALSE WHERE id = ?',
            [teacherId]
          );
          return res.json({
            verified: false,
            message: 'Invalid phone number format. Please check the number.',
            error: errorMessage
          });
        } else {
          // Other errors
          await pool.execute(
            'UPDATE teachers SET phone_verified = FALSE WHERE id = ?',
            [teacherId]
          );
          return res.json({
            verified: false,
            message: `WhatsApp verification failed: ${errorMessage}`,
            error: errorMessage
          });
        }
      } else {
        // Message sent successfully - number has WhatsApp and is in sandbox
        await pool.execute(
          'UPDATE teachers SET phone_verified = TRUE WHERE id = ?',
          [teacherId]
        );

        // Send welcome/verification confirmation message
        let welcomeMessageSent = false;
        let welcomeMessageId = null;
        
        try {
          // Send welcome message confirming verification
          const welcomeMessageResult = await sendWhatsAppMessage(
            teacher.phone_number,
            'whatsapp_verified_welcome',
            {
              teacher_name: teacher.name,
              phone_number: teacher.phone_number
            }
          );

          if (welcomeMessageResult.status !== 'failed' && !welcomeMessageResult.error) {
            welcomeMessageSent = true;
            welcomeMessageId = welcomeMessageResult.messageId;
            console.log(`[WhatsApp] Welcome/verification message sent to ${teacher.name} (${teacher.phone_number})`);
          } else {
            console.warn(`[WhatsApp] Failed to send welcome message to ${teacher.name}:`, welcomeMessageResult.error);
          }
        } catch (welcomeError) {
          console.error(`[WhatsApp] Error sending welcome message to ${teacher.name}:`, welcomeError);
          // Don't fail verification if welcome message fails
        }

        return res.json({
          verified: true,
          message: 'WhatsApp number verified successfully! A welcome message has been sent to the teacher.',
          messageId: messageResult.messageId,
          welcomeMessageSent: welcomeMessageSent,
          welcomeMessageId: welcomeMessageId
        });
      }
    } catch (error) {
      console.error('WhatsApp verification error:', error);
      await pool.execute(
        'UPDATE teachers SET phone_verified = FALSE WHERE id = ?',
        [teacherId]
      );
      return res.status(500).json({
        verified: false,
        error: 'Failed to verify WhatsApp number',
        message: error.message || 'Unknown error occurred'
      });
    }
  } catch (error) {
    console.error('Verify WhatsApp error:', error);
    res.status(500).json({ error: 'Failed to verify WhatsApp number' });
  }
});

// Get WhatsApp sandbox join instructions
router.get('/whatsapp-sandbox-info', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const sandboxInfo = await getWhatsAppSandboxInfo();
    res.json(sandboxInfo);
  } catch (error) {
    console.error('Get sandbox info error:', error);
    res.status(500).json({ error: 'Failed to get sandbox information' });
  }
});

// WhatsApp status/diagnostics endpoint
router.get('/whatsapp-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const hasAccountSid = !!process.env.TWILIO_ACCOUNT_SID;
    const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
    const hasFromNumber = !!process.env.TWILIO_WHATSAPP_FROM;
    const hasJoinCode = !!process.env.TWILIO_WHATSAPP_JOIN_CODE;
    
    // Check if Twilio is available
    let twilioAvailable = false;
    let initializationError = null;
    
    try {
      twilioAvailable = await initializeTwilio();
    } catch (initError) {
      console.error('[WhatsApp Status] Twilio initialization error:', initError);
      initializationError = {
        message: initError.message,
        code: initError.code,
        stack: process.env.NODE_ENV === 'development' ? initError.stack : undefined
      };
    }
    
    res.json({
      mode: twilioAvailable ? 'twilio' : 'mock',
      twilio: {
        accountSidConfigured: hasAccountSid,
        authTokenConfigured: hasAuthToken,
        fromNumberConfigured: hasFromNumber,
        joinCodeConfigured: hasJoinCode,
        available: twilioAvailable,
        initializationError: initializationError
      },
      message: twilioAvailable 
        ? 'Twilio is configured and ready to send messages'
        : initializationError
        ? `Twilio initialization failed: ${initializationError.message}`
        : 'Running in MOCK mode. Messages will be logged to console and file only.',
      instructions: twilioAvailable 
        ? 'WhatsApp messages will be sent via Twilio'
        : initializationError
        ? 'Check backend console logs for detailed error. Common issues: Twilio package not installed, invalid credentials, or network issues.'
        : 'To enable real WhatsApp messages, add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to your .env file'
    });
  } catch (error) {
    console.error('Get WhatsApp status error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to get WhatsApp status',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;

