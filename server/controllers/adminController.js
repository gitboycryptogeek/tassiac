// server/controllers/adminController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit'); // For PDF report generation

const prisma = new PrismaClient();

// Setup debug log file
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'admin-controller-debug.log');

function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] ADMIN_CTRL: ${message}`;
  if (data !== null) {
    try {
      const dataStr = JSON.stringify(data);
      logMessage += ` | Data: ${dataStr}`;
    } catch (err) {
      logMessage += ` | Data: [Failed to stringify: ${err.message}]`;
    }
  }
  console.log(logMessage);
 
  return logMessage;
}

// Helper for sending standardized responses
const sendResponse = (res, statusCode, success, data, message, errorDetails = null) => {
  const responsePayload = { success, message };
  if (data !== null && data !== undefined) {
    responsePayload.data = data;
  }
  if (errorDetails) {
    responsePayload.error = errorDetails;
  }
  return res.status(statusCode).json(responsePayload);
};

// Helper to check for view-only admin (ADAPT THIS LOGIC)
const isViewOnlyAdmin = (user) => {
  if (!user || !user.isAdmin) return false;
  const viewOnlyUsernames = ['admin3', 'admin4', 'admin5']; // Example
  return viewOnlyUsernames.includes(user.username);
};

// Log Admin Activity
async function logAdminActivity(actionType, targetId, initiatedBy, actionData = {}) {
  try {
    await prisma.adminAction.create({
      data: {
        actionType,
        targetId: String(targetId),
        initiatedBy,
        actionData,
        status: 'COMPLETED',
      },
    });
    debugLog(`Admin activity logged: ${actionType} for target ${targetId} by user ${initiatedBy}`);
  } catch (error) {
    debugLog(`Error logging admin activity for ${actionType} on ${targetId}:`, error.message);
  }
}

// Helper to format date for PDF (consider moving to a shared util)
const formatDateForPdf = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch (e) { return dateString.toString(); }
};


// Get recent admin activity
exports.getRecentActivity = async (req, res) => {
  debugLog('Admin: Get Recent Activity attempt started');
  try {
    const { limit = 20, page = 1 } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const activities = await prisma.adminAction.findMany({
      include: {
        initiator: { // Relation name from Prisma schema for User who initiated
          select: { id: true, username: true, fullName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip
    });

    const totalActivities = await prisma.adminAction.count();

    debugLog(`Retrieved ${activities.length} recent admin activities.`);
    return sendResponse(res, 200, true, {
        activities,
        totalPages: Math.ceil(totalActivities / take),
        currentPage: parseInt(page),
        totalActivities
    }, 'Recent admin activities retrieved successfully.');

  } catch (error) {
    debugLog('Admin: Error fetching admin activity:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching admin activity.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Create admin action log (can be an internal helper or a specific endpoint if needed)
// If this is only called internally, it doesn't need to be an exported controller function.
// For now, assuming it might be called via an API route by an admin for specific logging.
exports.createActivityLog = async (req, res) => {
  debugLog('Admin: Create Activity Log attempt started');
  try {
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot create activity logs directly.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { actionType, targetId, actionData } = req.body;
    if (!actionType || !targetId) {
      return sendResponse(res, 400, false, null, 'Action type and target ID are required.', { code: 'MISSING_FIELDS' });
    }

    // Consider validating actionType against a predefined list
    const validActionTypes = [
      'ADMIN_MANUAL_LOG', // Example for a manually logged action
      // Add other specific types if this endpoint is used for more than just generic logging
    ];
    if (!validActionTypes.includes(actionType)) {
         // return sendResponse(res, 400, false, null, 'Invalid action type.', { code: 'INVALID_ACTION_TYPE' });
         debugLog(`Warning: createActivityLog called with potentially unlisted actionType: ${actionType}. Allowing for flexibility.`);
    }


    const adminAction = await prisma.adminAction.create({
      data: {
        actionType,
        targetId: String(targetId),
        actionData: actionData || {},
        initiatedBy: req.user.id, // Logged-in admin
        status: 'COMPLETED', // Or allow status to be passed
      },
    });

    debugLog('Admin activity log created:', adminAction.id);
    return sendResponse(res, 201, true, { activity: adminAction }, 'Activity logged successfully.');

  } catch (error) {
    debugLog('Admin: Error creating activity log:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error creating activity log.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Get system dashboard stats
exports.getDashboardStats = async (req, res) => {
  debugLog('Admin: Get Dashboard Stats attempt started');
  try {
    // User Stats
    const totalUsers = await prisma.user.count();
    const adminUsers = await prisma.user.count({ where: { isAdmin: true } });
    const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
    const activeUsersLast30Days = await prisma.user.count({
      where: { lastLogin: { gte: thirtyDaysAgo } },
    });

    // Payment Stats
    const commonPaymentWhere = { status: 'COMPLETED', isTemplate: false };
    const totalRevenueResult = await prisma.payment.aggregate({ _sum: { amount: true }, where: { ...commonPaymentWhere, isExpense: false } });
    const totalExpensesResult = await prisma.payment.aggregate({ _sum: { amount: true }, where: { ...commonPaymentWhere, isExpense: true } });
    const platformFeesResult = await prisma.payment.aggregate({ _sum: { platformFee: true }, where: { ...commonPaymentWhere } });

    const totalRevenue = totalRevenueResult._sum.amount || 0;
const totalExpenses = totalExpensesResult._sum.amount || 0;
const totalPlatformFees = platformFeesResult._sum.platformFee || 0;

    // Monthly Stats (using $queryRaw for date formatting across DBs)
    // Adjust SQL for PostgreSQL vs SQLite if needed
    let monthlyData;
    const isPostgres = prisma._engineConfig.activeProvider === 'postgresql'; // Check active provider

    if (isPostgres) {
        monthlyData = await prisma.$queryRaw`
            SELECT
              TO_CHAR("paymentDate", 'YYYY-MM') as month,
              SUM(CASE WHEN "isExpense" = FALSE THEN amount ELSE 0 END) as revenue,
              SUM(CASE WHEN "isExpense" = TRUE THEN amount ELSE 0 END) as expenses
            FROM "Payments"
            WHERE status = 'COMPLETED' AND "isTemplate" = FALSE
              AND "paymentDate" >= date_trunc('month', NOW() - INTERVAL '11 months')
            GROUP BY month
            ORDER BY month ASC;
        `;
    } else { // SQLite
        monthlyData = await prisma.$queryRaw`
            SELECT
              strftime('%Y-%m', "paymentDate") as month,
              SUM(CASE WHEN "isExpense" = 0 THEN amount ELSE 0 END) as revenue,
              SUM(CASE WHEN "isExpense" = 1 THEN amount ELSE 0 END) as expenses
            FROM "Payments"
            WHERE status = 'COMPLETED' AND "isTemplate" = 0
              AND "paymentDate" >= date('now', '-12 months')
            GROUP BY month
            ORDER BY month ASC;
        `;
    }
    

    const paymentsByType = await prisma.payment.groupBy({
      by: ['paymentType'],
      _sum: { amount: true },
      where: { ...commonPaymentWhere, isExpense: false },
      orderBy: { _sum: { amount: 'desc' } },
    });

    const expensesByDepartment = await prisma.payment.groupBy({
      by: ['department'],
      _sum: { amount: true },
      where: { ...commonPaymentWhere, isExpense: true, department: { not: null } },
      orderBy: { _sum: { amount: 'desc' } },
    });

    // Contact Inquiries Count (assuming you have a ContactInquiry model)
    // If not, this part needs a ContactInquiry model or adjustment.
    // For now, I'll stub it. If you create ContactInquiry model, uncomment and use:
    // const pendingInquiries = await prisma.contactInquiry.count({ where: { status: 'PENDING' }});
    const pendingInquiries = 0; // Placeholder

    const stats = {
      userStats: {
        total: totalUsers,
        adminCount: adminUsers,
        activeLast30Days: activeUsersLast30Days,
      },
      paymentStats: {
        revenue: parseFloat(totalRevenue) || 0,
expenses: parseFloat(totalExpenses) || 0,
netBalance: parseFloat(totalRevenue) - parseFloat(totalExpenses),
platformFees: parseFloat(totalPlatformFees) || 0,
      },
      monthlyFinancialSummary: monthlyData.map(m => ({
          month: m.month,
          revenue: Number(m.revenue || 0), // Ensure numbers
          expenses: Number(m.expenses || 0), // Ensure numbers
          net: Number(m.revenue || 0) - Number(m.expenses || 0)
      })),
      paymentsByType: paymentsByType.map(p => ({
          type: p.paymentType,
          total: parseFloat((p._sum.amount || 0).toString())
      })),
      expensesByDepartment: expensesByDepartment.map(d => ({
          department: d.department || "Uncategorized",
          total: parseFloat((d._sum.amount || 0).toString())
      })),
      pendingInquiries,
    };

    debugLog('Admin: Dashboard stats retrieved.');
    return sendResponse(res, 200, true, stats, 'Dashboard statistics retrieved successfully.');

  } catch (error) {
    debugLog('Admin: Error getting dashboard stats:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching dashboard statistics.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Generate system reports (PDF/CSV)
exports.generateReport = async (req, res) => {
  debugLog('Admin: Generate Report attempt started');
  // View-only admins are typically allowed to generate/view reports.
  // If not, add: if (isViewOnlyAdmin(req.user)) { ... return forbidden ... }

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog('Validation errors for report generation:', errors.array());
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const { reportType, startDate, endDate, format = 'pdf' } = req.body;

    if (!reportType || !startDate || !endDate) {
      return sendResponse(res, 400, false, null, 'Report type, start date, and end date are required.', { code: 'MISSING_REPORT_PARAMS' });
    }
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(new Date(endDate).setHours(23, 59, 59, 999)); // Inclusive end date

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `${reportType.toLowerCase()}_report_${timestamp}.${format.toLowerCase()}`;
    const reportDir = path.join(__dirname, '..', 'public', 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    const filepath = path.join(reportDir, filename);

    if (format.toLowerCase() === 'pdf') {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const writeStream = fs.createWriteStream(filepath);
      doc.pipe(writeStream);

      await generatePdfContent(doc, reportType, parsedStartDate, parsedEndDate); // Helper function
      doc.end();

      writeStream.on('finish', async () => {
        debugLog(`PDF Report generated: ${filename}`);
        await logAdminActivity('ADMIN_GENERATE_REPORT', filename, req.user.id, { reportType, format, startDate, endDate });
        return sendResponse(res, 200, true, { filePath: `/reports/${filename}` }, 'PDF Report generated successfully.');
      });
      writeStream.on('error', (err) => {
        debugLog('Error writing PDF report stream:', err.message);
        throw new Error('Failed to write PDF file.');
      });

    } else if (format.toLowerCase() === 'csv') {
      const csvContent = await generateCsvContent(reportType, parsedStartDate, parsedEndDate); // Helper function
      fs.writeFileSync(filepath, csvContent);
      debugLog(`CSV Report generated: ${filename}`);
      await logAdminActivity('ADMIN_GENERATE_REPORT', filename, req.user.id, { reportType, format, startDate, endDate });
      return sendResponse(res, 200, true, { filePath: `/reports/${filename}` }, 'CSV Report generated successfully.');

    } else {
      return sendResponse(res, 400, false, null, 'Invalid report format. Supported: pdf, csv.', { code: 'INVALID_FORMAT' });
    }

  } catch (error) {
    debugLog('Admin: Error generating report:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error generating report.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// --- Helper functions for report generation ---
async function generatePdfContent(doc, reportType, startDate, endDate) {
  doc.fontSize(18).font('Helvetica-Bold').text('Tassia Central SDA Church', { align: 'center' });
  doc.fontSize(14).font('Helvetica-Bold').text(`${reportType.toUpperCase()} Report`, { align: 'center' });
  doc.fontSize(10).font('Helvetica').text(`Period: ${formatDateForPdf(startDate)} to ${formatDateForPdf(endDate)}`, { align: 'center' });
  doc.moveDown(2);

  const commonQueryOptions = {
    where: { paymentDate: { gte: startDate, lte: endDate }, status: 'COMPLETED', isTemplate: false },
    orderBy: { paymentDate: 'asc' },
    include: { user: { select: { fullName: true } } }
  };

  switch (reportType.toUpperCase()) {
    case 'REVENUE':
      const revenue = await prisma.payment.findMany({ ...commonQueryOptions, where: { ...commonQueryOptions.where, isExpense: false } });
      const totalRevenue = revenue.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
      doc.font('Helvetica-Bold').fontSize(12).text(`Total Revenue: KES ${totalRevenue.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      doc.moveDown();
      pdfCreateTable(doc, ['Date', 'Type', 'Member', 'Amount (KES)', 'Receipt'],
        revenue.map(p => [
          formatDateForPdf(p.paymentDate),
          p.paymentType,
          p.user?.fullName || 'N/A',
          parseFloat(p.amount.toString()).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          p.receiptNumber || 'N/A'
        ])
      );
      break;

    case 'EXPENSES':
      const expenses = await prisma.payment.findMany({ ...commonQueryOptions, where: { ...commonQueryOptions.where, isExpense: true } });
      const totalExpenses = expenses.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
      doc.font('Helvetica-Bold').fontSize(12).text(`Total Expenses: KES ${totalExpenses.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      doc.moveDown();
      pdfCreateTable(doc, ['Date', 'Department', 'Description', 'Amount (KES)'],
        expenses.map(e => [
          formatDateForPdf(e.paymentDate),
          e.department || 'N/A',
          e.description || 'N/A',
          parseFloat(e.amount.toString()).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        ])
      );
      break;

    case 'USERS':
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        select: { username: true, fullName: true, email: true, phone: true, isAdmin: true, isActive: true, lastLogin: true, createdAt: true }
      });
      doc.font('Helvetica-Bold').fontSize(12).text(`Total Users: ${users.length}`);
      doc.moveDown();
      pdfCreateTable(doc, ['Username', 'Full Name', 'Email', 'Phone', 'Role', 'Active', 'Last Login'],
        users.map(u => [
          u.username, u.fullName, u.email || 'N/A', u.phone || 'N/A',
          u.isAdmin ? 'Admin' : 'User', u.isActive ? 'Yes' : 'No',
          u.lastLogin ? formatDateForPdf(u.lastLogin) : 'Never'
        ])
      );
      break;
    
    // COMPREHENSIVE report would combine multiple sections
    case 'COMPREHENSIVE':
        doc.font('Helvetica-Bold').fontSize(14).text('Financial Summary', { underline: true });
        doc.moveDown(0.5);
        const revenueComp = await prisma.payment.aggregate({_sum: {amount: true}, where: {...commonQueryOptions.where, isExpense: false}});
        const expensesComp = await prisma.payment.aggregate({_sum: {amount: true}, where: {...commonQueryOptions.where, isExpense: true}});
        const totalRevComp = revenueComp._sum.amount || new Prisma.Decimal(0);
        const totalExpComp = expensesComp._sum.amount || new Prisma.Decimal(0);
        doc.fontSize(10).font('Helvetica')
            .text(`Total Revenue: KES ${parseFloat(totalRevComp.toString()).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
            .text(`Total Expenses: KES ${parseFloat(totalExpComp.toString()).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
            .text(`Net Balance: KES ${parseFloat(totalRevComp.minus(totalExpComp).toString()).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        doc.moveDown(1.5);
        // You can then call the individual report generation logic for revenue, expenses, users sections.
        doc.addPage().font('Helvetica-Bold').fontSize(14).text('Detailed Revenue', { underline: true }).moveDown(0.5);
        const revenueDetail = await prisma.payment.findMany({ ...commonQueryOptions, where: { ...commonQueryOptions.where, isExpense: false } });
         pdfCreateTable(doc, ['Date', 'Type', 'Member', 'Amount (KES)', 'Receipt'],
            revenueDetail.map(p => [
            formatDateForPdf(p.paymentDate), p.paymentType, p.user?.fullName || 'N/A',
            parseFloat(p.amount.toString()).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), p.receiptNumber || 'N/A'
            ])
        );
        doc.addPage().font('Helvetica-Bold').fontSize(14).text('Detailed Expenses', { underline: true }).moveDown(0.5);
        const expensesDetail = await prisma.payment.findMany({ ...commonQueryOptions, where: { ...commonQueryOptions.where, isExpense: true } });
         pdfCreateTable(doc, ['Date', 'Department', 'Description', 'Amount (KES)'],
            expensesDetail.map(e => [
            formatDateForPdf(e.paymentDate), e.department || 'N/A', e.description || 'N/A',
            parseFloat(e.amount.toString()).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ])
        );
        break;

    default:
      doc.text('Invalid report type selected.');
  }
  doc.moveDown(2);
  doc.fontSize(8).text(`Report Generated: ${new Date().toLocaleString()}`, 40, doc.page.height - 30, {lineBreak: false});
}

function pdfCreateTable(doc, headers, dataRows) {
    const tableTop = doc.y;
    const rowHeight = 15;
    const colWidths = headers.map(() => (doc.page.width - 80) / headers.length); // Distribute width

    // Header
    doc.font('Helvetica-Bold').fontSize(8);
    headers.forEach((header, i) => {
        doc.text(header, 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop, { width: colWidths[i] - 5, align: 'left' });
    });
    doc.y += rowHeight;
    doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(40, doc.y - (rowHeight/2)).lineTo(doc.page.width - 40, doc.y - (rowHeight/2)).stroke();


    // Rows
    doc.font('Helvetica').fontSize(8);
    dataRows.forEach(row => {
        if (doc.y + rowHeight > doc.page.height - 50) { // Check for page break
            doc.addPage();
            doc.y = 40; // Reset y position
             // Re-draw header on new page
            doc.font('Helvetica-Bold');
            headers.forEach((header, i) => {
                doc.text(header, 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), doc.y, { width: colWidths[i] -5, align: 'left'});
            });
            doc.y += rowHeight;
            doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(40, doc.y - (rowHeight/2)).lineTo(doc.page.width - 40, doc.y - (rowHeight/2)).stroke();
            doc.font('Helvetica');
        }
        row.forEach((cell, i) => {
            doc.text(String(cell === null || cell === undefined ? 'N/A' : cell), 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), doc.y, { width: colWidths[i] - 5, align: 'left' });
        });
        doc.y += rowHeight;
        doc.strokeColor('#dddddd').lineWidth(0.25).moveTo(40, doc.y - (rowHeight/2)).lineTo(doc.page.width - 40, doc.y - (rowHeight/2)).stroke();
    });
}


async function generateCsvContent(reportType, startDate, endDate) {
  let csvHeaders = [];
  let csvRows = [];
  const commonQueryOptions = {
    where: { paymentDate: { gte: startDate, lte: endDate }, status: 'COMPLETED', isTemplate: false },
    orderBy: { paymentDate: 'asc' },
    include: { user: { select: { fullName: true } } }
  };

  switch (reportType.toUpperCase()) {
    case 'REVENUE':
      csvHeaders = ['Date', 'Type', 'Member', 'Amount (KES)', 'Description', 'Receipt'];
      const revenue = await prisma.payment.findMany({ ...commonQueryOptions, where: { ...commonQueryOptions.where, isExpense: false } });
      csvRows = revenue.map(p => [
        formatDateForPdf(p.paymentDate), p.paymentType, p.user?.fullName || 'N/A',
        parseFloat(p.amount.toString()), p.description || '', p.receiptNumber || ''
      ]);
      break;
    case 'EXPENSES':
      csvHeaders = ['Date', 'Department', 'Description', 'Amount (KES)'];
      const expenses = await prisma.payment.findMany({ ...commonQueryOptions, where: { ...commonQueryOptions.where, isExpense: true } });
      csvRows = expenses.map(e => [
        formatDateForPdf(e.paymentDate), e.department || 'N/A', e.description || '', parseFloat(e.amount.toString())
      ]);
      break;
    case 'USERS':
      csvHeaders = ['Username', 'Full Name', 'Email', 'Phone', 'Role', 'Active', 'Last Login', 'Created At'];
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        select: { username: true, fullName: true, email: true, phone: true, isAdmin: true, isActive:true, lastLogin: true, createdAt: true }
      });
      csvRows = users.map(u => [
        u.username, u.fullName, u.email || '', u.phone || '',
        u.isAdmin ? 'Admin' : 'User', u.isActive ? 'Yes' : 'No',
        u.lastLogin ? formatDateForPdf(u.lastLogin) : 'Never', formatDateForPdf(u.createdAt)
      ]);
      break;
    case 'COMPREHENSIVE':
        // For CSV, it might be better to produce separate sections or a very wide table.
        // Here's an example combining revenue and expenses.
        csvHeaders = ['Date', 'Type/Department', 'Description', 'Amount (KES)', 'Category', 'Member'];
        const paymentsComp = await prisma.payment.findMany({ ...commonQueryOptions });
        csvRows = paymentsComp.map(p => [
            formatDateForPdf(p.paymentDate),
            p.isExpense ? (p.department || 'N/A') : p.paymentType,
            p.description || '',
            parseFloat(p.amount.toString()),
            p.isExpense ? 'Expense' : 'Revenue',
            p.user?.fullName || 'N/A'
        ]);
        break;
    default:
      throw new Error('Invalid report type for CSV.');
  }

  const escapeCsvCell = (cell) => {
    const cellStr = String(cell === null || cell === undefined ? '' : cell);
    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
  };

  let csvString = csvHeaders.map(escapeCsvCell).join(',') + '\n';
  csvRows.forEach(rowArray => {
    csvString += rowArray.map(escapeCsvCell).join(',') + '\n';
  });
  return csvString;
}

module.exports = exports;