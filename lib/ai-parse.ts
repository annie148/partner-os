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
  knownAccounts: string[]
): Promise<ParsedMeeting> {
  const accountList = knownAccounts.join(', ')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are parsing meeting notes to extract structured data. Here are the known account/organization names in our system: [${accountList}]

Meeting title: ${title}

Meeting content:
${content}

Extract the following as JSON (no markdown, just raw JSON):
{
  "organization": "the account/organization name this meeting was about — use the closest match from the known accounts list if possible, otherwise use the name from the notes",
  "summary": "a 1-2 sentence summary of the meeting",
  "actionItems": [
    {
      "title": "description of the action item",
      "assignee": "person responsible (use first name only: Annie, Sam, or Gab if they match, otherwise the name from the notes)",
      "dueDate": "YYYY-MM-DD if mentioned, otherwise empty string"
    }
  ]
}

If no action items are found, return an empty array. If the organization can't be determined, use the meeting title. Return ONLY valid JSON.`,
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
