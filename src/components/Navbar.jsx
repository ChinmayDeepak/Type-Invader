import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const cls = ({ isActive }) => "nav-link" + (isActive ? " active" : "");

  return (
    <nav className="navbar">
      <NavLink to="/" className="brand">
        TYPE<span>INVADERS</span>
      </NavLink>

      <div className="nav-links">
        <NavLink to="/play" className={cls}>Play</NavLink>
        <NavLink to="/leaderboard" className={cls}>Leaderboard</NavLink>
        {user && <NavLink to="/profile" className={cls}>Profile</NavLink>}
        {isAdmin && <NavLink to="/admin" className={cls}>Admin</NavLink>}
      </div>

      <div className="nav-user">
        {error && <span className="error" role="alert">{error}</span>}
        {user ? (
          <>
            <span className="who">
              {user.username}
              <i>best {user.bestScore}</i>
            </span>
            <button
              className="btn ghost"
              onClick={async () => {
                try { await logout(); navigate("/login"); }
                catch (e) { setError(e.message); }
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className="btn ghost">Sign in</NavLink>
            <NavLink to="/register" className="btn solid">Register</NavLink>
          </>
        )}
      </div>
    </nav>
  );
}
