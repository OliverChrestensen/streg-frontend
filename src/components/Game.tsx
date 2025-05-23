"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface Player {
  name: string;
  selectedNumber: number | null;
  isEliminated: boolean;
  placement: number | null;
  id: string;
}

interface GameState {
  players: Player[];
  numbers: number[];
  currentTurn: string | null;
  currentPlayerName: string | null;
  gameStarted: boolean;
  boardSize: number;
}

interface GameOverInfo {
  placements: {
    name: string;
    number: number;
    placement: number;
  }[];
}

interface PlayerElimination {
  playerName: string;
  number: number;
  placement: number;
  totalPlayers: number;
}

export default function Game() {
  const [playerName, setPlayerName] = useState("");
  const [boardSize, setBoardSize] = useState(20);
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    numbers: Array.from({ length: 20 }, (_, i) => i + 1),
    currentTurn: null,
    currentPlayerName: null,
    gameStarted: false,
    boardSize: 20
  });
  const [error, setError] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameResult, setGameResult] = useState<"won" | "lost" | null>(null);
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null);
  const [eliminationInfo, setEliminationInfo] =
    useState<PlayerElimination | null>(null);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [lobbyCode, setLobbyCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [lobbyStep, setLobbyStep] = useState<
    "menu" | "create" | "join" | "joining" | "creating"
  >("menu");
  const socketRef = useRef<Socket | null>(null);
  const playerNameRef = useRef(playerName);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const errorTimeout = useRef<NodeJS.Timeout | null>(null);
  const justPickedNumber = useRef(false);

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://streg-backend.onrender.com';
    const newSocket = io(backendUrl);
    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      setMySocketId(newSocket.id ?? null);
    });

    newSocket.on("playerList", (players: Player[]) => {
      console.log("Received player list:", players);
      setGameState((prev) => {
        const newState = { ...prev, players };
        // No need to sync local selectedNumber anymore
        console.log("Updated game state with players:", newState);
        return newState;
      });
    });

    newSocket.on(
      "gameStarted",
      (data: {
        currentTurn: string;
        currentPlayerName: string;
        numbers: number[];
      }) => {
        console.log("Received numbers from server:", data.numbers);
        setGameState((prev) => ({
          ...prev,
          gameStarted: true,
          currentTurn: data.currentTurn,
          currentPlayerName: data.currentPlayerName,
          numbers: data.numbers,
        }));
      }
    );

    newSocket.on(
      "numberEliminated",
      (data: {
        number: number;
        remainingNumbers: number[];
        currentTurn: string;
        currentPlayerName: string;
      }) => {
        console.log(
          "Received updated numbers after elimination:",
          data.remainingNumbers
        );
        setGameState((prev) => ({
          ...prev,
          numbers: data.remainingNumbers,
          currentTurn: data.currentTurn,
          currentPlayerName: data.currentPlayerName,
        }));
      }
    );

    newSocket.on("error", (message: string) => {
      console.log("Received error from backend:", message);
      if (justPickedNumber.current) return; // Ignore error if just picked a number
      setError(message);
      if (errorTimeout.current) clearTimeout(errorTimeout.current);
      errorTimeout.current = setTimeout(() => setError(null), 3000);
    });

    newSocket.on(
      "youWon",
      (data: { placement: number; totalPlayers: number; number: number }) => {
        // Only show a banner, do not set gameOver
        setEliminationInfo({
          playerName: playerName,
          number: data.number,
          placement: data.placement,
          totalPlayers: data.totalPlayers,
        });
        setTimeout(() => setEliminationInfo(null), 3000);
      }
    );

    newSocket.on(
      "youLost",
      (data: { placement: number; totalPlayers: number; number: number }) => {
        // Only show a banner, do not set gameOver
        setEliminationInfo({
          playerName: playerName,
          number: data.number,
          placement: data.placement,
          totalPlayers: data.totalPlayers,
        });
        setTimeout(() => setEliminationInfo(null), 3000);
      }
    );

    newSocket.on("playerEliminated", (info: PlayerElimination) => {
      setEliminationInfo(info);
      setTimeout(() => setEliminationInfo(null), 3000);
    });

    newSocket.on("gameOver", (info: GameOverInfo) => {
      setGameOver(true);
      setGameOverInfo(info);
    });

    newSocket.on("lobbyCreated", (code: string) => {
      setLobbyCode(code);
      setLobbyStep("creating");
      // Immediately join the lobby with the player name (latest value)
      if (playerNameRef.current.trim().length >= 2 && socketRef.current) {
        socketRef.current.emit("joinLobby", {
          code,
          playerName: playerNameRef.current,
        });
        setShowStartScreen(false);
      }
    });

    newSocket.on("lobbyJoined", (data) => {
      setGameState((prev) => ({
        ...prev,
        status: "waiting",
        boardSize: data.boardSize,
        numbers: Array.from({ length: data.boardSize }, (_, i) => i + 1),
      }));
      setShowStartScreen(false);
      // Reset local selectedNumber if needed
      // No need to sync local selectedNumber anymore
    });

    newSocket.on("resetNumbers", () => {
      // No need to sync local selectedNumber anymore
      setError("All players have chosen the same number. Pick a new number.");
    });

    newSocket.on("lobbyReset", (data) => {
      setGameOver(false);
      setGameResult(null);
      setGameOverInfo(null);
      // No need to sync local selectedNumber anymore
      setGameState((prev) => ({
        ...prev,
        players: data.players,
        numbers: data.numbers,
        currentTurn: null,
        currentPlayerName: null,
        gameStarted: false,
        boardSize: data.boardSize,
      }));
      setShowStartScreen(false);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleNumberSelect = (number: number) => {
    if (gameOver) return; // Prevent selection after game over
    setError(null); // Clear any error when picking a new number
    justPickedNumber.current = true;
    setTimeout(() => { justPickedNumber.current = false; }, 500);
    const me = gameState.players.find(p => p.id === mySocketId);
    if (me && me.selectedNumber === null) {
      socketRef.current?.emit("selectNumber", number);
    }
  };

  const handleNumberElimination = (number: number) => {
    if (
      gameState.gameStarted &&
      socketRef.current?.id === gameState.currentTurn
    ) {
      socketRef.current.emit("eliminateNumber", number);
    }
  };

  const handlePlayAgain = () => {
    socketRef.current?.emit("playerReadyForReplay");
  };

  const handleMainMenu = () => {
    // Ask backend to remove this player from the lobby
    socketRef.current?.emit("leaveLobby");
    setGameOver(false);
    setGameResult(null);
    setGameOverInfo(null);
    setPlayerName("");
    // No need to sync local selectedNumber anymore
    setGameState({
      players: [],
      numbers: Array.from({ length: 20 }, (_, i) => i + 1),
      currentTurn: null,
      currentPlayerName: null,
      gameStarted: false,
      boardSize: 20
    });
    setShowStartScreen(true);
    setLobbyCode(null);
    setJoinCodeInput("");
    setLobbyStep("menu");
  };

  const getPlacementText = (placement: number) => {
    if (placement === 1) return "1st";
    if (placement === 2) return "2nd";
    if (placement === 3) return "3rd";
    return `${placement}th`;
  };

  if (showStartScreen) {
    // Step 1: Main menu
    if (lobbyStep === "menu") {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-gray-800 flex flex-col items-center relative">
            <button
              className="absolute top-2 right-2 text-gray-700 hover:text-black text-2xl"
              onClick={() => setShowInfo(true)}
              aria-label="Game Info"
            >
              ℹ️
            </button>
            <h1 className="text-3xl font-bold mb-8 text-black">
              Welcome to the Game!
            </h1>
            <div className="flex flex-col gap-4 w-64">
              <button
                className="bg-blue-700 text-white font-bold py-3 rounded border-2 border-gray-800 hover:bg-blue-900"
                onClick={() => setLobbyStep("create")}
              >
                Create Game
              </button>
              <button
                className="bg-green-700 text-white font-bold py-3 rounded border-2 border-gray-800 hover:bg-green-900"
                onClick={() => setLobbyStep("join")}
              >
                Join Game
              </button>
            </div>
            {showInfo && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
                <div className="bg-white p-6 rounded-lg border-2 border-gray-800 max-w-md text-black">
                  <h2 className="text-xl font-bold mb-2">How to Play</h2>
                  <p>
                    This is a number elimination game. Players take turns
                    eliminating numbers from the board. The last player
                    remaining loses!
                  </p>
                  <button
                    className="mt-4 bg-blue-700 text-white px-4 py-2 rounded border-2 border-gray-800 font-bold hover:bg-blue-900"
                    onClick={() => setShowInfo(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    // Step 2: Create lobby - enter name
    if (lobbyStep === "create") {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-gray-800 flex flex-col items-center">
            <h2 className="text-2xl font-bold mb-6 text-black">Create Game</h2>
            <input
              type="text"
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                // Clear error when user starts typing
                if (error) setError(null);
              }}
              placeholder="Enter your name"
              className="w-full p-2 border-2 border-gray-800 rounded text-black font-bold bg-white mb-4"
            />
            <div className="mb-4">
              <label className="block text-black font-bold mb-2">Board Size</label>
              <select
                value={boardSize}
                onChange={(e) => setBoardSize(Number(e.target.value))}
                className="w-full p-2 border-2 border-gray-800 rounded text-black font-bold bg-white"
              >
                <option value={10}>10 numbers</option>
                <option value={20}>20 numbers</option>
                <option value={30}>30 numbers</option>
                <option value={40}>40 numbers</option>
                <option value={50}>50 numbers</option>
                <option value={60}>60 numbers</option>
                <option value={70}>70 numbers</option>
                <option value={80}>80 numbers</option>
                <option value={90}>90 numbers</option>
                <option value={100}>100 numbers</option>
              </select>
            </div>
            {error && (
              <div className="w-full mb-4 p-2 bg-red-100 text-red-700 border-2 border-red-700 rounded font-bold">
                {error}
              </div>
            )}
            <button
              className="bg-blue-700 text-white font-bold py-2 px-4 rounded border-2 border-gray-800 hover:bg-blue-900 w-full"
              onClick={() => {
                if (playerName.trim().length < 2) {
                  setError("Name must be at least 2 characters long");
                  return;
                }
                socketRef.current?.emit("createLobby", { boardSize });
                setLobbyStep("creating");
              }}
            >
              Create Lobby
            </button>
            <button
              className="mt-2 text-blue-700 underline"
              onClick={() => {
                setError(null);
                setLobbyStep("menu");
              }}
            >
              Back
            </button>
          </div>
        </div>
      );
    }
    // Step 2: Join lobby - enter name and code
    if (lobbyStep === "join") {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-gray-800 flex flex-col items-center">
            <h2 className="text-2xl font-bold mb-6 text-black">Join Game</h2>
            <input
              type="text"
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                // Clear error when user starts typing
                if (error) setError(null);
              }}
              placeholder="Enter your name"
              className="w-full p-2 border-2 border-gray-800 rounded text-black font-bold bg-white mb-2"
            />
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setJoinCodeInput(value);
                // Clear error when user starts typing
                if (error) setError(null);
              }}
              placeholder="Enter lobby code"
              className="w-full p-2 border-2 border-gray-800 rounded text-black font-bold bg-white mb-4 uppercase"
              maxLength={5}
            />
            {error && (
              <div className="w-full mb-4 p-2 bg-red-100 text-red-700 border-2 border-red-700 rounded font-bold">
                {error}
              </div>
            )}
            <button
              className="bg-green-700 text-white font-bold py-2 px-4 rounded border-2 border-gray-800 hover:bg-green-900 w-full"
              onClick={() => {
                if (playerName.trim().length < 2) {
                  setError("Name must be at least 2 characters long");
                  return;
                }
                if (joinCodeInput.trim().length !== 5) {
                  setError("Lobby code must be 5 characters");
                  return;
                }
                // Validate that the code only contains letters and numbers
                if (!/^[A-Z0-9]{5}$/.test(joinCodeInput.trim())) {
                  setError("Lobby code must contain only letters and numbers");
                  return;
                }
                setError(null);
                setLobbyCode(joinCodeInput.trim());
                socketRef.current?.emit("joinLobby", {
                  code: joinCodeInput.trim(),
                  playerName,
                });
              }}
            >
              Join Lobby
            </button>
            <button
              className="mt-2 text-blue-700 underline"
              onClick={() => {
                setError(null);
                setLobbyStep("menu");
              }}
            >
              Back
            </button>
          </div>
        </div>
      );
    }
    // Step 3: Creating lobby, waiting for code
    if (lobbyStep === "creating") {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-gray-800 flex flex-col items-center">
            <h2 className="text-2xl font-bold mb-6 text-black">
              Creating Lobby...
            </h2>
          </div>
        </div>
      );
    }
  }

  if (gameOver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center border-2 border-gray-800">
          {gameResult ? (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-black">
                {gameResult === "won"
                  ? `Congratulations! You got ${getPlacementText(
                      gameOverInfo?.placements.find(
                        (p) => p.name === playerName
                      )?.placement || 0
                    )} place!`
                  : `Game Over! You got last place!`}
              </h2>
              {gameOverInfo && (
                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-2 text-black">
                    Final Placements:
                  </h3>
                  {gameOverInfo.placements.map((p, index) => (
                    <p key={index} className="mb-1 text-black font-bold">
                      {getPlacementText(p.placement)}: {p.name} (number: {p.number})
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            gameOverInfo && (
              <div>
                <h2 className="text-2xl font-bold mb-2 text-black">
                  Game Over!
                </h2>
                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-2 text-black">
                    Final Placements:
                  </h3>
                  {gameOverInfo.placements.map((p, index) => (
                    <p key={index} className="mb-1 text-black font-bold">
                      {getPlacementText(p.placement)}: {p.name} (number: {p.number})
                    </p>
                  ))}
                </div>
              </div>
            )
          )}
          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={handlePlayAgain}
              className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-900 font-bold border-2 border-gray-800"
            >
              Play Again
            </button>
            <button
              onClick={handleMainMenu}
              className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400 font-bold border-2 border-gray-800"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState.gameStarted) {
    const me = gameState.players.find(p => p.id === mySocketId);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-gray-800">
          {error && (
            <div className="mb-4 p-2 bg-red-100 text-red-700 border-2 border-red-700 rounded font-bold text-center">
              {error}
            </div>
          )}
          {lobbyCode && (
            <div className="mb-4 text-center">
              <span className="text-black font-bold">
                Lobby Code: {" "}
                <span className="text-2xl tracking-widest">{lobbyCode}</span>
              </span>
            </div>
          )}
          <h2 className="text-2xl font-bold mb-4 text-black">
            Players in Lobby
          </h2>
          <ul className="mb-4">
            {gameState.players.map((player, idx) => (
              <li
                key={idx}
                className="text-black font-bold flex items-center gap-2"
              >
                {player.name}
                {idx === 0 && (
                  <span className="ml-2 text-blue-700">(Party Leader)</span>
                )}
                {player.name === playerName && (
                  <span className="ml-2 text-green-700">(You)</span>
                )}
                {player.selectedNumber !== null && !error && (
                  <span className="ml-2 text-green-600">✔️</span>
                )}
              </li>
            ))}
          </ul>
          {/* Start Game button for party leader */}
          {gameState.players.length > 1 &&
            gameState.players[0]?.id === mySocketId && (
              <button
                className={`bg-blue-700 text-white font-bold py-2 px-4 rounded border-2 border-gray-800 w-full mb-4 ${
                  gameState.players.every((p) => p.selectedNumber !== null)
                    ? "hover:bg-blue-900"
                    : "opacity-50 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (gameState.players.every((p) => p.selectedNumber !== null)) {
                    socketRef.current?.emit("startGame");
                  }
                }}
                disabled={
                  !gameState.players.every((p) => p.selectedNumber !== null)
                }
              >
                Start Game
              </button>
            )}
          {/* Number selection always available until game starts, or after duplicate error, or if selectedNumber is null */}
          {me && me.selectedNumber === null ? (
            <>
              <h2 className="text-2xl font-bold mb-4 text-black">
                {error?.includes("same number") ? "Choose a Different Number" : "Select Your Number"}
              </h2>
              <div className={`grid gap-2 ${
                gameState.boardSize <= 20 ? 'grid-cols-5' :
                gameState.boardSize <= 40 ? 'grid-cols-8' :
                gameState.boardSize <= 60 ? 'grid-cols-10' :
                gameState.boardSize <= 80 ? 'grid-cols-10' :
                'grid-cols-10'
              }`}>
                {gameState.numbers.map((number) => (
                  <button
                    key={number}
                    onClick={() => handleNumberSelect(number)}
                    className="p-2 border-2 border-gray-800 rounded hover:bg-gray-200 text-black font-bold text-sm bg-white"
                  >
                    {number}
                  </button>
                ))}
              </div>
            </>
          ) : (
            // Show waiting message only if player has picked a number, there is no error, and not all players have picked
            (!error && !gameState.players.every((p) => p.selectedNumber !== null)) ? (
              <div className="text-center mt-4">
                <h2 className="text-xl font-bold text-black">
                  Waiting for other players to select their number...
                </h2>
                <p className="text-black font-bold">
                  Your number: {me?.selectedNumber ?? ''}
                </p>
              </div>
            ) : null
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 border-2 border-red-700 rounded font-bold text-center">
            {error}
          </div>
        )}
        {eliminationInfo && (
          <div className="bg-green-100 p-4 rounded-lg shadow-lg text-center mb-6 border-2 border-green-700">
            <p className="text-green-900 font-bold text-lg">
              {eliminationInfo.playerName} got{" "}
              {getPlacementText(eliminationInfo.placement)} place! Their number
              was {eliminationInfo.number}.
            </p>
          </div>
        )}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-gray-800">
          {gameState.gameStarted && (
            <div className="text-center mb-4">
              <p className="text-lg font-bold text-black">
                Current Turn:{" "}
                <span className="text-blue-700 font-bold">
                  {gameState.currentPlayerName}
                </span>
              </p>
            </div>
          )}
          <h2 className="text-2xl font-bold mb-4 text-black">Game Board</h2>
          <div className={`grid gap-2 ${
            gameState.boardSize <= 20 ? 'grid-cols-5' :
            gameState.boardSize <= 40 ? 'grid-cols-8' :
            gameState.boardSize <= 60 ? 'grid-cols-10' :
            gameState.boardSize <= 80 ? 'grid-cols-10' :
            'grid-cols-10'
          }`}>
            {gameState.numbers.map((number) => (
              <button
                key={number}
                onClick={() => handleNumberElimination(number)}
                disabled={socketRef.current?.id !== gameState.currentTurn}
                className={`p-2 border-2 border-gray-800 rounded text-center bg-white text-black font-bold text-sm shadow-sm transition-colors duration-150
                  ${
                    socketRef.current?.id === gameState.currentTurn
                      ? "hover:bg-red-200 cursor-pointer"
                      : "opacity-50 cursor-not-allowed"
                  }
                `}
              >
                {number}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-800">
          <h2 className="text-2xl font-bold mb-4 text-black">Players</h2>
          <div className="space-y-2">
            {gameState.players.map((player, index) => (
              <div
                key={index}
                className={`p-4 rounded flex justify-between items-center border-2 transition-colors duration-150
                  ${
                    player.isEliminated
                      ? "bg-gray-100 border-gray-400"
                      : socketRef.current?.id === gameState.currentTurn &&
                        player.name === playerName
                      ? "bg-blue-100 border-blue-700"
                      : player.name ===
                        gameState.players.find(
                          (p, i) =>
                            gameState.players[i].name === p.name &&
                            socketRef.current?.id === gameState.currentTurn
                        )?.name
                      ? "bg-blue-100 border-blue-700"
                      : "bg-white border-gray-800"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-black text-lg">
                    {player.name}
                  </span>
                  {player.isEliminated && (
                    <span className="bg-green-200 text-green-900 text-sm font-bold px-3 py-1 rounded-full border border-green-700">
                      Won - {getPlacementText(player.placement || 0)} Place
                      {player.selectedNumber !== null &&
                        ` (${player.selectedNumber})`}
                    </span>
                  )}
                  {!player.isEliminated && (
                    <>
                      {socketRef.current?.id === gameState.currentTurn &&
                        player.name === playerName && (
                          <span className="bg-blue-200 text-blue-900 text-sm font-bold px-3 py-1 rounded-full border border-blue-700">
                            Current Turn
                          </span>
                        )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
