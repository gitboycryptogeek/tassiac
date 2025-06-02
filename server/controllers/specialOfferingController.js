// server/controllers/specialOfferingController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Setup debug log file
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'special-offering-controller-debug.log');

function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] SPEC_OFFER_CTRL: ${message}`;
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

// Helper to check for view-only admin (placeholder logic)
const isViewOnlyAdmin = (user) => {
  if (!user || !user.isAdmin) return false;
  const viewOnlyUsernames = ['admin3', 'admin4', 'admin5'];
  // const viewOnlyIds = [3, 4, 5]; // Or use IDs
  // return viewOnlyUsernames.includes(user.username) || viewOnlyIds.includes(user.id);
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

// Helper to format special offering for consistent output
const formatOfferingOutput = (offering) => {
  if (!offering) return null;
  return {
    id: offering.id,
    offeringCode: offering.offeringCode,
    name: offering.name,
    description: offering.description,
    targetAmount: offering.targetAmount ? parseFloat(offering.targetAmount.toString()) : null,
    currentAmount: offering.currentAmount ? parseFloat(offering.currentAmount.toString()) : 0, // Will be calculated
    startDate: offering.startDate,
    endDate: offering.endDate,
    isActive: offering.isActive,
    createdBy: offering.createdBy,
    creator: offering.creator ? { // Include basic creator info
        id: offering.creator.id,
        fullName: offering.creator.fullName,
        username: offering.creator.username,
    } : null,
    customFields: offering.customFields, // Already JSON from Prisma
    createdAt: offering.createdAt,
    updatedAt: offering.updatedAt,
  };
};

// Create a new special offering (Admin only)
exports.createSpecialOffering = async (req, res) => {
  debugLog('Attempting to create special offering');
  try {
    if (isViewOnlyAdmin(req.user)) {
      debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to create special offering.`);
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot create special offerings.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog('Validation errors on create:', errors.array());
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const {
      name,
      description,
      targetAmount,
      startDate,
      endDate,
      isActive = true,
      customFields,
      offeringCode
    } = req.body;

    if (!name || !offeringCode) {
      return sendResponse(res, 400, false, null, 'Offering name and code are required.', { code: 'MISSING_REQUIRED_FIELDS' });
    }

    const existingOfferingByCode = await prisma.specialOffering.findUnique({
      where: { offeringCode }
    });
    if (existingOfferingByCode) {
      return sendResponse(res, 400, false, null, `Offering code '${offeringCode}' already exists.`, { code: 'DUPLICATE_OFFERING_CODE' });
    }

    const offeringData = {
      name,
      offeringCode,
      description: description || null,
      targetAmount: targetAmount ? parseFloat(targetAmount) : null,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      isActive,
      customFields: customFields || Prisma.JsonNull,
      createdBy: req.user.id,
    };

    debugLog('Creating SpecialOffering with data:', offeringData);
    const specialOffering = await prisma.specialOffering.create({ data: offeringData });

    await logAdminActivity('CREATE_SPECIAL_OFFERING', specialOffering.id, req.user.id, { name: specialOffering.name, code: specialOffering.offeringCode });
    debugLog('Special offering created successfully:', specialOffering.id);
    return sendResponse(res, 201, true, { specialOffering: formatOfferingOutput(specialOffering) }, 'Special offering created successfully.');

  } catch (error) {
    debugLog('Error creating special offering:', error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return sendResponse(res, 400, false, null, `A special offering with the provided code or other unique identifier already exists. Fields: ${error.meta?.target?.join(', ')}`, { code: 'DUPLICATE_ENTRY' });
    }
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error creating special offering.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Get all special offerings
exports.getAllSpecialOfferings = async (req, res) => {
  debugLog('Attempting to get all special offerings');
  try {
    const { activeOnly = 'false', page = 1, limit = 10, search } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const whereClause = {};
    if (activeOnly === 'true') {
      whereClause.isActive = true;
      const now = new Date();
      whereClause.OR = [
        { endDate: null },
        { endDate: { gte: now } },
      ];
    }
    if (search) {
      whereClause.OR = [
        ...(whereClause.OR || []), // Keep existing OR conditions if any
        { name: { contains: search, mode: 'insensitive' } },
        { offeringCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }


    const offerings = await prisma.specialOffering.findMany({
      where: whereClause,
      orderBy: { startDate: 'desc' },
      skip,
      take,
      include: { creator: { select: { id: true, fullName: true, username: true } } }
    });

    const totalOfferings = await prisma.specialOffering.count({ where: whereClause });

    const offeringsWithProgress = await Promise.all(
      offerings.map(async (offering) => {
        const contributions = await prisma.payment.aggregate({
          _sum: { amount: true },
          where: { specialOfferingId: offering.id, status: 'COMPLETED', paymentType: 'SPECIAL_OFFERING_CONTRIBUTION' },
        });
        return {
          ...formatOfferingOutput(offering), // Uses the helper
          currentAmount: contributions._sum.amount ? parseFloat(contributions._sum.amount.toString()) : 0,
          // creatorName: offering.creator?.fullName // creator is already part of formatOfferingOutput
        };
      })
    );

    debugLog(`Retrieved ${offeringsWithProgress.length} special offerings.`);
    return sendResponse(res, 200, true, {
      specialOfferings: offeringsWithProgress,
      totalPages: Math.ceil(totalOfferings / take),
      currentPage: parseInt(page),
      totalOfferings
    }, 'Special offerings retrieved successfully.');

  } catch (error) {
    debugLog('Error getting special offerings:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error retrieving special offerings.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Get a specific special offering by ID or Code
exports.getSpecialOffering = async (req, res) => {
  const { identifier } = req.params;
  debugLog(`Attempting to get special offering by identifier: ${identifier}`);
  try {
    const isNumericId = /^\d+$/.test(identifier);
    const whereUnique = isNumericId ? { id: parseInt(identifier) } : { offeringCode: identifier };

    const offering = await prisma.specialOffering.findUnique({
      where: whereUnique,
      include: { creator: { select: { id: true, fullName: true, username: true } } }
    });

    if (!offering) {
      debugLog('Special offering not found.');
      return sendResponse(res, 404, false, null, 'Special offering not found.', { code: 'NOT_FOUND' });
    }

    const contributions = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { specialOfferingId: offering.id, status: 'COMPLETED', paymentType: 'SPECIAL_OFFERING_CONTRIBUTION' },
    });

    const offeringWithProgress = {
      ...formatOfferingOutput(offering),
      currentAmount: contributions._sum.amount ? parseFloat(contributions._sum.amount.toString()) : 0,
      // creatorName: offering.creator?.fullName // Included in formatOfferingOutput
    };

    debugLog('Special offering retrieved successfully:', offering.name);
    return sendResponse(res, 200, true, { specialOffering: offeringWithProgress }, 'Special offering retrieved successfully.');

  } catch (error) {
    debugLog('Error getting special offering:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error retrieving special offering.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Update a special offering (Admin only)
exports.updateSpecialOffering = async (req, res) => {
  const { identifier } = req.params;
  debugLog(`Attempting to update special offering: ${identifier}`);
  try {
    if (isViewOnlyAdmin(req.user)) {
      debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to update special offering.`);
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot update special offerings.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog('Validation errors on update:', errors.array());
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const { name, description, targetAmount, startDate, endDate, isActive, customFields, offeringCode } = req.body;
    const isNumericId = /^\d+$/.test(identifier);
    const whereUnique = isNumericId ? { id: parseInt(identifier) } : { offeringCode: identifier };

    const existingOffering = await prisma.specialOffering.findUnique({ where: whereUnique });
    if (!existingOffering) {
      return sendResponse(res, 404, false, null, 'Special offering not found to update.', { code: 'NOT_FOUND' });
    }

    if (offeringCode && offeringCode !== existingOffering.offeringCode) {
      const checkCode = await prisma.specialOffering.findUnique({ where: { offeringCode } });
      if (checkCode && checkCode.id !== existingOffering.id) {
        return sendResponse(res, 400, false, null, `Offering code '${offeringCode}' is already in use.`, { code: 'DUPLICATE_OFFERING_CODE' });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (offeringCode !== undefined) updateData.offeringCode = offeringCode;
    if (description !== undefined) updateData.description = description || null;
    if (targetAmount !== undefined) updateData.targetAmount = targetAmount ? parseFloat(targetAmount) : null;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null; // Allow setting endDate to null
    if (isActive !== undefined) updateData.isActive = isActive;
    if (customFields !== undefined) updateData.customFields = customFields || Prisma.JsonNull;

    const updatedOffering = await prisma.specialOffering.update({
      where: whereUnique,
      data: updateData,
      include: { creator: { select: { id: true, fullName: true, username: true } } }
    });
    
    await logAdminActivity('UPDATE_SPECIAL_OFFERING', updatedOffering.id, req.user.id, { name: updatedOffering.name, changes: Object.keys(updateData) });
    debugLog('Special offering updated successfully:', updatedOffering.name);
    return sendResponse(res, 200, true, { specialOffering: formatOfferingOutput(updatedOffering) }, 'Special offering updated successfully.');

  } catch (error) {
    debugLog('Error updating special offering:', error.message);
     if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return sendResponse(res, 400, false, null, `A special offering with this identifier (e.g., code) already exists. Fields: ${error.meta?.target?.join(', ')}`, { code: 'DUPLICATE_ENTRY' });
    }
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error updating special offering.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Delete a special offering (Admin only)
exports.deleteSpecialOffering = async (req, res) => {
  const { identifier } = req.params;
  debugLog(`Attempting to delete special offering: ${identifier}`);
  try {
    if (isViewOnlyAdmin(req.user)) {
      debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to delete special offering.`);
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot delete special offerings.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const isNumericId = /^\d+$/.test(identifier);
    const whereUnique = isNumericId ? { id: parseInt(identifier) } : { offeringCode: identifier };

    const offering = await prisma.specialOffering.findUnique({
      where: whereUnique,
      include: { _count: { select: { contributions: { where: { status: 'COMPLETED' } } } } }
    });

    if (!offering) {
      debugLog('Special offering not found for deletion.');
      return sendResponse(res, 404, false, null, 'Special offering not found.', { code: 'NOT_FOUND' });
    }

    if (offering._count.contributions > 0) {
      debugLog(`Offering ${offering.name} has contributions, marking as inactive.`);
      const deactivatedOffering = await prisma.specialOffering.update({
        where: whereUnique,
        data: { isActive: false, endDate: new Date() },
      });
      await logAdminActivity('DEACTIVATE_SPECIAL_OFFERING', deactivatedOffering.id, req.user.id, { name: deactivatedOffering.name });
      return sendResponse(res, 200, true, { specialOffering: formatOfferingOutput(deactivatedOffering), status: 'deactivated' }, 'Special offering has contributions and has been marked as inactive.');
    }

    await prisma.specialOffering.delete({ where: whereUnique });
    await logAdminActivity('DELETE_SPECIAL_OFFERING', offering.id, req.user.id, { name: offering.name });
    debugLog('Special offering deleted successfully:', offering.name);
    return sendResponse(res, 200, true, { id: offering.id, offeringCode: offering.offeringCode, status: 'deleted' }, 'Special offering deleted successfully.');

  } catch (error) {
    debugLog('Error deleting special offering:', error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { // Record to delete not found
        return sendResponse(res, 404, false, null, 'Special offering not found for deletion.', { code: 'NOT_FOUND' });
    }
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error deleting special offering.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Make a payment (contribution) to a special offering (Authenticated User)
exports.makePaymentToOffering = async (req, res) => {
  const { identifier } = req.params; // SpecialOffering ID or Code
  debugLog(`Payment attempt for special offering: ${identifier}`);
  const transaction = await prisma.$transaction(async (tx) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog('Validation errors on payment:', errors.array());
      // No direct res here, throw error to be caught by outer try-catch
      throw { statusCode: 400, success: false, data: null, message: 'Validation failed', errorDetails: {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      }};
    }

    const { amount, description, paymentMethod = 'MPESA' } = req.body; // Default to MPESA if user paying
    const userId = req.user.id;

    if (!amount || parseFloat(amount) <= 0) {
      throw { statusCode: 400, success: false, data:null, message:'Invalid payment amount.', errorDetails: {code: 'INVALID_AMOUNT'}};
    }

    const isNumericId = /^\d+$/.test(identifier);
    const whereUniqueOffering = isNumericId ? { id: parseInt(identifier) } : { offeringCode: identifier };

    const specialOffering = await tx.specialOffering.findUnique({ where: whereUniqueOffering });

    if (!specialOffering || !specialOffering.isActive) {
      debugLog('Special offering not found or inactive.');
      throw { statusCode: 404, success: false, data:null, message: 'Special offering not found or is not active.', errorDetails: {code: 'OFFERING_NOT_AVAILABLE'}};
    }
    
    if (specialOffering.endDate && new Date(specialOffering.endDate) < new Date()) {
        debugLog('Special offering has ended.');
        throw { statusCode: 400, success: false, data:null, message: 'This special offering has ended.', errorDetails: {code: 'OFFERING_ENDED'}};
    }

    const paymentAmount = parseFloat(amount);
    let mpesaResponseDetails = null;
    let paymentStatus = 'PENDING'; // Default for M-Pesa

    if (paymentMethod === 'MPESA') {
        const userPhone = req.body.phoneNumber || req.user.phone;
        if (!userPhone) {
            throw { statusCode: 400, success: false, data:null, message: 'Phone number required for M-Pesa.', errorDetails: {code: 'PHONE_REQUIRED_MPESA'}};
        }
        // M-Pesa fee calculation (example)
        let platformFee = 5;
        if (paymentAmount > 500) {
            platformFee = Math.max(5, parseFloat((paymentAmount * 0.01).toFixed(2)));
        }

        const tempPaymentForMpesa = {
            id: `TEMP_${Date.now()}`, // Temporary ID for M-Pesa call
            amount: paymentAmount,
            paymentType: 'SPECIAL_OFFERING_CONTRIBUTION',
            description: description || `Contribution to ${specialOffering.name}`,
            platformFee: platformFee
        };
        
        mpesaResponseDetails = await initiateMpesaPayment( // This function should be in paymentUtils.js
            tempPaymentForMpesa.id,
            paymentAmount, // Amount user intends to give
            userPhone,
            tempPaymentForMpesa.description
        );
        // paymentStatus will remain PENDING; callback will update to COMPLETED/FAILED
    } else if (paymentMethod === 'MANUAL') {
        // This case is if an admin is manually recording a contribution to a special offering
        if (!req.user.isAdmin) {
            throw { statusCode: 403, success: false, data: null, message: 'Forbidden: Only admins can make manual entries.', errorDetails: { code: 'FORBIDDEN_MANUAL_ENTRY'}};
        }
        paymentStatus = 'COMPLETED'; // Manual entries are typically completed
    }


    const paymentData = {
      userId,
      amount: paymentAmount,
      paymentType: 'SPECIAL_OFFERING_CONTRIBUTION',
      paymentMethod,
      description: description || `Contribution to ${specialOffering.name}`,
      status: paymentStatus,
      paymentDate: new Date(),
      specialOfferingId: specialOffering.id,
      processedBy: req.user.isAdmin && paymentMethod === 'MANUAL' ? req.user.id : null,
      reference: paymentMethod === 'MPESA' ? mpesaResponseDetails?.reference : null,
      transactionId: paymentMethod === 'MPESA' ? mpesaResponseDetails?.transactionId : null,
      platformFee: paymentMethod === 'MPESA' ? (mpesaResponseDetails?.platformFee || 0) : 0
    };

    const payment = await tx.payment.create({ data: paymentData });

    // If manual and completed, generate receipt immediately
    if (paymentMethod === 'MANUAL' && payment.status === 'COMPLETED') {
        const user = await tx.user.findUnique({where: {id: userId}});
        const receiptNumber = generateReceiptNumber(payment.paymentType);
        await tx.receipt.create({
            data: {
                receiptNumber,
                paymentId: payment.id,
                userId: payment.userId,
                generatedBy: req.user.id, // Admin who made the manual entry
                receiptDate: new Date(),
                receiptData: { /* Populate as needed */ }
            }
        });
        await tx.payment.update({ where: {id: payment.id}, data: { receiptNumber }});
        debugLog(`Manual contribution receipt ${receiptNumber} generated for payment ${payment.id}`);
    }
    
    debugLog(`Contribution of ${amount} made to special offering ${specialOffering.name} by user ${userId}. Method: ${paymentMethod}. Status: ${paymentStatus}`);
    return { payment, mpesaCheckoutID: paymentMethod === 'MPESA' ? mpesaResponseDetails?.reference : null, message: paymentMethod === 'MPESA' ? mpesaResponseDetails?.message : 'Contribution recorded.' };
  });

  try {
    const { payment, mpesaCheckoutID, message } = transaction;
    return sendResponse(res, 201, true, { paymentId: payment.id, mpesaCheckoutID }, message);
  } catch (error) {
    debugLog('Error making payment to special offering:', error.message || error);
    console.error(error);
    const statusCode = error.statusCode || 500;
    return sendResponse(res, statusCode, false, null, error.message || 'Server error processing contribution.', error.errorDetails || {
      code: 'CONTRIBUTION_ERROR',
      details: error.message,
    });
  }
};


// Get progress for a special offering
exports.getSpecialOfferingProgress = async (req, res) => {
  const { identifier } = req.params;
  debugLog(`Fetching progress for special offering: ${identifier}`);
  try {
    const isNumericId = /^\d+$/.test(identifier);
    const whereUnique = isNumericId ? { id: parseInt(identifier) } : { offeringCode: identifier };

    const offering = await prisma.specialOffering.findUnique({ where: whereUnique });

    if (!offering) {
      debugLog('Special offering not found for progress check.');
      return sendResponse(res, 404, false, null, 'Special offering not found.', { code: 'NOT_FOUND' });
    }

    const contributions = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { specialOfferingId: offering.id, status: 'COMPLETED', paymentType: 'SPECIAL_OFFERING_CONTRIBUTION' },
    });

    const totalContributed = contributions._sum.amount ? parseFloat(contributions._sum.amount.toString()) : 0;
    const targetGoal = offering.targetAmount ? parseFloat(offering.targetAmount.toString()) : 0;
    const percentage = targetGoal > 0 ? Math.min(100, (totalContributed / targetGoal) * 100) : (targetGoal === 0 && totalContributed > 0 ? 100 : 0) ; // If no target, but contributions exist, show 100% of what's given.
    const remainingAmount = targetGoal > 0 ? Math.max(0, targetGoal - totalContributed) : 0;

    const progressData = {
      offeringId: offering.id,
      offeringCode: offering.offeringCode,
      name: offering.name,
      targetGoal: targetGoal,
      totalContributed: totalContributed,
      percentage: parseFloat(percentage.toFixed(2)),
      remainingAmount: parseFloat(remainingAmount.toFixed(2))
    };
    
    debugLog('Special offering progress retrieved:', progressData);
    return sendResponse(res, 200, true, { progress: progressData }, 'Special offering progress retrieved successfully.');

  } catch (error) {
    debugLog('Error fetching special offering progress:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error retrieving progress.', { code: 'SERVER_ERROR', details: error.message });
  }
};