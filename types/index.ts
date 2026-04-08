export type AccountType =
  | 'Prospective Funder'
  | 'Current Funder'
  | 'Former Funder'
  | 'Declined Funder'
  | 'Prospective'
  | 'Current Partner'
  | 'Indirect Partner'
  | 'Declined Partner'
  | 'Past Partner'
  | 'Other - Education'
  | 'Other - Funder'

// School/District type constants
export const SCHOOL_TYPES: AccountType[] = [
  'Prospective',
  'Current Partner',
  'Indirect Partner',
  'Declined Partner',
  'Past Partner',
  'Other - Education',
]

export type Priority = 'High' | 'Medium' | 'Low'
export type Owner = 'Annie' | 'Genesis' | 'Sam' | 'Gab' | 'Krissy'
export type TaskStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Complete'
export type TaskType = 'Follow-up' | 'Outreach' | 'Internal' | 'Other'

export type AskStatus =
  | 'Committed'
  | 'Submitted/Ask Made'
  | 'Declined'
  | 'Need to Qualify'
  | 'Cultivating'
  | 'Received'
  | 'No Ask'

export type EngagementType = 'High Level' | 'Medium Level' | 'Low Level'
export type AccountLevel = 'District' | 'CMO' | 'School' | ''

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
  granolaNotesUrl: string
  obcStatus: string
  contractCap: string
  dsaStatus: string
  district: string
  parentDistrictId: string
  accountLevel: AccountLevel
  mouStatus: string
  dataReceived: string
  districtAssessmentMath: string
  districtAssessmentReading: string
  testWindow: string
  matchedStudents: string
  assessmentFollowUpNotes: string
}

export interface Region {
  regionName: string
  regionGoalSY26: string
  regionGoalSY27: string
  currentStatus: string
  openQuestions: string
  nextMoves: string
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

export type ActivityType = 'Call' | 'Email' | 'Meeting' | 'Note' | 'Other'

export interface Activity {
  id: string
  accountId: string
  date: string
  type: ActivityType
  description: string
  loggedBy: string
  sourceId: string
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
  region: string
  completedDate: string
  type: TaskType
}
