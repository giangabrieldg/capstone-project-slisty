
const sequelize = require('./config/database');

async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('Connection to Slice N Grind database successful!');
    } catch (error) {
        console.error('Unable to connect to the database:', error.message);
    }
}

testConnection();