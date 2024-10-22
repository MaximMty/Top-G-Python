const express = require("express");
const router = express.Router();
const db = require("./db");

let players = [];
let currentPlayerIndex = 0;

// Route to add a player
router.post("/add-player", (req, res) => {
  const { name } = req.body;
  if (name) {
    players.push({ name, score: 0 }); // Add player with initial score
  }
  req.session.players = players;
  res.redirect("/game");
});

// Route to start the game
router.post("/start-game", (req, res) => {
  if (!req.session.players || req.session.players.length === 0) {
    return res.redirect("/game");
  }
  req.session.currentPlayerIndex = 0;
  res.redirect("/game/play");
});

// Route to render the game play page
router.get("/play", (req, res) => {
  const players = req.session.players || [];
  const currentPlayerIndex = req.session.currentPlayerIndex;

  if (players.length === 0) {
    return res.redirect("/game");
  }

  const currentPlayer = players[currentPlayerIndex];
  if (!currentPlayer) {
    return res.redirect("/game");
  }

  // Pass session explicitly to avoid undefined errors in the template
  res.render("play", { player: currentPlayer, players, session: req.session });
});

// Function to get a random question based on difficulty
const getQuestion = (difficulty) => {
  return new Promise((resolve, reject) => {
    let query;
    let points;
    if (difficulty === "hard") {
      query = "SELECT * FROM high_risk_questions ORDER BY RAND() LIMIT 1";
      points = 20;
    } else if (difficulty === "easy") {
      query = "SELECT * FROM low_risk_questions ORDER BY RAND() LIMIT 1";
      points = 10;
    } else {
      return reject(new Error("Invalid difficulty level"));
    }

    db.query(query, (error, results) => {
      if (error) {
        return reject(error);
      }
      if (results.length === 0) {
        return reject(new Error("No questions found"));
      }
      resolve({ question: results[0], points }); // Return both the question and points
    });
  });
};

// Route to roll the dice (no points awarded on roll)
router.post("/roll-dice", (req, res) => {
  const currentPlayerIndex = req.session.currentPlayerIndex;
  const players = req.session.players;

  if (currentPlayerIndex === undefined || !players || players.length === 0) {
    return res
      .status(400)
      .send("No players found or current player index is invalid.");
  }

  const diceRoll = req.body.diceRoll; // Use the rolled value sent from the client
  req.session.roll = diceRoll; // Store rolled value in session

  res.render("question-selection", {
    currentPlayer: players[currentPlayerIndex],
    roll: diceRoll,
  });
});

// Route to select a question based on difficulty
router.post("/select-question", (req, res) => {
  const { difficulty } = req.body;
  const currentPlayerIndex = req.session.currentPlayerIndex;
  const currentPlayer = req.session.players[currentPlayerIndex];

  getQuestion(difficulty)
    .then(({ question, points }) => {
      req.session.currentQuestion = question;
      req.session.points = points; // Store points for the current question
      res.render("answer-question", {
        question,
        currentPlayer,
      });
    })
    .catch((error) => {
      console.error(error);
      res.redirect("/game/play");
    });
});

// Route to submit the answer
router.post("/submit-answer", (req, res) => {
  const { answer } = req.body;
  let currentPlayerIndex = req.session.currentPlayerIndex;
  const currentPlayer = req.session.players[currentPlayerIndex];
  const currentQuestion = req.session.currentQuestion;
  const points = req.session.points; // Retrieve points from session

  if (!currentQuestion) {
    return res.redirect("/game/play");
  }

  const correctAnswer = currentQuestion.correct_answer;
  const tip = currentQuestion.tip; // Get the tip column from the question

  if (answer === correctAnswer) {
    currentPlayer.score += points; // Award points based on the question
  } else {
    req.session.tip = tip; // Store the tip for feedback on incorrect answer
  }

  req.session.players[currentPlayerIndex] = currentPlayer;

  // Move to the next player
  currentPlayerIndex = (currentPlayerIndex + 1) % req.session.players.length;
  req.session.currentPlayerIndex = currentPlayerIndex;

  res.redirect("/game/play");
});

// Render the game page
router.get("/", (req, res) => {
  const players = req.session.players || [];
  if (req.session.user) {
    res.render("game", { user: req.session.user, players });
  } else {
    res.render("login", { message: "Please log in to access the game" });
  }
});

module.exports = router;
