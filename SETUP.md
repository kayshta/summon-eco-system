# Setup Guide

## Initial Setup

### 1. Database Setup

```bash
# Create MySQL database
mysql -u root -p < database/schema.sql
```

Or use Docker:
```bash
docker-compose up -d mysql
# Wait for MySQL to be ready, then:
mysql -h localhost -u root -prootpassword < database/schema.sql
```

### 2. Backend Setup

```bash
cd backend
npm install

# Copy environment file
cp env.example .env

# Edit .env with your settings:
# - Database credentials
# - JWT_SECRET (generate a strong random string)
# - Twilio credentials (for WhatsApp)
```

Set up default password hashes (run after database is ready):
```bash
npm run setup-passwords
```

This will set proper bcrypt hashes for:
- Admin: admin@greenfield.example / admin123
- Teachers: teachera@greenfield.example / teacher123

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 5. Access the Application

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Admin Login: admin@greenfield.example / admin123
- Teacher Login: teachera@greenfield.example / teacher123

## Docker Setup (Alternative)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Twilio WhatsApp Setup

1. Create a Twilio account at https://www.twilio.com
2. Get your Account SID and Auth Token
3. Set up WhatsApp Sandbox (for testing) or use approved WhatsApp Business number
4. Add credentials to `backend/.env`:
   ```
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   ```

## Testing the System

### 1. Test Student Import
- Go to Admin → Students → Import from Excel
- Upload `sample_students.csv`
- Preview and import

### 2. Test QR Code Generation
- Go to Admin → QR Manager
- Download QR code for a class
- Print or display on screen

### 3. Test QR Scan
- Login as Teacher
- Go to Teacher → Scan QR
- Scan the QR code generated above
- Verify teacher is marked as present

### 4. Test Student Summon
- Login as Admin
- Go to Admin → Call Student
- Search for a student
- Enter reason and submit
- Verify WhatsApp message sent (if teacher is present)

## Production Checklist

- [ ] Change all default passwords
- [ ] Set strong JWT_SECRET
- [ ] Configure production database
- [ ] Set up Twilio production WhatsApp number
- [ ] Enable HTTPS
- [ ] Configure proper CORS origins
- [ ] Set up database backups
- [ ] Configure monitoring and logging
- [ ] Review and update rate limits
- [ ] Test all workflows end-to-end

