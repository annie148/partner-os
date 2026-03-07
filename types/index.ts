export type AccountType =
  | 'Prospective Funder'
  | 'Current Funder'
  | 'Former Funder'
  | 'Declined Funder'
  | 'Prospective School/District'
  | 'Current School/District'
  | 'Former School/District'
  | 'Declined School/District'

export type Priority = 'High' | 'Medium' | 'Low'
export type Owner = 'Annie' | 'Sam' | 'Gab'
export type TaskStatus = 'Not Started' | 'In Progress' | 'Complete'

export type AskStatus =
  | 'Committed'
  | 'Submitted/Ask Made'
  | 'Declined'
  | 'Need to Qualify'
  | 'Cultivating'
  | 'Received'
  | 'No Ask'

export type EngagementType = 'High Level' | 'Medium Level' | 'Low Level'

export interface Account {
  id: string
  name: string
  type: AccountType
  region: string
  priority: Priority
  owner: Owner
  lastContactDate: string
  nextFollowUpDate: string
  nextAction: string
  notes: string
  // Funder fields
  askStatus: AskStatus | string
  target: string
  committedAmount: string
  // School/District fields
  goal: string
  principal: string
  engagementType: EngagementType | string
  partnerDashboardLink: string
  partnerEnrollmentToolkit: string
  googleDriveFile: string
  midpointDate: string
  boyData: string
  moyData: string
  eoyData: string
  assessmentName: string
  mathCurriculum: string
  elaCurriculum: string
}

export interface Contact {
  id: string
  accountId: string
  accountName: string
  name: string
  email: string
  phone: string
  role: string
  notes: string
}

export interface Task {
  id: string
  accountId: string
  accountName: string
  title: string
  assignee: Owner
  dueDate: string
  status: TaskStatus
  notes: string
}
