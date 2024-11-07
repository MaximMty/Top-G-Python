import { updatePlayerTurn, showDiceRollResult } from "./diceLogic.js";

export function setupSocketListeners(socket) {
  socket.on("updatePlayerList", (data) => {
    console.log("Updated player list:", data.players);
    const playerListElement = document.getElementById("playerList");
    if (playerListElement) {
      // Clear the current player list to prevent duplication
      playerListElement.innerHTML = "";

      // Add players from the updated list
      data.players.forEach((player) => {
        const newPlayer = document.createElement("li");
        newPlayer.textContent = player.name ? player.name : "Unknown Player";
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
    if (
      data.currentPlayer &&
      typeof data.currentPlayer === "object" &&
      data.currentPlayer.name
    ) {
      console.log(
        `Player ${data.currentPlayer.name} rolled a ${data.diceValue}`
      );
      showDiceRollResult(data.currentPlayer.name, data.diceValue);
    } else {
      console.error("Invalid player data received in diceRolled event:", data);
    }
  });

  // Handle turn ended event
  socket.on("turnEnded", (data) => {
    if (
      data.currentPlayer &&
      typeof data.currentPlayer === "object" &&
      data.currentPlayer.name
    ) {
      console.log(`It's now ${data.currentPlayer.name}'s turn`);
      updatePlayerTurn(data.currentPlayer);

      // Display the number of moves for the current player if necessary
      if (data.moveSteps > 0) {
        const playerPositionsElement =
          document.getElementById("playerPositions");
        if (playerPositionsElement) {
          playerPositionsElement.textContent = `You can move ${data.moveSteps} steps!`;
        }
      }
    } else {
      console.error("Invalid player data received in turnEnded event:", data);
    }
  });

  // Handle question answered event
  socket.on("questionAnswered", (data) => {
    if (
      data.currentPlayer &&
      typeof data.currentPlayer === "object" &&
      data.currentPlayer.name
    ) {
      console.log(`Player ${data.currentPlayer.name} answered the question.`);
      updatePlayerTurn(data.currentPlayer);
    } else {
      console.error(
        "Invalid player data received in questionAnswered event:",
        data
      );
    }
  });
}
