// server/controllers/specialOfferingController.js
const { Op } = require('sequelize');
const { models } = require('../models');
const { validationResult } = require('express-validator');
const sequelize = require('../config/database');

const Payment = models.Payment;
const User = models.User;

// Helper to format special offering data from a payment
const formatSpecialOffering = (payment) => {
  let customFields = [];
  let fullDescription = payment.description || '';
  
  try {
    if (payment.customFields) {
      // Handle different formats of customFields (string or object)
      if (typeof payment.customFields === 'string') {
        const parsedCustomFields = JSON.parse(payment.customFields);
        
        // Extract fields and description from parsed object
        if (parsedCustomFields.fields) {
          customFields = parsedCustomFields.fields;
        }
        
        if (parsedCustomFields.fullDescription) {
          fullDescription = parsedCustomFields.fullDescription;
        }
      } else if (payment.customFields.fields) {
        // Already an object
        customFields = payment.customFields.fields;
        if (payment.customFields.fullDescription) {
          fullDescription = payment.customFields.fullDescription;
        }
      }
    }
  } catch (error) {
    console.error(`Error parsing custom fields for offering ${payment.id}:`, error);
    // Continue with empty fields if parsing fails
  }
  
  return {
    offeringType: payment.paymentType,
    name: payment.description || 'Unnamed Special Offering', // Ensure name is never empty
    description: fullDescription,
    startDate: payment.paymentDate,
    endDate: payment.endDate,
    targetGoal: payment.targetGoal || 0,
    customFields: customFields,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    isTemplate: true // Always return isTemplate: true for special offerings
  };
};

// Get all special offerings
exports.getAllSpecialOfferings = async (req, res) => {
  try {
    console.log('Special offerings request received, activeOnly:', req.query.activeOnly);
    const now = new Date();
    
    // Find all special offering templates
    const specialOfferingPayments = await Payment.findAll({
      where: {
        paymentType: {
          [Op.like]: 'SPECIAL_%' 
        },
        isTemplate: true, // CRUCIAL: Only get templates, not actual payments
        // Only include active offerings if requested
        ...(req.query.activeOnly === 'true' ? {
          [Op.or]: [
            { endDate: null },
            { endDate: { [Op.gte]: now } }
          ]
        } : {})
      },
      include: [
        {
          model: User,
          attributes: ['id', 'username', 'fullName']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`Found ${specialOfferingPayments.length} special offering templates in database`);
    
    if (specialOfferingPayments.length === 0) {
      console.log('No special offerings found in database');
      return res.json({ specialOfferings: [] });
    }
    
    // Get unique offerings (in case there are duplicates)
    const uniqueOfferings = new Map();
    specialOfferingPayments.forEach(payment => {
      // Only add if not already in map or if this one is newer
      if (!uniqueOfferings.has(payment.paymentType) || 
          uniqueOfferings.get(payment.paymentType).createdAt < payment.createdAt) {
        uniqueOfferings.set(payment.paymentType, formatSpecialOffering(payment));
      }
    });
    
    // Convert to array
    const specialOfferings = [...uniqueOfferings.values()];
    console.log(`Returning ${specialOfferings.length} unique special offerings`);
    
    res.json({ specialOfferings });
  } catch (error) {
    console.error('Error getting special offerings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get a specific special offering by type
exports.getSpecialOfferingByType = async (req, res) => {
  try {
    const { offeringType } = req.params;
    
    const specialOfferingPayment = await Payment.findOne({
      where: {
        paymentType: offeringType,
        isTemplate: true // Only get template
      },
      include: [
        {
          model: User,
          attributes: ['id', 'username', 'fullName']
        }
      ]
    });
    
    if (!specialOfferingPayment) {
      return res.status(404).json({ message: 'Special offering not found' });
    }
    
    // Format the response
    const specialOffering = formatSpecialOffering(specialOfferingPayment);
    
    res.json({ specialOffering });
  } catch (error) {
    console.error('Error getting special offering:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get progress for a special offering
exports.getSpecialOfferingProgress = async (req, res) => {
  try {
    const { offeringType } = req.params;
    
    // Get the special offering template
    const specialOfferingPayment = await Payment.findOne({
      where: {
        paymentType: offeringType,
        isTemplate: true // Only get template
      }
    });
    
    if (!specialOfferingPayment) {
      return res.status(404).json({ message: 'Special offering not found' });
    }
    
    // Get all payments made to this special offering type (excluding the template)
    const payments = await Payment.findAll({
      where: {
        paymentType: offeringType,
        isTemplate: false, // Exclude the template
        status: 'COMPLETED'
      },
      include: [
        {
          model: User,
          attributes: ['id', 'username', 'fullName']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Calculate the total amount contributed
    const totalContributed = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    
    // Calculate the percentage (if target goal is set)
    let percentage = 0;
    if (specialOfferingPayment.targetGoal && specialOfferingPayment.targetGoal > 0) {
      percentage = Math.min(100, (totalContributed / parseFloat(specialOfferingPayment.targetGoal)) * 100);
    }
    
    res.json({
      offeringType,
      name: specialOfferingPayment.description || 'Unnamed Special Offering',
      description: getDescription(specialOfferingPayment),
      startDate: specialOfferingPayment.paymentDate,
      endDate: specialOfferingPayment.endDate,
      targetGoal: parseFloat(specialOfferingPayment.targetGoal) || 0,
      totalContributed,
      percentage,
      payments,
      remainingAmount: Math.max(0, (parseFloat(specialOfferingPayment.targetGoal) || 0) - totalContributed)
    });
  } catch (error) {
    console.error('Error getting special offering progress:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create a special offering
// Create a special offering
exports.createSpecialOffering = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await transaction.rollback();
      return res.status(400).json({ errors: errors.array() });
    }
    
    let { 
      offeringType,
      name,
      description,
      startDate,
      endDate,
      targetGoal,
      customFields
    } = req.body;
    
    // Validate name is provided and normalize offeringType
    if (!name || name.trim() === '') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Special offering name is required' });
    }
    if (!offeringType.startsWith('SPECIAL_')) {
      offeringType = `SPECIAL_${offeringType}`;
    }
    
    console.log('Creating special offering:', {
      offeringType,
      name,
      description,
      startDate,
      endDate,
      targetGoal
    });
    
    // Direct duplicate check
    const [duplicateCheck] = await sequelize.query(
      "SELECT COUNT(*) as count FROM \"Payments\" WHERE \"paymentType\" = ? AND \"isTemplate\" = true",
      { 
        replacements: [offeringType],
        type: sequelize.QueryTypes.SELECT,
        transaction
      }
    );
    
    if (duplicateCheck.count > 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'A special offering with this type already exists' });
    }
    
    const specialOffering = await Payment.create({
      userId: req.user.id,
      amount: targetGoal || 0,
      paymentType: offeringType,
      paymentMethod: 'MANUAL',
      // Use the trimmed name as the offering title stored in description
      description: name.trim(),
      status: 'COMPLETED',
      paymentDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      targetGoal: targetGoal || 0,
      isPromoted: true,
      isTemplate: true,
      addedBy: req.user.id,
      customFields: JSON.stringify({
        fullDescription: description,
        fields: customFields || []
      })
    }, { transaction });
    
    await transaction.commit();
    
    console.log('Special offering created successfully:', {
      id: specialOffering.id,
      paymentType: specialOffering.paymentType,
      description: specialOffering.description,
      isTemplate: specialOffering.isTemplate
    });
    
    // Return the formatted special offering
    const formattedOffering = formatSpecialOffering(specialOffering);
    
    res.status(201).json({
      success: true,
      message: 'Special offering created successfully',
      specialOffering: formattedOffering
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating special offering:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update a special offering
exports.updateSpecialOffering = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await transaction.rollback();
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { offeringType: rawOfferingType } = req.params;
    let offeringType = rawOfferingType;
    if (!offeringType.startsWith('SPECIAL_')) {
      offeringType = `SPECIAL_${offeringType}`;
    }
    
    const { 
      name,
      description,
      endDate,
      targetGoal,
      customFields,
      isActive
    } = req.body;
    
    const specialOffering = await Payment.findOne({
      where: {
        paymentType: offeringType,
        isTemplate: true
      },
      transaction
    });
    
    if (!specialOffering) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Special offering not found' });
    }
    
    const updateData = {};
    if (name && name.trim() !== '') {
      updateData.description = name.trim();
    }
    
    if (endDate) updateData.endDate = new Date(endDate);
    if (typeof targetGoal !== 'undefined') {
      updateData.targetGoal = targetGoal;
      updateData.amount = targetGoal;
    }
    if (typeof isActive !== 'undefined') {
      if (!isActive && !updateData.endDate) {
        updateData.endDate = new Date();
      }
      if (isActive) {
        updateData.endDate = null;
      }
    }
    
    if (typeof description !== 'undefined' || typeof customFields !== 'undefined') {
      let currentCustomFields = {};
      try {
        if (specialOffering.customFields) {
          currentCustomFields = typeof specialOffering.customFields === 'string'
            ? JSON.parse(specialOffering.customFields)
            : specialOffering.customFields;
        }
      } catch (e) {
        console.error('Error parsing existing custom fields:', e);
        currentCustomFields = {};
      }
      
      updateData.customFields = JSON.stringify({
        fullDescription: description || currentCustomFields.fullDescription || specialOffering.description,
        fields: customFields || currentCustomFields.fields || []
      });
    }
    
    updateData.isTemplate = true;
    
    await specialOffering.update(updateData, { transaction });
    
    const updatedOffering = await Payment.findOne({
      where: {
        paymentType: offeringType,
        isTemplate: true
      },
      transaction
    });
    
    await transaction.commit();
    
    res.json({
      message: 'Special offering updated successfully',
      specialOffering: formatSpecialOffering(updatedOffering)
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating special offering:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a special offering
exports.deleteSpecialOffering = async (req, res) => {
  // Start a transaction
  const transaction = await sequelize.transaction();
  
  try {
    const { offeringType } = req.params;
    
    const specialOffering = await Payment.findOne({
      where: {
        paymentType: offeringType,
        isTemplate: true // Only delete templates
      },
      transaction
    });
    
    if (!specialOffering) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Special offering not found' });
    }
    
    // Check if there are any payments to this offering
    const paymentsCount = await Payment.count({
      where: {
        paymentType: offeringType,
        isTemplate: false // Only count actual payments, not the template itself
      },
      transaction
    });
    
    if (paymentsCount > 0) {
      // Don't delete if there are payments, just mark as inactive by setting end date
      await specialOffering.update({
        endDate: new Date(),
        isPromoted: false
      }, { transaction });
      
      await transaction.commit();
      
      return res.json({
        message: 'Special offering deactivated (not deleted due to existing payments)',
        deactivated: true
      });
    }
    
    // Delete the special offering
    await specialOffering.destroy({ transaction });
    
    // Commit the transaction
    await transaction.commit();
    
    res.json({
      message: 'Special offering deleted successfully',
      deleted: true
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error('Error deleting special offering:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Make a payment to a special offering
exports.makePaymentToOffering = async (req, res) => {
  // Start a transaction
  const transaction = await sequelize.transaction();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await transaction.rollback();
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { offeringType } = req.params;
    const { amount, description } = req.body;
    const userId = req.user.id;
    
    // Find the special offering template
    const specialOffering = await Payment.findOne({
      where: {
        paymentType: offeringType,
        isTemplate: true
      },
      transaction
    });
    
    if (!specialOffering) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Special offering not found' });
    }
    
    // Check if offering is still active
    const now = new Date();
    if (specialOffering.endDate && specialOffering.endDate < now) {
      await transaction.rollback();
      return res.status(400).json({ message: 'This special offering is no longer active' });
    }
    
    // Generate receipt number
    const receiptNumber = `${offeringType.substring(0, 2)}-${Date.now()}`;
    
    // Create a payment for this offering with explicit isTemplate=false
    const payment = await Payment.create({
      userId,
      amount,
      paymentType: offeringType, // Same payment type as the offering
      paymentMethod: 'MANUAL',
      description: description || `Payment for ${specialOffering.description || 'Unnamed Special Offering'}`,
      status: 'COMPLETED',
      receiptNumber,
      addedBy: req.user.id,
      isTemplate: false, // This is a real payment, not a template
      paymentDate: new Date(),
      targetGoal: null // No target goal for actual payments
    }, { transaction });
    
    // Get user info for receipt
    const user = await User.findByPk(userId, { transaction });
    
    // Create receipt
    const receiptData = {
      paymentId: payment.id,
      amount,
      paymentType: payment.paymentType,
      paymentMethod: 'MANUAL',
      description: payment.description,
      userDetails: {
        name: user.fullName,
        phone: user.phone,
        email: user.email
      },
      churchDetails: {
        name: 'TASSIAC Church',
        address: 'Church Address',
        phone: 'Church Phone',
        email: 'church@tassiac.com'
      },
      receiptNumber,
      paymentDate: payment.paymentDate,
      issuedDate: new Date()
    };
    
    await models.Receipt.create({
      receiptNumber,
      paymentId: payment.id,
      userId,
      generatedBy: req.user.id,
      receiptData
    }, { transaction });
    
    // Commit the transaction
    await transaction.commit();
    
    res.status(201).json({
      message: 'Payment to special offering recorded successfully',
      payment,
      receiptNumber
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error('Error making payment to special offering:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper function to extract description from offering
function getDescription(offering) {
  try {
    if (offering.customFields) {
      const customFields = typeof offering.customFields === 'string'
        ? JSON.parse(offering.customFields)
        : offering.customFields;
        
      if (customFields.fullDescription) {
        return customFields.fullDescription;
      }
    }
  } catch (e) {
    console.warn('Error parsing custom fields for description:', e);
  }
  
  return offering.description || 'Unnamed Special Offering';
}

// Cleanup duplicate templates
exports.cleanupDuplicateTemplates = async (req, res) => {
  // Start a transaction
  const transaction = await sequelize.transaction();
  
  try {
    // Get all special offering templates
    const templates = await Payment.findAll({
      where: {
        paymentType: { 
          [Op.like]: 'SPECIAL_%' 
        }
      },
      order: [['createdAt', 'DESC']],
      transaction
    });
    
    console.log(`Found ${templates.length} total special offering records`);
    
    // Fix incorrect template flags - set all special offering definitions to isTemplate=true
    const definitionsByType = {};
    const duplicatesToDelete = [];
    const incorrectFlags = [];
    
    // First pass: categorize records and identify duplicates
    for (const record of templates) {
      const offeringType = record.paymentType;
      
      // Check if this is a definition (has targetGoal, description, no receiptNumber)
      const isDefinition = !record.receiptNumber && 
                          (record.targetGoal > 0 || record.customFields);
      
      if (isDefinition) {
        // This appears to be a definition
        if (!definitionsByType[offeringType]) {
          // First definition for this type
          definitionsByType[offeringType] = record;
          
          // Check if flag is incorrect
          if (!record.isTemplate) {
            incorrectFlags.push({id: record.id, type: offeringType});
          }
        } else {
          // Duplicate definition - mark for deletion
          duplicatesToDelete.push(record.id);
        }
      } else {
        // This appears to be a payment to the offering
        // Check if flag is incorrect (should be false)
        if (record.isTemplate) {
          incorrectFlags.push({id: record.id, type: offeringType, shouldBe: false});
        }
      }
    }
    
    // Fix incorrect flags
    for (const item of incorrectFlags) {
      await Payment.update(
        { isTemplate: item.shouldBe === false ? false : true },
        { 
          where: { id: item.id },
          transaction
        }
      );
      console.log(`Fixed isTemplate flag for record ${item.id} (${item.type}), set to ${item.shouldBe === false ? false : true}`);
    }
    
    // Delete duplicate templates
    if (duplicatesToDelete.length > 0) {
      await Payment.destroy({
        where: {
          id: { [Op.in]: duplicatesToDelete }
        },
        transaction
      });
      console.log(`Deleted ${duplicatesToDelete.length} duplicate template records`);
    }
    
    // Commit the transaction
    await transaction.commit();
    
    res.json({
      message: 'Special offering cleanup completed successfully',
      totalRecords: templates.length,
      uniqueOfferingTypes: Object.keys(definitionsByType).length,
      incorrectFlagsFixed: incorrectFlags.length,
      duplicatesRemoved: duplicatesToDelete.length
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error('Error cleaning up special offerings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Export controller methods
module.exports = exports;