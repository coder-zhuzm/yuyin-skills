import { useState } from 'react';
import { List, ListItem, TextField } from '@mui/material';
import { filterProducts } from './filter-products.mjs';

export function ProductList({ products }) {
  const [query, setQuery] = useState('');
  return <><TextField label="搜索商品" value={query} onChange={event => setQuery(event.target.value)} />
    <List>{filterProducts(products, query).map(product => <ListItem key={product.id}>{product.name}</ListItem>)}</List></>;
}
