-- School Operations Ecosystem Database Schema
-- Database: school_operations

CREATE DATABASE IF NOT EXISTS school_operations;
USE school_operations;

-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone_number),
    INDEX idx_email (email)
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    class_name VARCHAR(50) NOT NULL UNIQUE,
    qr_code_value VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_class_name (class_name),
    INDEX idx_qr_code (qr_code_value)
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    roll_no VARCHAR(50) NOT NULL,
    class_id INT NOT NULL,
    section VARCHAR(10),
    dob DATE,
    phone VARCHAR(20),
    guardian_name VARCHAR(255),
    guardian_phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_verified_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_roll_class (roll_no, class_id),
    INDEX idx_class_roll (class_id, roll_no),
    INDEX idx_name (name),
    INDEX idx_last_verified (last_verified_at)
);

-- Current class teacher tracking
CREATE TABLE IF NOT EXISTS current_class_teacher (
    id INT PRIMARY KEY AUTO_INCREMENT,
    class_id INT NOT NULL UNIQUE,
    teacher_id INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    INDEX idx_class (class_id),
    INDEX idx_teacher (teacher_id)
);

-- Summon requests
CREATE TABLE IF NOT EXISTS summon_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    class_id INT NOT NULL,
    teacher_id INT,
    requested_by INT NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('sent', 'acknowledged', 'arrived', 'cancelled') DEFAULT 'sent',
    whatsapp_message_id VARCHAR(255),
    whatsapp_delivery_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
    INDEX idx_student (student_id),
    INDEX idx_class (class_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
);

-- QR scan logs
CREATE TABLE IF NOT EXISTS qr_scan_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_id INT NOT NULL,
    class_id INT NOT NULL,
    scan_token VARCHAR(255),
    scan_metadata JSON,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    INDEX idx_teacher (teacher_id),
    INDEX idx_class (class_id),
    INDEX idx_scanned_at (scanned_at)
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Admin', 'Reception', 'Auditor') DEFAULT 'Admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
);

-- Access logs for auditing
CREATE TABLE IF NOT EXISTS access_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    user_type ENUM('admin', 'teacher') NOT NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id, user_type),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
);

-- QR nonce tokens (for Option B security)
CREATE TABLE IF NOT EXISTS qr_nonces (
    id INT PRIMARY KEY AUTO_INCREMENT,
    class_id INT NOT NULL,
    nonce VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    INDEX idx_nonce (nonce),
    INDEX idx_class_expires (class_id, expires_at),
    INDEX idx_expires (expires_at)
);

-- Insert default admin user (password: admin123 - should be changed in production)
-- Password hash for 'admin123' using bcrypt (rounds=10)
INSERT INTO admin_users (name, email, password_hash, role) VALUES
('Admin User', 'admin@greenfield.example', '$2a$10$I6.V07hBYiQU87xgCy6c4uFfKufQE8.ZJrPuTHCaujvAX7YSfGLG2', 'Admin')
ON DUPLICATE KEY UPDATE name=name;

-- Insert sample classes
INSERT INTO classes (class_name, qr_code_value) VALUES
('1A', CONCAT('class_1A_qr_', SUBSTRING(MD5(RAND()), 1, 10))),
('2B', CONCAT('class_2B_qr_', SUBSTRING(MD5(RAND()), 1, 10))),
('3C', CONCAT('class_3C_qr_', SUBSTRING(MD5(RAND()), 1, 10)))
ON DUPLICATE KEY UPDATE class_name=class_name;

-- Insert sample teachers
INSERT INTO teachers (name, phone_number, email, password_hash) VALUES
('Teacher A', '+10000000001', 'teachera@greenfield.example', '$2a$10$dXHXNN48b11VU2dn94gDc.Q0/wVucJfV7XfeyVEeh0jJ4OqHJ6GOG'),
('Teacher B', '+10000000002', 'teacherb@greenfield.example', '$2a$10$dXHXNN48b11VU2dn94gDc.Q0/wVucJfV7XfeyVEeh0jJ4OqHJ6GOG'),
('Teacher C', '+10000000003', 'teacherc@greenfield.example', '$2a$10$dXHXNN48b11VU2dn94gDc.Q0/wVucJfV7XfeyVEeh0jJ4OqHJ6GOG')
ON DUPLICATE KEY UPDATE name=name;

-- Insert sample student
INSERT INTO students (name, roll_no, class_id, section, phone) VALUES
('Ravi Kumar', '12', (SELECT id FROM classes WHERE class_name = '1A' LIMIT 1), 'A', '+97798xxxxxxx')
ON DUPLICATE KEY UPDATE name=name;

