import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Home() {
  const { user } = useAuth();
  const [top, setTop] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.leaderboard(0, 5).then(setTop).catch(e => setError(e.message));
  }, []);

  return (
    <div className="home">
      <section className="hero">
        <h1>TYPE INVADERS</h1>
        <p>
          Type the word above an alien to shoot it. Miss and it closes the gap.
          One round, four stages, and AVERAGEREAPER waiting in the last one.
        </p>
        <div className="hero-actions">
          <Link className="btn solid lg" to={user ? "/play" : "/login"}>
            {user ? "Launch run" : "Sign in to play"}
          </Link>
          <Link className="btn ghost lg" to="/leaderboard">
            View leaderboard
          </Link>
        </div>
        <p className="muted credit">Created by Chinmay Deepak Chandavar</p>
      </section>

      <section className="panel">
        <h2>Top 5 right now</h2>
        {error ? <p className="error" role="alert">{error}</p> : top.length === 0 ? (
          <p className="muted">No runs recorded yet — the board is yours to open.</p>
        ) : (
          <ol className="mini-board">
            {top.map((r) => (
              <li key={`${r.position}-${r.username}`}>
                <span className="pos">#{r.position}</span>
                <span className="name">{r.username}</span>
                <span className="score">{r.score.toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
