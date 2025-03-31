// server/models/AdminAction.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const AdminAction = sequelize.define('AdminAction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  actionType: {
    type: DataTypes.ENUM('DELETE_RECORD', 'MODIFY_USER', 'BULK_OPERATION', 'OTHER_SENSITIVE'),
    allowNull: false
  },
  targetId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'ID of the record being acted upon'
  },
  actionData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional data about the action'
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'),
    defaultValue: 'PENDING'
  },
  initiatedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: () => {
      // Action expires after 24 hours
      const date = new Date();
      date.setHours(date.getHours() + 24);
      return date;
    }
  }
});

// Define the approvals model
const AdminActionApproval = sequelize.define('AdminActionApproval', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  adminActionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: AdminAction,
      key: 'id'
    }
  },
  adminId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  approved: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

// Set up relationships
AdminAction.belongsTo(User, { as: 'Initiator', foreignKey: 'initiatedBy' });
AdminAction.hasMany(AdminActionApproval, { foreignKey: 'adminActionId' });
AdminActionApproval.belongsTo(AdminAction, { foreignKey: 'adminActionId' });
AdminActionApproval.belongsTo(User, { as: 'Admin', foreignKey: 'adminId' });

module.exports = { AdminAction, AdminActionApproval };