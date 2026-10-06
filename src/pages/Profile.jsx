import { useEffect, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { DifficultyBadge, ResultBadge } from "../components/RunBadges.jsx";
import { downloadCsv } from "../utils/csv.js";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

const mmss = (s) => `${Math.floor(s / 60)}m ${s % 60}s`;

export default function Profile() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    let cancelled = false;
    setError("");
    api.stats().then((data) => { if (!cancelled) setStats(data); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError("");
    api.history(page, pageSize).then((data) => { if (!cancelled) setHistory(data); })
      .catch((e) => { if (!cancelled) setHistoryError(e.message); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [page, refresh]);

  if (error) return <div role="alert"><p className="error">{error}</p><button className="btn ghost" onClick={() => setRefresh((n) => n + 1)}>Try again</button></div>;
  if (!stats || !user) return <p className="muted">loading stats…</p>;

  // recentRuns arrives newest-first; the chart reads better oldest-first
  const chart = [...stats.recentRuns].reverse().map((r, i) => ({
    run: `#${i + 1}`,
    score: r.score,
    wpm: r.wpm,
  }));

  return (
    <div className="profile">
      <section className="panel">
        <h2>{user.username}</h2>
        <p className="muted">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
        <p className="muted">History and averages include assisted practice. Best score and the public leaderboard exclude it.</p>

        <div className="stat-grid">
          <Stat label="Runs played" value={stats.runsPlayed} />
          <Stat label="Best score" value={stats.bestScore.toLocaleString("en-IN")} />
          <Stat label="Best WPM" value={stats.bestWpm} />
          <Stat label="Average WPM" value={stats.avgWpm} />
          <Stat label="Average accuracy" value={`${stats.avgAccuracy}%`} />
          <Stat label="Longest combo" value={stats.bestCombo} />
          <Stat label="Total kills" value={stats.totalKills} />
          <Stat label="Time played" value={mmss(stats.totalSeconds)} />
        </div>
      </section>

      {chart.length > 1 && (
        <section className="panel">
          <h2>Last {chart.length} runs</h2>
          <p className="muted">Score on the left axis · WPM on the right</p>
          <div className="chart">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#22302b" />
                <XAxis dataKey="run" stroke="#7d9384" />
                <YAxis yAxisId="score" stroke="#a8e05f" width={65} />
                <YAxis yAxisId="wpm" orientation="right" stroke="#79c9ff" width={50} />
                <Tooltip
                  contentStyle={{ background: "#0d1512", border: "1px solid #2b3d34" }}
                />
                <Line yAxisId="score" name="Score" type="monotone" dataKey="score" stroke="#a8e05f" strokeWidth={2} dot={false} />
                <Line yAxisId="wpm" name="WPM" type="monotone" dataKey="wpm" stroke="#79c9ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2>Match history</h2>
          <button className="btn ghost" disabled={historyLoading || !!historyError || !history.length}
            onClick={() => downloadCsv("match-history-page.csv",
              ["Finished at", "Score", "Stage", "Difficulty", "Kills", "WPM", "Accuracy (%)", "Combo", "Rank", "Duration (s)", "Result"],
              history.map(r => [r.finishedAt, r.score, r.stageReached, r.difficulty, r.kills, r.wpm,
                r.accuracy, r.bestCombo, r.rank, r.durationSec, r.won ? "Cleared" : "Overrun"]))}>Export page CSV</button>
        </div>
        {historyError ? <div role="alert"><p className="error">{historyError}</p><button className="btn ghost" onClick={() => setRefresh(n => n + 1)}>Try again</button></div>
          : historyLoading ? <p className="muted" role="status">Loading match history…</p>
          : history.length === 0 ? (
          <p className="muted">No completed runs yet.</p>
        ) : (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Match history results">
          <table className="table">
            <caption className="sr-only">Completed runs, newest first</caption>
            <thead>
              <tr>
                <th scope="col">When</th><th scope="col">Score</th><th scope="col">Stage</th><th scope="col">Diff</th><th scope="col">Kills</th>
                <th scope="col">WPM</th><th scope="col">Acc</th><th scope="col">Combo</th><th scope="col">Rank</th><th scope="col">Duration</th><th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} className={r.won ? "cleared" : ""}>
                  <td>{new Date(r.finishedAt).toLocaleString()}</td>
                  <td className="num">{r.score.toLocaleString("en-IN")}</td>
                  <td>{r.stageReached}</td>
                  <td><DifficultyBadge value={r.difficulty} /></td>
                  <td>{r.kills}</td>
                  <td>{r.wpm}</td>
                  <td>{r.accuracy}%</td>
                  <td>{r.bestCombo}</td>
                  <td><span className={"rank r-" + r.rank}>{r.rank}</span></td>
                  <td>{mmss(r.durationSec)}</td><td><ResultBadge won={r.won} />{r.assisted && <small className="muted"> · assisted</small>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <nav className="pager" aria-label="Match history pages">
          <button className="btn ghost" disabled={historyLoading || page === 0} onClick={() => { setHistoryLoading(true); setPage(p => p - 1); }}>Previous</button>
          <span className="muted" aria-live="polite">Page {page + 1} of {Math.max(1, Math.ceil(stats.runsPlayed / pageSize))} · {stats.runsPlayed} runs</span>
          <button className="btn ghost" disabled={historyLoading || !!historyError || (page + 1) * pageSize >= stats.runsPlayed} onClick={() => { setHistoryLoading(true); setPage(p => p + 1); }}>Next</button>
        </nav>
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
