const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create Users table first
    await queryInterface.createTable('Users', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false
      },
      fullName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false
      },
      isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      lastLogin: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Create Payments table
    await queryInterface.createTable('Payments', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
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
          model: 'Users',
          key: 'id'
        }
      },
      paymentDate: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW
      },
      platformFee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      titheDistribution: {
        type: DataTypes.JSON,
        allowNull: true
      },
      department: {
        type: DataTypes.STRING,
        allowNull: true
      },
      isPromoted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      endDate: {
        type: DataTypes.DATE,
        allowNull: true
      },
      customFields: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      targetGoal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      isTemplate: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('Payments');
    await queryInterface.dropTable('Users');
  }
};
