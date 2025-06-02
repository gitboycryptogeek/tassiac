-- CreateTable
CREATE TABLE "Users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT,
    "lastLogin" DATETIME,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminActions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "actionType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "actionData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "initiatedById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminActions_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "Users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminActionApprovals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adminActionId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminActionApprovals_adminActionId_fkey" FOREIGN KEY ("adminActionId") REFERENCES "AdminActions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdminActionApprovals_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpecialOfferings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "offeringCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetAmount" REAL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "customFields" JSONB,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpecialOfferings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "paymentType" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "transactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "receiptNumber" TEXT,
    "paymentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platformFee" REAL NOT NULL DEFAULT 0.00,
    "titheDistributionSDA" JSONB,
    "isExpense" BOOLEAN NOT NULL DEFAULT false,
    "department" TEXT,
    "expenseReceiptUrl" TEXT,
    "processedById" INTEGER,
    "specialOfferingId" INTEGER,
    "isTemplate" BOOLEAN DEFAULT false,
    "targetGoal" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payments_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "Users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payments_specialOfferingId_fkey" FOREIGN KEY ("specialOfferingId") REFERENCES "SpecialOfferings" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Receipts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receiptNumber" TEXT NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "generatedById" INTEGER,
    "receiptDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptData" JSONB NOT NULL,
    "pdfPath" TEXT,
    "attachmentPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Receipts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Receipts_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "Users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "notificationType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reference" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "responseData" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactInquiries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedById" INTEGER,
    "handledById" INTEGER,
    "resolutionNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContactInquiries_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "Users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContactInquiries_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "Users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_username_key" ON "Users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Users_phone_key" ON "Users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialOfferings_offeringCode_key" ON "SpecialOfferings"("offeringCode");

-- CreateIndex
CREATE UNIQUE INDEX "Payments_transactionId_key" ON "Payments"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payments_receiptNumber_key" ON "Payments"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Receipts_receiptNumber_key" ON "Receipts"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Receipts_paymentId_key" ON "Receipts"("paymentId");
