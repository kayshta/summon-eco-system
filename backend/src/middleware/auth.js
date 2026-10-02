import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Authorization failed' });
  }
};

export const requireTeacher = async (req, res, next) => {
  try {
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Teacher access required' });
    }
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Authorization failed' });
  }
};

export const logAccess = async (req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    // Log access after response
    if (req.user) {
      const logData = {
        user_id: req.user.id,
        user_type: req.user.userType,
        action: `${req.method} ${req.path}`,
        resource_type: req.path.split('/')[1],
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('user-agent')
      };
      
      pool.execute(
        'INSERT INTO access_logs (user_id, user_type, action, resource_type, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
        [logData.user_id, logData.user_type, logData.action, logData.resource_type, logData.ip_address, logData.user_agent]
      ).catch(err => console.error('Access log error:', err));
    }
    return originalSend.call(this, data);
  };
  next();
};

