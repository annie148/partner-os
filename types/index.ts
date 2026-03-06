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
