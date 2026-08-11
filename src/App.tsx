import { AppProvider } from './stores/AppContext'
import { ChapterProvider } from './stores/ChapterContext'
import { TaskProvider } from './stores/TaskContext'
import { ReflectionProvider } from './stores/ReflectionContext'
import { PomodoroProvider } from './stores/PomodoroContext'
import { SearchProvider } from './stores/SearchContext'
import AppShell from './components/layout/AppShell'

export default function App() {
  return (
    <AppProvider>
      <ChapterProvider>
        <TaskProvider>
          <ReflectionProvider>
            <PomodoroProvider>
              <SearchProvider>
                <AppShell />
              </SearchProvider>
            </PomodoroProvider>
          </ReflectionProvider>
        </TaskProvider>
      </ChapterProvider>
    </AppProvider>
  )
}

