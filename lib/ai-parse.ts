import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export interface ParsedMeeting {
  organization: string
  summary: string
  actionItems: {
    title: string
    assignee: string
    dueDate: string
  }[]
}

export async function parseMeetingNote(
  title: string,
  content: string,
  knownAccounts: string[],
  nextStepsSection?: string
): Promise<ParsedMeeting> {
  const accountList = knownAccounts.join(', ')

  const nextStepsContext = nextStepsSection
    ? `\n\nEXTRACTED NEXT STEPS SECTION (use these as the primary source for action items):\n${nextStepsSection}`
    : ''

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are parsing meeting notes to extract structured data. Here are the known account/organization names in our system: [${accountList}]

Meeting title: ${title}

Meeting content:
${content}${nextStepsContext}

Extract the following as JSON (no markdown, just raw JSON):
{
  "organization": "the account/organization name this meeting was about — use the closest match from the known accounts list if possible, otherwise use the name from the notes",
  "summary": "a 1-2 sentence summary of the meeting",
  "actionItems": [
    {
      "title": "specific, concrete action item or next step",
      "assignee": "person responsible (use first name only: Annie, Genesis, Sam, Gab, or Krissy if they match, otherwise the name from the notes)",
      "dueDate": "YYYY-MM-DD if mentioned, otherwise empty string"
    }
  ]
}

IMPORTANT for actionItems:
- Look specifically for sections titled "Next Steps", "Action Items", "Follow-up Actions", or "Immediate Actions" in the content — these contain the real tasks.
- Each action item should be a specific, discrete task (e.g. "Send calendar invite for technical meeting" NOT "Discussed potential partnership").
- Do NOT include general discussion points or summary bullets as action items.
- If a next step has sub-items (like a list of questions to address), create ONE action item for the parent task, not separate items for each sub-point.
- If no concrete action items or next steps are found, return an empty array.
- If the organization can't be determined, use the meeting title.

Return ONLY valid JSON.`,
      },
    ],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''

  // Extract JSON from the response (handle potential markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { organization: title, summary: '', actionItems: [] }
  }

  try {
    return JSON.parse(jsonMatch[0]) as ParsedMeeting
  } catch {
    return { organization: title, summary: '', actionItems: [] }
  }
}
