// server/models/SpecialOffering.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const SpecialOffering = sequelize.define('SpecialOffering', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // A unique code for this offering (e.g., "CAMP2025")
  offeringCode: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  // The name/title of the offering
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Detailed description
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Who created this offering
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  // When the offering starts accepting contributions
  startDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  // Optional end date
  endDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Target amount to raise
  targetGoal: {
    type: DataTypes.DECIMAL(12, 2), // Larger precision for Postgres
    allowNull: true,
    defaultValue: 0.00
  },
  // JSON string for custom fields
  customFields: {
    type: DataTypes.TEXT, // TEXT is compatible with both SQLite and Postgres
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('customFields');
      if (rawValue) {
        try {
          return JSON.parse(rawValue);
        } catch (e) {
          return [];
        }
      }
      return [];
    },
    set(value) {
      this.setDataValue('customFields', 
        typeof value === 'string' ? value : JSON.stringify(value || []));
    }
  },
  // Visibility flag
  isPromoted: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // Whether the offering is active
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  indexes: [
    // Add indexes for frequently queried fields
    { fields: ['offeringCode'] },
    { fields: ['isActive'] },
    { fields: ['createdBy'] }
  ]
});

// Set up relationships
SpecialOffering.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });

module.exports = SpecialOffering;