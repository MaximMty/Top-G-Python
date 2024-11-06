import { updatePlayerTurn, showDiceRollResult } from "./diceLogic.js";

export function setupSocketListeners(socket) {
  socket.on("updatePlayerList", (data) => {
    console.log("Updated player list:", data.players);
    const playerListElement = document.getElementById("playerList");
    if (playerListElement) {
      playerListElement.innerHTML = "";
      data.players.forEach((player) => {
        const newPlayer = document.createElement("li");
        newPlayer.textContent = player.name ? player.name : "Unknown Player"; // Ensure player name is displayed
        playerListElement.appendChild(newPlayer);
      });
    }
  });

  // Handle game started event
  socket.on("gameStarted", (data) => {
    console.log("The game has started!");
    document.querySelector(".game-lobby").style.display = "none";
    document.getElementById("gameBoard").style.display = "block";
    updatePlayerTurn(data.currentPlayer);
  });

  // Handle dice rolled event from other players
  socket.on("diceRolled", (data) => {
    console.log(`Player ${data.playerId} rolled a ${data.diceValue}`);
    showDiceRollResult(data.playerId, data.diceValue);
  });

  // Handle turn ended event
  socket.on("turnEnded", (data) => {
    console.log(`It's now ${data.currentPlayer.name}'s turn`);
    updatePlayerTurn(data.currentPlayer);

    // Display the number of moves for the current player if necessary
    if (data.moveSteps > 0) {
      document.getElementById(
        "playerPositions"
      ).textContent = `You can move ${data.moveSteps} steps!`;
    }
  });

  // Handle question answered event
  socket.on("questionAnswered", (data) => {
    console.log(`Player ${data.playerId} answered the question.`);
    updatePlayerTurn(data.currentPlayer);
  });
}
