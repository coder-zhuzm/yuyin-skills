---
title: Use useTransition Over Manual Loading States
impact: LOW
impactDescription: reduces re-renders and improves code clarity
tags: rendering, transitions, useTransition, loading, state
---

## Use useTransition Over Manual Loading States

For React 19 async Actions, `useTransition` can track pending work while keeping rendering responsive. React 18 does not track async Actions this way: use the project's request/loading mechanism there. Keep existing query-library ordering and cancellation where available; a manual loading state is also valid. The manual example below illustrates missing error/order handling, not a general ban on `useState`.

**Incorrect (manual loading state):**

```tsx
function SearchResults() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSearch = async (value: string) => {
    setIsLoading(true)
    setQuery(value)
    const data = await fetchResults(value)
    setResults(data)
    setIsLoading(false)
  }

  return (
    <>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {isLoading && <Spinner />}
      <ResultsList results={results} />
    </>
  )
}
```

**Correct (useTransition with built-in pending state):**

```tsx
import { useTransition, useState, useRef } from 'react'

function SearchResults() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const latestRequest = useRef(0)

  const handleSearch = (value: string) => {
    setQuery(value)
    const requestId = ++latestRequest.current
    setError(null)
    return startTransition(async () => {
      try {
        const data = await fetchResults(value)
        startTransition(() => {
          if (requestId === latestRequest.current) setResults(data)
        })
      } catch (cause) {
        startTransition(() => {
          if (requestId === latestRequest.current) {
            setError(cause instanceof Error ? cause.message : String(cause))
          }
        })
      }
    })
  }

  return (
    <>
      <input value={query} onChange={(e) => handleSearch(e.target.value)} />
      {isPending && <Spinner />}
      {error && <p role="alert">{error}</p>}
      <ResultsList results={results} />
    </>
  )
}
```

**Benefits:**

- **Automatic pending state**: No need to manually manage `setIsLoading(true/false)`
- **Error resilience**: Pending state correctly resets even if the transition throws
- **Better responsiveness**: Keeps the UI responsive during updates
- **Request ordering**: Transition rendering can be interrupted; network requests are not automatically cancelled or ordered. The request sequence above ignores stale results and stale errors. Pending remains true while any Action is outstanding.

Reference: [useTransition](https://react.dev/reference/react/useTransition)
