"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface Player {
  name: string;
  selectedNumber: number | null;
  isEliminated: boolean;
  placement: number | null;
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
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
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

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  useEffect(() => {
    const newSocket = io("https://streg-backend.onrender.com");
    socketRef.current = newSocket;

    newSocket.on("playerList", (players: Player[]) => {
      setGameState((prev) => ({ ...prev, players }));
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
      setError(message);
    });

    newSocket.on(
      "youWon",
      (data: { placement: number; totalPlayers: number }) => {
        setGameOver(true);
        setGameResult("won");
        setGameOverInfo({
          placements: [
            {
              name: playerName,
              number: selectedNumber || 0,
              placement: data.placement,
            },
          ],
        });
      }
    );

    newSocket.on(
      "youLost",
      (data: { placement: number; totalPlayers: number }) => {
        setGameOver(true);
        setGameResult("lost");
        setGameOverInfo({
          placements: [
            {
              name: playerName,
              number: selectedNumber || 0,
              placement: data.placement,
            },
          ],
        });
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

    return () => {
      newSocket.close();
    };
  }, []);

  const handleNumberSelect = (number: number) => {
    if (!selectedNumber) {
      setSelectedNumber(number);
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
    setGameOver(false);
    setGameResult(null);
    setGameOverInfo(null);
    setPlayerName("");
    setSelectedNumber(null);
    setGameState({
      players: [],
      numbers: Array.from({ length: 20 }, (_, i) => i + 1),
      currentTurn: null,
      currentPlayerName: null,
      gameStarted: false,
      boardSize: 20
    });
    window.location.reload();
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
              onChange={(e) => setPlayerName(e.target.value)}
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
            <button
              className="bg-blue-700 text-white font-bold py-2 px-4 rounded border-2 border-gray-800 hover:bg-blue-900 w-full"
              disabled={playerName.trim().length < 2}
              onClick={() => {
                if (playerName.trim().length >= 2) {
                  socketRef.current?.emit("createLobby", { boardSize });
                  setLobbyStep("creating");
                }
              }}
            >
              Create Lobby
            </button>
            <button
              className="mt-2 text-blue-700 underline"
              onClick={() => setLobbyStep("menu")}
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
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="w-full p-2 border-2 border-gray-800 rounded text-black font-bold bg-white mb-2"
            />
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              placeholder="Enter lobby code"
              className="w-full p-2 border-2 border-gray-800 rounded text-black font-bold bg-white mb-4 uppercase"
              maxLength={5}
            />
            <button
              className="bg-green-700 text-white font-bold py-2 px-4 rounded border-2 border-gray-800 hover:bg-green-900 w-full"
              disabled={
                playerName.trim().length < 2 ||
                joinCodeInput.trim().length !== 5
              }
              onClick={() => {
                if (
                  playerName.trim().length >= 2 &&
                  joinCodeInput.trim().length === 5
                ) {
                  socketRef.current?.emit("joinLobby", {
                    code: joinCodeInput.trim().toUpperCase(),
                    playerName,
                  });
                  setLobbyCode(joinCodeInput.trim().toUpperCase());
                  setShowStartScreen(false);
                }
              }}
            >
              Join Lobby
            </button>
            <button
              className="mt-2 text-blue-700 underline"
              onClick={() => setLobbyStep("menu")}
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
                      {getPlacementText(p.placement)}: {p.name} (number:{" "}
                      {p.number})
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
                      {getPlacementText(p.placement)}: {p.name} (number:{" "}
                      {p.number})
                    </p>
                  ))}
                </div>
              </div>
            )
          )}
          <button
            onClick={handlePlayAgain}
            className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-900 font-bold border-2 border-gray-800"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  if (!gameState.gameStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-gray-800">
          {lobbyCode && (
            <div className="mb-4 text-center">
              <span className="text-black font-bold">
                Lobby Code:{" "}
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
                {player.selectedNumber !== null && (
                  <span className="ml-2 text-green-600">✔️</span>
                )}
              </li>
            ))}
          </ul>
          {/* Only party leader sees Start Game button, and only if all players have selected a number */}
          {gameState.players.length > 1 &&
            gameState.players[0]?.name === playerName && (
              <button
                className={`bg-blue-700 text-white font-bold py-2 px-4 rounded border-2 border-gray-800 w-full mb-4 ${
                  gameState.players.every((p) => p.selectedNumber !== null)
                    ? "hover:bg-blue-900"
                    : "opacity-50 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (
                    gameState.players.every((p) => p.selectedNumber !== null)
                  ) {
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
          {/* Number selection always available until game starts */}
          {selectedNumber === null ? (
            <>
              <h2 className="text-2xl font-bold mb-4 text-black">
                Select Your Number
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
            <div className="text-center mt-4">
              <h2 className="text-xl font-bold text-black">
                Waiting for other players to select their number...
              </h2>
              <p className="text-black font-bold">
                Your number: {selectedNumber}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto">
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
                    <span className="bg-red-200 text-red-900 text-sm font-bold px-3 py-1 rounded-full border border-red-700">
                      OUT - {getPlacementText(player.placement || 0)} Place
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

        {error && (
          <div className="mt-4 p-4 bg-red-200 text-red-900 rounded border-2 border-red-700 font-bold">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
