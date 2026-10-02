# School Operations Ecosystem

A comprehensive school operations system that enables head office to call students out of class and reliably notify teachers via WhatsApp. The system supports teacher presence tracking via QR scanning, bulk student imports from Excel/CSV, and yearly verification workflows.

## Features

- **Student Summoning**: Admin can call students to head office with automatic WhatsApp notifications to teachers
- **QR Code Attendance**: Teachers scan QR codes to sign in to classes (Option B: with nonce validation)
- **Bulk Import**: Import students from Excel/CSV with validation and preview
- **Yearly Verification**: Track and manage student data verification annually
- **Role-Based Access**: Separate admin and teacher portals
- **Audit Logs**: Complete logging of QR scans and summon requests
- **WhatsApp Integration**: Twilio integration for reliable message delivery

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React + TypeScript + Vite
- **Database**: MySQL
- **WhatsApp**: Twilio API
- **QR Codes**: qrcode library
- **File Processing**: xlsx library

## Prerequisites

- Node.js 18+
- MySQL 8.0+
- Twilio account (for WhatsApp)

## Quick Start

### 1. Database Setup

```bash
# Create database and run schema
mysql -u root -p < database/schema.sql
```

### 2. Backend Setup

```bash
cd backend
npm install
cp env.example .env
# Edit .env with your configuration

# Set up default password hashes (run after database is set up)
npm run setup-passwords

npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Docker Setup (Alternative)

```bash
docker-compose up -d
```

## Configuration

### Backend Environment Variables

Create `backend/.env` from `backend/env.example`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=school_operations

JWT_SECRET=your-secret-key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

### Default Credentials

**Admin:**
- Email: `admin@greenfield.example`
- Password: `admin123` (change in production!)

**Teacher:**
- Email: `teachera@greenfield.example`
- Password: `teacher123` (change in production!)

## API Endpoints

### Authentication
- `POST /api/auth/admin/login` - Admin login
- `POST /api/auth/teacher/login` - Teacher login
- `GET /api/auth/me` - Get current user

### Classes
- `GET /api/classes` - List all classes
- `POST /api/classes` - Create class
- `GET /api/classes/:id/qr-code` - Download QR code image
- `GET /api/classes/:id/qr-value` - Get QR code value

### Students
- `GET /api/students` - List students (with filters)
- `POST /api/students` - Create student
- `GET /api/students/verification/pending` - Get students needing verification

### Teachers
- `GET /api/teachers` - List teachers
- `POST /api/teachers` - Create teacher

### QR Scan
- `POST /api/qr-scan/scan` - Scan QR code (requires teacher auth)
- `GET /api/qr-scan/current-teachers` - Get active teachers
- `GET /api/qr-scan/logs` - Get scan logs

### Summon
- `POST /api/summon` - Create summon request
- `GET /api/summon` - List summon requests
- `PATCH /api/summon/:id/status` - Update status

### Import
- `POST /api/import/preview` - Preview import file
- `POST /api/import/students` - Import students

## Excel Import Format

Expected columns in Excel/CSV:
- `name` (required)
- `roll_no` (required)
- `class_name` (required)
- `section` (optional)
- `dob` (optional)
- `phone` (optional)
- `guardian_name` (optional)
- `guardian_phone` (optional)

## QR Code Security (Option B)

QR codes contain:
- `class_id`: The class identifier
- `nonce`: One-time token (expires in 15 minutes)
- `expires_at`: Expiration timestamp

Teachers must:
1. Be logged in (JWT token required)
2. Scan valid QR code with non-expired nonce
3. Server validates both teacher identity and nonce

## WhatsApp Templates

The system uses three WhatsApp message templates:

1. **Summon Student**: Sent to teacher when student is called
2. **QR Scan Confirmation**: Sent to office when teacher scans QR
3. **No Teacher Present**: Sent when no teacher is in class

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic (WhatsApp, etc.)
│   │   ├── middleware/   # Auth middleware
│   │   └── config/       # Database config
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/        # React pages
│   │   ├── components/   # Reusable components
│   │   ├── context/      # React context (Auth)
│   │   └── services/     # API client
│   └── package.json
├── database/
│   └── schema.sql        # MySQL schema
└── docker-compose.yml
```

## Development

### Backend
```bash
cd backend
npm run dev  # Uses nodemon for auto-reload
```

### Frontend
```bash
cd frontend
npm run dev  # Vite dev server on :3001
```

## Testing

1. **Import Test**: Upload sample Excel file
2. **QR Scan Test**: Generate QR, scan with teacher app
3. **Summon Test**: Call student, verify WhatsApp delivery
4. **Verification Test**: Check yearly verification dashboard

## Production Deployment

1. Set strong `JWT_SECRET`
2. Configure production database
3. Set up Twilio production credentials
4. Update `FRONTEND_URL` in backend
5. Use HTTPS for all connections
6. Set up proper backup strategy for database
7. Configure rate limiting appropriately
8. Enable SSL for MySQL connections

## Security Notes

- All API endpoints require JWT authentication
- QR codes use one-time nonces (Option B)
- Passwords are hashed with bcrypt
- Rate limiting enabled on API
- CORS configured for frontend origin
- SQL injection protection via parameterized queries

## License

ISC

## Support

For issues or questions, please refer to the project documentation or contact the development team.

