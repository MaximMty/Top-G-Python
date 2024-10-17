const mysql = require("mysql2");

// Create a MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "maximag",
  database: "Top_G_Python",
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    process.exit(1); // Stop the app if the DB fails to connect
  }
  console.log("Connected to the MySQL database.");
});

module.exports = db;
