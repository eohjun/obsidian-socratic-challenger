/**
 * GenerateQuestionsUseCase
 * Generates Socratic questions based on note content.
 */

import { Question } from '../../domain/entities/question';
import { QuestionType, QuestionTypeEnum } from '../../domain/value-objects/question-type';
import { IntensityLevel } from '../../domain/value-objects/intensity-level';
import type { ILLMProvider, LLMResponse } from '../../domain/interfaces/llm-provider.interface';

export interface GenerateQuestionsInput {
  noteContent: string;
  questionTypes: QuestionTypeEnum[];
  intensity: IntensityLevel;
  maxQuestions?: number;
}

export interface GenerateQuestionsOutput {
  questions: Question[];
  rawResponse?: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are an expert in Socratic dialogue.
You generate thought-provoking questions about notes or ideas written by the user.

**Key Principles:**
- Questions must be open-ended and cannot be answered with yes/no.
- Maintain a critical but non-aggressive tone.
- The goal is to expand and deepen the user's thinking.

**Examples by Question Type:**

🔍 Assumption Challenge (ASSUMPTION):
- "What conditions must be assumed for this claim to be true?"
- "What is the basis for assuming this is always true?"
- "Could there be counterexamples to this assumption?"

👁️ Perspective Shift (PERSPECTIVE):
- "How would someone with the opposite position view this?"
- "Will this perspective still be valid in 10 years?"
- "How might an expert from a different field interpret this?"

🌐 Expansion (EXPANSION):
- "What would happen if this idea were applied to other domains?"
- "What are the limitations of this?"
- "What meaning does this have in a broader context?"

💡 Clarification (CLARIFICATION):
- "How would you define the concept of 'X' more specifically?"
- "How would you express the core of this idea in one sentence?"
- "What is the most important element?"

🎯 Implication (IMPLICATION):
- "If this is true, what conclusions follow?"
- "What results would you expect when applied in practice?"
- "What would you have to give up by accepting this claim?"`;

function buildUserPrompt(input: GenerateQuestionsInput): string {
  const intensityModifier = input.intensity.getPromptModifier();
  const questionCount = input.maxQuestions ?? 3;

  const typeDescriptions = input.questionTypes
    .map((type) => {
      const qt = QuestionType.create(type);
      return `- ${qt.getIcon()} ${qt.getDisplayText()}: ${qt.getPromptHint()}`;
    })
    .join('\n');

  return `Analyze the following note content and generate ${questionCount} questions ${intensityModifier}.

**Requested Question Types:**
${typeDescriptions}

**Note Content:**
---
${input.noteContent}
---

**Response Format:**
Output each question in the following JSON format:
\`\`\`json
{
  "questions": [
    {"type": "ASSUMPTION", "content": "Question content"},
    {"type": "PERSPECTIVE", "content": "Question content"},
    ...
  ]
}
\`\`\`

Question types must be selected from the requested types only.`;
}

function parseQuestionsFromResponse(responseText: string): Question[] {
  try {
    // Extract JSON from markdown code block if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();

    const parsed = JSON.parse(jsonStr);
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid response format: missing questions array');
    }

    return parsed.questions.map((q: { type: string; content: string }) => {
      const questionType = QuestionType.create(q.type as QuestionTypeEnum);
      return Question.create(questionType, q.content);
    });
  } catch (error) {
    // Fallback: try to extract questions from plain text
    const questions: Question[] = [];
    const lines = responseText.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes('?')) {
        // Try to detect question type from emoji or keyword
        let type = QuestionTypeEnum.ASSUMPTION;
        if (trimmed.includes('🔍') || trimmed.toLowerCase().includes('assumption')) {
          type = QuestionTypeEnum.ASSUMPTION;
        } else if (trimmed.includes('👁️') || trimmed.toLowerCase().includes('perspective')) {
          type = QuestionTypeEnum.PERSPECTIVE;
        } else if (trimmed.includes('🌐') || trimmed.toLowerCase().includes('expansion')) {
          type = QuestionTypeEnum.EXPANSION;
        } else if (trimmed.includes('💡') || trimmed.toLowerCase().includes('clarif')) {
          type = QuestionTypeEnum.CLARIFICATION;
        } else if (trimmed.includes('🎯') || trimmed.toLowerCase().includes('implic')) {
          type = QuestionTypeEnum.IMPLICATION;
        }

        // Clean up the question text
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

export class GenerateQuestionsUseCase {
  constructor(private readonly llmProvider: ILLMProvider) {}

  async execute(input: GenerateQuestionsInput): Promise<GenerateQuestionsOutput> {
    if (!input.noteContent.trim()) {
      return {
        questions: [],
        error: 'Note content is empty.',
      };
    }

    if (input.questionTypes.length === 0) {
      return {
        questions: [],
        error: 'Please select at least one question type.',
      };
    }

    const userPrompt = buildUserPrompt(input);

    const response: LLMResponse = await this.llmProvider.simpleGenerate(
      userPrompt,
      SYSTEM_PROMPT,
      {
        maxTokens: 2000,
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
        error: 'Failed to generate questions. The note content may be too short or ambiguous.',
        rawResponse: response.content,
      };
    }

    return {
      questions,
      rawResponse: response.content,
    };
  }
}
