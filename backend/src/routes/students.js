import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all students (with filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { class_id, search, section } = req.query;
    let query = `
      SELECT s.id, s.name, s.roll_no, s.class_id, s.section, s.dob, 
             s.phone, s.guardian_name, s.guardian_phone, 
             s.created_at, s.last_verified_at,
             c.class_name
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (class_id) {
      query += ' AND s.class_id = ?';
      params.push(class_id);
    }
    if (section) {
      query += ' AND s.section = ?';
      params.push(section);
    }
    if (search) {
      query += ' AND (s.name LIKE ? OR s.roll_no LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY c.class_name, s.roll_no';

    const [students] = await pool.execute(query, params);
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get single student
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [students] = await pool.execute(
      `SELECT s.*, c.class_name 
       FROM students s 
       JOIN classes c ON s.class_id = c.id 
       WHERE s.id = ?`,
      [req.params.id]
    );
    
    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json(students[0]);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// Create student
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, roll_no, class_id, section, dob, phone, guardian_name, guardian_phone } = req.body;

    if (!name || !roll_no || !class_id) {
      return res.status(400).json({ error: 'Name, roll number, and class are required' });
    }

    const [result] = await pool.execute(
      `INSERT INTO students (name, roll_no, class_id, section, dob, phone, guardian_name, guardian_phone, last_verified_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [name, roll_no, class_id, section || null, dob || null, phone || null, guardian_name || null, guardian_phone || null]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      roll_no,
      class_id
    });
  } catch (error) {
    console.error('Create student error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Student with this roll number already exists in this class' });
    }
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// Update student
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, roll_no, class_id, section, dob, phone, guardian_name, guardian_phone, last_verified_at } = req.body;
    
    const updates = [];
    const values = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }
    if (roll_no) {
      updates.push('roll_no = ?');
      values.push(roll_no);
    }
    if (class_id) {
      updates.push('class_id = ?');
      values.push(class_id);
    }
    if (section !== undefined) {
      updates.push('section = ?');
      values.push(section);
    }
    if (dob !== undefined) {
      updates.push('dob = ?');
      values.push(dob);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (guardian_name !== undefined) {
      updates.push('guardian_name = ?');
      values.push(guardian_name);
    }
    if (guardian_phone !== undefined) {
      updates.push('guardian_phone = ?');
      values.push(guardian_phone);
    }
    if (last_verified_at !== undefined) {
      updates.push('last_verified_at = ?');
      values.push(last_verified_at === 'now' ? new Date() : last_verified_at);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    await pool.execute(
      `UPDATE students SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ message: 'Student updated successfully' });
  } catch (error) {
    console.error('Update student error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Student with this roll number already exists in this class' });
    }
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Delete student
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM students WHERE id = ?', [req.params.id]);
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Get students needing yearly verification
router.get('/verification/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [students] = await pool.execute(
      `SELECT s.id, s.name, s.roll_no, s.class_id, s.section, 
              s.last_verified_at, c.class_name,
              DATEDIFF(NOW(), s.last_verified_at) as days_since_verification
       FROM students s
       JOIN classes c ON s.class_id = c.id
       WHERE s.last_verified_at IS NULL 
          OR s.last_verified_at <= DATE_SUB(NOW(), INTERVAL 365 DAY)
       ORDER BY s.last_verified_at ASC, c.class_name, s.roll_no`
    );
    res.json(students);
  } catch (error) {
    console.error('Get pending verification error:', error);
    res.status(500).json({ error: 'Failed to fetch students needing verification' });
  }
});

export default router;

