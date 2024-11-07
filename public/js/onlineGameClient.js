import { setupSocketListeners } from "./socketHandlers.js";
import { setupQuestionHandling } from "./questionHandlers.js";
import { setupDiceRolling, updatePlayerTurn } from "./diceLogic.js";

document.addEventListener("DOMContentLoaded", () => {
  const sessionCodeElement = document.getElementById("sessionCode");

  if (sessionCodeElement) {
    const sessionCode = sessionCodeElement.value;

    if (sessionCode && sessionCode !== "No active session") {
      const socket = io();
      setupSocketListeners(socket);

      // Emit an event to join the session once connected
      socket.on("connect", () => {
        console.log("Connected to server");
        socket.emit("joinSession", sessionCode);

        // Fetch the current game state when connected
        fetch(`/onlinegame/get-game-state/${sessionCode}`)
          .then((response) => {
            if (!response.ok) {
              throw new Error(
                "Failed to get game state. HTTP status " + response.status
              );
            }
            return response.json();
          })
          .then((data) => {
            if (data.success) {
              console.log("Retrieved game state:", data);

              if (data.gameStarted && data.gameStage === "in_progress") {
                // Hide the lobby and show the game board
                document.querySelector(".game-lobby").style.display = "none";
                document.getElementById("gameBoard").style.display = "block";

                // Ensure players are listed correctly and show the correct player's turn
                if (data.players && data.players.length > 0) {
                  updatePlayerTurn(data.players[data.currentPlayerIndex]);
                }
              } else {
                console.log("Game not started yet. Waiting in the lobby.");
              }
            } else {
              console.error("Failed to retrieve game state. Data missing.");
            }
          })
          .catch((error) => {
            console.error("Error retrieving game state:", error);
          });
      });

      // Set up dice rolling and question handling
      setupDiceRolling(socket);
      setupQuestionHandling(socket);

      // Set up the start game button listener (button is rendered by the server-side only for the host)
      const startGameButton = document.getElementById("startGameButton");
      if (startGameButton) {
        startGameButton.addEventListener("click", () => {
          console.log("Starting the game...");
          socket.emit("startGame", sessionCode);
        });
      }

      // Set up the finish turn button listener
      const finishTurnButton = document.getElementById("finishTurnBtn");
      if (finishTurnButton) {
        finishTurnButton.addEventListener("click", () => {
          fetch("/onlinegame/finish-turn", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "same-origin",
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.success) {
                alert("You have finished your turn and are now spectating.");

                // Add the user to the list of finished players in session storage
                let finishedPlayers =
                  JSON.parse(sessionStorage.getItem("finishedPlayers")) || [];
                finishedPlayers.push(window.currentUser);
                sessionStorage.setItem(
                  "finishedPlayers",
                  JSON.stringify(finishedPlayers)
                );

                // Hide the roll dice button
                const rollDiceButton = document.getElementById("roll-dice-btn");
                if (rollDiceButton) {
                  rollDiceButton.style.display = "none";
                }
              } else {
                console.error("Failed to finish turn:", data.message);
              }
            })
            .catch((err) => console.error("Error finishing turn:", err));
        });
      }
    }
  } else {
    console.error("Session code not found.");
  }
});

// Function to set up "Finish Turn" button listener
function setupFinishTurn() {
  const finishTurnButton = document.getElementById("finishTurnBtn");
  if (finishTurnButton) {
    finishTurnButton.addEventListener("click", () => {
      fetch("/onlinegame/finish-turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            alert("You have finished your turn and are now spectating.");
          } else {
            console.error("Failed to finish turn:", data.message);
          }
        })
        .catch((err) => console.error("Error finishing turn:", err));
    });
  } else {
    console.warn("Finish Turn button not found in DOM.");
  }
}
