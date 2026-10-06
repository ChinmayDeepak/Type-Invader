import { useState } from "react";
import { unlockLobbyMusic } from "./lobbyMusic.js";
import { Navigate, Route, Routes } from "react-router-dom";
import { setupError } from "./api/supabase.js";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Play from "./pages/Play.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Profile from "./pages/Profile.jsx";
import Admin from "./pages/Admin.jsx";

/**
 * Full Stack Development (22CBG71)
 * Chinmay Deepak Chandavar | 1NT23CB013 | CSBS
 */
export default function App() {
  const [entered, setEntered] = useState(false);
  function enter() {
    unlockLobbyMusic();
    setEntered(true);
  }
  if (setupError) return <main className="content"><section className="panel" role="alert"><h1>Finish setting up Type Invaders</h1><p>{setupError}</p><p>After changing Vercel environment variables, redeploy the project.</p></section></main>;
  if (!entered) return (
    <button className="entry-screen" onClick={enter} autoFocus>
      <span className="entry-title">TYPE INVADERS</span>
      <span className="entry-subtitle">RELOADED</span>
      <span className="entry-prompt">CLICK ANYWHERE TO START</span>
      <span className="entry-hint">Tap or press Enter to continue</span>
    </button>
  );
  return (
    <div className="app">
      <Navbar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route
            path="/play"
            element={
              <ProtectedRoute>
                <Play />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
