const express = require('express');
const app = require('./app');
const sequelize = require('./config/database');
const customersRouter = require('./routes/customers');
const ordersRouter = require('./routes/orders');
const authRouter = require('./routes/auth');
const port = 3001;

// Detailed logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

// Root path handler
app.get('/', (req, res) => {
  res.json({ message: "Welcome to the API" });
});

// Test route
app.get('/test', (req, res) => {
  res.json({ message: "Test route reached" });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Routes
app.use('/customers', customersRouter);
app.use('/orders', ordersRouter);
app.use('/auth', authRouter);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found", path: req.url });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// Sync database
sequelize.sync().then(() => {
  console.log('Database synced');
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}).catch(err => {
  console.error('Unable to sync database:', err);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});
