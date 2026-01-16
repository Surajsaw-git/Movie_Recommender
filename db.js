/*
* This file manages your connection to MySQL.
*
* How to use:
* 1. Make sure you have the 'mysql2' package installed:
* npm install mysql2
* 2. Update the connection details (user, password) to match
* your local MySQL setup.
* 3. Make sure you have created the 'online_movie' database.
*/

const mysql = require('mysql2/promise');

// Create a connection "pool"
// A pool is more efficient than creating a new connection for every query
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root', // <-- !! Change this to your MySQL username
  password: '1234', // <-- !! Change this to your MySQL password
  database: 'online_movie', // From your PPT (slide 5)
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log('Database connection pool created for online_movie.');

// Export the pool so `server.js` can use it
module.exports = pool;