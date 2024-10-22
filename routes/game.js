const express = require("express");
const router = express.Router();
const db = require("./db");

let players = [];
let currentPlayerIndex = 0;

// Store leaderboard points for different positions
const POSITION_POINTS = [100, 75, 50, 25]; // Points for 1st, 2nd, 3rd, etc.

// Track the players who finish in order
let finishedPlayers = [];

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
      query =
        "SELECT *, 'hard' AS difficulty FROM high_risk_questions ORDER BY RAND() LIMIT 1";
      points = 20;
    } else if (difficulty === "easy") {
      query =
        "SELECT *, 'easy' AS difficulty FROM low_risk_questions ORDER BY RAND() LIMIT 1";
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
  const diceRoll = req.session.roll; // Use the stored dice roll

  if (!currentQuestion) {
    return res.redirect("/game/play");
  }

  const correctAnswer = currentQuestion.correct_answer;
  const tip = currentQuestion.tip; // Get the tip column from the question

  let moves = 0; // Initialize moves to 0
  let message = "";

  // Handle correct answer
  if (answer === correctAnswer) {
    currentPlayer.score += points; // Award points

    if (currentQuestion.difficulty === "hard") {
      moves = diceRoll * 2; // Double movement for correct hard question
    } else {
      moves = diceRoll; // Regular movement for easy question
    }

    message = `Correct! You move forward ${moves} spaces.`;
  }
  // Handle incorrect answer
  else {
    req.session.tip = tip; // Store the tip for incorrect answer

    if (currentQuestion.difficulty === "hard") {
      moves = 0; // No movement for wrong hard question
      message = "Incorrect! No moves this time.";
    } else {
      moves = diceRoll; // Regular movement even for wrong easy question
      message = `Incorrect! But you still move forward ${moves} spaces.`;
    }
  }

  // Save the current player state
  req.session.players[currentPlayerIndex] = currentPlayer;

  // Move to the next player
  currentPlayerIndex = (currentPlayerIndex + 1) % req.session.players.length;
  req.session.currentPlayerIndex = currentPlayerIndex;

  // Store the result in session for the result page
  req.session.result = { message, moves, score: currentPlayer.score };

  res.redirect("/game/result"); // Redirect to the result page
});

// Route to show result after submitting an answer
router.get("/result", (req, res) => {
  const result = req.session.result || {};
  const players = req.session.players || [];
  const currentPlayerIndex =
    (req.session.currentPlayerIndex - 1 + players.length) % players.length;
  const currentPlayer = players[currentPlayerIndex];

  const tip = req.session.tip; // Retrieve the tip from session
  req.session.tip = null; // Clear tip after use
  req.session.result = null; // Clear result after use

  res.render("result", {
    result,
    currentPlayer,
    session: { tip }, // Safely pass tip to the view
  });
});

// Route for finishing the game for a player
router.post("/finish", (req, res) => {
  const currentPlayerIndex = req.session.currentPlayerIndex;
  const players = req.session.players;

  if (!players || players.length === 0) {
    return res.status(400).send("No players found.");
  }

  const currentPlayer = players[currentPlayerIndex];

  if (currentPlayer.finished) {
    return res.redirect("/game/play"); // Prevent double finish
  }

  // Assign points based on finishing order
  const position = finishedPlayers.length;
  const points = POSITION_POINTS[position] || 10; // Default to 10 points for later finishers

  currentPlayer.score += points;
  currentPlayer.finished = true; // Mark player as finished
  finishedPlayers.push(currentPlayer); // Add to finished players list

  // Remove player from active play
  req.session.players = players.filter((player) => !player.finished);

  // Check if all players are finished
  if (req.session.players.length === 0) {
    saveLeaderboard(finishedPlayers)
      .then(() => res.redirect("/game/leaderboard"))
      .catch((error) => {
        console.error(error);
        res.status(500).send("Error saving leaderboard.");
      });
  } else {
    // Move to the next active player
    req.session.currentPlayerIndex %= req.session.players.length;
    res.redirect("/game/play");
  }
});

// Function to save leaderboard data to the database
function saveLeaderboard(players) {
  const leaderboardEntries = players.map((player) => [
    player.name,
    player.score,
  ]);

  const query = "INSERT INTO leaderboard (name, score) VALUES ?";
  return new Promise((resolve, reject) => {
    db.query(query, [leaderboardEntries], (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });
}

// Route to render the leaderboard for players who just finished
router.get("/leaderboard", (req, res) => {
  // Check if there are finished players
  if (finishedPlayers.length === 0) {
    return res.redirect("/game"); // Redirect to game if no players have finished
  }

  // Sort finished players by score in descending order
  const sortedFinishedPlayers = finishedPlayers.sort(
    (a, b) => b.score - a.score
  );

  // Render the leaderboard with sorted finished player data
  res.render("leaderboard", { players: sortedFinishedPlayers });

  // Optionally clear finished players for the next game
  finishedPlayers = [];
  players = [];
  currentPlayerIndex = 0;
  currentQuestion = null;
  points = 0;
  roll = null;
  result = null;
  tip = null;
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
