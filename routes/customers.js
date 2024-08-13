const express = require('express');
const { Op, fn, col, literal, Sequelize } = require('sequelize');
const Customer = require('../models/customer');
const Order = require('../models/order');
const OrderItem = require('../models/orderItem');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment');
const fs = require('fs');

const router = express.Router();
const sequelize = require('../config/database');
// Search customers with various filters
router.get('/search', async (req, res) => {
  try {
    console.log('Received search request with params:', req.query);
    const { days, minOrders, minItemsInOrder, deliveryPartner } = req.query;

    let whereConditions = [];
    let havingConditions = [];
    
    if (days) {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - parseInt(days));
      console.log('Date threshold:', dateThreshold);

      whereConditions.push({
        '$Orders.order_date$': {
          [Op.lt]: dateThreshold
        }
      });
    }

    if (minOrders) {
      havingConditions.push(Sequelize.literal(`COUNT(DISTINCT "Orders"."id") >= :minOrders`));
    }

    if (minItemsInOrder) {
      whereConditions.push(Sequelize.literal(`
        EXISTS (
          SELECT 1
          FROM "Orders" AS "SubOrder"
          LEFT JOIN "OrderItems" AS "SubOrderItems" ON "SubOrder"."id" = "SubOrderItems"."OrderId"
          WHERE "SubOrder"."CustomerId" = "Customer"."id"
          GROUP BY "SubOrder"."id"
          HAVING COUNT(DISTINCT "SubOrderItems"."id") >= :minItemsInOrder
        )
      `));
    }

    if (deliveryPartner) {
      whereConditions.push(Sequelize.where(
        Sequelize.fn('LOWER', Sequelize.col('Orders.delivery_partner')),
        Sequelize.fn('LOWER', deliveryPartner)
      ));
    }

    const customers = await Customer.findAll({
      attributes: [
        'id',
        'name',
        'phone_number',
        [fn('MAX', col('Orders.order_date')), 'last_order_date'],
        [fn('COUNT', Sequelize.literal('DISTINCT "Orders"."id"')), 'order_count'],
        [fn('MAX', col('Orders.delivery_partner')), 'last_delivery_partner'],
      ],
      include: [
        {
          model: Order,
          attributes: [],
          required: false,
        },
      ],
      where: whereConditions.length > 0 ? { [Op.and]: whereConditions } : {},
      group: ['Customer.id'],
      having: havingConditions.length > 0 ? Sequelize.and(...havingConditions) : {},
      replacements: { 
        minOrders: minOrders ? parseInt(minOrders) : 0,
        minItemsInOrder: minItemsInOrder ? parseInt(minItemsInOrder) : 0
      },
    });

    // Apply days filter post-query if it's set
    let result = customers.map(customer => customer.get({ plain: true }));
    if (days) {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - parseInt(days));
      result = result.filter(customer => 
        !customer.last_order_date || new Date(customer.last_order_date) < dateThreshold
      );
    }
    
    console.log('Filtered customers:', result.length);
    res.json(result);
  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({ error: error.message });
  }
});


// Get a paginated list of customers
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;

    const customers = await Customer.findAndCountAll({
      attributes: [
        'id',
        'name',
        'phone_number',
        [fn('MAX', col('Orders.order_date')), 'last_order_date'],
        [fn('COUNT', col('Orders.id')), 'order_count'],
        [fn('SUM', col('Orders.OrderItems.quantity')), 'total_items_ordered'],
        [fn('MAX', col('Orders.delivery_partner')), 'last_delivery_partner'], // Add this line
      ],
      include: [
        {
          model: Order,
          attributes: [],
          include: [
            {
              model: OrderItem,
              attributes: [],
            },
          ],
        },
      ],
      group: ['Customer.id'],
      limit,
      offset,
      subQuery: false,
    });

    const plainCustomers = customers.rows.map(customer => customer.get({ plain: true }));

    res.json({
      total: customers.count.length,
      customers: plainCustomers,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Download customer data as CSV
router.get('/download-csv', async (req, res) => {
  try {
    const { days, minOrders, minItemsInOrder, deliveryPartner } = req.query;

    let whereConditions = [];
    let havingConditions = [];
    
    if (days) {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - parseInt(days));
      console.log('Date threshold:', dateThreshold);

      whereConditions.push({
        '$Orders.order_date$': {
          [Op.lt]: dateThreshold
        }
      });
    }

    if (minOrders) {
      havingConditions.push(Sequelize.literal(`COUNT(DISTINCT "Orders"."id") >= :minOrders`));
    }

    if (minItemsInOrder) {
      whereConditions.push(Sequelize.literal(`
        EXISTS (
          SELECT 1
          FROM "Orders" AS "SubOrder"
          LEFT JOIN "OrderItems" AS "SubOrderItems" ON "SubOrder"."id" = "SubOrderItems"."OrderId"
          WHERE "SubOrder"."CustomerId" = "Customer"."id"
          GROUP BY "SubOrder"."id"
          HAVING COUNT(DISTINCT "SubOrderItems"."id") >= :minItemsInOrder
        )
      `));
    }

    if (deliveryPartner) {
      whereConditions.push(Sequelize.where(
        Sequelize.fn('LOWER', Sequelize.col('Orders.delivery_partner')),
        Sequelize.fn('LOWER', deliveryPartner)
      ));
    }

    const customers = await Customer.findAll({
      attributes: [
        'name',
        'phone_number',
      ],
      include: [
        {
          model: Order,
          attributes: [],
          required: false,
        },
      ],
      where: whereConditions.length > 0 ? { [Op.and]: whereConditions } : {},
      group: ['Customer.id'],
      having: havingConditions.length > 0 ? Sequelize.and(...havingConditions) : {},
      replacements: { 
        minOrders: minOrders ? parseInt(minOrders) : 0,
        minItemsInOrder: minItemsInOrder ? parseInt(minItemsInOrder) : 0
      },
    });

    const csvWriter = createCsvWriter({
      path: 'customers.csv',
      header: [
        { id: 'name', title: 'Customer Name' },
        { id: 'phone_number', title: 'Phone Number' },
      ],
    });

    const csvData = customers.map(c => c.get({ plain: true }));

    await csvWriter.writeRecords(csvData);

    res.download('customers.csv', 'customers.csv', (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).json({ error: 'An error occurred while sending the file' });
      }
      // Delete the file after sending
      fs.unlink('customers.csv', (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting file:', unlinkErr);
      });
    });

  } catch (error) {
    console.error('Error generating CSV:', error);
    res.status(500).json({ error: error.message });
  }
});


// Get orders for a specific customer
router.get('/:customerId/orders', async (req, res) => {
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


// Delete a customer and their related orders and order items
router.delete('/:id', async (req, res) => {
  const customerId = req.params.id;

  try {
    await sequelize.transaction(async (t) => {
      // Delete the order items related to the orders of the customer
      await OrderItem.destroy({
        where: {
          OrderId: {
            [Op.in]: sequelize.literal(`(SELECT id FROM "Orders" WHERE "CustomerId" = ${customerId})`),
          },
        },
        transaction: t
      });

      // Delete the orders of the customer
      await Order.destroy({
        where: {
          CustomerId: customerId,
        },
        transaction: t
      });

      // Delete the customer
      const deletedCustomer = await Customer.destroy({
        where: {
          id: customerId,
        },
        transaction: t
      });

      if (deletedCustomer === 0) {
        throw new Error('Customer not found');
      }
    });

    res.status(200).json({ message: 'Customer and related orders and order items deleted successfully.' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'An error occurred while deleting the customer.' });
  }
});

// Approve and save an order for a customer
router.post('/approve_order', async (req, res) => {
  const { customer_name, customer_phone_number, ...data } = req.body;

  if (!customer_name || !customer_phone_number) {
    return res.status(400).json({ error: 'Customer name and phone number are required' });
  }

  try {
    console.log('Received order data:', { customer_name, customer_phone_number, ...data });

    // Start a transaction
    const result = await sequelize.transaction(async (t) => {
      // Check if customer exists
      let customer = await Customer.findOne({ 
        where: { phone_number: customer_phone_number },
        transaction: t
      });

      console.log('Existing customer:', customer);

      // If customer doesn't exist, create a new one
      if (!customer) {
        customer = await Customer.create({
          name: customer_name,
          phone_number: customer_phone_number,
        }, { transaction: t });
        console.log('Created new customer:', customer);
      }

      // Parse the order date if provided, otherwise use current date
      const orderDate = data.order_date ? moment(data.order_date).toDate() : new Date();
      if (isNaN(orderDate)) {
        throw new Error('Invalid order date format');
      }

      console.log('Order date:', orderDate);

      // Create the order with optional fields
      const order = await Order.create({
        order_id: data.order_id || `ORD-${Date.now()}`, // Generate a default order ID if not provided
        order_date: orderDate,
        subtotal: data.subtotal_amount || 0,
        delivery_fees: data.delivery_fees || 0,
        discount: data.discount || 0,
        total: data.total || 0,
        delivery_partner: data.delivery_partner || 'Unknown',
        CustomerId: customer.id,
      }, { transaction: t });

      console.log('Created order:', order);

      // Create order items if provided
      if (data.order_item_list && Array.isArray(data.order_item_list)) {
        const orderItems = data.order_item_list.map(item => ({
          item_name: item.item_name || 'Unnamed Item',
          price: item.price || 0,
          quantity: item.quantity || 1,
          OrderId: order.id,
        }));

        const createdOrderItems = await OrderItem.bulkCreate(orderItems, { transaction: t });
        console.log('Created order items:', createdOrderItems);
      }

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
