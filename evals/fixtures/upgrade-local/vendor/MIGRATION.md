# Synthetic local SDK migration fixture

Both versions are local test doubles, not real npm packages. v1 exports
`currency(cents)`. v2 exports `formatMoney({ cents })` and requires integer cents.
The application contract accepts integer cents, including zero and negatives,
and returns a yuan string with exactly two decimals. Preserve that contract.

Change only money-helper from `file:vendor/v1` to `file:vendor/v2` and adapt
`src/price.mjs` to import the local v2 module. Direct relative imports deliberately
avoid installation: this fixture checks adapter/config compatibility, not npm
resolution, package publishing or an actual vendor upgrade. No lockfile exists.
Rollback restores the old dependency declaration and adapter import/call.
