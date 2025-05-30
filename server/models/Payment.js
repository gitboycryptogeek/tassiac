// server/models/Payment.js
const { DataTypes, Op, Model } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

class Payment extends Model {}

Payment.init({
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
  sequelize,
  modelName: 'Payment',
  tableName: 'Payments', // Change to match your PostgreSQL table name
  timestamps: true,
  hooks: {
    beforeValidate: (payment, options) => {
      // Allow special offering creation from both endpoints
      if (payment.paymentType && payment.paymentType.startsWith('SPECIAL_')) {
        // Don't throw error, just validate and normalize the data
        if (!payment.description || payment.description.trim() === '') {
          payment.description = 'Unnamed Special Offering';
        }
        if (payment.isTemplate) {
          payment.status = 'COMPLETED';
        }
      }
      // Normalize special offering types
      if (payment.paymentType && String(payment.paymentType).toUpperCase().indexOf('SPECIAL_') !== 0) {
        payment.paymentType = `SPECIAL_${payment.paymentType}`;
      }
    },
    
    beforeCreate: async (payment, options) => {
      // Only validate duplicate templates
      if (payment.isTemplate && payment.paymentType?.startsWith('SPECIAL_')) {
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