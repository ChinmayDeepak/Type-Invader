export function toCsv(headers, rows) {
  const cell = (value) => {
    let text = String(value ?? "");
    // Keep player-supplied cells from being interpreted as spreadsheet formulas.
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename, headers, rows) {
  const blob = new Blob(["\uFEFF", toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
