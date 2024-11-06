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
    }
  } else {
    console.error("Session code not found.");
  }
});
