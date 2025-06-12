# 🏛️ Tassia Central SDA Church Management System

A comprehensive, secure, and robust church management system built with Node.js, Express, Prisma, and React. Features advanced payment processing with KCB integration, wallet management, batch payments, multi-admin approvals, and production-ready API services.

## 🚀 Features

### Core Functionality
- **Advanced User Authentication & Authorization** - JWT-based with role management, automatic token refresh
- **Payment Processing** - KCB Bank & M-Pesa integration with atomic transactions
- **Batch Payment Management** - Process multiple payments efficiently with progress tracking
- **Wallet System** - Segregated funds with race-condition protection and atomic operations
- **Receipt Generation** - Automatic PDF receipt creation with digital signatures
- **Special Offerings Management** - Track fundraising campaigns with progress monitoring
- **Admin Activity Logging** - Comprehensive audit trail with activity tracking
- **Multi-Admin Withdrawal Approvals** - Secure fund management with three-tier approval
- **Contact Form Management** - Handle inquiries systematically with status tracking
- **Transaction Synchronization** - Auto-sync with KCB transactions and reconciliation
- **SMS Notifications** - Automated payment confirmations via Africa's Talking

### Security Features
- **Atomic Database Operations** - Prevent race conditions and double spending
- **Environment Variable Validation** - Startup-time configuration checking
- **Rate Limiting** - Protection against abuse with configurable limits
- **Input Validation** - Comprehensive request validation with sanitization
- **SQL Injection Prevention** - Prisma ORM protection with parameterized queries
- **XSS Protection** - Helmet.js security headers and content sanitization
- **CORS Configuration** - Secure cross-origin requests with origin validation
- **Advisory Locking** - PostgreSQL advisory locks for critical operations

### Production API Service Features
- **Comprehensive Endpoint Coverage** - All backend endpoints with type safety
- **Advanced Error Handling** - Retry logic with exponential backoff
- **Request/Response Caching** - Intelligent caching with TTL and invalidation
- **File Upload/Download** - Progress tracking and validation
- **Offline Support** - Request queuing and connection monitoring
- **Automatic Token Refresh** - Seamless authentication management
- **Request Deduplication** - Prevents duplicate concurrent requests
- **Performance Monitoring** - Request metrics and response time tracking
- **Connection Status Monitoring** - Real-time online/offline detection
- **Event System** - Reactive programming with custom events

## 🛠️ Prerequisites

- **Node.js** 18.x or higher
- **PostgreSQL** 14+ (or MySQL 8+/SQLite for development)
- **npm** or **yarn** or **pnpm**
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

# Frontend Configuration (for ApiService)
VITE_API_BASE_URL="/api"
```

## 🏗️ System Architecture

### Payment Flow
1. **User Initiates Payment** → Frontend sends request via ApiService
2. **Gateway Integration** → KCB/M-Pesa STK Push initiated with retry logic
3. **Database Record** → Payment record created (PENDING) with atomic operations
4. **User Completes** → Payment via mobile phone
5. **Callback Processing** → Gateway sends result to callback URL with validation
6. **Atomic Update** → Database updated, wallet balances updated, receipt generated
7. **Notification** → SMS sent to user with delivery confirmation

### Batch Payment Flow
1. **Admin Creates Batch** → Multiple payments bundled with validation
2. **KCB Deposit** → Admin deposits total amount with progress tracking
3. **Completion** → Individual payments marked complete atomically
4. **Wallet Update** → Funds distributed to appropriate wallets with locking
5. **Receipt Generation** → Individual receipts created with PDF generation

### Withdrawal Flow
1. **Request Creation** → Admin requests withdrawal with validation
2. **Multi-Admin Approval** → 3 admins must approve with secure passwords
3. **Atomic Processing** → Wallet balance updated with advisory locking
4. **Expense Record** → Withdrawal recorded as expense with audit trail
5. **KCB Transfer** → Funds transferred via KCB API with confirmation

## 🔒 Security Measures

### Database Security
- **Atomic Transactions** - All critical operations use database transactions
- **Advisory Locking** - PostgreSQL advisory locks prevent race conditions
- **Input Validation** - express-validator on all endpoints with sanitization
- **SQL Injection Prevention** - Prisma ORM with parameterized queries
- **Row-Level Security** - Database-level access controls where applicable

### Authentication & Authorization
- **JWT Tokens** - Secure, stateless authentication with automatic refresh
- **Role-Based Access** - Admin, user, and view-only admin roles with permissions
- **Session Management** - Secure session configuration with proper expiry
- **Password Security** - bcrypt hashing with configurable salt rounds
- **Token Validation** - Continuous token validation with automatic refresh

### API Security
- **Rate Limiting** - Prevent API abuse with configurable limits
- **CORS Configuration** - Secure cross-origin requests with whitelist
- **Security Headers** - Helmet.js protection with CSP policies
- **Input Sanitization** - Prevent XSS attacks with comprehensive filtering
- **Request Validation** - Schema-based validation with error handling

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
- Race conditions prevented with PostgreSQL advisory locks
- Balance validation prevents negative balances
- Withdrawal approval system prevents unauthorized access
- Comprehensive audit trail for all wallet operations

## 🔄 KCB Integration

### Supported Operations
- **STK Push** - Mobile payment initiation with progress tracking
- **Transaction Query** - Payment status checking with polling
- **Account Balance** - Real-time balance retrieval with caching
- **Transaction History** - Historical transaction data with pagination
- **Fund Transfer** - Withdrawal processing with confirmation
- **Transaction Sync** - Auto-sync with bank transactions and reconciliation

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
- **Super Admin** - Full system access with all permissions
- **Regular Admin** - Limited administrative functions
- **View-Only Admin** - Read-only access (configurable usernames)

### Batch Operations
- Create multiple payments simultaneously with validation
- Process deposits via KCB integration with progress tracking
- Automatic wallet distribution with atomic operations
- Comprehensive receipt generation with PDF creation

### Withdrawal Management
- Multi-admin approval requirement (3 approvals) with secure passwords
- Password-based verification with attempt limiting
- Automatic expense recording with audit trail
- KCB transfer integration with confirmation tracking

## 📈 Monitoring & Logging

### Activity Logging
- All admin actions logged with comprehensive details
- Payment processing events tracked with timestamps
- Error logging with stack traces and context
- Performance monitoring with response time tracking

### Health Checks
- `/api/health` - General system health with dependency checks
- `/api/receipt-health` - Receipt system status with PDF validation
- `/api/system/status` - Detailed system metrics with performance data
- Database connection monitoring with automatic reconnection

## 🚀 Production API Service

### ApiService.js Features

#### Core Functionality
```javascript
// Initialize the service
import apiService from './utils/apiService.js';

// Check service status
console.log(apiService.getServiceStatus());

// Monitor connection
apiService.on('online', () => console.log('Connected'));
apiService.on('offline', () => console.log('Disconnected'));
```

#### Authentication
```javascript
// Login with automatic token management
const result = await apiService.login({ username, password });

// Automatic token refresh
// Tokens are automatically refreshed when needed

// Logout with cleanup
await apiService.logout();
```

#### Payment Operations
```javascript
// Initiate payments with validation
const payment = await apiService.initiatePayment({
  amount: 1000,
  paymentType: 'TITHE',
  paymentMethod: 'KCB',
  phoneNumber: '0712345678',
  titheDistributionSDA: {
    welfare: 500,
    thanksgiving: 300,
    stationFund: 200
  }
});

// Get payments with caching
const payments = await apiService.getAllPayments({
  page: 1,
  limit: 20,
  startDate: '2024-01-01',
  status: 'COMPLETED'
});
```

#### File Operations
```javascript
// Upload files with progress tracking
const result = await apiService.addManualPayment(paymentData, receiptFile);

// Download receipts
await apiService.downloadReceipt(receiptId, 'custom-filename.pdf');
```

#### Batch Operations
```javascript
// Create batch payments
const batch = await apiService.createBatchPayment({
  payments: paymentsArray,
  description: 'Monthly batch processing'
});

// Process batch with progress
await apiService.processBatchDeposit(batchId, {
  phoneNumber: '0712345678',
  depositDescription: 'Batch deposit via KCB'
});
```

#### Wallet Management
```javascript
// Get wallet information
const wallets = await apiService.getAllWallets();

// Create withdrawal requests
const withdrawal = await apiService.createWithdrawalRequest({
  walletId: 1,
  amount: 5000,
  purpose: 'Church maintenance',
  withdrawalMethod: 'BANK_TRANSFER',
  destinationAccount: '1234567890'
});

// Approve withdrawals
await apiService.approveWithdrawalRequest(withdrawalId, {
  password: 'secure-approval-password',
  comment: 'Approved for maintenance work'
});
```

#### Special Offerings
```javascript
// Create special offerings
const offering = await apiService.createSpecialOffering({
  name: 'Building Fund 2024',
  description: 'Fundraising for new church building',
  targetAmount: 1000000,
  startDate: '2024-01-01',
  endDate: '2024-12-31'
});

// Track progress
const progress = await apiService.getSpecialOfferingProgress(offeringId);
```

#### Administrative Functions
```javascript
// Get dashboard statistics
const stats = await apiService.getDashboardStats();

// Generate reports
const report = await apiService.generateReport({
  reportType: 'COMPREHENSIVE',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  format: 'pdf'
});

// Manage users
const users = await apiService.getAllUsers();
await apiService.updateUser(userId, updatedData);
```

### Advanced Features

#### Caching System
```javascript
// Automatic caching with TTL
const data = await apiService.get('/endpoint', params, {
  cache: true,
  cacheDuration: 300000 // 5 minutes
});

// Cache invalidation
apiService.invalidateCache('/pattern');
```

#### Offline Support
```javascript
// Requests are automatically queued when offline
await apiService.post('/endpoint', data, {
  queueIfOffline: true
});

// Monitor connection status
const status = apiService.getConnectionStatus();
```

#### Performance Monitoring
```javascript
// Get performance metrics
const metrics = apiService.getPerformanceMetrics();
console.log(`Success rate: ${metrics.successRate}`);
console.log(`Average response time: ${metrics.averageResponseTime}ms`);
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login with token generation
- `POST /api/auth/register` - Register user (admin only)
- `GET /api/auth/profile` - Get user profile with caching
- `POST /api/auth/change-password` - Change password with validation
- `POST /api/auth/refresh` - Refresh authentication token
- `GET /api/auth/logout` - Logout with cleanup

### User Management
- `GET /api/auth/users` - Get all users (admin) with pagination
- `PUT /api/auth/users/:userId` - Update user (admin) with validation
- `DELETE /api/auth/users/:userId` - Delete user (admin) with safety checks
- `POST /api/auth/reset-password/:userId` - Reset user password (admin)

### Payments
- `GET /api/payment/all` - Get all payments (admin) with advanced filtering
- `GET /api/payment/user/:userId?` - Get user payments with pagination
- `GET /api/payment/stats` - Get payment statistics with caching
- `POST /api/payment/initiate` - Initiate payment (unified KCB/M-Pesa)
- `POST /api/payment/manual` - Add manual payment (admin) with file upload
- `GET /api/payment/status/:paymentId` - Check payment status
- `PUT /api/payment/:paymentId/status` - Update payment status (admin)
- `DELETE /api/payment/:paymentId` - Delete payment (admin)

### Batch Payments
- `POST /api/batch-payments` - Create batch payment with validation
- `GET /api/batch-payments` - Get all batch payments with filtering
- `GET /api/batch-payments/:batchId` - Get batch details with caching
- `POST /api/batch-payments/:batchId/add-items` - Add items to batch
- `POST /api/batch-payments/:batchId/deposit` - Process KCB deposit
- `POST /api/batch-payments/:batchId/complete` - Complete batch processing
- `DELETE /api/batch-payments/:batchId` - Cancel batch payment

### Receipts
- `GET /api/receipt/all` - Get all receipts (admin) with search
- `GET /api/receipt/user/:userId?` - Get user receipts with pagination
- `GET /api/receipt/:receiptId` - Get receipt details with caching
- `GET /api/receipt/:receiptId/pdf` - Generate/download PDF receipt
- `POST /api/receipt/:receiptId/attachment` - Upload receipt attachment

### Special Offerings
- `POST /api/special-offerings` - Create special offering (admin)
- `GET /api/special-offerings` - Get all special offerings with filtering
- `GET /api/special-offerings/:identifier` - Get specific offering
- `PUT /api/special-offerings/:identifier` - Update offering (admin)
- `DELETE /api/special-offerings/:identifier` - Delete offering (admin)
- `GET /api/special-offerings/:identifier/progress` - Get progress with caching
- `POST /api/special-offerings/:identifier/contribution` - Make contribution

### Contact Management
- `GET /api/contact/info` - Get contact information (public, cached)
- `POST /api/contact/submit` - Submit contact form (public, with validation)
- `GET /api/contact/inquiries` - Get all inquiries (admin) with filtering
- `GET /api/contact/inquiries/:inquiryId` - Get inquiry details (admin)
- `PUT /api/contact/inquiries/:inquiryId/status` - Update inquiry status (admin)
- `DELETE /api/contact/inquiries/:inquiryId` - Archive inquiry (admin)

### Wallet Management
- `GET /api/wallets/all` - Get all wallets with comprehensive data
- `GET /api/wallets/:walletId/transactions` - Get wallet transaction history
- `POST /api/wallets/initialize` - Initialize wallet system (admin)
- `POST /api/wallets/recalculate` - Recalculate balances (admin)
- `POST /api/wallets/update-balances` - Update specific wallet balances (admin)
- `GET /api/wallets/withdrawals` - Get withdrawal requests with filtering
- `POST /api/wallets/withdrawals` - Create withdrawal request with validation
- `POST /api/wallets/withdrawals/:withdrawalId/approve` - Approve withdrawal
- `POST /api/wallets/validate-tithe` - Validate tithe distribution

### KCB Synchronization
- `GET /api/kcb-sync/balance` - Get KCB account balance with caching
- `GET /api/kcb-sync/transactions` - Get KCB transaction history
- `POST /api/kcb-sync/sync` - Sync KCB transactions with reconciliation
- `GET /api/kcb-sync/unlinked` - Get unlinked transactions
- `POST /api/kcb-sync/link` - Manually link transaction
- `PUT /api/kcb-sync/ignore/:kcbSyncId` - Mark transaction as ignored
- `GET /api/kcb-sync/statistics` - Get sync statistics with analytics

### Administrative
- `GET /api/admin/activity` - Get admin activity with pagination
- `POST /api/admin/activity-log` - Create activity log entry
- `GET /api/admin/dashboard-stats` - Get dashboard statistics with caching
- `POST /api/admin/reports` - Generate comprehensive reports

### System Health
- `GET /api/health` - System health check with dependency validation
- `GET /api/system/status` - Detailed system status (admin)
- `GET /api/receipt-health` - Receipt system health check

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
# Build frontend (if applicable)
npm run build

# Start production server
npm start
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables Validation
The system includes comprehensive environment validation that runs at startup:
- Required variables checked with pattern validation
- Production-specific validation with security checks
- Security pattern detection for weak configurations
- Configuration completeness verification with detailed error messages

## 🔧 Frontend Integration

### ApiService Usage Examples

```javascript
// Initialize and use the service
import apiService from './utils/apiService.js';

// Login
const loginResult = await apiService.login({
  username: 'admin',
  password: 'securepassword'
});

// Get current user
const user = apiService.getCurrentUser();

// Make payments
const payment = await apiService.initiatePayment({
  amount: 1000,
  paymentType: 'TITHE',
  phoneNumber: '0712345678'
});

// Monitor service status
console.log(apiService.getServiceStatus());
```

### Event Handling
```javascript
// Listen to service events
apiService.on('login', (data) => {
  console.log('User logged in:', data.user);
});

apiService.on('offline', () => {
  showOfflineMessage();
});

apiService.on('online', () => {
  hideOfflineMessage();
});
```

### Error Handling
```javascript
try {
  const result = await apiService.someMethod();
} catch (error) {
  if (error.status === 401) {
    // Handle authentication error
    redirectToLogin();
  } else if (error.status >= 500) {
    // Handle server error
    showServerErrorMessage();
  } else {
    // Handle other errors
    showErrorMessage(error.message);
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style and patterns
- Add comprehensive tests for new features
- Update documentation for API changes
- Ensure all environment validations pass
- Test with both development and production configurations

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository with detailed information
- Contact the development team through official channels
- Check the system health endpoints for diagnostics
- Review the comprehensive logging for troubleshooting

## 🔄 Updates & Maintenance

### Regular Maintenance
- Monitor system health endpoints for performance metrics
- Review admin activity logs for security auditing
- Update environment variables as configuration changes
- Backup database regularly with automated scripts
- Update dependencies for security patches and performance improvements
- Monitor KCB integration status and transaction synchronization

### System Monitoring
The system includes comprehensive monitoring capabilities:
- Real-time health checks with dependency validation
- Payment processing status with error tracking
- Database connection monitoring with automatic reconnection
- KCB integration status with transaction reconciliation
- Wallet balance tracking with audit trails
- Performance metrics with response time analysis
- Cache efficiency monitoring with hit rate tracking

### Performance Optimization
- Request caching with intelligent invalidation
- Database query optimization with index analysis
- Connection pooling for improved performance
- Rate limiting to prevent system abuse
- Background job processing for heavy operations
- CDN integration for static asset delivery

---

**Built with ❤️ for Tassia Central SDA Church**

*Version 2.0.0 - Production Ready with Advanced API Service*