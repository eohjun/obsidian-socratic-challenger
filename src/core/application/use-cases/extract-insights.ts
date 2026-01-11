/**
 * ExtractInsightsUseCase
 * Extracts insights from Socratic dialogue and suggests new note topics.
 */

import type { DialogueSession } from '../../domain/entities/dialogue-session';
import type { ILLMProvider, LLMResponse } from '../../domain/interfaces/llm-provider.interface';

export interface Insight {
  title: string;
  description: string;
  category: 'discovery' | 'perspective' | 'question' | 'connection';
}

export interface NoteTopic {
  title: string;
  description: string;
  suggestedTags: string[];
}

export interface ExtractInsightsInput {
  session: DialogueSession;
}

export interface ExtractInsightsOutput {
  insights: Insight[];
  noteTopics: NoteTopic[];
  unansweredQuestions: string[];
  noteEnhancements: string[];
  rawResponse?: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are an expert at analyzing Socratic dialogues to extract key insights.

Analyze the dialogue where the user answered questions about their note to derive:
1. Key insights discovered through the dialogue
2. Topics that could be developed into new permanent notes (Zettelkasten)
3. Questions that remain unresolved
4. Content that would be good to add to the original note

**Insight Categories:**
- discovery: Newly discovered insights or realizations
- perspective: New viewpoints or perspectives
- question: Questions worth further exploration
- connection: Connection points with other concepts

**Principles for Note Topic Suggestions:**
- Atomic: Should contain only one idea
- Standalone: Should be understandable without context
- Linkable: Should be connectable to other notes`;

function buildUserPrompt(session: DialogueSession): string {
  const history = session.getHistory();

  const dialogueText = history
    .map((entry, index) => {
      const q = `Q${index + 1}. [${entry.question.getTypeDisplayText()}] ${entry.question.content}`;
      const a = entry.response
        ? `A${index + 1}. ${entry.response}`
        : `A${index + 1}. (Unanswered)`;
      return `${q}\n${a}`;
    })
    .join('\n\n');

  return `Analyze the following Socratic dialogue and extract insights.

**Original Note Content:**
---
${session.noteContext}
---

**Question and Answer Dialogue:**
---
${dialogueText}
---

**Response Format:**
Respond in the following JSON format:
\`\`\`json
{
  "insights": [
    {
      "title": "Insight title (concise)",
      "description": "Insight description (2-3 sentences)",
      "category": "discovery|perspective|question|connection"
    }
  ],
  "noteTopics": [
    {
      "title": "New note title (concept-focused, no ID format)",
      "description": "Core content this note will cover",
      "suggestedTags": ["tag1", "tag2"]
    }
  ],
  "unansweredQuestions": [
    "Question not yet explored 1",
    "Question to dig deeper into 2"
  ],
  "noteEnhancements": [
    "Content to add to the original note 1",
    "Perspective to supplement 2"
  ]
}
\`\`\`

**Guidelines:**
- insights: 3-5 items
- noteTopics: 2-3 items (only those truly worth developing into new notes)
- unansweredQuestions: 1-3 items
- noteEnhancements: 1-3 items`;
}

function parseInsightsFromResponse(responseText: string): Omit<ExtractInsightsOutput, 'rawResponse' | 'error'> {
  try {
    // Extract JSON from markdown code block if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();

    const parsed = JSON.parse(jsonStr);

    return {
      insights: (parsed.insights || []).map((i: Insight) => ({
        title: i.title || '',
        description: i.description || '',
        category: i.category || 'discovery',
      })),
      noteTopics: (parsed.noteTopics || []).map((t: NoteTopic) => ({
        title: t.title || '',
        description: t.description || '',
        suggestedTags: t.suggestedTags || [],
      })),
      unansweredQuestions: parsed.unansweredQuestions || [],
      noteEnhancements: parsed.noteEnhancements || [],
    };
  } catch (error) {
    console.error('Failed to parse insights response:', error);
    return {
      insights: [],
      noteTopics: [],
      unansweredQuestions: [],
      noteEnhancements: [],
    };
  }
}

export class ExtractInsightsUseCase {
  constructor(private readonly llmProvider: ILLMProvider) {}

  async execute(input: ExtractInsightsInput): Promise<ExtractInsightsOutput> {
    const { session } = input;

    // Check if there are answered questions
    const answeredQuestions = session.getAnsweredQuestions();
    if (answeredQuestions.length === 0) {
      return {
        insights: [],
        noteTopics: [],
        unansweredQuestions: [],
        noteEnhancements: [],
        error: 'At least one question must be answered to extract insights.',
      };
    }

    const userPrompt = buildUserPrompt(session);

    const response: LLMResponse = await this.llmProvider.simpleGenerate(
      userPrompt,
      SYSTEM_PROMPT,
      {
        maxTokens: 3000,
        temperature: 0.7,
      }
    );

    if (!response.success) {
      return {
        insights: [],
        noteTopics: [],
        unansweredQuestions: [],
        noteEnhancements: [],
        error: response.error ?? 'LLM request failed.',
        rawResponse: response.content,
      };
    }

    const result = parseInsightsFromResponse(response.content);

    if (result.insights.length === 0 && result.noteTopics.length === 0) {
      return {
        ...result,
        error: 'Failed to extract insights. The responses may be too short.',
        rawResponse: response.content,
      };
    }

    return {
      ...result,
      rawResponse: response.content,
    };
  }
}
