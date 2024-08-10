const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Customer = require('./customer');

const Order = sequelize.define('Order', {
  order_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  order_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  subtotal: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  delivery_fees: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  discount: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  total: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  delivery_partner: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

Customer.hasMany(Order);
Order.belongsTo(Customer);

module.exports = Order;
