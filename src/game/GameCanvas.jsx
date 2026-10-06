import { useEffect, useRef, useState } from "react";
import { startTypeInvader } from "./engine.js";

/**
 * The bridge between React and the imperative game loop.
 *
 * React owns nothing inside the host div: the engine writes its own DOM once
 * and then mutates it at 60 fps. All React does here is mount it, hand it the
 * server data it needs, and guarantee destroy() runs on unmount so the rAF
 * loop and window listeners do not leak between route changes.
 *
 * The host div MUST stay childless in JSX. The engine replaces its innerHTML,
 * so any React-rendered child would be silently detached and React would then
 * crash trying to remove a node that is no longer its own.
 */
export default function GameCanvas({ words, initialBest, isAdmin, onStart, onFinish }) {
  const hostRef = useRef(null);
  const [booted, setBooted] = useState(false);

  // Callbacks live in a ref so a new function identity on re-render cannot
  // tear the engine down in the middle of a run.
  const handlers = useRef({ onStart, onFinish });
  handlers.current = { onStart, onFinish };

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const game = startTypeInvader(hostRef.current, {
      words,
      initialBest,
      isAdmin,          // shows the HACK button; it is worth zero score either way
      onStart: (...a) => handlers.current.onStart?.(...a),
      onFinish: (...a) => handlers.current.onFinish?.(...a),
    });
    setBooted(true);

    return () => game.destroy();
    // Mount once, on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {!booted && <p className="muted">booting engine…</p>}
      <div className="game-host" ref={hostRef} aria-label="Type Invaders game" />
    </>
  );
}
