export function uid(prefix: string): string {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return function (...args: A) {
    if (timer !== null) {
      clearTimeout(timer)
    }
    timer = setTimeout(function () {
      fn.apply(null, args)
    }, ms)
  }
}

export function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) {
    return iso || ''
  }
  const pad = function (n: number): string {
    return n < 10 ? '0' + String(n) : String(n)
  }
  return String(d.getFullYear()) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return minutes + ' 分钟'
  }
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h + ' 小时' + (m > 0 ? ' ' + m + ' 分钟' : '')
}

export function todayKey(): string {
  const d = new Date()
  const pad = function (n: number): string {
    return n < 10 ? '0' + String(n) : String(n)
  }
  return String(d.getFullYear()) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}
