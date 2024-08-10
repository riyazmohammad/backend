const express = require('express');
const { Op } = require('sequelize');
const Customer = require('../models/customer');
const Order = require('../models/order');
const OrderItem = require('../models/orderItem');
const moment = require('moment');
const sequelize = require('../config/database');

const router = express.Router();

// Get orders for a specific customer
router.get('/customers/:customerId/orders', async (req, res) => {
  try {
    const { customerId } = req.params;
    const orders = await Order.findAll({
      where: { CustomerId: customerId },
      include: [OrderItem],
    });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'An error occurred while fetching orders' });
  }
});

// Approve and save an order for a customer
router.post('/approve_order', async (req, res) => {
  const data = req.body;

  try {
    console.log('Received order data:', data);

    // Start a transaction
    const result = await sequelize.transaction(async (t) => {
      // Check if customer exists
      let customer = await Customer.findOne({ 
        where: { phone_number: data.customer_phone_number },
        transaction: t
      });

      console.log('Existing customer:', customer);

      // If customer doesn't exist, create a new one
      if (!customer) {
        customer = await Customer.create({
          name: data.customer_name,
          phone_number: data.customer_phone_number,
        }, { transaction: t });
        console.log('Created new customer:', customer);
      }

      // Parse the order date
      const orderDate = moment(data.order_date).toDate();
      if (isNaN(orderDate)) {
        throw new Error('Invalid order date format');
      }

      console.log('Parsed order date:', orderDate);

      // Create the order
      const order = await Order.create({
        order_id: data.order_id,
        order_date: orderDate,
        subtotal: data.subtotal_amount,
        delivery_fees: data.delivery_fees,
        discount: data.discount,
        total: data.total,
        delivery_partner: data.delivery_partner,
        CustomerId: customer.id,
      }, { transaction: t });

      console.log('Created order:', order);

      // Create order items
      const orderItems = data.order_item_list.map(item => ({
        item_name: item.item_name,
        price: item.price,
        quantity: item.quantity,
        OrderId: order.id,
      }));

      const createdOrderItems = await OrderItem.bulkCreate(orderItems, { transaction: t });
      console.log('Created order items:', createdOrderItems);

      return { customer, order };
    });

    res.status(201).json({ 
      message: 'Order approved and saved successfully',
      customer: result.customer,
      order: result.order
    });
  } catch (error) {
    console.error('Error approving order:', error);
    res.status(500).json({ error: error.message || 'An error occurred while saving the order' });
  }
});
module.exports = router;
