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
        console.log("Player Avatar URL:", player.avatar); // Debugging to check avatar value

        const newPlayer = document.createElement("li");
        newPlayer.classList.add("player-item");

        const avatarImg = document.createElement("img");
        // Only set avatar if a valid URL is present
        if (player.avatar && player.avatar.startsWith("http")) {
          avatarImg.src = `${player.avatar}?timestamp=${Date.now()}`;
        } else {
          avatarImg.src = "/uploads/avatars/default.png";
        }

        avatarImg.alt = `${player.name || "Unknown Player"}'s Avatar`;
        avatarImg.classList.add("avatar"); // Add a class for CSS styling

        const playerName = document.createElement("span");
        playerName.textContent = player.name ? player.name : "Unknown Player";

        newPlayer.appendChild(avatarImg);
        newPlayer.appendChild(playerName);
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
          playerPositionsElement.textContent = `Previous player can move ${data.moveSteps} steps!`;
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

  socket.on("gameEnded", (data) => {
    console.log("Game has ended! Here are the rankings:");

    if (!data || !Array.isArray(data.rankings)) {
      console.error("Invalid rankings data received:", data);
      return;
    }

    const rankingsListElement = document.getElementById("rankingList");
    if (rankingsListElement) {
      // Clear any existing ranking entries
      rankingsListElement.innerHTML = "";

      // Display rankings
      data.rankings.forEach((player, index) => {
        const playerElement = document.createElement("li");
        playerElement.textContent = `${index + 1}. ${player.name} - ${
          player.score
        } points`;
        rankingsListElement.appendChild(playerElement);
      });

      // Show the final rankings section
      document.getElementById("finalRanking").style.display = "block";
      document.getElementById("gameBoard").style.display = "none";
      document.getElementById("questionDifficulty").style.display = "none";
      document.getElementById("questionSection").style.display = "none";
    } else {
      console.error("Ranking list element not found in DOM.");
    }
  });
}
