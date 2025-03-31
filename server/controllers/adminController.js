// server/controllers/adminController.js
const { models } = require('../models');
const User = models.User;
const Payment = models.Payment;
const AdminAction = models.AdminAction;
const Receipt = models.Receipt;
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Get recent admin activity
exports.getRecentActivity = async (req, res) => {
  try {
    // Get recent admin actions with user details
    const activities = await AdminAction.findAll({
      include: [
        {
          model: User,
          as: 'Initiator',
          attributes: ['id', 'username', 'fullName']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    
    res.json({ activities });
  } catch (error) {
    console.error('Error fetching admin activity:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create admin action log
exports.createActivityLog = async (req, res) => {
  try {
    const { actionType, targetId, actionData } = req.body;
    
    if (!actionType || !targetId) {
      return res.status(400).json({ message: 'Action type and target ID are required' });
    }
    
    // Validate action type
    const validActionTypes = [
      'ADD_USER', 'UPDATE_USER', 'DELETE_USER',
      'ADD_PAYMENT', 'UPDATE_PAYMENT', 'DELETE_PAYMENT',
      'ADD_EXPENSE', 'UPDATE_EXPENSE', 'DELETE_EXPENSE',
      'ADD_SPECIAL_OFFERING', 'UPDATE_SPECIAL_OFFERING', 'DELETE_SPECIAL_OFFERING',
      'SYSTEM_CONFIG', 'OTHER'
    ];
    
    if (!validActionTypes.includes(actionType)) {
      return res.status(400).json({ message: 'Invalid action type' });
    }
    
    const adminAction = await AdminAction.create({
      actionType,
      targetId,
      actionData,
      initiatedBy: req.user.id,
      status: 'COMPLETED'
    });
    
    res.status(201).json({ success: true, activity: adminAction });
  } catch (error) {
    console.error('Error creating activity log:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get system dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    // Get user stats
    const userStats = await User.findAll({
      attributes: [
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'total'],
        [models.sequelize.fn('SUM', models.sequelize.literal('CASE WHEN "isAdmin" = true THEN 1 ELSE 0 END')), 'adminCount'],
        [models.sequelize.fn('SUM', models.sequelize.literal('CASE WHEN "lastLogin" > NOW() - INTERVAL \'30 day\' THEN 1 ELSE 0 END')), 'activeUsers']
      ]
    });
    
    // Get payment stats
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    const paymentStats = await Payment.findAll({
      attributes: [
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'totalTransactions'],
        [models.sequelize.fn('SUM', models.sequelize.literal('CASE WHEN "status" = \'COMPLETED\' THEN 1 ELSE 0 END')), 'completedTransactions'],
        [models.sequelize.fn('SUM', models.sequelize.literal('CASE WHEN "status" = \'PENDING\' THEN 1 ELSE 0 END')), 'pendingTransactions'],
        [models.sequelize.fn('SUM', models.sequelize.literal('CASE WHEN "status" = \'FAILED\' THEN 1 ELSE 0 END')), 'failedTransactions'],
        [models.sequelize.fn('SUM', models.sequelize.literal('CASE WHEN "isExpense" = false AND "status" = \'COMPLETED\' THEN "amount" ELSE 0 END')), 'totalRevenue'],
        [models.sequelize.fn('SUM', models.sequelize.literal('CASE WHEN "isExpense" = true AND "status" = \'COMPLETED\' THEN "amount" ELSE 0 END')), 'totalExpenses'],
        [models.sequelize.fn('SUM', models.sequelize.literal('CASE WHEN "status" = \'COMPLETED\' THEN "platformFee" ELSE 0 END')), 'totalFees'],
        [models.sequelize.fn('SUM', models.sequelize.literal(`CASE WHEN EXTRACT(MONTH FROM "paymentDate") = ${currentMonth} AND EXTRACT(YEAR FROM "paymentDate") = ${currentYear} AND "isExpense" = false AND "status" = 'COMPLETED' THEN "amount" ELSE 0 END`)), 'currentMonthRevenue'],
        [models.sequelize.fn('SUM', models.sequelize.literal(`CASE WHEN EXTRACT(MONTH FROM "paymentDate") = ${currentMonth} AND EXTRACT(YEAR FROM "paymentDate") = ${currentYear} AND "isExpense" = true AND "status" = 'COMPLETED' THEN "amount" ELSE 0 END`)), 'currentMonthExpenses']
      ]
    });
    
    // Get monthly revenue and expenses for the past 12 months
    const monthlyStats = [];
    const now = new Date();
    const currentFullYear = now.getFullYear();
    const currentFullMonth = now.getMonth() + 1;
    
    for (let i = 0; i < 12; i++) {
      let month = currentFullMonth - i;
      let year = currentFullYear;
      
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
      
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      
      // Get revenue for the month
      const revenue = await Payment.sum('amount', {
        where: {
          paymentDate: {
            [Op.between]: [monthStart, monthEnd]
          },
          isExpense: false,
          status: 'COMPLETED'
        }
      }) || 0;
      
      // Get expenses for the month
      const expenses = await Payment.sum('amount', {
        where: {
          paymentDate: {
            [Op.between]: [monthStart, monthEnd]
          },
          isExpense: true,
          status: 'COMPLETED'
        }
      }) || 0;
      
      monthlyStats.push({
        month,
        year,
        monthName: monthStart.toLocaleString('default', { month: 'long' }),
        revenue,
        expenses,
        netBalance: revenue - expenses
      });
    }
    
    // Get payment breakdown by type
    const paymentBreakdown = await Payment.findAll({
      attributes: [
        'paymentType',
        [models.sequelize.fn('SUM', models.sequelize.col('amount')), 'total']
      ],
      where: {
        isExpense: false,
        status: 'COMPLETED'
      },
      group: ['paymentType']
    });
    
    // Get expense breakdown by department
    const expenseBreakdown = await Payment.findAll({
      attributes: [
        'department',
        [models.sequelize.fn('SUM', models.sequelize.col('amount')), 'total']
      ],
      where: {
        isExpense: true,
        status: 'COMPLETED'
      },
      group: ['department']
    });
    
    // Return combined stats
    res.json({
      userStats: userStats[0],
      paymentStats: paymentStats[0],
      monthlyStats: monthlyStats.reverse(), // Reverse to get chronological order
      paymentBreakdown,
      expenseBreakdown
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Generate system reports
exports.generateReport = async (req, res) => {
  try {
    const { reportType, startDate, endDate, format = 'pdf' } = req.body;
    
    if (!reportType || !startDate || !endDate) {
      return res.status(400).json({ message: 'Report type, start date, and end date are required' });
    }
    
    // Parse dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    
    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    
    // Validate report type
    const validReportTypes = ['REVENUE', 'EXPENSES', 'USERS', 'COMPREHENSIVE'];
    
    if (!validReportTypes.includes(reportType)) {
      return res.status(400).json({ message: 'Invalid report type' });
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').substring(0, 19);
    const filename = `${reportType.toLowerCase()}_report_${timestamp}.${format.toLowerCase()}`;
    const filePath = path.join(__dirname, '..', 'public', 'reports', filename);
    
    // Create directory if it doesn't exist
    const reportDir = path.join(__dirname, '..', 'public', 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    // Handle different report types and formats
    if (format.toLowerCase() === 'pdf') {
      // Generate PDF report
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      
      // Add content to PDF based on report type
      await generatePdfContent(doc, reportType, parsedStartDate, parsedEndDate);
      
      doc.end();
      
      stream.on('finish', () => {
        // Log activity
        AdminAction.create({
          actionType: 'GENERATE_REPORT',
          targetId: filename,
          actionData: { reportType, startDate, endDate, format },
          initiatedBy: req.user.id,
          status: 'COMPLETED'
        });
        
        // Send file path for download
        res.json({
          success: true,
          message: 'Report generated successfully',
          filePath: `/reports/${filename}`
        });
      });
    } else if (format.toLowerCase() === 'csv') {
      // Generate CSV report
      const csvContent = await generateCsvContent(reportType, parsedStartDate, parsedEndDate);
      
      fs.writeFileSync(filePath, csvContent);
      
      // Log activity
      AdminAction.create({
        actionType: 'GENERATE_REPORT',
        targetId: filename,
        actionData: { reportType, startDate, endDate, format },
        initiatedBy: req.user.id,
        status: 'COMPLETED'
      });
      
      // Send file path for download
      res.json({
        success: true,
        message: 'Report generated successfully',
        filePath: `/reports/${filename}`
      });
    } else {
      return res.status(400).json({ message: 'Invalid report format. Supported formats: pdf, csv' });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper function to generate PDF content (implementation would be specific to your needs)
async function generatePdfContent(doc, reportType, startDate, endDate) {
  // Add header
  doc.fontSize(20).text('TASSIAC Church', { align: 'center' });
  doc.fontSize(16).text(`${reportType} Report`, { align: 'center' });
  doc.fontSize(12).text(`Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`, { align: 'center' });
  doc.moveDown(2);
  
  // Different content based on report type
  switch (reportType) {
    case 'REVENUE':
      // Add revenue data
      const revenue = await Payment.findAll({
        where: {
          paymentDate: {
            [Op.between]: [startDate, endDate]
          },
          isExpense: false,
          status: 'COMPLETED'
        },
        order: [['paymentDate', 'ASC']]
      });
      
      doc.fontSize(14).text('Revenue Summary', { underline: true });
      doc.moveDown(0.5);
      
      // Calculate total
      const totalRevenue = revenue.reduce((total, item) => total + item.amount, 0);
      doc.fontSize(12).text(`Total Revenue: KES ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      doc.moveDown(1);
      
      // Add table header
      doc.fontSize(10).text('Date', 100, doc.y, { width: 100, continued: true });
      doc.text('Type', { width: 100, continued: true });
      doc.text('Amount (KES)', { width: 100, continued: true });
      doc.text('Receipt', { width: 100 });
      doc.moveDown(0.5);
      
      // Add table rows
      revenue.forEach(item => {
        const date = new Date(item.paymentDate).toLocaleDateString();
        const amount = item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        doc.fontSize(10).text(date, 100, doc.y, { width: 100, continued: true });
        doc.text(item.paymentType, { width: 100, continued: true });
        doc.text(amount, { width: 100, continued: true });
        doc.text(item.receiptNumber || '-', { width: 100 });
      });
      break;
      
    case 'EXPENSES':
      // Add expenses data
      const expenses = await Payment.findAll({
        where: {
          paymentDate: {
            [Op.between]: [startDate, endDate]
          },
          isExpense: true,
          status: 'COMPLETED'
        },
        order: [['paymentDate', 'ASC']]
      });
      
      doc.fontSize(14).text('Expenses Summary', { underline: true });
      doc.moveDown(0.5);
      
      // Calculate total
      const totalExpenses = expenses.reduce((total, item) => total + item.amount, 0);
      doc.fontSize(12).text(`Total Expenses: KES ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      doc.moveDown(1);
      
      // Add table header
      doc.fontSize(10).text('Date', 100, doc.y, { width: 100, continued: true });
      doc.text('Department', { width: 100, continued: true });
      doc.text('Amount (KES)', { width: 100, continued: true });
      doc.text('Description', { width: 150 });
      doc.moveDown(0.5);
      
      // Add table rows
      expenses.forEach(item => {
        const date = new Date(item.paymentDate).toLocaleDateString();
        const amount = item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        doc.fontSize(10).text(date, 100, doc.y, { width: 100, continued: true });
        doc.text(item.department || '-', { width: 100, continued: true });
        doc.text(amount, { width: 100, continued: true });
        doc.text(item.description || '-', { width: 150 });
      });
      break;
      
    case 'USERS':
      // Add user data
      const users = await User.findAll({
        order: [['createdAt', 'ASC']]
      });
      
      doc.fontSize(14).text('User Summary', { underline: true });
      doc.moveDown(0.5);
      
      doc.fontSize(12).text(`Total Users: ${users.length}`);
      doc.fontSize(12).text(`Admins: ${users.filter(user => user.isAdmin).length}`);
      doc.fontSize(12).text(`Regular Users: ${users.filter(user => !user.isAdmin).length}`);
      doc.moveDown(1);
      
      // Add table header
      doc.fontSize(10).text('Username', 100, doc.y, { width: 100, continued: true });
      doc.text('Full Name', { width: 150, continued: true });
      doc.text('Role', { width: 80, continued: true });
      doc.text('Last Login', { width: 100 });
      doc.moveDown(0.5);
      
      // Add table rows
      users.forEach(user => {
        const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never';
        
        doc.fontSize(10).text(user.username, 100, doc.y, { width: 100, continued: true });
        doc.text(user.fullName, { width: 150, continued: true });
        doc.text(user.isAdmin ? 'Admin' : 'User', { width: 80, continued: true });
        doc.text(lastLogin, { width: 100 });
      });
      break;
      
    case 'COMPREHENSIVE':
      // Add comprehensive report with multiple sections
      doc.fontSize(14).text('Comprehensive Financial Report', { underline: true });
      doc.moveDown(1);
      
      // Revenue summary
      const totalRev = await Payment.sum('amount', {
        where: {
          paymentDate: {
            [Op.between]: [startDate, endDate]
          },
          isExpense: false,
          status: 'COMPLETED'
        }
      }) || 0;
      
      // Expense summary
      const totalExp = await Payment.sum('amount', {
        where: {
          paymentDate: {
            [Op.between]: [startDate, endDate]
          },
          isExpense: true,
          status: 'COMPLETED'
        }
      }) || 0;
      
      // Platform fees
      const totalFees = await Payment.sum('platformFee', {
        where: {
          paymentDate: {
            [Op.between]: [startDate, endDate]
          },
          status: 'COMPLETED'
        }
      }) || 0;
      
      doc.fontSize(12).text(`Total Revenue: KES ${totalRev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      doc.fontSize(12).text(`Total Expenses: KES ${totalExp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      doc.fontSize(12).text(`Net Balance: KES ${(totalRev - totalExp).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      doc.fontSize(12).text(`Platform Fees: KES ${totalFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      doc.moveDown(2);
      
      // Add more comprehensive sections...
      break;
  }
  
  // Add footer
  doc.fontSize(10).text('Generated on ' + new Date().toLocaleString(), { align: 'center' });
}

// Helper function to generate CSV content (implementation would be specific to your needs)
async function generateCsvContent(reportType, startDate, endDate) {
  let csvContent = '';
  
  switch (reportType) {
    case 'REVENUE':
      csvContent = 'Date,Type,Amount,Description,Receipt Number\n';
      
      const revenue = await Payment.findAll({
        where: {
          paymentDate: {
            [Op.between]: [startDate, endDate]
          },
          isExpense: false,
          status: 'COMPLETED'
        },
        order: [['paymentDate', 'ASC']]
      });
      
      revenue.forEach(item => {
        const date = new Date(item.paymentDate).toLocaleDateString();
        csvContent += `${date},"${item.paymentType}",${item.amount},"${item.description || ''}","${item.receiptNumber || ''}"\n`;
      });
      break;
      
    case 'EXPENSES':
      csvContent = 'Date,Department,Amount,Description\n';
      
      const expenses = await Payment.findAll({
        where: {
          paymentDate: {
            [Op.between]: [startDate, endDate]
          },
          isExpense: true,
          status: 'COMPLETED'
        },
        order: [['paymentDate', 'ASC']]
      });
      
      expenses.forEach(item => {
        const date = new Date(item.paymentDate).toLocaleDateString();
        csvContent += `${date},"${item.department || ''}",${item.amount},"${item.description || ''}"\n`;
      });
      break;
      
    case 'USERS':
      csvContent = 'Username,Full Name,Email,Phone,Role,Last Login\n';
      
      const users = await User.findAll({
        order: [['createdAt', 'ASC']]
      });
      
      users.forEach(user => {
        const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never';
        csvContent += `"${user.username}","${user.fullName}","${user.email || ''}","${user.phone || ''}","${user.isAdmin ? 'Admin' : 'User'}","${lastLogin}"\n`;
      });
      break;
      
    case 'COMPREHENSIVE':
      // Combined data from multiple sources
      csvContent = 'Report Type: Comprehensive Financial Report\n';
      csvContent += `Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n\n`;
      
      // Revenue summary
      const totalRev = await Payment.sum('amount', {
        where: {
          paymentDate: {
            [Op.between]: [startDate, endDate]
          },
          isExpense: false,
          status: 'COMPLETED'
        }
      }) || 0;
      
      // Expense summary
      const totalExp = await Payment.sum('amount', {
        where: {
          paymentDate: {
            [Op.between]: [startDate, endDate]
          },
          isExpense: true,
          status: 'COMPLETED'
        }
      }) || 0;
      
      csvContent += 'Financial Summary\n';
      csvContent += `Total Revenue,${totalRev}\n`;
      csvContent += `Total Expenses,${totalExp}\n`;
      csvContent += `Net Balance,${totalRev - totalExp}\n\n`;
      
      // Add more sections...
      break;
  }
  
  return csvContent;
}

// Reset user password
// Reset user password (updated for security)
exports.resetUserPassword = async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Check if user exists
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Generate a unique reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date();
      resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 24); // 24 hour expiry
      
      // Update user with reset token
      await user.update({
        resetToken,
        resetTokenExpiry
      });
      
      // Generate reset URL (for admin to share with user)
      const resetUrl = `${process.env.FRONTEND_URL || ''}/reset-password?token=${resetToken}`;
      
      // Log activity
      await AdminAction.create({
        actionType: 'RESET_PASSWORD',
        targetId: userId,
        actionData: { userId, resetTokenHash: crypto.createHash('sha256').update(resetToken).digest('hex') }, // Store hash not actual token
        initiatedBy: req.user.id,
        status: 'COMPLETED'
      });
      
      res.json({
        success: true,
        message: 'Password reset initiated successfully',
        resetUrl
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ 
        message: 'Server error',
        error: process.env.NODE_ENV === 'production' ? undefined : error.message
      });
    }
  };
  
  // Add a new endpoint to handle the password reset with token
  exports.completePasswordReset = async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
      }
      
      // Find user with the valid token
      const user = await User.findOne({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            [Op.gt]: new Date() // Token hasn't expired
          }
        }
      });
      
      if (!user) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }
      
      // Update password and clear token
      await user.update({
        password: newPassword, // Will be hashed by model hooks
        resetToken: null,
        resetTokenExpiry: null
      });
      
      res.json({
        success: true,
        message: 'Password has been reset successfully'
      });
    } catch (error) {
      console.error('Error completing password reset:', error);
      res.status(500).json({ 
        message: 'Server error',
        error: process.env.NODE_ENV === 'production' ? undefined : error.message
      });
    }
  };

// Export the admin controller
module.exports = exports;