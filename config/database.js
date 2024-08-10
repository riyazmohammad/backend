const { Sequelize } = require('sequelize');
const db_url = process.env.DB_URI;
const sequelize = new Sequelize(db_url, {
  dialect: 'postgres',
  logging: false,
});

sequelize.authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

module.exports = sequelize;
