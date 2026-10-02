import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireTeacher } from '../middleware/auth.js';
import { sendWhatsAppMessage } from '../services/whatsapp.js';

const router = express.Router();

// QR Scan endpoint (Option B: with nonce validation)
router.post('/scan', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { qr_data } = req.body;
    const teacherId = req.user.id;

    if (!qr_data) {
      return res.status(400).json({ error: 'QR data required' });
    }

    let parsedData;
    try {
      parsedData = typeof qr_data === 'string' ? JSON.parse(qr_data) : qr_data;
      console.log('Parsed QR data:', parsedData);
    } catch (e) {
      console.error('QR data parse error:', e);
      return res.status(400).json({ error: 'Invalid QR data format' });
    }

    const { class_id, nonce } = parsedData;

    if (!class_id || !nonce) {
      return res.status(400).json({ error: 'Class ID and nonce required in QR data' });
    }

    // Ensure class_id is a number
    const classIdNum = parseInt(class_id);
    if (isNaN(classIdNum)) {
      return res.status(400).json({ error: 'Invalid class ID format' });
    }

    // Verify nonce is valid and not expired
    const [nonces] = await pool.execute(
      `SELECT * FROM qr_nonces 
       WHERE class_id = ? AND nonce = ? AND expires_at > NOW() AND used = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [classIdNum, nonce]
    );

    console.log(`QR scan validation - Class ID: ${classIdNum}, Nonce: ${nonce}, Found nonces: ${nonces.length}`);

    if (nonces.length === 0) {
      // Check if nonce exists but is expired or used
      const [checkNonce] = await pool.execute(
        `SELECT * FROM qr_nonces 
         WHERE class_id = ? AND nonce = ?
         ORDER BY created_at DESC LIMIT 1`,
        [classIdNum, nonce]
      );

      if (checkNonce.length > 0) {
        const nonceData = checkNonce[0];
        const now = new Date();
        const expiresAt = new Date(nonceData.expires_at);
        console.log(`Nonce found but invalid - Used: ${nonceData.used}, Expires: ${expiresAt}, Now: ${now}`);
        
        if (nonceData.used) {
          return res.status(400).json({ error: 'QR code has already been used. Please generate a new QR code.' });
        }
        if (expiresAt <= now) {
          return res.status(400).json({ error: 'QR code has expired. Please generate a new QR code.' });
        }
      } else {
        console.log(`No nonce found for class_id: ${classIdNum}, nonce: ${nonce}`);
        // Check if class has any nonces at all
        const [allNonces] = await pool.execute(
          `SELECT COUNT(*) as count FROM qr_nonces WHERE class_id = ?`,
          [classIdNum]
        );
        if (allNonces[0].count === 0) {
          return res.status(400).json({ error: 'No QR code nonce found for this class. Please generate a QR code first.' });
        }
      }
      return res.status(400).json({ error: 'Invalid QR code. Please ensure you are scanning a valid QR code.' });
    }

    // Mark nonce as used
    await pool.execute(
      'UPDATE qr_nonces SET used = TRUE WHERE id = ?',
      [nonces[0].id]
    );

    // Verify class exists
    const [classes] = await pool.execute(
      'SELECT id, class_name FROM classes WHERE id = ?',
      [classIdNum]
    );

    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Check if there's an existing assignment and if it's expired
    const [existingAssignments] = await pool.execute(
      `SELECT teacher_id, updated_at, 
              TIMESTAMPDIFF(MINUTE, updated_at, NOW()) as minutes_elapsed
       FROM current_class_teacher 
       WHERE class_id = ?`,
      [classIdNum]
    );

    const assignmentExpiryMinutes = parseInt(process.env.TEACHER_ASSIGNMENT_EXPIRY_MINUTES) || 45;
    let assignmentExpired = false;
    let previousTeacherId = null;

    if (existingAssignments.length > 0) {
      const existing = existingAssignments[0];
      previousTeacherId = existing.teacher_id;
      const minutesElapsed = existing.minutes_elapsed || 0;
      
      // Check if assignment has expired (older than expiry time)
      if (minutesElapsed >= assignmentExpiryMinutes) {
        assignmentExpired = true;
        console.log(`[QR Scan] Previous assignment for class ${classIdNum} expired (${minutesElapsed} minutes old). Replacing with new teacher ${teacherId}.`);
      } else if (existing.teacher_id === teacherId) {
        // Same teacher re-scanning - just update timestamp to extend their assignment
        console.log(`[QR Scan] Same teacher ${teacherId} re-scanning class ${classIdNum}. Extending assignment.`);
      } else {
        // Different teacher scanning before expiration - still allow replacement
        console.log(`[QR Scan] Different teacher ${teacherId} scanning class ${classIdNum} (previous: ${existing.teacher_id}, ${minutesElapsed} minutes remaining). Replacing assignment.`);
      }
    }

    // Update or insert current_class_teacher
    // Always update to the new teacher and reset the timestamp
    await pool.execute(
      `INSERT INTO current_class_teacher (class_id, teacher_id, updated_at) 
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE teacher_id = ?, updated_at = NOW()`,
      [classIdNum, teacherId, teacherId]
    );

    // Log QR scan
    const scanMetadata = {
      ip: req.ip || req.connection.remoteAddress,
      user_agent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    };

    await pool.execute(
      `INSERT INTO qr_scan_logs (teacher_id, class_id, scan_token, scan_metadata) 
       VALUES (?, ?, ?, ?)`,
      [teacherId, classIdNum, nonce, JSON.stringify(scanMetadata)]
    );

    // Get teacher info for notification
    const [teachers] = await pool.execute(
      'SELECT name, phone_number FROM teachers WHERE id = ?',
      [teacherId]
    );

    const teacher = teachers[0];
    const classData = classes[0];

    // Send WhatsApp confirmation to office (optional)
    // In production, you might want to send this to an admin phone number
    if (process.env.ADMIN_WHATSAPP_NUMBER) {
      try {
        await sendWhatsAppMessage(
          process.env.ADMIN_WHATSAPP_NUMBER,
          'qr_scan_confirmation',
          {
            teacher_name: teacher.name,
            class_name: classData.class_name,
            timestamp: new Date().toLocaleString()
          }
        );
      } catch (whatsappError) {
        console.error('WhatsApp confirmation error:', whatsappError);
        // Don't fail the scan if WhatsApp fails
      }
    }

    // Calculate expiration time
    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() + assignmentExpiryMinutes);

    res.json({
      message: assignmentExpired 
        ? 'QR code scanned successfully. Previous assignment expired - you are now the active teacher.'
        : previousTeacherId && previousTeacherId !== teacherId
        ? 'QR code scanned successfully. You are now the active teacher for this class.'
        : 'QR code scanned successfully',
      class: {
        id: classData.id,
        class_name: classData.class_name
      },
      teacher: {
        id: teacherId,
        name: teacher.name
      },
      assignment: {
        expires_at: expirationTime.toISOString(),
        expires_in_minutes: assignmentExpiryMinutes,
        previous_teacher_replaced: previousTeacherId && previousTeacherId !== teacherId
      }
    });
  } catch (error) {
    console.error('QR scan error:', error);
    res.status(500).json({ error: 'Failed to process QR scan' });
  }
});

// Get current class teachers (only non-expired assignments)
router.get('/current-teachers', authenticateToken, async (req, res) => {
  try {
    const assignmentExpiryMinutes = parseInt(process.env.TEACHER_ASSIGNMENT_EXPIRY_MINUTES) || 45;
    
    const [results] = await pool.execute(
      `SELECT cct.class_id, cct.teacher_id, cct.updated_at,
              c.class_name, t.name as teacher_name, t.phone_number,
              TIMESTAMPDIFF(MINUTE, cct.updated_at, NOW()) as minutes_elapsed,
              (? - TIMESTAMPDIFF(MINUTE, cct.updated_at, NOW())) as minutes_remaining,
              DATE_ADD(cct.updated_at, INTERVAL ? MINUTE) as expires_at
       FROM current_class_teacher cct
       JOIN classes c ON cct.class_id = c.id
       JOIN teachers t ON cct.teacher_id = t.id
       WHERE TIMESTAMPDIFF(MINUTE, cct.updated_at, NOW()) < ?
       ORDER BY c.class_name`,
      [assignmentExpiryMinutes, assignmentExpiryMinutes, assignmentExpiryMinutes]
    );
    
    // Also clean up expired assignments in the background
    pool.execute(
      `DELETE FROM current_class_teacher 
       WHERE TIMESTAMPDIFF(MINUTE, updated_at, NOW()) >= ?`,
      [assignmentExpiryMinutes]
    ).catch(err => {
      console.error('Error cleaning up expired assignments:', err);
    });
    
    res.json(results);
  } catch (error) {
    console.error('Get current teachers error:', error);
    res.status(500).json({ error: 'Failed to fetch current teachers' });
  }
});

// Get QR scan logs
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const { class_id, teacher_id, limit = 100 } = req.query;
    
    let query = `
      SELECT qsl.id, qsl.teacher_id, qsl.class_id, qsl.scanned_at, qsl.scan_token,
             t.name as teacher_name, c.class_name
      FROM qr_scan_logs qsl
      JOIN teachers t ON qsl.teacher_id = t.id
      JOIN classes c ON qsl.class_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (class_id) {
      query += ' AND qsl.class_id = ?';
      params.push(class_id);
    }
    if (teacher_id) {
      query += ' AND qsl.teacher_id = ?';
      params.push(teacher_id);
    }

    query += ' ORDER BY qsl.scanned_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [logs] = await pool.execute(query, params);
    res.json(logs);
  } catch (error) {
    console.error('Get QR scan logs error:', error);
    res.status(500).json({ error: 'Failed to fetch QR scan logs' });
  }
});

export default router;

