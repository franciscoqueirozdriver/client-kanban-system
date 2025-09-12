export function joinUrl(base, path) {
  const b = base.replace(/\/+$/, '');
  const p = String(path || '').replace(/^\/+/, '');
  return `${b}/${p}`;
}
