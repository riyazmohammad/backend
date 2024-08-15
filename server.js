const app = require('./app');
const sequelize = require('./config/database');
const customersRouter = require('./routes/customers');
const ordersRouter = require('./routes/orders');
const authRouter = require('./routes/auth');


const port = 3456;

// Sync database
sequelize.sync();

// Routes
app.use('/customers', customersRouter);
app.use('/orders', ordersRouter);
app.use('/auth', authRouter);


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});
