/**
 * ContinueDialogueUseCase
 * Generates follow-up questions based on previous dialogue context.
 */

import { DialogueSession } from '../../domain/entities/dialogue-session';
import { Question } from '../../domain/entities/question';
import { QuestionType, QuestionTypeEnum } from '../../domain/value-objects/question-type';
import type { ILLMProvider, LLMResponse } from '../../domain/interfaces/llm-provider.interface';

export interface ContinueDialogueInput {
  session: DialogueSession;
  questionTypes?: QuestionTypeEnum[];
  maxQuestions?: number;
}

export interface ContinueDialogueOutput {
  questions: Question[];
  rawResponse?: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are an expert in Socratic dialogue.
You generate follow-up questions for deeper exploration based on the previous dialogue context.

**Key Principles:**
- Dig into new assumptions or ideas discovered in previous responses.
- Explore areas the user may have overlooked.
- The goal is to deepen thinking one step further.
- Avoid questions that duplicate previous ones.`;

function buildContinuePrompt(input: ContinueDialogueInput): string {
  const session = input.session;
  const history = session.getHistory();
  const lastExchange = session.getLastExchange();
  const intensityModifier = session.intensity.getPromptModifier();
  const questionCount = input.maxQuestions ?? 2;

  // Build conversation history
  const historyText = history
    .map((entry, index) => {
      const q = entry.question;
      const r = entry.response;
      return `Q${index + 1}. ${q.getTypeIcon()} ${q.content}\n${
        r ? `A${index + 1}. ${r}` : '(No answer yet)'
      }`;
    })
    .join('\n\n');

  // Question types to use
  const questionTypes = input.questionTypes ?? [
    QuestionTypeEnum.ASSUMPTION,
    QuestionTypeEnum.EXPANSION,
    QuestionTypeEnum.IMPLICATION,
  ];

  const typeDescriptions = questionTypes
    .map((type) => {
      const qt = QuestionType.create(type);
      return `- ${qt.getIcon()} ${qt.getDisplayText()}`;
    })
    .join('\n');

  return `Analyze the following dialogue and generate ${questionCount} follow-up questions ${intensityModifier}.

**Original Note:**
---
${session.noteContext}
---

**Dialogue So Far:**
---
${historyText}
---

**Most Recent Exchange:**
Question: ${lastExchange?.question.content ?? '(None)'}
Response: ${lastExchange?.response ?? '(None)'}

**Requested Question Types:**
${typeDescriptions}

**Response Format:**
\`\`\`json
{
  "questions": [
    {"type": "EXPANSION", "content": "Follow-up question content"},
    {"type": "IMPLICATION", "content": "Follow-up question content"}
  ]
}
\`\`\`

Dig into new assumptions, implications, or expandable ideas discovered in the user's last response.
Ensure questions do not duplicate those already asked.`;
}

function parseQuestionsFromResponse(responseText: string): Question[] {
  try {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();

    const parsed = JSON.parse(jsonStr);
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid response format');
    }

    return parsed.questions.map((q: { type: string; content: string }) => {
      const questionType = QuestionType.create(q.type as QuestionTypeEnum);
      return Question.create(questionType, q.content);
    });
  } catch {
    // Fallback parsing for plain text
    const questions: Question[] = [];
    const lines = responseText.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes('?')) {
        let type = QuestionTypeEnum.EXPANSION;
        if (trimmed.toLowerCase().includes('assumption') || trimmed.includes('🔍')) {
          type = QuestionTypeEnum.ASSUMPTION;
        } else if (trimmed.toLowerCase().includes('implic') || trimmed.includes('🎯')) {
          type = QuestionTypeEnum.IMPLICATION;
        }

        const cleanedContent = trimmed
          .replace(/^[-*•]\s*/, '')
          .replace(/^[🔍👁️🌐💡🎯]\s*/, '')
          .replace(/^\d+\.\s*/, '')
          .trim();

        if (cleanedContent.length > 10) {
          questions.push(Question.create(QuestionType.create(type), cleanedContent));
        }
      }
    }

    return questions;
  }
}

export class ContinueDialogueUseCase {
  constructor(private readonly llmProvider: ILLMProvider) {}

  async execute(input: ContinueDialogueInput): Promise<ContinueDialogueOutput> {
    const session = input.session;

    // Check if there's at least one answered question
    if (session.getAnsweredQuestions().length === 0) {
      return {
        questions: [],
        error: 'Please answer at least one question before generating follow-up questions.',
      };
    }

    const userPrompt = buildContinuePrompt(input);

    const response: LLMResponse = await this.llmProvider.simpleGenerate(
      userPrompt,
      SYSTEM_PROMPT,
      {
        maxTokens: 1500,
        temperature: 0.7,
      }
    );

    if (!response.success) {
      return {
        questions: [],
        error: response.error ?? 'LLM request failed.',
        rawResponse: response.content,
      };
    }

    const questions = parseQuestionsFromResponse(response.content);

    if (questions.length === 0) {
      return {
        questions: [],
        error: 'Failed to generate follow-up questions.',
        rawResponse: response.content,
      };
    }

    return {
      questions,
      rawResponse: response.content,
    };
  }
}
