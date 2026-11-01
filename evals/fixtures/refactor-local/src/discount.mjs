export function total(items, kind = 'regular') {
  if (kind === 'vip') {
    let cents = 0;
    for (const item of items) {
      if (item.active) cents += item.priceCents * item.quantity;
    }
    return Math.round(cents * 0.9);
  }
  let cents = 0;
  for (const item of items) {
    if (item.active) cents += item.priceCents * item.quantity;
  }
  return cents;
}
