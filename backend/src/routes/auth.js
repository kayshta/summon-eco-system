import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const [admins] = await pool.execute(
      'SELECT * FROM admin_users WHERE email = ?',
      [email]
    );

    if (admins.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = admins[0];
    const validPassword = await bcrypt.compare(password, admin.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, userType: 'admin', role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        userType: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Teacher login
router.post('/teacher/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const [teachers] = await pool.execute(
      'SELECT * FROM teachers WHERE email = ?',
      [email]
    );

    if (teachers.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const teacher = teachers[0];
    const validPassword = await bcrypt.compare(password, teacher.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: teacher.id, email: teacher.email, userType: 'teacher' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        phone_number: teacher.phone_number,
        userType: 'teacher'
      }
    });
  } catch (error) {
    console.error('Teacher login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType === 'admin') {
      const [admins] = await pool.execute(
        'SELECT id, name, email, role FROM admin_users WHERE id = ?',
        [req.user.id]
      );
      if (admins.length > 0) {
        return res.json({ ...admins[0], userType: 'admin' });
      }
    } else if (req.user.userType === 'teacher') {
      const [teachers] = await pool.execute(
        'SELECT id, name, email, phone_number FROM teachers WHERE id = ?',
        [req.user.id]
      );
      if (teachers.length > 0) {
        return res.json({ ...teachers[0], userType: 'teacher' });
      }
    }
    res.status(404).json({ error: 'User not found' });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;

