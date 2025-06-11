-- CreateTable
CREATE TABLE "Users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT,
    "lastLogin" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActions" (
    "id" SERIAL NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "actionData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "initiatedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminActions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActionApprovals" (
    "id" SERIAL NOT NULL,
    "adminActionId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminActionApprovals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialOfferings" (
    "id" SERIAL NOT NULL,
    "offeringCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetAmount" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "customFields" JSONB,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialOfferings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payments" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentType" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "transactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "receiptNumber" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    "titheDistributionSDA" JSONB,
    "isExpense" BOOLEAN NOT NULL DEFAULT false,
    "department" TEXT,
    "expenseReceiptUrl" TEXT,
    "processedById" INTEGER,
    "specialOfferingId" INTEGER,
    "isTemplate" BOOLEAN DEFAULT false,
    "targetGoal" DOUBLE PRECISION,
    "batchPaymentId" INTEGER,
    "isBatchProcessed" BOOLEAN NOT NULL DEFAULT false,
    "kcbTransactionId" TEXT,
    "kcbReference" TEXT,
    "bankDepositStatus" TEXT DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchPayments" (
    "id" SERIAL NOT NULL,
    "batchReference" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "createdById" INTEGER NOT NULL,
    "processedById" INTEGER,
    "kcbTransactionId" TEXT,
    "kcbReference" TEXT,
    "depositedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchPayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallets" (
    "id" SERIAL NOT NULL,
    "walletType" TEXT NOT NULL,
    "subType" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeposits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWithdrawals" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "specialOfferingId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequests" (
    "id" SERIAL NOT NULL,
    "withdrawalReference" TEXT NOT NULL,
    "walletId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "purpose" TEXT NOT NULL,
    "description" TEXT,
    "requestedById" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "withdrawalMethod" TEXT NOT NULL,
    "destinationAccount" TEXT,
    "destinationPhone" TEXT,
    "kcbTransactionId" TEXT,
    "kcbReference" TEXT,
    "requiredApprovals" INTEGER NOT NULL DEFAULT 3,
    "currentApprovals" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalRequests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalApprovals" (
    "id" SERIAL NOT NULL,
    "withdrawalRequestId" INTEGER NOT NULL,
    "approvedById" INTEGER NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "password" TEXT,
    "approvalMethod" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalApprovals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KcbTransactionSyncs" (
    "id" SERIAL NOT NULL,
    "kcbTransactionId" TEXT NOT NULL,
    "kcbReference" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "transactionType" TEXT NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'UNLINKED',
    "linkedPaymentId" INTEGER,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KcbTransactionSyncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipts" (
    "id" SERIAL NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "generatedById" INTEGER,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptData" JSONB NOT NULL,
    "pdfPath" TEXT,
    "attachmentPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notifications" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "notificationType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reference" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "responseData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactInquiries" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedById" INTEGER,
    "handledById" INTEGER,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactInquiries_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "BatchPayments_batchReference_key" ON "BatchPayments"("batchReference");

-- CreateIndex
CREATE UNIQUE INDEX "Wallets_walletType_subType_key" ON "Wallets"("walletType", "subType");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalRequests_withdrawalReference_key" ON "WithdrawalRequests"("withdrawalReference");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalApprovals_withdrawalRequestId_approvedById_key" ON "WithdrawalApprovals"("withdrawalRequestId", "approvedById");

-- CreateIndex
CREATE UNIQUE INDEX "KcbTransactionSyncs_kcbTransactionId_key" ON "KcbTransactionSyncs"("kcbTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipts_receiptNumber_key" ON "Receipts"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Receipts_paymentId_key" ON "Receipts"("paymentId");

-- AddForeignKey
ALTER TABLE "AdminActions" ADD CONSTRAINT "AdminActions_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActionApprovals" ADD CONSTRAINT "AdminActionApprovals_adminActionId_fkey" FOREIGN KEY ("adminActionId") REFERENCES "AdminActions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActionApprovals" ADD CONSTRAINT "AdminActionApprovals_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialOfferings" ADD CONSTRAINT "SpecialOfferings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_specialOfferingId_fkey" FOREIGN KEY ("specialOfferingId") REFERENCES "SpecialOfferings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_batchPaymentId_fkey" FOREIGN KEY ("batchPaymentId") REFERENCES "BatchPayments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchPayments" ADD CONSTRAINT "BatchPayments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchPayments" ADD CONSTRAINT "BatchPayments_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequests" ADD CONSTRAINT "WithdrawalRequests_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequests" ADD CONSTRAINT "WithdrawalRequests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalApprovals" ADD CONSTRAINT "WithdrawalApprovals_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "WithdrawalRequests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalApprovals" ADD CONSTRAINT "WithdrawalApprovals_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipts" ADD CONSTRAINT "Receipts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipts" ADD CONSTRAINT "Receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipts" ADD CONSTRAINT "Receipts_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactInquiries" ADD CONSTRAINT "ContactInquiries_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactInquiries" ADD CONSTRAINT "ContactInquiries_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
