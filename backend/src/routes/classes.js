import express from 'express';
import QRCode from 'qrcode';
import crypto from 'crypto';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all classes
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [classes] = await pool.execute(
      'SELECT id, class_name, qr_code_value, created_at FROM classes ORDER BY class_name'
    );
    res.json(classes);
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get single class
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [classes] = await pool.execute(
      'SELECT id, class_name, qr_code_value, created_at FROM classes WHERE id = ?',
      [req.params.id]
    );
    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(classes[0]);
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({ error: 'Failed to fetch class' });
  }
});

// Create class
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { class_name } = req.body;

    if (!class_name) {
      return res.status(400).json({ error: 'Class name required' });
    }

    // Generate unique QR code value
    const qr_code_value = `class_${class_name}_qr_${crypto.randomBytes(10).toString('hex')}`;

    const [result] = await pool.execute(
      'INSERT INTO classes (class_name, qr_code_value) VALUES (?, ?)',
      [class_name, qr_code_value]
    );

    // Generate initial QR nonce for the class
    try {
      await generateQRNonce(result.insertId);
    } catch (nonceError) {
      console.error('Failed to generate initial QR nonce:', nonceError);
      // Continue even if nonce generation fails
    }

    res.status(201).json({
      id: result.insertId,
      class_name,
      qr_code_value
    });
  } catch (error) {
    console.error('Create class error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Class name already exists' });
    }
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// Update class
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { class_name } = req.body;

    if (!class_name) {
      return res.status(400).json({ error: 'Class name required' });
    }

    await pool.execute(
      'UPDATE classes SET class_name = ? WHERE id = ?',
      [class_name, req.params.id]
    );

    res.json({ message: 'Class updated successfully' });
  } catch (error) {
    console.error('Update class error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Class name already exists' });
    }
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// Delete class
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM classes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

// Generate/Regenerate QR code (GET - for downloading existing QR)
router.get('/:id/qr-code', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [classes] = await pool.execute(
      'SELECT id, class_name, qr_code_value FROM classes WHERE id = ?',
      [req.params.id]
    );

    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const classData = classes[0];

    // Get the latest valid nonce for this class
    const [nonces] = await pool.execute(
      `SELECT nonce, expires_at FROM qr_nonces 
       WHERE class_id = ? AND expires_at > NOW() AND used = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [req.params.id]
    );

    let nonce;
    if (nonces.length === 0) {
      // Generate new QR nonce if none exists or all expired
      nonce = await generateQRNonce(req.params.id);
    } else {
      nonce = { nonce: nonces[0].nonce, expires_at: nonces[0].expires_at };
    }

    // Generate QR code image
    const qrData = JSON.stringify({
      class_id: parseInt(req.params.id),
      class_name: classData.class_name,
      nonce: nonce.nonce,
      expires_at: nonce.expires_at
    });

    const qrImageBuffer = await QRCode.toBuffer(qrData, {
      width: parseInt(process.env.QR_CODE_SIZE) || 300,
      margin: 2
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="qr_${classData.class_name}.png"`);
    res.send(qrImageBuffer);
  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Regenerate QR code (POST - for regenerating with new nonce)
router.post('/:id/qr-code', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [classes] = await pool.execute(
      'SELECT id, class_name, qr_code_value FROM classes WHERE id = ?',
      [req.params.id]
    );

    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const classData = classes[0];
    
    // Generate new QR code value
    const new_qr_code_value = `class_${classData.class_name}_qr_${crypto.randomBytes(10).toString('hex')}`;
    
    await pool.execute(
      'UPDATE classes SET qr_code_value = ? WHERE id = ?',
      [new_qr_code_value, req.params.id]
    );

    // Generate QR nonce
    const nonce = await generateQRNonce(req.params.id);

    // Generate QR code image
    const qrData = JSON.stringify({
      class_id: parseInt(req.params.id),
      class_name: classData.class_name,
      nonce: nonce.nonce,
      expires_at: nonce.expires_at
    });

    const qrImageBuffer = await QRCode.toBuffer(qrData, {
      width: parseInt(process.env.QR_CODE_SIZE) || 300,
      margin: 2
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="qr_${classData.class_name}.png"`);
    res.send(qrImageBuffer);
  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Get QR code value (string)
router.get('/:id/qr-value', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [classes] = await pool.execute(
      'SELECT qr_code_value FROM classes WHERE id = ?',
      [req.params.id]
    );

    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({ qr_code_value: classes[0].qr_code_value });
  } catch (error) {
    console.error('Get QR value error:', error);
    res.status(500).json({ error: 'Failed to get QR value' });
  }
});

// Helper function to generate QR nonce
async function generateQRNonce(classId) {
  const nonce = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(process.env.QR_NONCE_EXPIRY_MINUTES || 15));

  await pool.execute(
    'INSERT INTO qr_nonces (class_id, nonce, expires_at) VALUES (?, ?, ?)',
    [classId, nonce, expiresAt]
  );

  return { nonce, expires_at: expiresAt };
}

export default router;

