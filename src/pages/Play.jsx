import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import GameCanvas from "../game/GameCanvas.jsx";

/** Opens a server-timed run and commits its result through Supabase RPC. */
export default function Play() {
  const { user, isAdmin } = useAuth();

  const [words, setWords] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState(null);   // {ok:boolean, message:string}

  // The engine mounts once, so the current runId must live in a ref, not state.
  const sessionRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api
      .words()
      .then((bank) => {
        if (cancelled) return;
        const hasWords = bank && bank.tiers && Object.keys(bank.tiers).length > 0;
        setWords(hasWords ? bank : {});   // {} => engine falls back to its built-in bank
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e.message);
        setWords({});
      });
    return () => { cancelled = true; sessionRef.current = null; };
  }, []);

  const handleStart = useCallback(() => {
    setSaveState(null);
    // Keep the opening request with THIS run. A slow previous save must never
    // consume the id of a new run or clear that new run's state.
    const session = { opening: null, submitting: false };
    sessionRef.current = session;
    session.opening = api.createRun().then((res) => res.runId).catch((e) => {
      if (sessionRef.current === session) {
        setSaveState({ ok: false, message: "Could not open a run: " + e.message });
      }
      return null;
    });
  }, []);

  const handleFinish = useCallback(async (result) => {
    const session = sessionRef.current;
    if (!session || session.submitting) return;
    session.submitting = true;
    const report = (state) => {
      if (sessionRef.current === session) setSaveState(state);
    };
    report({ pending: true, message: "Saving your run…" });
    const { hacked, ...payload } = result;
    try {
      const runId = await session.opening;
      if (!runId) {
        report({ ok: false, message: "Run could not be opened — score not saved. Check the Supabase connection." });
        return;
      }
      const saved = await api.completeRun(runId, { ...payload, assisted: !!hacked });
      report({ ok: true, message:
        `Saved: ${saved.score.toLocaleString("en-IN")} points, rank ${saved.rank}.` +
        (hacked ? " (admin assist — excluded from public leaderboard)" : "") });
    } catch (e) {
      report({ ok: false, message: e.message });
    } finally {
      if (sessionRef.current === session) sessionRef.current = null;
    }
  }, []);

  if (words === null) return <p className="muted">loading word packs…</p>;

  return (
    <div className="play">
      {loadError && (
        <p className="warn">
          Word packs unavailable ({loadError}) — playing with the built-in bank.
        </p>
      )}

      {saveState && (
        <p role="status" className={saveState.pending ? "warn" : saveState.ok ? "ok" : "error"}>{saveState.message}</p>
      )}

      <GameCanvas
        words={words}
        initialBest={user?.bestScore ?? 0}
        isAdmin={isAdmin}
        onStart={handleStart}
        onFinish={handleFinish}
      />
    </div>
  );
}
