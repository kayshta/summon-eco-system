import bcrypt from 'bcryptjs';
import pool from '../src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function setupPasswords() {
  try {
    const adminPassword = 'admin123';
    const teacherPassword = 'teacher123';

    const adminHash = await bcrypt.hash(adminPassword, 10);
    const teacherHash = await bcrypt.hash(teacherPassword, 10);

    // Update admin password
    await pool.execute(
      'UPDATE admin_users SET password_hash = ? WHERE email = ?',
      [adminHash, 'admin@greenfield.example']
    );
    console.log('✓ Admin password updated');

    // Update teacher passwords
    const teacherEmails = [
      'teachera@greenfield.example',
      'teacherb@greenfield.example',
      'teacherc@greenfield.example'
    ];

    for (const email of teacherEmails) {
      await pool.execute(
        'UPDATE teachers SET password_hash = ? WHERE email = ?',
        [teacherHash, email]
      );
    }
    console.log('✓ Teacher passwords updated');

    console.log('\nDefault passwords:');
    console.log('Admin: admin@greenfield.example / admin123');
    console.log('Teachers: teachera@greenfield.example / teacher123');
    console.log('\n⚠️  IMPORTANT: Change these passwords in production!');

    process.exit(0);
  } catch (error) {
    console.error('Error setting up passwords:', error);
    process.exit(1);
  }
}

setupPasswords();

