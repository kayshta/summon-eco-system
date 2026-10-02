import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv',
      'text/plain'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    if (
      allowedMimes.includes(file.mimetype) ||
      allowedExtensions.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
    }
  }
});

function readSpreadsheet(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const buffer = fs.readFileSync(file.path);

  if (ext === '.csv' || file.mimetype === 'text/csv' || file.mimetype === 'application/csv') {
    return XLSX.read(buffer, { type: 'buffer' });
  }

  return XLSX.read(buffer, { type: 'buffer' });
}

function handleUpload(fieldName) {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File is too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: err.message });
      }
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  };
}

// Preview import file
router.post('/preview', authenticateToken, requireAdmin, handleUpload('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File required' });
    }

    const workbook = readSpreadsheet(req.file);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    // Preview first 10 rows
    const preview = data.slice(0, 10);
    
    // Validate data
    const validation = validateImportData(data);

    res.json({
      preview,
      total_rows: data.length,
      validation
    });
  } catch (error) {
    console.error('Preview import error:', error);
    res.status(500).json({ error: 'Failed to preview file' });
  }
});

// Import students from file
router.post('/students', authenticateToken, requireAdmin, handleUpload('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File required' });
    }

    const { add_new = true, update_existing = true, verify_all = false } = req.body;
    const shouldAddNew = parseBoolean(add_new, true);
    const shouldUpdateExisting = parseBoolean(update_existing, true);
    const shouldVerifyAll = parseBoolean(verify_all, false);

    const workbook = readSpreadsheet(req.file);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    // Validate data
    const validation = validateImportData(data);
    if (validation.errors.length > 0) {
      return res.status(400).json({
        error: 'Validation errors found',
        validation
      });
    }

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Get all classes for lookup
    const [classes] = await pool.execute('SELECT id, class_name FROM classes');
    const classMap = new Map(classes.map(c => [c.class_name.toLowerCase(), c.id]));

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const classId = classMap.get((row.class_name || '').toLowerCase());
        if (!classId) {
          errors.push({ row: i + 2, error: `Class "${row.class_name}" not found` });
          skippedCount++;
          continue;
        }

        // Check if student exists
        const [existing] = await pool.execute(
          'SELECT id FROM students WHERE roll_no = ? AND class_id = ?',
          [row.roll_no, classId]
        );

        if (existing.length > 0) {
          // Student exists
          if (shouldUpdateExisting) {
            const updates = [];
            const values = [];

            if (row.name) {
              updates.push('name = ?');
              values.push(row.name);
            }
            if (row.section !== undefined) {
              updates.push('section = ?');
              values.push(row.section || null);
            }
            if (row.dob) {
              updates.push('dob = ?');
              values.push(row.dob || null);
            }
            if (row.phone) {
              updates.push('phone = ?');
              values.push(row.phone || null);
            }
            if (row.guardian_name) {
              updates.push('guardian_name = ?');
              values.push(row.guardian_name || null);
            }
            if (row.guardian_phone) {
              updates.push('guardian_phone = ?');
              values.push(row.guardian_phone || null);
            }
            if (shouldVerifyAll) {
              updates.push('last_verified_at = NOW()');
            }

            if (updates.length > 0) {
              values.push(existing[0].id);
              await pool.execute(
                `UPDATE students SET ${updates.join(', ')} WHERE id = ?`,
                values
              );
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            skippedCount++;
          }
        } else {
          // New student
          if (shouldAddNew) {
            await pool.execute(
              `INSERT INTO students 
               (name, roll_no, class_id, section, dob, phone, guardian_name, guardian_phone, last_verified_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                row.name,
                row.roll_no,
                classId,
                row.section || null,
                row.dob || null,
                row.phone || null,
                row.guardian_name || null,
                row.guardian_phone || null,
                shouldVerifyAll ? new Date() : null
              ]
            );
            addedCount++;
          } else {
            skippedCount++;
          }
        }
      } catch (error) {
        errors.push({ row: i + 2, error: error.message });
        skippedCount++;
      }
    }

    res.json({
      summary: {
        total: data.length,
        added: addedCount,
        updated: updatedCount,
        skipped: skippedCount
      },
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Import students error:', error);
    res.status(500).json({ error: 'Failed to import students' });
  }
});

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return String(value).toLowerCase() === 'true';
}

function validateImportData(data) {
  const errors = [];
  const requiredFields = ['name', 'roll_no', 'class_name'];

  data.forEach((row, index) => {
    const rowNum = index + 2; // +2 because Excel rows start at 1 and header is row 1

    // Check required fields
    for (const field of requiredFields) {
      if (!row[field] || row[field].toString().trim() === '') {
        errors.push({
          row: rowNum,
          field,
          error: `Missing required field: ${field}`
        });
      }
    }

    // Validate phone format (if provided)
    if (row.phone && !/^\+?[\d\s-()]+$/.test(row.phone)) {
      errors.push({
        row: rowNum,
        field: 'phone',
        error: 'Invalid phone number format'
      });
    }

    // Check for duplicate roll_no within the same import
    const duplicates = data.filter((r, i) => 
      i !== index && 
      r.roll_no === row.roll_no && 
      r.class_name === row.class_name
    );
    if (duplicates.length > 0) {
      errors.push({
        row: rowNum,
        field: 'roll_no',
        error: 'Duplicate roll number in same class within import file'
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export default router;

