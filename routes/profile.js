const express = require("express");
const bcrypt = require("bcrypt");
const multer = require("multer");
const router = express.Router();
const db = require("../routes/db");
const fs = require("fs"); // File system operations

// Multer setup for avatar uploads
const upload = multer({
  dest: "public/uploads/avatars/",
  limits: { fileSize: 2 * 1024 * 1024 }, // Limit: 2MB
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect("/login");
};

// Profile View Page
router.get("/profile", isAuthenticated, (req, res) => {
  const query = "SELECT username, email, avatar FROM users WHERE username = ?";
  db.query(query, [req.session.user], (err, results) => {
    if (err) {
      console.error("Error fetching user details:", err);
      return res.redirect("/");
    }
    const user = results[0];
    res.render("profile", { user });
  });
});

// Edit Profile Page
router.get("/editprofile", isAuthenticated, (req, res) => {
  const query = "SELECT username, email, avatar FROM users WHERE username = ?";
  db.query(query, [req.session.user], (err, results) => {
    if (err) {
      console.error("Error fetching user details:", err);
      return res.redirect("/profile");
    }
    const user = results[0];
    res.render("editprofile", { user });
  });
});

// Avatar Upload Handler
router.post("/avatar", isAuthenticated, upload.single("avatar"), (req, res) => {
  if (!req.file) {
    console.error("No file uploaded.");
    return res.redirect("/editprofile"); // Redirect back to edit page
  }

  const { filename } = req.file;
  const avatarPath = `/uploads/avatars/${filename}`;
  const query = "UPDATE users SET avatar = ? WHERE username = ?";

  db.query(query, [avatarPath, req.session.user], (err) => {
    if (err) {
      console.error("Error updating avatar:", err);
      return res.redirect("/profile");
    }
    res.redirect("/profile");
  });
});

// Update Profile Handler
router.post("/update", isAuthenticated, async (req, res) => {
  const { username, email, password } = req.body;
  const currentUsername = req.session.user;

  let query = "UPDATE users SET username = ?, email = ? WHERE username = ?";
  let params = [username, email, currentUsername];

  if (password) {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      query =
        "UPDATE users SET username = ?, email = ?, password = ? WHERE username = ?";
      params = [username, email, hashedPassword, currentUsername];
    } catch (err) {
      console.error("Error hashing password:", err);
      return res.redirect("/profile");
    }
  }

  db.query(query, params, (err) => {
    if (err) {
      console.error("Error updating user details:", err);
      return res.redirect("/editprofile");
    }
    req.session.user = username; // Update session username
    res.redirect("/profile");
  });
});

// Remove Avatar Handler
router.post("/remove-avatar", isAuthenticated, (req, res) => {
  const defaultAvatarPath = "/uploads/avatars/default.png"; // Default avatar path

  // Query to get the current avatar of the user
  const query = "SELECT avatar FROM users WHERE username = ?";
  db.query(query, [req.session.user], (err, results) => {
    if (err) {
      console.error("Error fetching user avatar:", err);
      return res.redirect("/profile");
    }

    const currentAvatar = results[0]?.avatar;

    // If the current avatar is not the default one, delete it from the filesystem
    if (currentAvatar && currentAvatar !== defaultAvatarPath) {
      fs.unlink(`public${currentAvatar}`, (err) => {
        if (err) console.error("Error deleting avatar:", err);
      });
    }

    // Update the avatar in the database to the default avatar
    const updateQuery = "UPDATE users SET avatar = ? WHERE username = ?";
    db.query(updateQuery, [defaultAvatarPath, req.session.user], (err) => {
      if (err) {
        console.error("Error updating avatar to default:", err);
        return res.redirect("/profile");
      }
      res.redirect("/profile");
    });
  });
});

module.exports = router;
