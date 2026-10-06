import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { DifficultyBadge, ResultBadge } from "../components/RunBadges.jsx";
import { downloadCsv } from "../utils/csv.js";

const DEFAULTS = { page: 0, size: 20, minStage: "", difficulty: "", search: "", sort: "score" };

export default function Leaderboard() {
  const [filters, setFilters] = useState(DEFAULTS);
  const [searchText, setSearchText] = useState("");
  const [result, setResult] = useState({ rows: [], totalElements: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const change = (key, value) => {
    setLoading(true);
    setFilters((old) => ({ ...old, [key]: value, page: 0 }));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api.leaderboardPage(filters)
      .then((data) => {
        if (cancelled) return;
        if (filters.page > 0 && filters.page >= data.totalPages) {
          setFilters((old) => ({ ...old, page: Math.max(0, data.totalPages - 1) }));
        } else setResult(data);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters, refresh]);

  const exportPage = () => downloadCsv("leaderboard-page.csv",
    ["Position", "Player", "Score", "Stage", "Difficulty", "WPM", "Accuracy (%)", "Rank", "Result", "Achieved at"],
    result.rows.map((r) => [r.position, r.username, r.score, r.stageReached, r.difficulty,
      r.wpm, r.accuracy, r.rank, r.won ? "Cleared" : "Overrun", r.achievedAt]));

  return <section className="panel" aria-busy={loading}>
    <div className="panel-head">
      <div><h2>Leaderboard</h2><p className="muted">Compare completed runs across every player.</p></div>
      <div className="row-actions">
        <button className="btn ghost" disabled={loading} onClick={() => setRefresh((n) => n + 1)}>Refresh</button>
        <button className="btn ghost" disabled={loading || !!error || !result.rows.length} onClick={exportPage}>Export page CSV</button>
      </div>
    </div>
    <div className="table-tools">
      <form className="table-search" onSubmit={(e) => { e.preventDefault(); change("search", searchText.trim()); }}>
        <label className="filter">Player<input type="search" placeholder="Search callsign" maxLength={24}
          value={searchText} onChange={(e) => setSearchText(e.target.value)} /></label>
        <button className="btn ghost" type="submit">Search</button>
      </form>
      <label className="filter">Difficulty<select value={filters.difficulty} onChange={(e) => change("difficulty", e.target.value)}>
        <option value="">All</option><option>EASY</option><option>NORMAL</option><option>HARD</option>
        <option value="UNKNOWN">Not recorded</option>
      </select></label>
      <label className="filter">Reached stage<select value={filters.minStage} onChange={(e) => change("minStage", e.target.value)}>
        <option value="">Any</option><option value="2">2+</option><option value="3">3+</option><option value="4">4 (boss)</option>
      </select></label>
      <label className="filter">Sort by<select value={filters.sort} onChange={(e) => change("sort", e.target.value)}>
        <option value="score">Highest score</option><option value="wpm">Fastest WPM</option>
        <option value="accuracy">Best accuracy</option><option value="newest">Newest</option>
      </select></label>
      <label className="filter">Rows<select value={filters.size} onChange={(e) => change("size", Number(e.target.value))}>
        <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
      </select></label>
      <button className="btn ghost" onClick={() => { setSearchText(""); setFilters({ ...DEFAULTS }); }}>Reset filters</button>
    </div>
    {error ? <div role="alert"><p className="error">{error}</p><button className="btn ghost" onClick={() => setRefresh((n) => n + 1)}>Try again</button></div>
      : loading ? <p className="table-state muted" role="status">Loading leaderboard…</p>
      : !result.rows.length ? <p className="table-state muted">No completed runs match these filters.</p>
      : <div className="table-scroll" tabIndex={0} role="region" aria-label="Leaderboard results">
        <table className="table">
          <caption className="sr-only">Runs in the selected order. Positions apply to the current filters and sort.</caption>
          <thead><tr>{["#", "Player", "Score", "Stage", "Difficulty", "WPM", "Accuracy", "Rank", "Result"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{result.rows.map((r) => <tr key={`${r.position}-${r.username}`} className={r.won ? "cleared" : ""}>
            <td>{r.position}</td><td>{r.username}</td><td className="num">{r.score.toLocaleString("en-IN")}</td>
            <td>{r.stageReached}</td><td><DifficultyBadge value={r.difficulty} /></td><td>{r.wpm}</td>
            <td>{r.accuracy}%</td><td><span className={`rank r-${r.rank}`}>{r.rank || "—"}</span></td><td><ResultBadge won={r.won} /></td>
          </tr>)}</tbody>
        </table>
      </div>}
    <nav className="pager" aria-label="Leaderboard pages">
      <button className="btn ghost" disabled={loading || filters.page === 0} onClick={() => { setLoading(true); setFilters((f) => ({ ...f, page: f.page - 1 })); }}>Previous</button>
      <span className="muted" aria-live="polite">{loading ? "Loading…" : error ? "Unable to load results" : `Page ${filters.page + 1} of ${Math.max(1, result.totalPages)} · ${result.totalElements} runs`}</span>
      <button className="btn ghost" disabled={loading || !!error || filters.page + 1 >= result.totalPages} onClick={() => { setLoading(true); setFilters((f) => ({ ...f, page: f.page + 1 })); }}>Next</button>
    </nav>
  </section>;
}
