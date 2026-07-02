import { useEffect, useState } from "react";
import { GameCanvas } from "./ui/GameCanvas";
import { Joystick } from "./ui/Joystick";
import { ConnectionStatus } from "./ui/ConnectionStatus";
import { JoinPanel } from "./ui/JoinPanel";
import { ChatPanel } from "./ui/ChatPanel";
import { GiftPanel } from "./ui/GiftPanel";
import { HousePanel } from "./ui/HousePanel";
import { MemoryPanel } from "./ui/MemoryPanel";
import { ReconnectingOverlay } from "./ui/ReconnectingOverlay";
import { bindSocketToStore } from "./net/bindSocket";
import { fetchDevToken, socket } from "./net/socket";
import { useGameStore } from "./store/useGameStore";
import { useHouseStore } from "./store/useHouseStore";

export default function App() {
  const status = useGameStore((s) => s.status);
  const inHouse = useHouseStore((s) => s.inHouse);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    bindSocketToStore();
  }, []);

  const handleJoin = async (playerId: string, worldId: string) => {
    setJoinError(null);
    setJoining(true);
    try {
      const token = await fetchDevToken(playerId, worldId);
      useGameStore.getState().setIdentity(playerId, worldId);
      socket.connect(token);
    } catch (err) {
      setJoinError("Não foi possível conectar. Tente novamente.");
      console.error("join failed", err);
    } finally {
      setJoining(false);
    }
  };

  const showJoin = status === "idle" || status === "closed";

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GameCanvas />
      <ConnectionStatus />
      {!inHouse && <Joystick />}
      {!showJoin && !inHouse && <ChatPanel />}
      {!showJoin && !inHouse && <GiftPanel />}
      {!showJoin && <HousePanel />}
      {!showJoin && <MemoryPanel />}
      <ReconnectingOverlay />
      {showJoin && (
        <JoinPanel onJoin={handleJoin} error={joinError} loading={joining} />
      )}
    </div>
  );
}
