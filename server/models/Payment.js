// server/models/Payment.js
const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  paymentType: {
    type: DataTypes.STRING, 
    allowNull: false
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reference: {
    type: DataTypes.STRING,
    allowNull: true
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'PENDING'
  },
  receiptNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  },
  isExpense: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  addedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    }
  },
  paymentDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  platformFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: '2% for M-Pesa, 0.5% for manual'
  },
  titheDistribution: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Breakdown of tithe payment'
  },
  department: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Department for expenses'
  },
  isPromoted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Special payments promoted to users'
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'End date for special offerings'
  },
  customFields: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Custom fields for special offerings'
  },
  targetGoal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Goal amount for special offerings'
  },
  isTemplate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Flag for special offering templates (not actual payments)'
  }
}, {
  // Model options
  timestamps: true, // Enables createdAt and updatedAt
  
  hooks: {
    beforeValidate: (payment) => {
      // Ensure description is never empty for special offerings
      if (payment.paymentType && 
          payment.paymentType.startsWith('SPECIAL_') && 
          (!payment.description || payment.description.trim() === '')) {
        payment.description = 'Unnamed Special Offering';
      }
    },
    
    beforeCreate: async (payment, options) => {
      // Check for duplicate templates if this is a special offering template
      if (payment.paymentType && 
          payment.paymentType.startsWith('SPECIAL_') && 
          payment.isTemplate === true) {
        
        // Ensure special offering templates are always completed
        payment.status = 'COMPLETED';
        
        // Check for existing template with the same paymentType
        const existingTemplate = await Payment.findOne({
          where: {
            paymentType: payment.paymentType,
            isTemplate: true
          },
          transaction: options.transaction
        });
        
        if (existingTemplate) {
          throw new Error(`A special offering template with type ${payment.paymentType} already exists`);
        }
      }
      
      // Make sure actual payments to special offerings are NOT marked as templates
      if (payment.paymentType && 
          payment.paymentType.startsWith('SPECIAL_') && 
          payment.isTemplate !== true) {
        // Force isTemplate to false for actual payments
        payment.isTemplate = false;
      }
    },
    
    beforeUpdate: (payment) => {
      // Keep the same logic for updates
      if (payment.paymentType && 
          payment.paymentType.startsWith('SPECIAL_') && 
          payment.isTemplate === true) {
        payment.status = 'COMPLETED';
      }
      
      // Prevent accidental conversion of payments to templates
      if (payment.paymentType && 
          payment.paymentType.startsWith('SPECIAL_') && 
          payment.isTemplate !== true) {
        payment.isTemplate = false;
      }
      
      // Ensure description is never empty for special offerings
      if (payment.paymentType && 
          payment.paymentType.startsWith('SPECIAL_') && 
          payment.description === '') {
        payment.description = 'Unnamed Special Offering';
      }
    }
  }
});

// Set up the relationship
Payment.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Payment, { foreignKey: 'userId' });

// Add a relation for admin who added the payment
Payment.belongsTo(User, { as: 'AdminUser', foreignKey: 'addedBy' });

module.exports = Payment;