const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcrypt"); // Password encryption
const profileRouter = require("./routes/profile");
const db = require("./routes/db");
const registerRoutes = require("./routes/register");
const gameRoutes = require("./routes/game");

const app = express();

app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "public/js")));

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: true,
  })
);

app.get("/", (req, res) => {
  res.render("index", { title: "Home", user: req.session.user });
});

app.get("/login", (req, res) => {
  res.render("login", {
    title: "Login",
    user: req.session.user || null,
    message: null,
  });
});

app.get("/register", (req, res) => {
  res.render("register", { title: "Register", message: null });
});

// Register a new user with password hashing
app.post("/register", async (req, res) => {
  const { username, password, confirm_password } = req.body;

  // Check if passwords match
  if (password !== confirm_password) {
    return res.render("register", { message: "Passwords do not match" });
  }

  try {
    // Check if username already exists
    const checkQuery = "SELECT * FROM users WHERE username = ?";
    db.query(checkQuery, [username], async (err, results) => {
      if (err) {
        console.error("Error executing query:", err);
        return res.render("register", { message: "An error occurred" });
      }

      // If username exists, send a message to the user
      if (results.length > 0) {
        return res.render("register", {
          message: "Username already taken. Please choose another.",
        });
      }

      // If username is unique, hash the password and insert into the database
      const hashedPassword = await bcrypt.hash(password, 10);
      const query = "INSERT INTO users (username, password) VALUES (?, ?)";
      db.query(query, [username, hashedPassword], (err, results) => {
        if (err) {
          console.error("Error executing query:", err);
          return res.render("register", { message: "An error occurred" });
        }
        res.redirect("/login");
      });
    });
  } catch (err) {
    console.error("Error hashing password:", err);
    res.render("register", { message: "An error occurred" });
  }
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const query = "SELECT * FROM users WHERE username = ?";
  db.query(query, [username], async (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      return res.render("login", { message: "An error occurred" });
    }

    if (results.length > 0) {
      const isValidPassword = await bcrypt.compare(
        password,
        results[0].password
      );

      if (isValidPassword) {
        req.session.user = username;
        return res.redirect("/game");
      } else {
        return res.render("login", { message: "Invalid username or password" });
      }
    } else {
      res.render("login", { message: "Invalid username or password" });
    }
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.redirect("/login");
    }
    res.redirect("/");
  });
});

app.use("/", profileRouter);
app.use("/", registerRoutes);
app.use("/game", gameRoutes);

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
