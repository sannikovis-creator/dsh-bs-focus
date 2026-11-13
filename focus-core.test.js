import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PREFERENCES, groupSessions, normalizePreferences, projectHue, projectLabel,
  relativeActivity, visibleSessions, workspaceBySession,
} from './focus-core.js'

const NOW = 10 * 24 * 60 * 60 * 1000
const session = (id, age, extra = {}) => ({ id, displayTitle: id, updatedAt: NOW - age, ...extra })
const list = rows => ({ ids: rows.map(row => row.id), byId: Object.fromEntries(rows.map(row => [row.id, row])) })

test('preferences default safely and preserve valid values', () => {
  assert.deepEqual(normalizePreferences(null), DEFAULT_PREFERENCES)
  assert.deepEqual(normalizePreferences({ enabled: true, period: '6h', showProjects: true, showProjectLabels: true }), {
    enabled: true, period: '6h', showProjects: true, showProjectLabels: true,
  })
  assert.deepEqual(normalizePreferences({ enabled: 'yes', period: 'week', showProjects: 1, showProjectLabels: 1 }), DEFAULT_PREFERENCES)
})

test('age filter keeps the exact boundary and orders by newest activity', () => {
  const threeHours = 3 * 60 * 60 * 1000
  const rows = [session('old', threeHours + 1), session('edge', threeHours), session('new', 1)]
  assert.deepEqual(visibleSessions(list(rows), [], '3h', NOW).map(row => row.id), ['new', 'edge'])
})

test('all filter removes archived, blank and subagent summaries', () => {
  const rows = [
    session('normal', 100), session('archive', 50), session('blank', 10, { blank: true }),
    session('child', 1, { origin: 'subagent' }),
  ]
  assert.deepEqual(visibleSessions(list(rows), ['archive'], 'all', NOW).map(row => row.id), ['normal'])
})

test('project grouping follows workspace membership and keeps an ungrouped bucket', () => {
  const rows = [session('a', 1), session('b', 2), session('c', 3)]
  const workspaces = [
    { workspaceId: 'w1', title: 'One', sessionIds: ['a', 'missing'] },
    { workspaceId: 'w2', title: 'Two', sessionIds: ['b'] },
  ]
  const groups = groupSessions(rows, workspaces, 'No project')
  assert.deepEqual(groups.map(group => [group.title, group.sessions.map(item => item.id)]), [
    ['One', ['a']], ['Two', ['b']], ['No project', ['c']],
  ])
  assert.equal(workspaceBySession(workspaces).get('b').workspaceId, 'w2')
})

test('project groups are ordered by their newest session activity', () => {
  const rows = [session('old', 9_000), session('new', 100), session('middle', 1_000)]
  const groups = groupSessions(rows, [
    { workspaceId: 'old-workspace', title: 'Old', sessionIds: ['old'] },
    { workspaceId: 'new-workspace', title: 'New', sessionIds: ['new'] },
    { workspaceId: 'middle-workspace', title: 'Middle', sessionIds: ['middle'] },
  ], 'No project')
  assert.deepEqual(groups.map(group => group.title), ['New', 'Middle', 'Old'])
})

test('project label keeps the final two folders for unix and windows paths', () => {
  assert.equal(projectLabel('/home/user/workspace/sessions_list'), 'workspace/sessions_list')
  assert.equal(projectLabel('C:\\Users\\me\\project\\plugin\\'), 'project/plugin')
  assert.equal(projectLabel('', 'Fallback'), 'Fallback')
})

test('project color is stable and distinguishes identities', () => {
  assert.equal(projectHue('alpha'), projectHue('alpha'))
  assert.notEqual(projectHue('alpha'), projectHue('beta'))
  assert.ok(projectHue('alpha') >= 0 && projectHue('alpha') < 360)
})

test('relative activity uses minute, hour and day buckets', () => {
  const labels = { now: 'now', minutes: n => `${n}m`, hours: n => `${n}h`, days: n => `${n}d` }
  assert.equal(relativeActivity(NOW - 1_000, NOW, labels), 'now')
  assert.equal(relativeActivity(NOW - 5 * 60_000, NOW, labels), '5m')
  assert.equal(relativeActivity(NOW - 6 * 3_600_000, NOW, labels), '6h')
  assert.equal(relativeActivity(NOW - 3 * 86_400_000, NOW, labels), '3d')
})
