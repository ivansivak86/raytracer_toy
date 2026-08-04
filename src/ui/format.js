export function formatNumber(value, maximumFractionDigits = 0) {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

export function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return '0.00 s';
  if (milliseconds < 1000) return `${milliseconds.toFixed(0)} ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(2)} s`;
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = ((milliseconds % 60_000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

export function formatVector(vector, digits = 3) {
  return `[${vector.map((value) => Number(value).toFixed(digits)).join(', ')}]`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
