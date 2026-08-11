import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { SearchResult } from '../types'
import { createDb } from '../lib/db'
import { debounce } from '../lib/utils'

interface SearchState {
  query: string
  results: SearchResult[]
  isLoading: boolean
  setQuery: (q: string) => void
  clear: () => void
}

const SearchContext = createContext<SearchState | null>(null)

export function SearchProvider(props: { children: ReactNode }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const debouncedSearch = debounce(function (q: string) {
    setIsLoading(true)
    createDb().search(q).then(function (r) {
      setResults(r)
      setIsLoading(false)
    }).catch(function () {
      setIsLoading(false)
    })
  }, 300)

  useEffect(function () {
    if (!query.trim()) {
      setResults([])
      setIsLoading(false)
      return
    }
    debouncedSearch(query)
  }, [query])

  const clear = function () {
    setQuery('')
    setResults([])
    setIsLoading(false)
  }

  const value: SearchState = {
    query,
    results,
    isLoading,
    setQuery,
    clear,
  }

  return <SearchContext.Provider value={value}>{props.children}</SearchContext.Provider>
}

export function useSearch(): SearchState {
  const ctx = useContext(SearchContext)
  if (!ctx) {
    throw new Error('useSearch must be used within SearchProvider')
  }
  return ctx
}
