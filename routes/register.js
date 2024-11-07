const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const db = require("./db"); // Database connection

// Serve the registration form
router.get("/register", (req, res) => {
  res.render("register", { title: "Register" });
});

// Handle registration form submission
router.post("/register", async (req, res) => {
  const { username, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    return res.render("register", {
      title: "Register",
      message: "Passwords do not match",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = "INSERT INTO users (username, password) VALUES (?, ?)";
    db.query(query, [username, hashedPassword], (err) => {
      if (err) {
        console.error("Error inserting user:", err);
        return res.render("register", {
          title: "Register",
          message: "Registration failed. Try again.",
        });
      }
      res.redirect("/login");
    });
  } catch (err) {
    console.error("Error hashing password:", err);
    res.status(500).send("Internal server error");
  }
});

// Username Availability Check Route
router.get("/check-username", (req, res) => {
  const { username } = req.query;

  const query = "SELECT username FROM users WHERE username = ?";
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error("Database query error:", err);
      return res
        .status(500)
        .json({ available: false, error: "Database error" });
    }

    // If username is taken, respond with { available: false }
    const available = results.length === 0;
    res.json({ available });
  });
});

module.exports = router;
