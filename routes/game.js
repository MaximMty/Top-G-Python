const express = require("express");
const router = express.Router();
const db = require("./db");

let players = [];
let currentPlayerIndex = 0; // Initialize the starting player index

// Route to add a player
router.post("/add-player", (req, res) => {
  const { name } = req.body;
  if (name) {
    // Ensure the player object has a score property
    players.push({ name, score: 0 }); // Add player with initial score
  }
  req.session.players = players; // Update session with players
  res.redirect("/game"); // Redirect back to the game setup page
});

// Route to start the game
router.post("/start-game", (req, res) => {
  if (!req.session.players || req.session.players.length === 0) {
    return res.redirect("/game"); // Prevent starting if no players are added
  }
  req.session.currentPlayerIndex = 0; // Reset player index in session
  res.redirect("/game/play"); // Start the game
});

// Route to render the game play page
router.get("/play", (req, res) => {
  const players = req.session.players || []; // Ensure players are defined
  const currentPlayerIndex = req.session.currentPlayerIndex; // Get the current player index

  if (players.length === 0) {
    return res.redirect("/game"); // Handle case if players are not defined
  }

  const currentPlayer = players[currentPlayerIndex]; // Get the current player

  if (!currentPlayer) {
    return res.redirect("/game"); // Handle case if the current player is invalid
  }

  res.render("play", { player: currentPlayer, players });
});

// Function to get a random question based on difficulty
const getQuestion = (difficulty) => {
  return new Promise((resolve, reject) => {
    let query;
    if (difficulty === "hard") {
      query = "SELECT * FROM high_risk_questions ORDER BY RAND() LIMIT 1"; // Fetch a random hard question
    } else if (difficulty === "easy") {
      query = "SELECT * FROM low_risk_questions ORDER BY RAND() LIMIT 1"; // Fetch a random easy question
    } else {
      return reject(new Error("Invalid difficulty level")); // Handle invalid difficulty
    }

    db.query(query, (error, results) => {
      if (error) {
        return reject(error); // Handle query error
      }
      if (results.length === 0) {
        return reject(new Error("No questions found")); // Handle case where no questions are found
      }
      resolve(results[0]); // Return the question
    });
  });
};

router.post("/roll-dice", (req, res) => {
  const currentPlayerIndex = req.session.currentPlayerIndex; // Retrieve the current player index
  const players = req.session.players; // Access players from the session

  if (currentPlayerIndex === undefined || !players || players.length === 0) {
    return res
      .status(400)
      .send("No players found or current player index is invalid.");
  }

  const currentPlayer = players[currentPlayerIndex]; // Get the current player

  if (!currentPlayer) {
    return res.status(400).send("Current player not found."); // Ensure current player is valid
  }

  const diceRoll = Math.floor(Math.random() * 6) + 1; // Roll a dice (1-6)
  currentPlayer.score += diceRoll; // Update player's score

  // Update session
  req.session.players[currentPlayerIndex] = currentPlayer;

  // Store rolled value in the session
  req.session.roll = diceRoll;

  // Proceed to question selection view
  res.render("question-selection", {
    currentPlayer,
    roll: diceRoll,
  });
});

// Route to select a question based on difficulty
router.post("/select-question", (req, res) => {
  const { difficulty } = req.body; // Get difficulty from the form
  const currentPlayerIndex = req.session.currentPlayerIndex; // Get the current player index from the session
  const currentPlayer = req.session.players[currentPlayerIndex]; // Get the current player

  getQuestion(difficulty)
    .then((question) => {
      // Store the question in the session
      req.session.currentQuestion = question;
      res.render("answer-question", {
        question,
        currentPlayer, // Ensure the currentPlayer is passed correctly
      });
    })
    .catch((error) => {
      console.error(error);
      res.redirect("/game/play"); // Redirect on error
    });
});

// Route to submit the answer
router.post("/submit-answer", (req, res) => {
  const { answer } = req.body;
  const currentPlayerIndex = req.session.currentPlayerIndex;
  const currentPlayer = req.session.players[currentPlayerIndex];
  const currentQuestion = req.session.currentQuestion; // Retrieve the current question from the session

  if (!currentQuestion) {
    return res.redirect("/game/play"); // Redirect if no current question is found
  }

  const correctAnswer = currentQuestion.correct_answer; // Ensure currentQuestion is defined

  if (answer === correctAnswer) {
    currentPlayer.score += 10; // Add points for correct answer
    req.session.players[currentPlayerIndex] = currentPlayer; // Update session
  }

  // Proceed to the next player's turn
  currentPlayerIndex = (currentPlayerIndex + 1) % req.session.players.length; // Move to the next player
  req.session.currentPlayerIndex = currentPlayerIndex; // Update session

  res.redirect("/game/play"); // Redirect to play again
});

// Render the game page
router.get("/", (req, res) => {
  const players = req.session.players || []; // Access players from session
  if (req.session.user) {
    res.render("game", { user: req.session.user, players });
  } else {
    res.render("login", { message: "Please log in to access the game" });
  }
});

module.exports = router;
