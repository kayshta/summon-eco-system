import pool from '../config/database.js';
import crypto from 'crypto';

/**
 * Start the QR code auto-regeneration scheduler
 * This function will periodically regenerate QR nonces for all classes
 * and clean up expired teacher assignments
 */
export function startQRScheduler() {
  console.log('QR Scheduler: Starting QR code auto-regeneration scheduler...');
  
  // Get the regeneration interval from environment (default: 15 minutes)
  const intervalMinutes = parseInt(process.env.QR_REGENERATION_INTERVAL_MINUTES) || 15;
  const intervalMs = intervalMinutes * 60 * 1000;

  // Run immediately on startup
  regenerateAllQRCodes();
  cleanupExpiredAssignments();

  // Then run periodically
  setInterval(() => {
    regenerateAllQRCodes();
  }, intervalMs);

  // Clean up expired teacher assignments every 10 minutes
  setInterval(() => {
    cleanupExpiredAssignments();
  }, 10 * 60 * 1000); // 10 minutes

  console.log(`QR Scheduler: Will regenerate QR codes every ${intervalMinutes} minutes`);
  console.log('QR Scheduler: Will clean up expired teacher assignments every 10 minutes');
}

/**
 * Regenerate QR nonces for all classes
 */
async function regenerateAllQRCodes() {
  try {
    console.log('QR Scheduler: Regenerating QR codes for all classes...');
    
    // Get all classes
    const [classes] = await pool.execute('SELECT id FROM classes');
    
    if (classes.length === 0) {
      console.log('QR Scheduler: No classes found. Skipping regeneration.');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const classData of classes) {
      try {
        await generateQRNonce(classData.id);
        successCount++;
      } catch (error) {
        console.error(`QR Scheduler: Failed to regenerate QR for class ${classData.id}:`, error);
        errorCount++;
      }
    }

    console.log(`QR Scheduler: Regeneration complete. Success: ${successCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error('QR Scheduler: Error during regeneration:', error);
  }
}

/**
 * Generate a new QR nonce for a class
 */
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

/**
 * Clean up expired teacher assignments
 * Removes assignments that are older than the expiration time
 */
async function cleanupExpiredAssignments() {
  try {
    const assignmentExpiryMinutes = parseInt(process.env.TEACHER_ASSIGNMENT_EXPIRY_MINUTES) || 45;
    
    const [result] = await pool.execute(
      `DELETE FROM current_class_teacher 
       WHERE TIMESTAMPDIFF(MINUTE, updated_at, NOW()) >= ?`,
      [assignmentExpiryMinutes]
    );

    if (result.affectedRows > 0) {
      console.log(`QR Scheduler: Cleaned up ${result.affectedRows} expired teacher assignment(s)`);
    }
  } catch (error) {
    console.error('QR Scheduler: Error cleaning up expired assignments:', error);
  }
}
