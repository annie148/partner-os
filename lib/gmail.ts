export const TEAM_EMAILS: Record<string, string> = {
  Annie: 'annie@stepuptutoring.org',
  Genesis: 'genesis@stepuptutoring.org',
  Sam: 'sam@stepuptutoring.org',
  Gab: 'gabriella@stepuptutoring.org',
}

export function getAssigneeEmail(assignee: string): string | null {
  return TEAM_EMAILS[assignee] || null
}

/** Exchange the refresh token for a fresh access token */
async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID || '',
      client_secret: process.env.GMAIL_CLIENT_SECRET || '',
      refresh_token: process.env.GMAIL_REFRESH_TOKEN || '',
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (data.error) {
    throw new Error(`Gmail token error: ${data.error} — ${data.error_description || ''}`)
  }
  return data.access_token
}

function buildMimeMessage(to: string, subject: string, htmlBody: string): string {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
  ].join('\r\n')

  return `${headers}\r\n\r\n${htmlBody}`
}

function toBase64Url(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export interface TaskEmailData {
  taskTitle: string
  taskNotes: string
  accountName: string
  assignee: string
  dueDate: string
}

function buildEmailHtml(data: TaskEmailData): string {
  const dueLine = data.dueDate
    ? `<p style="margin:4px 0"><strong>Due:</strong> ${data.dueDate}</p>`
    : ''
  const accountLine = data.accountName
    ? `<p style="margin:4px 0"><strong>Account:</strong> ${data.accountName}</p>`
    : ''
  const notesLine = data.taskNotes
    ? `<p style="margin:12px 0 4px 0"><strong>Details:</strong></p><p style="margin:4px 0;color:#374151">${data.taskNotes}</p>`
    : ''

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#111827">
      <p>Hi ${data.assignee},</p>
      <p>You have a new task assigned to you:</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0 0 8px 0;font-size:16px;font-weight:600">${data.taskTitle}</p>
        ${accountLine}
        ${dueLine}
        ${notesLine}
      </div>
      <p style="color:#6b7280;font-size:13px">— Partner OS</p>
    </div>
  `
}

function buildReminderHtml(data: TaskEmailData): string {
  const accountLine = data.accountName
    ? `<p style="margin:4px 0"><strong>Account:</strong> ${data.accountName}</p>`
    : ''

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#111827">
      <p>Hi ${data.assignee},</p>
      <p>Friendly reminder — this task is due tomorrow:</p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0 0 8px 0;font-size:16px;font-weight:600">${data.taskTitle}</p>
        ${accountLine}
        <p style="margin:4px 0"><strong>Due:</strong> ${data.dueDate}</p>
      </div>
      <p style="color:#6b7280;font-size:13px">— Partner OS</p>
    </div>
  `
}

/** Send an email immediately via Gmail API */
export async function sendTaskEmail(to: string, data: TaskEmailData): Promise<void> {
  const token = await getAccessToken()
  const subject = `New task: ${data.taskTitle}`
  const html = buildEmailHtml(data)
  const raw = toBase64Url(buildMimeMessage(to, subject, html))

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Gmail send failed: ${JSON.stringify(err)}`)
  }
}

/** Send a due date reminder email */
export async function sendReminderEmail(to: string, data: TaskEmailData): Promise<void> {
  const token = await getAccessToken()
  const subject = `Reminder: "${data.taskTitle}" is due tomorrow`
  const html = buildReminderHtml(data)
  const raw = toBase64Url(buildMimeMessage(to, subject, html))

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Gmail reminder send failed: ${JSON.stringify(err)}`)
  }
}

/** Create a Gmail draft (for Granola-sourced tasks) and return the draft ID */
export async function createTaskDraft(to: string, data: TaskEmailData): Promise<string> {
  const token = await getAccessToken()
  const subject = `New task: ${data.taskTitle}`
  const html = buildEmailHtml(data)
  const raw = toBase64Url(buildMimeMessage(to, subject, html))

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw } }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Gmail draft failed: ${JSON.stringify(err)}`)
  }

  const draft = await res.json()
  return draft.id
}

/** Send an existing Gmail draft by its draft ID */
export async function sendDraft(draftId: string): Promise<void> {
  const token = await getAccessToken()

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: draftId }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Gmail draft send failed: ${JSON.stringify(err)}`)
  }
}

/** Send a daily digest email with overdue, today, and upcoming tasks */
export interface DigestTask {
  title: string
  accountName: string
  dueDate: string
}

export interface TeamMemberDigest {
  assignee: string
  overdue: DigestTask[]
  dueToday: DigestTask[]
  dueThisWeek: DigestTask[]
}

export interface DigestData {
  assignee: string
  dateLabel: string
  overdue: DigestTask[]
  dueToday: DigestTask[]
  dueThisWeek: DigestTask[]
  teamMembers?: TeamMemberDigest[]
}

function buildDigestHtml(data: DigestData): string {
  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function renderSection(title: string, tasks: DigestTask[], color: string, bgColor: string): string {
    if (tasks.length === 0) return ''
    const rows = tasks
      .map(
        (t) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${t.title}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${t.accountName || '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${formatDate(t.dueDate)}</td>
          </tr>`
      )
      .join('')

    return `
      <div style="margin:20px 0">
        <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:0.05em">${title} (${tasks.length})</h3>
        <table style="width:100%;border-collapse:collapse;background:${bgColor};border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500">Task</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500">Account</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500">Due</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }

  function renderTeamMember(member: TeamMemberDigest): string {
    const sections = [
      renderSection('Overdue', member.overdue, '#dc2626', '#fef2f2'),
      renderSection('Due Today', member.dueToday, '#d97706', '#fffbeb'),
      renderSection('Due This Week', member.dueThisWeek, '#2563eb', '#eff6ff'),
    ].filter(Boolean).join('')
    if (!sections) return ''
    return `
      <div style="margin:16px 0 24px 0">
        <h3 style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#374151">${member.assignee}</h3>
        ${sections}
      </div>`
  }

  const teamHtml = (data.teamMembers || [])
    .map(renderTeamMember)
    .filter(Boolean)
    .join('')

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;color:#111827">
      <p>Hi ${data.assignee},</p>
      <p>Here's your Step Up task summary for ${data.dateLabel}:</p>
      <h2 style="margin:24px 0 0 0;font-size:16px;font-weight:700;color:#111827">Your Tasks</h2>
      ${renderSection('Overdue', data.overdue, '#dc2626', '#fef2f2')}
      ${renderSection('Due Today', data.dueToday, '#d97706', '#fffbeb')}
      ${renderSection('Due This Week', data.dueThisWeek, '#2563eb', '#eff6ff')}
      ${teamHtml ? `
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 24px 0" />
        <h2 style="margin:0 0 8px 0;font-size:16px;font-weight:700;color:#111827">Team Tasks</h2>
        ${teamHtml}
      ` : ''}
      <p style="color:#6b7280;font-size:13px;margin-top:24px">— Partner OS</p>
    </div>
  `
}

export async function sendDigestEmail(to: string, data: DigestData): Promise<void> {
  const token = await getAccessToken()
  const subject = `Your Step Up tasks for ${data.dateLabel}`
  const html = buildDigestHtml(data)
  const raw = toBase64Url(buildMimeMessage(to, subject, html))

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Gmail digest send failed: ${JSON.stringify(err)}`)
  }
}

/** EOD Summary Types */
export interface EodTask {
  title: string
  accountName: string
  dueDate: string
  status: string
}

export interface EodOwnerGroup {
  owner: string
  tasks: EodTask[]
}

export interface EodData {
  recipient: string
  dateLabel: string
  completedByOwner: EodOwnerGroup[]
  outstandingByOwner: EodOwnerGroup[]
}

function buildEodHtml(data: EodData): string {
  function formatDate(dateStr: string): string {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  function renderTaskRows(tasks: EodTask[], showStatus: boolean): string {
    return tasks.map((t) => {
      const overdue = t.dueDate && t.dueDate < todayStr && t.status !== 'Complete'
      const dueDateStr = t.dueDate ? formatDate(t.dueDate) : ''
      const dueStyle = overdue ? 'color:#dc2626;font-weight:600' : ''
      const statusColor = t.status === 'Blocked' ? 'color:#d97706' : t.status === 'In Progress' ? 'color:#2563eb' : 'color:#6b7280'
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${t.title}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${t.accountName || '—'}</td>
          ${showStatus ? `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;${statusColor};font-size:12px">${t.status}${overdue ? ' (overdue)' : ''}</td>` : ''}
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;white-space:nowrap;${dueStyle}">${dueDateStr || '—'}</td>
        </tr>`
    }).join('')
  }

  function renderOwnerGroup(group: EodOwnerGroup, showStatus: boolean, bgColor: string): string {
    if (group.tasks.length === 0) return ''
    const statusHeader = showStatus ? '<th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500">Status</th>' : ''
    return `
      <div style="margin:12px 0 20px 0">
        <h4 style="margin:0 0 6px 0;font-size:14px;font-weight:600;color:#374151">${group.owner} (${group.tasks.length})</h4>
        <table style="width:100%;border-collapse:collapse;background:${bgColor};border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500">Task</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500">Account</th>
              ${statusHeader}
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500">Due</th>
            </tr>
          </thead>
          <tbody>${renderTaskRows(group.tasks, showStatus)}</tbody>
        </table>
      </div>`
  }

  const completedHtml = data.completedByOwner.length > 0
    ? data.completedByOwner.map((g) => renderOwnerGroup(g, false, '#f0fdf4')).join('')
    : '<p style="color:#6b7280;font-style:italic;margin:8px 0">No tasks completed today.</p>'

  const outstandingHtml = data.outstandingByOwner.length > 0
    ? data.outstandingByOwner.map((g) => renderOwnerGroup(g, true, '#fff')).join('')
    : '<p style="color:#6b7280;font-style:italic;margin:8px 0">No outstanding tasks.</p>'

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;color:#111827">
      <p>Hi ${data.recipient},</p>
      <p>Here's the end of day summary for ${data.dateLabel}:</p>
      <h2 style="margin:24px 0 8px 0;font-size:16px;font-weight:700;color:#16a34a">Completed Today</h2>
      ${completedHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
      <h2 style="margin:0 0 8px 0;font-size:16px;font-weight:700;color:#111827">Still Outstanding</h2>
      ${outstandingHtml}
      <p style="color:#6b7280;font-size:13px;margin-top:24px">— Partner OS</p>
    </div>
  `
}

export async function sendEodEmail(to: string, data: EodData): Promise<void> {
  const token = await getAccessToken()
  const subject = `End of day summary: ${data.dateLabel}`
  const html = buildEodHtml(data)
  const raw = toBase64Url(buildMimeMessage(to, subject, html))

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Gmail EOD send failed: ${JSON.stringify(err)}`)
  }
}

/** Delete a Gmail draft by its draft ID */
export async function deleteDraft(draftId: string): Promise<void> {
  const token = await getAccessToken()

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draftId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok && res.status !== 404) {
    const err = await res.json()
    throw new Error(`Gmail draft delete failed: ${JSON.stringify(err)}`)
  }
}
