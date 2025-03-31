// server/models/Receipt.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Payment = require('./Payment');
const User = require('./User');

const Receipt = sequelize.define('Receipt', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  receiptNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  paymentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Payment,
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  generatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    },
    comment: 'Admin who generated the receipt, if applicable'
  },
  receiptDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  receiptData: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'JSON data used to generate the receipt'
  },
  pdfPath: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Path to stored PDF receipt file'
  }
});

// Set up relationships
Receipt.belongsTo(Payment, { foreignKey: 'paymentId' });
Payment.hasOne(Receipt, { foreignKey: 'paymentId' });

Receipt.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Receipt, { foreignKey: 'userId' });

Receipt.belongsTo(User, { as: 'Generator', foreignKey: 'generatedBy' });

module.exports = Receipt;