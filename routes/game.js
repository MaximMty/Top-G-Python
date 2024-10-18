const express = require("express");
const router = express.Router();
const db = require("./db");

let players = [];
let currentPlayerIndex = 0; // Initialize the starting player index

// Route to add a player
router.post("/add-player", (req, res) => {
  const { name } = req.body;
  if (name) {
    players.push({ name, score: 0 }); // Add player with initial score
  }
  res.redirect("/game"); // Redirect back to the game setup page
});

// Route to start the game
router.post("/start-game", (req, res) => {
  if (players.length === 0) {
    return res.redirect("/game"); // Prevent starting if no players are added
  }
  currentPlayerIndex = 0; // Reset player index
  res.redirect("/game/play"); // Start the game
});

// Route to render the game play page
router.get("/play", (req, res) => {
  if (!players || players.length === 0) {
    return res.redirect("/game"); // Handle case if players are not defined
  }
  const currentPlayer = players[currentPlayerIndex];
  res.render("play", { player: currentPlayer, players });
});

// Route to handle dice roll
router.post("/roll-dice", (req, res) => {
  const diceRoll = Math.floor(Math.random() * 6) + 1;

  // Update player's score based on the dice roll
  players[currentPlayerIndex].score += diceRoll;

  // Move to the next player's turn
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;

  res.redirect("/game/play"); // Refresh the game play screen
});

// Render the game page
router.get("/", (req, res) => {
  if (req.session.user) {
    res.render("game", { user: req.session.user, players: players });
  } else {
    res.render("login", { message: "Please log in to access the game" });
  }
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

// Example usage of getQuestion function
getQuestion("hard")
  .then((question) => {
    console.log(question); // Handle the retrieved question here
  })
  .catch((error) => {
    console.error(error); // Handle errors
  });

// Route to roll the dice
router.post("/roll-dice", (req, res) => {
  const currentPlayerIndex = req.session.currentPlayerIndex; // Ensure you track the current player
  const roll = Math.floor(Math.random() * 6) + 1; // Roll a dice (1-6)

  // Store the rolled value in the session
  req.session.roll = roll;

  res.render("question-selection", {
    currentPlayer: req.session.players[currentPlayerIndex],
    roll,
  });
});

/// In your game.js file or the appropriate route file
router.post("/select-question", (req, res) => {
  const { difficulty } = req.body; // Get difficulty from the form
  getQuestion(difficulty)
    .then((question) => {
      res.render("answer-question", {
        question,
        currentPlayer: req.session.players[req.session.currentPlayerIndex],
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

  // Assuming question is stored in session or retrieved again from the DB
  const correctAnswer = currentQuestion.correct_answer; // You'll need to ensure currentQuestion is defined

  if (answer === correctAnswer) {
    currentPlayer.score += 10; // Add points for correct answer
    req.session.players[currentPlayerIndex] = currentPlayer; // Update session
  }

  // Proceed to the next player's turn or any other logic
  res.redirect("/game/play");
});

module.exports = router;
