export function DifficultyBadge({ value }) {
  const difficulty = ["EASY", "NORMAL", "HARD"].includes(value) ? value : null;
  return <span className={`diff d-${difficulty || "NA"}`} title={difficulty || "Difficulty was not recorded for this run"}>
    {difficulty || "—"}
  </span>;
}

export function ResultBadge({ won }) {
  return <span className={`result ${won ? "result-win" : "result-over"}`}>{won ? "Cleared" : "Overrun"}</span>;
}
