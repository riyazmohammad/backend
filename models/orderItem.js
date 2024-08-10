const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Order = require('./order');

const OrderItem = sequelize.define('OrderItem', {
  item_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

Order.hasMany(OrderItem);
OrderItem.belongsTo(Order);

module.exports = OrderItem;
