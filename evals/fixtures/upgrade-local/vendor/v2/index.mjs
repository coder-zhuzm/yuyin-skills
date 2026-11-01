export function formatMoney({ cents }) {
  if (!Number.isInteger(cents)) throw new TypeError('cents must be an integer');
  return `¥${(cents / 100).toFixed(2)}`;
}
