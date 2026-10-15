export async function loadOrders(fetchOrders, { budgetMs = 50 } = {}) {
  let timer;
  try {
    return await Promise.race([
      fetchOrders(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('order request timed out')), budgetMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
