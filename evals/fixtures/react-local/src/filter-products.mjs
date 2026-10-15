export function filterProducts(products, query) {
  return products.filter(product => product.name.includes(query));
}
