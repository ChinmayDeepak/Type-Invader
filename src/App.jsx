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
  if (setupError) return <main className="content"><section className="panel" role="alert"><h1>Finish setting up Type Invaders</h1><p>{setupError}</p><p>After changing Vercel environment variables, redeploy the project.</p></section></main>;
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
