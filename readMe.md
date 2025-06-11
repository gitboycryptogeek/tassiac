# 🏛️ Tassia Central SDA Church Management System

A comprehensive, secure, and robust church management system built with Node.js, Express, Prisma, and React. Features advanced payment processing with KCB integration, wallet management, batch payments, and multi-admin approvals.

## 🚀 Features

### Core Functionality
- **User Authentication & Authorization** - JWT-based with role management
- **Payment Processing** - KCB Bank & M-Pesa integration with atomic transactions
- **Batch Payment Management** - Process multiple payments efficiently
- **Wallet System** - Segregated funds with race-condition protection
- **Receipt Generation** - Automatic PDF receipt creation
- **Special Offerings Management** - Track fundraising campaigns
- **Admin Activity Logging** - Comprehensive audit trail
- **Multi-Admin Withdrawal Approvals** - Secure fund management
- **Contact Form Management** - Handle inquiries systematically
- **Transaction Synchronization** - Auto-sync with KCB transactions
- **SMS Notifications** - Automated payment confirmations

### Security Features
- **Atomic Database Operations** - Prevent race conditions and double spending
- **Environment Variable Validation** - Startup-time configuration checking
- **Rate Limiting** - Protection against abuse
- **Input Validation** - Comprehensive request validation
- **SQL Injection Prevention** - Prisma ORM protection
- **XSS Protection** - Helmet.js security headers
- **CORS Configuration** - Secure cross-origin requests

## 🛠️ Prerequisites

- **Node.js** 16.x or higher
- **PostgreSQL** 12+ (or MySQL 8+/SQLite for development)
- **npm** or **yarn**
- **KCB Bank API** credentials (for payment processing)
- **M-Pesa API** credentials (optional, for M-Pesa payments)
- **Africa's Talking** account (optional, for SMS notifications)

## ⚡ Quick Start

### 1. Clone and Install
```bash
git clone <repository-url>
cd tassia-church-system
npm install
```

### 2. Environment Setup
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual values
nano .env
```

### 3. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Seed initial data (optional)
npx prisma db seed
```

### 4. System Validation
```bash
# Run the startup validation script
node scripts/startup.js
```

### 5. Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🔧 Environment Variables

### Required Variables

```bash
# Database Configuration
DATABASE_URL_PRISMA="postgresql://user:password@localhost:5432/church_db"

# Security
JWT_SECRET="your-very-secure-jwt-secret-key-minimum-32-chars"
SESSION_SECRET="your-very-secure-session-secret-key-minimum-32-chars"

# KCB Integration (Required for payments)
KCB_API_KEY="your-kcb-api-key"
KCB_SECRET_KEY="your-kcb-secret-key"
KCB_MERCHANT_ID="your-merchant-id"
KCB_ACCOUNT_NUMBER="your-account-number"

# Application URLs
BACKEND_URL="https://your-backend-domain.com"
```

### Production Variables

```bash
# Frontend
FRONTEND_URL="https://your-frontend-domain.com"

# M-Pesa (if using M-Pesa payments)
MPESA_LIVE_CONSUMER_KEY="your-mpesa-consumer-key"
MPESA_LIVE_CONSUMER_SECRET="your-mpesa-consumer-secret"
MPESA_LIVE_SHORTCODE="your-shortcode"
MPESA_LIVE_PASSKEY="your-passkey"
MPESA_LIVE_CALLBACK_URL="https://your-backend-domain.com/api/payment/mpesa/callback"

# Withdrawal Security (3 different passwords for multi-admin approval)
WITHDRAWAL_PASSWORD_1="secure-withdrawal-password-1"
WITHDRAWAL_PASSWORD_2="secure-withdrawal-password-2"
WITHDRAWAL_PASSWORD_3="secure-withdrawal-password-3"
```

### Optional Variables

```bash
# KCB Configuration
KCB_BASE_URL="https://api.kcbgroup.com"  # Use UAT URL for testing
KCB_CALLBACK_URL="https://your-backend-domain.com/api/payment/kcb/callback"

# SMS Notifications
AFRICASTALKING_API_KEY="your-africastalking-api-key"
AFRICASTALKING_USERNAME="your-africastalking-username"
AFRICASTALKING_SENDER_ID="CHURCH"

# Admin Configuration
VIEW_ONLY_ADMIN_USERNAMES="readonly_admin1,readonly_admin2"
MAX_ADMIN_COUNT="5"

# Church Information
CHURCH_CONTACT_EMAIL="info@your-church.org"
CHURCH_CONTACT_PHONE="+254 700 000 000"
CHURCH_ADDRESS="Your Church Address"

# Server Configuration
PORT="3000"
NODE_ENV="production"
```

## 🏗️ System Architecture

### Payment Flow
1. **User Initiates Payment** → Frontend sends request
2. **Gateway Integration** → KCB/M-Pesa STK Push initiated
3. **Database Record** → Payment record created (PENDING)
4. **User Completes** → Payment via mobile phone
5. **Callback Processing** → Gateway sends result to callback URL
6. **Atomic Update** → Database updated, receipt generated
7. **Notification** → SMS sent to user

### Batch Payment Flow
1. **Admin Creates Batch** → Multiple payments bundled
2. **KCB Deposit** → Admin deposits total amount
3. **Completion** → Individual payments marked complete
4. **Wallet Update** → Funds distributed to appropriate wallets
5. **Receipt Generation** → Individual receipts created

### Withdrawal Flow
1. **Request Creation** → Admin requests withdrawal
2. **Multi-Admin Approval** → 3 admins must approve
3. **Atomic Processing** → Wallet balance updated
4. **Expense Record** → Withdrawal recorded as expense
5. **KCB Transfer** → Funds transferred via KCB API

## 🔒 Security Measures

### Database Security
- **Atomic Transactions** - All critical operations use database transactions
- **Race Condition Prevention** - Row-level locking and increment operations
- **Input Validation** - express-validator on all endpoints
- **SQL Injection Prevention** - Prisma ORM with parameterized queries

### Authentication & Authorization
- **JWT Tokens** - Secure, stateless authentication
- **Role-Based Access** - Admin, user, and view-only admin roles
- **Session Management** - Secure session configuration
- **Password Security** - bcrypt hashing with salt rounds

### API Security
- **Rate Limiting** - Prevent API abuse
- **CORS Configuration** - Secure cross-origin requests
- **Security Headers** - Helmet.js protection
- **Input Sanitization** - Prevent XSS attacks

## 📊 Wallet System

The wallet system segregates funds by purpose to prevent misuse:

### Wallet Types
- **TITHE** - Tithe collections with SDA categories
  - `campMeetingExpenses`
  - `welfare`
  - `thanksgiving`
  - `stationFund`
  - `mediaMinistry`
- **OFFERING** - General offerings
- **DONATION** - Donations
- **SPECIAL_OFFERING** - Special campaigns (auto-created)

### Atomic Operations
- All wallet updates use atomic increment/decrement operations
- Race conditions prevented with proper transaction isolation
- Balance validation prevents negative balances
- Withdrawal approval system prevents unauthorized access

## 🔄 KCB Integration

### Supported Operations
- **STK Push** - Mobile payment initiation
- **Transaction Query** - Payment status checking
- **Account Balance** - Real-time balance retrieval
- **Transaction History** - Historical transaction data
- **Fund Transfer** - Withdrawal processing
- **Transaction Sync** - Auto-sync with bank transactions

### Configuration
```javascript
// KCB endpoints are automatically configured based on environment
const KCB_CONFIG = {
  baseUrl: process.env.KCB_BASE_URL,
  endpoints: {
    stkPush: '/kcb/mpesa/stk/1.0.0/api/v1/stkpush',
    balance: '/kcb/account/balance/1.0.0/api/v1/account/balance',
    transactions: '/kcb/transaction/history/1.0.0/api/v1/transactions',
    transfer: '/kcb/funds/transfer/1.0.0/api/v1/transfer'
  }
};
```

## 🛡️ Admin Features

### Multi-Level Administration
- **Super Admin** - Full system access
- **Regular Admin** - Limited administrative functions
- **View-Only Admin** - Read-only access (configurable usernames)

### Batch Operations
- Create multiple payments simultaneously
- Process deposits via KCB integration
- Automatic wallet distribution
- Comprehensive receipt generation

### Withdrawal Management
- Multi-admin approval requirement (3 approvals)
- Password-based verification
- Automatic expense recording
- KCB transfer integration

## 📈 Monitoring & Logging

### Activity Logging
- All admin actions logged with details
- Payment processing events tracked
- Error logging with stack traces
- Performance monitoring capabilities

### Health Checks
- `/api/health` - General system health
- `/api/receipt-health` - Receipt system status
- `/api/system/status` - Detailed system metrics
- Database connection monitoring

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
# Build (if using frontend build)
npm run build

# Start production server
npm start
```

### Docker (Optional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables Validation
The system includes comprehensive environment validation that runs at startup:
- Required variables checked
- Production-specific validation
- Security pattern detection
- Configuration completeness verification

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Register user (admin only)
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/change-password` - Change password

### Payments
- `GET /api/payment/all` - Get all payments (admin)
- `GET /api/payment/user/:userId?` - Get user payments
- `POST /api/payment/initiate` - Initiate payment (KCB/M-Pesa)
- `POST /api/payment/manual` - Add manual payment (admin)
- `GET /api/payment/status/:paymentId` - Check payment status

### Batch Payments
- `POST /api/batch-payments` - Create batch payment
- `GET /api/batch-payments` - Get all batch payments
- `POST /api/batch-payments/:batchId/deposit` - Process KCB deposit
- `POST /api/batch-payments/:batchId/complete` - Complete batch

### Wallets
- `GET /api/wallets` - Get all wallets
- `POST /api/wallets/initialize` - Initialize wallet system
- `POST /api/wallets/update-balances` - Update from payments
- `POST /api/wallets/withdraw` - Create withdrawal request
- `POST /api/wallets/withdrawals/:id/approve` - Approve withdrawal

### Receipts
- `GET /api/receipt/all` - Get all receipts (admin)
- `GET /api/receipt/user/:userId?` - Get user receipts
- `GET /api/receipt/:receiptId` - Get specific receipt
- `GET /api/receipt/:receiptId/pdf` - Download PDF receipt

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the system health endpoints for diagnostics

## 🔄 Updates & Maintenance

### Regular Maintenance
- Monitor system health endpoints
- Review admin activity logs
- Update environment variables as needed
- Backup database regularly
- Update dependencies for security patches

### System Monitoring
The system includes comprehensive monitoring:
- Real-time health checks
- Payment processing status
- Database connection monitoring
- KCB integration status
- Wallet balance tracking

---

**Built with ❤️ for Tassia Central SDA Church**