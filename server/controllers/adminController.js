// server/controllers/adminController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');
const { isViewOnlyAdmin } = require('../middlewares/auth.js');

const prisma = new PrismaClient();

// Centralized logging utility (non-blocking)
const logActivity = async (message, data = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ADMIN_CTRL: ${message}${data ? ` | Data: ${JSON.stringify(data)}` : ''}`;
  console.log(logMessage);
  
  // Non-blocking file logging
  if (process.env.NODE_ENV !== 'production') {
    const LOG_DIR = path.join(__dirname, '..', 'logs');
    const LOG_FILE = path.join(LOG_DIR, 'admin-controller.log');
    
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });
      await fs.appendFile(LOG_FILE, logMessage + '\n');
    } catch (error) {
      console.error('Logging failed:', error.message);
    }
  }
};

// Standardized response helper
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

// Log Admin Activity (non-blocking)
const logAdminActivity = async (actionType, targetId, initiatedBy, actionData = {}) => {
  setImmediate(async () => {
    try {
      await prisma.adminAction.create({
        data: {
          actionType,
          targetId: String(targetId),
          initiatedById: initiatedBy,
          actionData,
          status: 'COMPLETED',
        },
      });
    } catch (error) {
      console.error(`Failed to log admin activity ${actionType}:`, error.message);
    }
  });
};

// Helper for formatting date in PDF
const formatDateForPdf = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch (e) { 
    return dateString.toString(); 
  }
};

// Get recent admin activity
exports.getRecentActivity = async (req, res) => {
  try {
    await logActivity('Admin: Get Recent Activity attempt started');
    
    const { limit = 20, page = 1 } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const [activities, totalActivities] = await Promise.all([
      prisma.adminAction.findMany({
        include: {
          initiator: {
            select: { id: true, username: true, fullName: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip
      }),
      prisma.adminAction.count()
    ]);

    await logActivity(`Retrieved ${activities.length} recent admin activities`);
    
    return sendResponse(res, 200, true, {
      activities,
      totalPages: Math.ceil(totalActivities / take),
      currentPage: parseInt(page),
      totalActivities
    }, 'Recent admin activities retrieved successfully.');

  } catch (error) {
    await logActivity('Error fetching admin activity:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching admin activity.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

// Create admin action log
exports.createActivityLog = async (req, res) => {
  try {
    await logActivity('Admin: Create Activity Log attempt started');
    
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot create activity logs directly.", { 
        code: 'FORBIDDEN_VIEW_ONLY' 
      });
    }

    const { actionType, targetId, actionData } = req.body;
    if (!actionType || !targetId) {
      return sendResponse(res, 400, false, null, 'Action type and target ID are required.', { 
        code: 'MISSING_FIELDS' 
      });
    }

    const validActionTypes = [
      'ADMIN_MANUAL_LOG',
      'SYSTEM_MAINTENANCE',
      'DATA_BACKUP',
      'CONFIGURATION_CHANGE',
      'SECURITY_AUDIT'
    ];
    
    if (!validActionTypes.includes(actionType)) {
      await logActivity(`Warning: createActivityLog called with potentially unlisted actionType: ${actionType}. Allowing for flexibility.`);
    }

    const adminAction = await prisma.adminAction.create({
      data: {
        actionType,
        targetId: String(targetId),
        actionData: actionData || {},
        initiatedById: req.user.id,
        status: 'COMPLETED',
      },
    });

    await logActivity('Admin activity log created:', adminAction.id);
    return sendResponse(res, 201, true, { activity: adminAction }, 'Activity logged successfully.');

  } catch (error) {
    await logActivity('Error creating activity log:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error creating activity log.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

// Get system dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    await logActivity('Admin: Get Dashboard Stats attempt started');

    // User Stats
    const [totalUsers, adminUsers, thirtyDaysAgo] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isAdmin: true } }),
      new Date(new Date().setDate(new Date().getDate() - 30))
    ]);

    const activeUsersLast30Days = await prisma.user.count({
      where: { lastLogin: { gte: thirtyDaysAgo } },
    });

    // Payment Stats - SAFE AGGREGATION (No Raw SQL)
    const commonPaymentWhere = { status: 'COMPLETED', isTemplate: false };
    
    const [totalRevenueResult, totalExpensesResult, platformFeesResult] = await Promise.all([
      prisma.payment.aggregate({ 
        _sum: { amount: true }, 
        where: { ...commonPaymentWhere, isExpense: false } 
      }),
      prisma.payment.aggregate({ 
        _sum: { amount: true }, 
        where: { ...commonPaymentWhere, isExpense: true } 
      }),
      prisma.payment.aggregate({ 
        _sum: { platformFee: true }, 
        where: { ...commonPaymentWhere } 
      })
    ]);

    const totalRevenue = totalRevenueResult._sum.amount || new Prisma.Decimal(0);
    const totalExpenses = totalExpensesResult._sum.amount || new Prisma.Decimal(0);
    const totalPlatformFees = platformFeesResult._sum.platformFee || new Prisma.Decimal(0);

    // SAFE Monthly Data Query - Using Prisma groupBy instead of raw SQL
    const now = new Date();
    const elevenMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    
    const monthlyPayments = await prisma.payment.findMany({
      where: {
        status: 'COMPLETED',
        isTemplate: false,
        paymentDate: {
          gte: elevenMonthsAgo
        }
      },
      select: {
        paymentDate: true,
        amount: true,
        isExpense: true
      }
    });

    // Process monthly data safely in JavaScript
    const monthlyDataMap = new Map();
    
    monthlyPayments.forEach(payment => {
      const monthKey = payment.paymentDate.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyDataMap.has(monthKey)) {
        monthlyDataMap.set(monthKey, { month: monthKey, revenue: 0, expenses: 0 });
      }
      
      const monthData = monthlyDataMap.get(monthKey);
      const amount = parseFloat(payment.amount.toString());
      
      if (payment.isExpense) {
        monthData.expenses += amount;
      } else {
        monthData.revenue += amount;
      }
    });

    const monthlyData = Array.from(monthlyDataMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        net: m.revenue - m.expenses
      }));

    const [paymentsByType, expensesByDepartment, pendingInquiries] = await Promise.all([
      prisma.payment.groupBy({
        by: ['paymentType'],
        _sum: { amount: true },
        where: { ...commonPaymentWhere, isExpense: false },
        orderBy: { _sum: { amount: 'desc' } },
      }),
      prisma.payment.groupBy({
        by: ['department'],
        _sum: { amount: true },
        where: { ...commonPaymentWhere, isExpense: true, department: { not: null } },
        orderBy: { _sum: { amount: 'desc' } },
      }),
      prisma.contactInquiry.count({ where: { status: 'PENDING' } })
    ]);

    const stats = {
      userStats: {
        total: totalUsers,
        adminCount: adminUsers,
        activeLast30Days: activeUsersLast30Days,
      },
      paymentStats: {
        revenue: parseFloat(totalRevenue.toString()) || 0,
        expenses: parseFloat(totalExpenses.toString()) || 0,
        netBalance: parseFloat(totalRevenue.toString()) - parseFloat(totalExpenses.toString()),
        platformFees: parseFloat(totalPlatformFees.toString()) || 0,
      },
      monthlyFinancialSummary: monthlyData,
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

    await logActivity('Dashboard stats retrieved successfully');
    return sendResponse(res, 200, true, stats, 'Dashboard statistics retrieved successfully.');

  } catch (error) {
    await logActivity('Error getting dashboard stats:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching dashboard statistics.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

// Generate system reports (PDF/CSV)
exports.generateReport = async (req, res) => {
  try {
    await logActivity('Admin: Generate Report attempt started');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await logActivity('Validation errors for report generation:', errors.array());
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const { reportType, startDate, endDate, format = 'pdf' } = req.body;

    if (!reportType || !startDate || !endDate) {
      return sendResponse(res, 400, false, null, 'Report type, start date, and end date are required.', { 
        code: 'MISSING_REPORT_PARAMS' 
      });
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(new Date(endDate).setHours(23, 59, 59, 999));

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `${reportType.toLowerCase()}_report_${timestamp}.${format.toLowerCase()}`;
    const reportDir = path.join(__dirname, '..', 'public', 'reports');
    
    // Ensure directory exists
    await fs.mkdir(reportDir, { recursive: true });
    const filepath = path.join(reportDir, filename);

    if (format.toLowerCase() === 'pdf') {
      await generatePdfReport(filepath, reportType, parsedStartDate, parsedEndDate);
    } else if (format.toLowerCase() === 'csv') {
      const csvContent = await generateCsvContent(reportType, parsedStartDate, parsedEndDate);
      await fs.writeFile(filepath, csvContent);
    } else {
      return sendResponse(res, 400, false, null, 'Invalid report format. Supported: pdf, csv.', { 
        code: 'INVALID_FORMAT' 
      });
    }

    await logAdminActivity('ADMIN_GENERATE_REPORT', filename, req.user.id, { 
      reportType, 
      format, 
      startDate, 
      endDate 
    });

    await logActivity(`Report generated successfully: ${filename}`);
    return sendResponse(res, 200, true, { filePath: `/reports/${filename}` }, `${format.toUpperCase()} Report generated successfully.`);

  } catch (error) {
    await logActivity('Error generating report:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error generating report.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

// Generate PDF report content
async function generatePdfReport(filepath, reportType, startDate, endDate) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const writeStream = require('fs').createWriteStream(filepath);
      doc.pipe(writeStream);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('Tassia Central SDA Church', { align: 'center' });
      doc.fontSize(14).font('Helvetica-Bold').text(`${reportType.toUpperCase()} Report`, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Period: ${formatDateForPdf(startDate)} to ${formatDateForPdf(endDate)}`, { align: 'center' });
      doc.moveDown(2);

      const commonQueryOptions = {
        where: { 
          paymentDate: { gte: startDate, lte: endDate }, 
          status: 'COMPLETED', 
          isTemplate: false 
        },
        orderBy: { paymentDate: 'asc' },
        include: { 
          user: { select: { fullName: true } },
          specialOffering: { select: { name: true, offeringCode: true } }
        }
      };

      switch (reportType.toUpperCase()) {
        case 'REVENUE':
          await generateRevenueReport(doc, commonQueryOptions);
          break;
        case 'EXPENSES':
          await generateExpensesReport(doc, commonQueryOptions);
          break;
        case 'USERS':
          await generateUsersReport(doc);
          break;
        case 'COMPREHENSIVE':
          await generateComprehensiveReport(doc, commonQueryOptions);
          break;
        default:
          doc.text('Invalid report type selected.');
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).text(`Report Generated: ${new Date().toLocaleString()}`, 40, doc.page.height - 30, {lineBreak: false});
      
      doc.end();

      writeStream.on('finish', resolve);
      writeStream.on('error', reject);

    } catch (error) {
      reject(error);
    }
  });
}

async function generateRevenueReport(doc, queryOptions) {
  const revenue = await prisma.payment.findMany({ 
    ...queryOptions, 
    where: { ...queryOptions.where, isExpense: false } 
  });
  
  const totalRevenue = revenue.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
  
  doc.font('Helvetica-Bold').fontSize(12).text(`Total Revenue: KES ${totalRevenue.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  doc.moveDown();
  
  createPdfTable(doc, ['Date', 'Type', 'Member', 'Amount (KES)', 'Receipt'],
    revenue.map(p => [
      formatDateForPdf(p.paymentDate),
      p.paymentType,
      p.user?.fullName || 'N/A',
      parseFloat(p.amount.toString()).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      p.receiptNumber || 'N/A'
    ])
  );
}

async function generateExpensesReport(doc, queryOptions) {
  const expenses = await prisma.payment.findMany({ 
    ...queryOptions, 
    where: { ...queryOptions.where, isExpense: true } 
  });
  
  const totalExpenses = expenses.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
  
  doc.font('Helvetica-Bold').fontSize(12).text(`Total Expenses: KES ${totalExpenses.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  doc.moveDown();
  
  createPdfTable(doc, ['Date', 'Department', 'Description', 'Amount (KES)'],
    expenses.map(e => [
      formatDateForPdf(e.paymentDate),
      e.department || 'N/A',
      e.description || 'N/A',
      parseFloat(e.amount.toString()).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ])
  );
}

async function generateUsersReport(doc) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { 
      username: true, 
      fullName: true, 
      email: true, 
      phone: true, 
      isAdmin: true, 
      isActive: true, 
      lastLogin: true, 
      createdAt: true 
    }
  });
  
  doc.font('Helvetica-Bold').fontSize(12).text(`Total Users: ${users.length}`);
  doc.moveDown();
  
  createPdfTable(doc, ['Username', 'Full Name', 'Email', 'Phone', 'Role', 'Active', 'Last Login'],
    users.map(u => [
      u.username, 
      u.fullName, 
      u.email || 'N/A', 
      u.phone || 'N/A',
      u.isAdmin ? 'Admin' : 'User', 
      u.isActive ? 'Yes' : 'No',
      u.lastLogin ? formatDateForPdf(u.lastLogin) : 'Never'
    ])
  );
}

async function generateComprehensiveReport(doc, queryOptions) {
  // Financial Summary
  doc.font('Helvetica-Bold').fontSize(14).text('Financial Summary', { underline: true });
  doc.moveDown(0.5);
  
  const [revenueResult, expensesResult] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true }, 
      where: { ...queryOptions.where, isExpense: false }
    }),
    prisma.payment.aggregate({
      _sum: { amount: true }, 
      where: { ...queryOptions.where, isExpense: true }
    })
  ]);
  
  const totalRev = revenueResult._sum.amount || new Prisma.Decimal(0);
  const totalExp = expensesResult._sum.amount || new Prisma.Decimal(0);
  
  doc.fontSize(10).font('Helvetica')
    .text(`Total Revenue: KES ${parseFloat(totalRev.toString()).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    .text(`Total Expenses: KES ${parseFloat(totalExp.toString()).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    .text(`Net Balance: KES ${parseFloat(totalRev.minus(totalExp).toString()).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  
  doc.moveDown(1.5);
  
  // Add individual sections
  doc.addPage().font('Helvetica-Bold').fontSize(14).text('Detailed Revenue', { underline: true }).moveDown(0.5);
  await generateRevenueReport(doc, queryOptions);
  
  doc.addPage().font('Helvetica-Bold').fontSize(14).text('Detailed Expenses', { underline: true }).moveDown(0.5);
  await generateExpensesReport(doc, queryOptions);
}

function createPdfTable(doc, headers, dataRows) {
  const tableTop = doc.y;
  const rowHeight = 15;
  const colWidths = headers.map(() => (doc.page.width - 80) / headers.length);

  // Header
  doc.font('Helvetica-Bold').fontSize(8);
  headers.forEach((header, i) => {
    doc.text(header, 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop, { 
      width: colWidths[i] - 5, 
      align: 'left' 
    });
  });
  doc.y += rowHeight;
  doc.strokeColor('#cccccc').lineWidth(0.5)
     .moveTo(40, doc.y - (rowHeight/2))
     .lineTo(doc.page.width - 40, doc.y - (rowHeight/2))
     .stroke();

  // Rows
  doc.font('Helvetica').fontSize(8);
  dataRows.forEach(row => {
    if (doc.y + rowHeight > doc.page.height - 50) {
      doc.addPage();
      doc.y = 40;
      
      // Re-draw header on new page
      doc.font('Helvetica-Bold');
      headers.forEach((header, i) => {
        doc.text(header, 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), doc.y, { 
          width: colWidths[i] - 5, 
          align: 'left'
        });
      });
      doc.y += rowHeight;
      doc.strokeColor('#cccccc').lineWidth(0.5)
         .moveTo(40, doc.y - (rowHeight/2))
         .lineTo(doc.page.width - 40, doc.y - (rowHeight/2))
         .stroke();
      doc.font('Helvetica');
    }
    
    row.forEach((cell, i) => {
      doc.text(String(cell === null || cell === undefined ? 'N/A' : cell), 
               40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), 
               doc.y, 
               { width: colWidths[i] - 5, align: 'left' });
    });
    doc.y += rowHeight;
    doc.strokeColor('#dddddd').lineWidth(0.25)
       .moveTo(40, doc.y - (rowHeight/2))
       .lineTo(doc.page.width - 40, doc.y - (rowHeight/2))
       .stroke();
  });
}

// Generate CSV content
async function generateCsvContent(reportType, startDate, endDate) {
  let csvHeaders = [];
  let csvRows = [];
  
  const commonQueryOptions = {
    where: { 
      paymentDate: { gte: startDate, lte: endDate }, 
      status: 'COMPLETED', 
      isTemplate: false 
    },
    orderBy: { paymentDate: 'asc' },
    include: { 
      user: { select: { fullName: true } },
      specialOffering: { select: { name: true, offeringCode: true } }
    }
  };

  switch (reportType.toUpperCase()) {
    case 'REVENUE':
      csvHeaders = ['Date', 'Type', 'Member', 'Amount (KES)', 'Description', 'Receipt'];
      const revenue = await prisma.payment.findMany({ 
        ...commonQueryOptions, 
        where: { ...commonQueryOptions.where, isExpense: false } 
      });
      csvRows = revenue.map(p => [
        formatDateForPdf(p.paymentDate), 
        p.paymentType, 
        p.user?.fullName || 'N/A',
        parseFloat(p.amount.toString()), 
        p.description || '', 
        p.receiptNumber || ''
      ]);
      break;
      
    case 'EXPENSES':
      csvHeaders = ['Date', 'Department', 'Description', 'Amount (KES)'];
      const expenses = await prisma.payment.findMany({ 
        ...commonQueryOptions, 
        where: { ...commonQueryOptions.where, isExpense: true } 
      });
      csvRows = expenses.map(e => [
        formatDateForPdf(e.paymentDate), 
        e.department || 'N/A', 
        e.description || '', 
        parseFloat(e.amount.toString())
      ]);
      break;
      
    case 'USERS':
      csvHeaders = ['Username', 'Full Name', 'Email', 'Phone', 'Role', 'Active', 'Last Login', 'Created At'];
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        select: { 
          username: true, 
          fullName: true, 
          email: true, 
          phone: true, 
          isAdmin: true, 
          isActive: true, 
          lastLogin: true, 
          createdAt: true 
        }
      });
      csvRows = users.map(u => [
        u.username, 
        u.fullName, 
        u.email || '', 
        u.phone || '',
        u.isAdmin ? 'Admin' : 'User', 
        u.isActive ? 'Yes' : 'No',
        u.lastLogin ? formatDateForPdf(u.lastLogin) : 'Never', 
        formatDateForPdf(u.createdAt)
      ]);
      break;
      
    case 'COMPREHENSIVE':
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