export const PERIOD_MS = Object.freeze({
  '3h': 3 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  all: Number.POSITIVE_INFINITY,
})

export const DEFAULT_PREFERENCES = Object.freeze({
  enabled: false,
  period: '1d',
  showProjects: false,
  showProjectLabels: false,
})

export function normalizePreferences(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_PREFERENCES }
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_PREFERENCES.enabled,
    period: Object.hasOwn(PERIOD_MS, value.period) ? value.period : DEFAULT_PREFERENCES.period,
    showProjects: typeof value.showProjects === 'boolean' ? value.showProjects : DEFAULT_PREFERENCES.showProjects,
    showProjectLabels: typeof value.showProjectLabels === 'boolean'
      ? value.showProjectLabels : DEFAULT_PREFERENCES.showProjectLabels,
  }
}

export function visibleSessions(list, archivedSessionIds, period, now) {
  const archived = archivedSessionIds instanceof Set ? archivedSessionIds : new Set(archivedSessionIds || [])
  const maxAge = PERIOD_MS[period] ?? PERIOD_MS[DEFAULT_PREFERENCES.period]
  return (list?.ids || [])
    .map(id => list.byId[id])
    .filter(Boolean)
    .filter(session => session.origin !== 'subagent' && !session.blank && !archived.has(session.id))
    .filter(session => maxAge === Number.POSITIVE_INFINITY || now - session.updatedAt <= maxAge)
    .sort((left, right) => right.updatedAt - left.updatedAt || String(left.id).localeCompare(String(right.id)))
}

export function workspaceBySession(workspaces) {
  const result = new Map()
  for (const workspace of workspaces || []) {
    for (const sessionId of workspace.sessionIds || []) {
      if (!result.has(sessionId)) result.set(sessionId, workspace)
    }
  }
  return result
}

export function groupSessions(sessions, workspaces, ungroupedLabel) {
  const owner = workspaceBySession(workspaces)
  const buckets = new Map()
  for (const workspace of workspaces || []) {
    buckets.set(workspace.workspaceId, { key: workspace.workspaceId, title: workspace.title || workspace.path, sessions: [] })
  }
  const ungrouped = { key: '__ungrouped__', title: ungroupedLabel, sessions: [] }
  for (const session of sessions) {
    const workspace = owner.get(session.id)
    const bucket = workspace === undefined ? ungrouped : buckets.get(workspace.workspaceId)
    ;(bucket || ungrouped).sessions.push(session)
  }
  const groups = [...buckets.values()].filter(group => group.sessions.length > 0)
  if (ungrouped.sessions.length > 0) groups.push(ungrouped)
  return groups.sort((left, right) => (right.sessions[0]?.updatedAt ?? 0) - (left.sessions[0]?.updatedAt ?? 0))
}

export function projectLabel(path, fallback = '') {
  const normalized = String(path || '').replaceAll('\\', '/').replace(/\/+$/, '')
  const parts = normalized.split('/').filter(Boolean)
  return parts.slice(-2).join('/') || fallback
}

export function projectHue(identity) {
  let hash = 2166136261
  for (const char of String(identity || '')) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) * 137.508) % 360
}

export function relativeActivity(updatedAt, now, labels) {
  const elapsed = Math.max(0, now - updatedAt)
  if (elapsed < 60_000) return labels.now
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 60) return labels.minutes(minutes)
  const hours = Math.floor(elapsed / 3_600_000)
  if (hours < 24) return labels.hours(hours)
  const days = Math.floor(elapsed / 86_400_000)
  return labels.days(days)
}
