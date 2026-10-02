import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { sendWhatsAppMessage, getTwilioMessageQuota } from '../services/whatsapp.js';
import { getTwilioConfig, updateTwilioConfig } from '../services/twilio-config.js';
import { getTextLinkConfig, updateTextLinkConfig } from '../services/textlink-config.js';
import { getMessagingConfig, updateMessagingProvider } from '../services/messaging-config.js';

const router = express.Router();

// Get active messaging provider (must be before /:id)
router.get('/messaging-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    res.json(getMessagingConfig());
  } catch (error) {
    console.error('Get messaging config error:', error);
    res.status(500).json({ error: 'Failed to fetch messaging configuration' });
  }
});

// Update active messaging provider
router.put('/messaging-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { provider } = req.body;
    if (!provider) {
      return res.status(400).json({ error: 'Messaging provider is required' });
    }

    const config = updateMessagingProvider(provider);
    res.json({
      message: `Messaging provider switched to ${config.label}`,
      config
    });
  } catch (error) {
    console.error('Update messaging config error:', error);
    res.status(400).json({ error: error.message || 'Failed to update messaging provider' });
  }
});

// Get TextLink configuration
router.get('/textlink-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    res.json(getTextLinkConfig());
  } catch (error) {
    console.error('Get TextLink config error:', error);
    res.status(500).json({ error: 'Failed to fetch TextLink configuration' });
  }
});

// Update TextLink configuration
router.put('/textlink-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { apiKey, apiUrl, simCardId, updateApiKey } = req.body;

    if (apiUrl !== undefined && !apiUrl.trim()) {
      return res.status(400).json({ error: 'TextLink API URL is required' });
    }
    if (updateApiKey && (!apiKey || !apiKey.trim())) {
      return res.status(400).json({ error: 'TextLink API key is required when updating credentials' });
    }

    const config = updateTextLinkConfig({
      apiKey,
      apiUrl,
      simCardId,
      updateApiKey: Boolean(updateApiKey)
    });

    res.json({
      message: 'TextLink configuration updated successfully',
      config
    });
  } catch (error) {
    console.error('Update TextLink config error:', error);
    res.status(500).json({ error: 'Failed to update TextLink configuration' });
  }
});

// Get Twilio configuration (must be before /:id)
router.get('/twilio-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    res.json(getTwilioConfig());
  } catch (error) {
    console.error('Get Twilio config error:', error);
    res.status(500).json({ error: 'Failed to fetch Twilio configuration' });
  }
});

// Update Twilio configuration
router.put('/twilio-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { accountSid, authToken, whatsappFrom, whatsappToPrefix, updateAuthToken } = req.body;

    if (accountSid !== undefined && !accountSid.trim()) {
      return res.status(400).json({ error: 'Twilio Account SID is required' });
    }
    if (whatsappFrom !== undefined && !whatsappFrom.trim()) {
      return res.status(400).json({ error: 'WhatsApp From number is required' });
    }
    if (updateAuthToken && (!authToken || !authToken.trim())) {
      return res.status(400).json({ error: 'Auth Token is required when updating credentials' });
    }

    const config = updateTwilioConfig({
      accountSid,
      authToken,
      whatsappFrom,
      whatsappToPrefix,
      updateAuthToken: Boolean(updateAuthToken)
    });

    res.json({
      message: 'Twilio configuration updated successfully',
      config
    });
  } catch (error) {
    console.error('Update Twilio config error:', error);
    res.status(500).json({ error: 'Failed to update Twilio configuration' });
  }
});

// Get Twilio WhatsApp message quota (must be before /:id)
router.get('/message-quota', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const quota = await getTwilioMessageQuota({
      forceRefresh: req.query.refresh === 'true'
    });
    res.json(quota);
  } catch (error) {
    console.error('Get message quota error:', error);
    res.status(500).json({ error: 'Failed to fetch message quota' });
  }
});

// Create summon request
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { student_id, reason } = req.body;
    const requested_by = req.user.id;

    if (!student_id || !reason) {
      return res.status(400).json({ error: 'Student ID and reason required' });
    }

    // Get student info
    const [students] = await pool.execute(
      `SELECT s.*, c.class_name 
       FROM students s 
       JOIN classes c ON s.class_id = c.id 
       WHERE s.id = ?`,
      [student_id]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = students[0];

    // Check if teacher is present in class (only non-expired assignments)
    const assignmentExpiryMinutes = parseInt(process.env.TEACHER_ASSIGNMENT_EXPIRY_MINUTES) || 45;
    const [currentTeachers] = await pool.execute(
      `SELECT cct.teacher_id, t.name as teacher_name, t.phone_number
       FROM current_class_teacher cct
       JOIN teachers t ON cct.teacher_id = t.id
       WHERE cct.class_id = ? 
       AND TIMESTAMPDIFF(MINUTE, cct.updated_at, NOW()) < ?`,
      [student.class_id, assignmentExpiryMinutes]
    );

    let teacher_id = null;
    let whatsapp_message_id = null;
    let whatsapp_delivery_status = null;
    let status = 'sent';

    if (currentTeachers.length > 0) {
      const currentTeacher = currentTeachers[0];
      teacher_id = currentTeacher.teacher_id;

      // Send WhatsApp message
      if (!currentTeacher.phone_number || !currentTeacher.phone_number.trim()) {
        console.warn(`Teacher ${currentTeacher.teacher_name} (ID: ${currentTeacher.teacher_id}) has no phone number configured`);
        whatsapp_delivery_status = 'failed';
      } else {
        try {
          const messageResult = await sendWhatsAppMessage(
            currentTeacher.phone_number,
            'summon_student',
            {
              student_name: student.name,
              class_name: student.class_name,
              roll_no: student.roll_no,
              section: student.section || 'N/A',
              reason: reason,
              timestamp: new Date().toLocaleString()
            }
          );

          whatsapp_message_id = messageResult.messageId || null;
          whatsapp_delivery_status = messageResult.status || 'sent';

          // If message failed, log the error
          if (messageResult.status === 'failed' || messageResult.error) {
            const errorDetails = {
              error: messageResult.error,
              errorCode: messageResult.errorCode,
              phone: currentTeacher.phone_number,
              normalizedPhone: messageResult.to,
              needsSandboxJoin: messageResult.needsSandboxJoin || false
            };
            
            console.error(`WhatsApp send failed for teacher ${currentTeacher.teacher_name}:`, errorDetails);
            
            // If teacher hasn't joined sandbox, update their verification status
            if (messageResult.needsSandboxJoin) {
              await pool.execute(
                'UPDATE teachers SET phone_verified = FALSE WHERE id = ?',
                [currentTeacher.teacher_id]
              );
              console.warn(`Teacher ${currentTeacher.teacher_name} (${currentTeacher.phone_number}) needs to join WhatsApp sandbox`);
              // Use a clearer status instead of "failed" for sandbox join issues
              whatsapp_delivery_status = 'needs_setup';
            } else {
              whatsapp_delivery_status = 'failed';
            }
          } else {
            console.log(`WhatsApp message sent successfully to ${currentTeacher.teacher_name} (${messageResult.to})`);
            // Update verification status on successful send
            await pool.execute(
              'UPDATE teachers SET phone_verified = TRUE WHERE id = ?',
              [currentTeacher.teacher_id]
            );
          }
        } catch (whatsappError) {
          console.error('WhatsApp send exception:', whatsappError);
          whatsapp_delivery_status = 'failed';
          // Still create the summon request even if WhatsApp fails
        }
      }
    } else {
      status = 'sent';
      // No teacher present - could send to office/guardian
      if (process.env.ADMIN_WHATSAPP_NUMBER) {
        try {
          await sendWhatsAppMessage(
            process.env.ADMIN_WHATSAPP_NUMBER,
            'no_teacher_present',
            {
              class_name: student.class_name,
              student_name: student.name,
              roll_no: student.roll_no
            }
          );
        } catch (whatsappError) {
          console.error('WhatsApp notification error:', whatsappError);
        }
      }
    }

    // Create summon request
    const [result] = await pool.execute(
      `INSERT INTO summon_requests 
       (student_id, class_id, teacher_id, requested_by, reason, status, whatsapp_message_id, whatsapp_delivery_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_id, student.class_id, teacher_id, requested_by, reason, status, whatsapp_message_id, whatsapp_delivery_status]
    );

    // Get teacher info for response
    let teacherInfo = null;
    if (teacher_id) {
      const [teacherData] = await pool.execute(
        'SELECT name, phone_number, phone_verified FROM teachers WHERE id = ?',
        [teacher_id]
      );
      if (teacherData.length > 0) {
        teacherInfo = teacherData[0];
      }
    }

    res.status(201).json({
      id: result.insertId,
      student_id,
      class_id: student.class_id,
      teacher_id,
      reason,
      status,
      teacher_present: teacher_id !== null,
      whatsapp_sent: whatsapp_message_id !== null,
      whatsapp_delivery_status: whatsapp_delivery_status,
      teacher_info: teacherInfo ? {
        name: teacherInfo.name,
        phone_verified: teacherInfo.phone_verified,
        needs_sandbox_join: (whatsapp_delivery_status === 'failed' || whatsapp_delivery_status === 'needs_setup') && !teacherInfo.phone_verified
      } : null
    });
  } catch (error) {
    console.error('Create summon error:', error);
    res.status(500).json({ error: 'Failed to create summon request' });
  }
});

// Get all summon requests
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, class_id, student_id, limit = 100 } = req.query;
    
    let query = `
      SELECT sr.*, 
             s.name as student_name, s.roll_no,
             c.class_name,
             t.name as teacher_name, t.phone_number as teacher_phone, t.phone_verified as teacher_phone_verified,
             a.name as requested_by_name
      FROM summon_requests sr
      JOIN students s ON sr.student_id = s.id
      JOIN classes c ON sr.class_id = c.id
      LEFT JOIN teachers t ON sr.teacher_id = t.id
      LEFT JOIN admin_users a ON sr.requested_by = a.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND sr.status = ?';
      params.push(status);
    }
    if (class_id) {
      query += ' AND sr.class_id = ?';
      params.push(class_id);
    }
    if (student_id) {
      query += ' AND sr.student_id = ?';
      params.push(student_id);
    }

    query += ' ORDER BY sr.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [requests] = await pool.execute(query, params);
    res.json(requests);
  } catch (error) {
    console.error('Get summon requests error:', error);
    res.status(500).json({ error: 'Failed to fetch summon requests' });
  }
});

// Get single summon request
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [requests] = await pool.execute(
      `SELECT sr.*, 
              s.name as student_name, s.roll_no,
              c.class_name,
              t.name as teacher_name, t.phone_number as teacher_phone,
              a.name as requested_by_name
       FROM summon_requests sr
       JOIN students s ON sr.student_id = s.id
       JOIN classes c ON sr.class_id = c.id
       LEFT JOIN teachers t ON sr.teacher_id = t.id
       LEFT JOIN admin_users a ON sr.requested_by = a.id
       WHERE sr.id = ?`,
      [req.params.id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Summon request not found' });
    }

    res.json(requests[0]);
  } catch (error) {
    console.error('Get summon request error:', error);
    res.status(500).json({ error: 'Failed to fetch summon request' });
  }
});

// Update summon request status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['sent', 'acknowledged', 'arrived', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required' });
    }

    await pool.execute(
      'UPDATE summon_requests SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, req.params.id]
    );

    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Update summon status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;

