// server/models/Notification.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Notification = sequelize.define('Notification', {
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
  notificationType: {
    type: DataTypes.ENUM('SMS', 'EMAIL', 'SYSTEM'),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  reference: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Reference to associated entity (e.g., payment ID)'
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'SENT', 'FAILED'),
    defaultValue: 'PENDING'
  },
  responseData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Response data from notification service'
  }
});

// Set up relationship
Notification.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Notification, { foreignKey: 'userId' });

module.exports = Notification;