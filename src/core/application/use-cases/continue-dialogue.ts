/**
 * ContinueDialogueUseCase
 * 이전 대화 맥락을 기반으로 후속 질문을 생성합니다.
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

const SYSTEM_PROMPT = `당신은 소크라테스식 대화의 전문가입니다.
이전 대화 맥락을 바탕으로 더 깊은 탐구를 위한 후속 질문을 생성합니다.

**중요한 원칙:**
- 질문은 반드시 한국어로 작성합니다.
- 이전 응답에서 발견된 새로운 가정이나 아이디어를 파고듭니다.
- 사용자가 놓쳤을 수 있는 부분을 탐구합니다.
- 사고를 한 단계 더 깊게 하는 것이 목표입니다.
- 이전과 중복되는 질문은 피합니다.`;

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
        r ? `A${index + 1}. ${r}` : '(아직 답변 없음)'
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

  return `다음 대화를 분석하고, ${intensityModifier} 후속 질문을 ${questionCount}개 생성해주세요.

**원본 노트:**
---
${session.noteContext}
---

**지금까지의 대화:**
---
${historyText}
---

**가장 최근 교환:**
질문: ${lastExchange?.question.content ?? '(없음)'}
응답: ${lastExchange?.response ?? '(없음)'}

**요청하는 질문 유형:**
${typeDescriptions}

**응답 형식:**
\`\`\`json
{
  "questions": [
    {"type": "EXPANSION", "content": "후속 질문 내용"},
    {"type": "IMPLICATION", "content": "후속 질문 내용"}
  ]
}
\`\`\`

사용자의 마지막 응답에서 발견된 새로운 가정, 함의, 또는 확장 가능한 아이디어를 파고드세요.
이전에 이미 물어본 질문과 중복되지 않도록 하세요.`;
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
        if (trimmed.includes('가정') || trimmed.includes('🔍')) {
          type = QuestionTypeEnum.ASSUMPTION;
        } else if (trimmed.includes('함의') || trimmed.includes('🎯')) {
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
        error: '후속 질문을 생성하려면 먼저 하나 이상의 질문에 답변해주세요.',
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
        error: response.error ?? 'LLM 요청에 실패했습니다.',
        rawResponse: response.content,
      };
    }

    const questions = parseQuestionsFromResponse(response.content);

    if (questions.length === 0) {
      return {
        questions: [],
        error: '후속 질문을 생성하지 못했습니다.',
        rawResponse: response.content,
      };
    }

    return {
      questions,
      rawResponse: response.content,
    };
  }
}
