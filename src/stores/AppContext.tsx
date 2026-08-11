import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppPage, AppSettings } from '../types'
import { createDb } from '../lib/db'

interface AppState {
  activePage: AppPage
  setActivePage: (page: AppPage) => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
  searchOpen: boolean
  openSearch: () => void
  closeSearch: () => void
  dataVersion: number
  bumpDataVersion: () => void
  settings: AppSettings | null
  refreshSettings: () => void
  minimal: boolean
  toggleMinimal: () => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider(props: { children: ReactNode }) {
  const [activePage, setActivePage] = useState<AppPage>('dashboard')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [searchOpen, setSearchOpen] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [minimal, setMinimal] = useState(false)

  const refreshSettings = function () {
    createDb().getSettings().then(function (s) { setSettings(s) }).catch(function () {})
  }

  useEffect(function () {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(function () {
    refreshSettings()
  }, [dataVersion])

  useEffect(function () {
    const root = document.documentElement
    if (settings && settings.accentColor) {
      root.style.setProperty('--accent', settings.accentColor)
      root.style.setProperty('--accent-weak', settings.accentColor + '1f')
    }
    root.setAttribute('data-font-size', settings && settings.fontSize ? settings.fontSize : 'normal')
    root.setAttribute('data-density', settings && settings.density ? settings.density : 'comfortable')
  }, [settings])

  const openSearch = function () { setSearchOpen(true) }
  const closeSearch = function () { setSearchOpen(false) }
  const toggleTheme = function () {
    setTheme(function (t) { return t === 'light' ? 'dark' : 'light' })
  }
  const bumpDataVersion = function () {
    setDataVersion(function (v) { return v + 1 })
  }
  const toggleMinimal = function () {
    setMinimal(function (v) { return !v })
  }

  const value: AppState = {
    activePage,
    setActivePage,
    theme,
    toggleTheme,
    searchOpen,
    openSearch,
    closeSearch,
    dataVersion,
    bumpDataVersion,
    settings,
    refreshSettings,
    minimal,
    toggleMinimal,
  }

  return <AppContext.Provider value={value}>{props.children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider')
  }
  return ctx
}

