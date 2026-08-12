import type { StudyStats } from '../types'

export interface ReportExtras {
  tasksDone: number
  tasksTotal: number
  mistakesOpen: number
  mistakesMastered: number
  cardsDue: number
  cardsReviewed: number
  cardsDuePeriod: number
}

export function buildInsight(stats: StudyStats, extras: ReportExtras, days: number): string {
  const lines: string[] = []
  if (stats.totalStudyMinutes <= 0) {
    lines.push('这 ' + days + ' 天还没开始专注，先来一个 25 分钟，把灯点亮。')
  } else {
    const daily = Math.round(stats.totalStudyMinutes / days)
    if (daily >= 60) {
      lines.push('平均每天专注约 ' + daily + ' 分钟，状态很稳，继续保持。')
    } else if (daily >= 30) {
      lines.push('平均每天专注 ' + daily + ' 分钟，习惯正在成形，可以试着再加一组。')
    } else {
      lines.push('平均每天专注只有 ' + daily + ' 分钟，从明天的一件小事开始，先坐满 25 分钟。')
    }
  }
  if (stats.subjectStats.length > 0) {
    const top = stats.subjectStats.slice().sort(function (a, b) { return b.minutes - a.minutes })[0]
    if (top.minutes > 0) {
      const share = stats.totalStudyMinutes > 0 ? Math.round((top.minutes / stats.totalStudyMinutes) * 100) : 0
      lines.push('「' + top.name + '」占专注 ' + share + '%，' + (share >= 70 ? '有点偏科，记得给其他科目留点时间' : '是这段时间的主力，保持这个节奏'))
    }
  }
  if (extras.cardsDuePeriod > 0) {
    const rate = Math.round((extras.cardsReviewed / extras.cardsDuePeriod) * 100)
    if (rate >= 80) lines.push('复习完成率 ' + rate + '%，卡片清得很勤，记忆会越来越牢。')
    else if (rate >= 50) lines.push('复习完成率 ' + rate + '%，还有几张卡片在等你，今天顺手清掉。')
    else lines.push('复习完成率只有 ' + rate + '%，到期卡片别攒着，每天清一点更轻松。')
  } else if (extras.cardsDue > 0) {
    lines.push('有 ' + extras.cardsDue + ' 张卡片待复习，是时候安排一次复习了。')
  }
  if (extras.tasksTotal > 0) {
    const rate = Math.round((extras.tasksDone / extras.tasksTotal) * 100)
    if (rate >= 100) lines.push('任务全部完成，今天可以安心休息。')
    else if (rate >= 50) lines.push('任务完成 ' + extras.tasksDone + '/' + extras.tasksTotal + '，还差一点，别让它们溜到明天。')
    else lines.push('任务完成 ' + extras.tasksDone + '/' + extras.tasksTotal + '，先从最重要的一件开始。')
  }
  if (stats.streakDays >= 7) {
    lines.push('灯已连亮 ' + stats.streakDays + ' 晚，深夜书房的常客了，小咕敬佩。')
  }
  return lines.join('\n')
}

function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n)
}

export function dateRange(days: number): string {
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - days + 1)
  const key = function (d: Date): string {
    return String(d.getFullYear()) + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
  }
  return key(start) + ' ~ ' + key(end)
}

export function buildWeeklyReport(stats: StudyStats, extras: ReportExtras, days: number): string {
  const lines: string[] = []
  lines.push('# 📊 学习周报')
  lines.push('')
  lines.push('> 统计周期：' + dateRange(days) + '（' + days + ' 天）')
  lines.push('')
  lines.push('## 💡 本周洞察')
  lines.push('')
  for (const line of buildInsight(stats, extras, days).split('\n')) {
    lines.push('- ' + line)
  }
  lines.push('')
  lines.push('## ⏱️ 学习投入')
  lines.push('')
  lines.push('- 总学习时长：**' + (stats.totalStudyMinutes / 60).toFixed(1) + ' 小时（' + stats.totalStudyMinutes + ' 分钟）**')
  lines.push('- 完成番茄钟：**' + stats.pomodoroCompleted + ' / ' + stats.pomodoroTotal + '**（完成率 **' + (stats.pomodoroTotal > 0 ? Math.round((stats.pomodoroCompleted / stats.pomodoroTotal) * 100) : 0) + '%**）')
  lines.push('- 连续打卡：**' + stats.streakDays + ' 天**')
  lines.push('')
  lines.push('## 📚 章节进度')
  lines.push('')
  lines.push('- 完成章节：' + stats.completedChapters + ' / ' + stats.totalChapters)
  if (stats.subjectStats.length > 0) {
    lines.push('')
    for (const s of stats.subjectStats) {
      const pct = s.totalChapters > 0 ? Math.round((s.completedChapters / s.totalChapters) * 100) : 0
      lines.push('- **' + s.name + '**：专注 ' + s.minutes + ' 分钟 · 章节 ' + s.completedChapters + '/' + s.totalChapters + '（' + pct + '%）')
    }
  }
  lines.push('')
  lines.push('## ✅ 任务完成')
  lines.push('')
  lines.push('- 完成 **' + extras.tasksDone + ' / ' + extras.tasksTotal + '** 项任务')
  lines.push('- 复习完成率：**' + extras.cardsReviewed + ' / ' + extras.cardsDuePeriod + '**（**' + (extras.cardsDuePeriod > 0 ? Math.round((extras.cardsReviewed / extras.cardsDuePeriod) * 100) : 0) + '%**）')
  lines.push('- 当前待复习卡片：' + extras.cardsDue + ' 张')
  lines.push('')
  lines.push('## 📕 错题')
  lines.push('')
  lines.push('- 待订正/复习中：' + extras.mistakesOpen + ' 道')
  lines.push('- 已掌握：' + extras.mistakesMastered + ' 道')
  lines.push('')
  lines.push('## 💡 本周心得')
  lines.push('')
  lines.push('- 请在下方补充本周的收获与反思：')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('_由 Study desktop 自动生成_' + ' · ' + dateRange(days))
  return lines.join('\n')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildWeeklyReportHtml(stats: StudyStats, extras: ReportExtras, days: number): string {
  const pct = stats.pomodoroTotal > 0 ? Math.round((stats.pomodoroCompleted / stats.pomodoroTotal) * 100) : 0
  const subjectRows = stats.subjectStats.map(function (s) {
    const p = s.totalChapters > 0 ? Math.round((s.completedChapters / s.totalChapters) * 100) : 0
    return '<tr><td>' + esc(s.name) + '</td><td>' + s.minutes + ' 分钟</td><td>' + s.completedChapters + '/' + s.totalChapters + '（' + p + '%）</td></tr>'
  }).join('')
  return '<!doctype html><html lang=' + String.fromCharCode(39) + 'zh-CN' + String.fromCharCode(39) + '><head><meta charset=' + String.fromCharCode(39) + 'utf-8' + String.fromCharCode(39) + ' /><title>学习周报</title><style>' +
    'body{font-family:-apple-system,BlinkMacSystemFont,' + String.fromCharCode(39) + 'Segoe UI' + String.fromCharCode(39) + ',' + String.fromCharCode(39) + 'PingFang SC' + String.fromCharCode(39) + ',sans-serif;background:#f3f4f6;margin:0;padding:32px;color:#1f2937}' +
    '.card{max-width:720px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 18px rgba(0,0,0,.08)}' +
    'h1{color:#2B3A67;margin:0 0 4px}.sub{color:#5B6478;font-size:13px;margin-bottom:24px}' +
    'h2{font-size:16px;margin:22px 0 10px;border-left:4px solid #D9922E;padding-left:10px}' +
    'table{width:100%;border-collapse:collapse;font-size:13px}td,th{border:1px solid #e5e7eb;padding:8px 10px;text-align:left}' +
    'th{background:#F2EDE3}.stat{display:inline-block;background:#F7E8CE;border-radius:10px;padding:12px 16px;margin:6px 8px 6px 0;min-width:120px}' +
    '.stat b{display:block;font-size:22px;color:#D9922E}.stat span{font-size:12px;color:#5B6478}' +
    'ul{font-size:13px;line-height:1.8}' +
    '</style></head><body><div class=' + String.fromCharCode(39) + 'card' + String.fromCharCode(39) + '>' +
    '<h1>📊 学习周报</h1><div class=' + String.fromCharCode(39) + 'sub' + String.fromCharCode(39) + '>统计周期：' + dateRange(days) + '（' + days + ' 天）</div>' +
    '<div><div class=' + String.fromCharCode(39) + 'stat' + String.fromCharCode(39) + '><b>' + (stats.totalStudyMinutes / 60).toFixed(1) + 'h</b><span>总学习时长</span></div>' +
    '<div class=' + String.fromCharCode(39) + 'stat' + String.fromCharCode(39) + '><b>' + stats.pomodoroCompleted + '/' + stats.pomodoroTotal + '</b><span>番茄（' + pct + '%）</span></div>' +
    '<div class=' + String.fromCharCode(39) + 'stat' + String.fromCharCode(39) + '><b>' + stats.streakDays + '</b><span>连续打卡（天）</span></div>' +
    '<div class=' + String.fromCharCode(39) + 'stat' + String.fromCharCode(39) + '><b>' + extras.tasksDone + '/' + extras.tasksTotal + '</b><span>任务完成</span></div>' +
    '<div class=' + String.fromCharCode(39) + 'stat' + String.fromCharCode(39) + '><b>' + (extras.cardsDuePeriod > 0 ? Math.round((extras.cardsReviewed / extras.cardsDuePeriod) * 100) : 0) + '%</b><span>复习完成率</span></div></div>' +
    '<h2>💡 本周洞察</h2><ul>' + buildInsight(stats, extras, days).split('\n').map(function (line) { return '<li>' + esc(line) + '</li>' }).join('') + '</ul>' +
    '<h2>📚 章节进度</h2><p>完成章节 ' + stats.completedChapters + ' / ' + stats.totalChapters + '</p>' +
    (stats.subjectStats.length > 0 ? '<table><tr><th>科目</th><th>专注时长</th><th>章节进度</th></tr>' + subjectRows + '</table>' : '') +
    '<h2>📕 错题</h2><p>待订正/复习中 ' + extras.mistakesOpen + ' 道 · 已掌握 ' + extras.mistakesMastered + ' 道 · 复习 ' + extras.cardsReviewed + '/' + extras.cardsDuePeriod + ' 张 · 当前待复习 ' + extras.cardsDue + ' 张</p>' +
    '<h2>💡 本周心得</h2><p>（请在下方补充）</p>' +
    '<p style=' + String.fromCharCode(39) + 'color:#9ca3af;font-size:12px;margin-top:28px' + String.fromCharCode(39) + '>由 Study desktop 自动生成</p>' +
    '</div></body></html>'
}

