import { useEffect, useState } from "react";
import { api } from "../api/client.js";

const BLANK = { name: "", tier: 1, active: true, words: "" };

export default function Admin() {
  const [tab, setTab] = useState("packs");
  const [stats, setStats] = useState(null);
  const [packs, setPacks] = useState([]);
  const [users, setUsers] = useState([]);
  const [draft, setDraft] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    try {
      const [s, p, u] = await Promise.all([api.adminStats(), api.wordPacks(), api.users()]);
      setStats(s);
      setPacks(p);
      setUsers(u);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const savePack = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    const body = {
      name: draft.name,
      tier: Number(draft.tier),
      active: draft.active,
      words: draft.words.split(/[\s,]+/).filter(Boolean),
    };

    try {
      if (editingId) {
        await api.updatePack(editingId, body);
        setNotice(`Pack "${body.name}" updated.`);
      } else {
        await api.createPack(body);
        setNotice(`Pack "${body.name}" created.`);
      }
      setDraft(BLANK);
      setEditingId(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const editPack = (p) => {
    setEditingId(p.id);
    setDraft({ name: p.name, tier: p.tier, active: p.active, words: p.words.join(" ") });
    setTab("packs");
  };

  const removePack = async (id) => {
    if (!window.confirm("Delete this pack and all its words?")) return;
    try {
      await api.deletePack(id);
      refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleBan = async (u) => {
    try {
      await api.updateUser(u.id, { banned: !u.banned });
      refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="admin">
      <section className="panel">
        <h2>Admin</h2>
        {stats && (
          <div className="stat-grid">
            <Stat label="Players" value={stats.totalUsers} />
            <Stat label="Runs stored" value={stats.totalRuns} />
            <Stat label="Rejected scores" value={stats.rejectedRuns} />
            <Stat label="Word packs" value={stats.wordPacks} />
            <Stat label="Words" value={stats.totalWords} />
          </div>
        )}

        <div className="tabs">
          <button className={"tab" + (tab === "packs" ? " on" : "")} onClick={() => setTab("packs")}>
            Word packs
          </button>
          <button className={"tab" + (tab === "users" ? " on" : "")} onClick={() => setTab("users")}>
            Players
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {notice && <p className="ok">{notice}</p>}
      </section>

      {tab === "packs" && (
        <>
          <section className="panel">
            <h2>{editingId ? "Edit pack" : "New pack"}</h2>
            <form className="form wide" onSubmit={savePack}>
              <label>
                Name
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  required
                />
              </label>

              <label>
                Tier
                <select
                  value={draft.tier}
                  onChange={(e) => setDraft({ ...draft, tier: e.target.value })}
                >
                  <option value={1}>1 — short words</option>
                  <option value={2}>2 — medium</option>
                  <option value={3}>3 — long</option>
                  <option value={4}>4 — extreme</option>
                  <option value={5}>5 — boss bank</option>
                </select>
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Active (served to the game)
              </label>

              <label>
                Words — space or comma separated, letters a–z only
                <textarea
                  rows={4}
                  value={draft.words}
                  onChange={(e) => setDraft({ ...draft, words: e.target.value })}
                  required
                />
              </label>

              <div className="row-actions">
                <button className="btn solid">{editingId ? "Save changes" : "Create pack"}</button>
                {editingId && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setEditingId(null);
                      setDraft(BLANK);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="panel">
            <h2>Existing packs</h2>
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Tier</th><th>Words</th><th>Active</th><th></th></tr>
              </thead>
              <tbody>
                {packs.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.tier === 5 ? "boss" : p.tier}</td>
                    <td className="num">{p.words.length}</td>
                    <td>{p.active ? "yes" : "no"}</td>
                    <td className="row-actions">
                      <button className="btn ghost sm" onClick={() => editPack(p)}>Edit</button>
                      <button className="btn danger sm" onClick={() => removePack(p.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {tab === "users" && (
        <section className="panel">
          <h2>Players</h2>
          <table className="table">
            <thead>
              <tr><th>Callsign</th><th>Email</th><th>Role</th><th>Best</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.banned ? "banned" : ""}>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td className="num">{u.bestScore.toLocaleString("en-IN")}</td>
                  <td>{u.banned ? "suspended" : "active"}</td>
                  <td>
                    <button
                      className={"btn sm " + (u.banned ? "ghost" : "danger")}
                      onClick={() => toggleBan(u)}
                      disabled={u.role === "ADMIN"}
                    >
                      {u.banned ? "Reinstate" : "Suspend"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
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
