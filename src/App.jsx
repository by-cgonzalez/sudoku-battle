import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { GameProvider, useGame } from "./contexts/GameContext";
import { Header } from "./components/Header";
import { ConfigScreen } from "./components/ConfigScreen";
import { AuthScreen } from "./components/AuthScreen";
import { LobbyScreen } from "./components/LobbyScreen";
import { RoomScreen } from "./components/RoomScreen";
import { GameScreen } from "./components/GameScreen";
import { SoloScreen } from "./components/SoloScreen";

function AppContent() {
  const { user, loading, configured } = useAuth();
  const { screen } = useGame();

  if (!configured) return <ConfigScreen />;
  if (loading) {
    return (
      <section className="screen active">
        <div className="card card-center">
          <p>Cargando...</p>
        </div>
      </section>
    );
  }

  if (!user) return <AuthScreen />;

  switch (screen) {
    case "room":
      return <RoomScreen />;
    case "game":
      return <GameScreen />;
    case "solo":
      return <SoloScreen />;
    default:
      return <LobbyScreen />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <div className="bg-grid" />
        <div className="app">
          <Header />
          <AppContent />
        </div>
      </GameProvider>
    </AuthProvider>
  );
}
