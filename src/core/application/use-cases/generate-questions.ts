/**
 * GenerateQuestionsUseCase
 * 노트 내용을 기반으로 소크라테스식 질문을 생성합니다.
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

const SYSTEM_PROMPT = `당신은 소크라테스식 대화의 전문가입니다.
사용자가 작성한 노트나 아이디어에 대해 깊이 있는 사고를 촉진하는 질문을 생성합니다.

**중요한 원칙:**
- 질문은 반드시 한국어로 작성합니다.
- 질문은 열린 질문 형태로, 예/아니오로 답할 수 없어야 합니다.
- 비판적이지만 공격적이지 않은 톤을 유지합니다.
- 사용자의 사고를 확장하고 깊게 하는 것이 목표입니다.

**질문 유형별 예시:**

🔍 가정 도전 (ASSUMPTION):
- "이 주장이 참이 되려면 어떤 조건이 전제되어야 할까요?"
- "이것이 항상 참이라고 가정하는 근거는 무엇인가요?"
- "이 가정에 반례가 있을 수 있을까요?"

👁️ 관점 전환 (PERSPECTIVE):
- "만약 반대 입장에 있는 사람이라면 이것을 어떻게 볼까요?"
- "10년 후에도 이 관점이 유효할까요?"
- "다른 분야의 전문가는 이것을 어떻게 해석할까요?"

🌐 확장 (EXPANSION):
- "이 아이디어를 다른 영역에 적용하면 어떤 결과가 나올까요?"
- "이것의 한계는 무엇인가요?"
- "더 넓은 맥락에서 이것은 어떤 의미를 가질까요?"

💡 명확화 (CLARIFICATION):
- "'X'라는 개념을 좀 더 구체적으로 정의한다면?"
- "이 아이디어의 핵심을 한 문장으로 표현한다면?"
- "가장 중요한 요소는 무엇인가요?"

🎯 함의 (IMPLICATION):
- "이것이 사실이라면 어떤 결론이 도출되나요?"
- "실제로 적용했을 때 예상되는 결과는 무엇인가요?"
- "이 주장을 받아들이면 포기해야 하는 것은 무엇인가요?"`;

function buildUserPrompt(input: GenerateQuestionsInput): string {
  const intensityModifier = input.intensity.getPromptModifier();
  const questionCount = input.maxQuestions ?? 3;

  const typeDescriptions = input.questionTypes
    .map((type) => {
      const qt = QuestionType.create(type);
      return `- ${qt.getIcon()} ${qt.getDisplayText()}: ${qt.getPromptHint()}`;
    })
    .join('\n');

  return `다음 노트 내용을 분석하고, ${intensityModifier} 질문을 ${questionCount}개 생성해주세요.

**요청하는 질문 유형:**
${typeDescriptions}

**노트 내용:**
---
${input.noteContent}
---

**응답 형식:**
각 질문을 다음 JSON 형식으로 출력하세요:
\`\`\`json
{
  "questions": [
    {"type": "ASSUMPTION", "content": "질문 내용"},
    {"type": "PERSPECTIVE", "content": "질문 내용"},
    ...
  ]
}
\`\`\`

질문 유형은 반드시 요청된 유형 중에서 선택하세요.`;
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
        if (trimmed.includes('🔍') || trimmed.includes('가정')) {
          type = QuestionTypeEnum.ASSUMPTION;
        } else if (trimmed.includes('👁️') || trimmed.includes('관점')) {
          type = QuestionTypeEnum.PERSPECTIVE;
        } else if (trimmed.includes('🌐') || trimmed.includes('확장')) {
          type = QuestionTypeEnum.EXPANSION;
        } else if (trimmed.includes('💡') || trimmed.includes('명확')) {
          type = QuestionTypeEnum.CLARIFICATION;
        } else if (trimmed.includes('🎯') || trimmed.includes('함의')) {
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
        error: '노트 내용이 비어있습니다.',
      };
    }

    if (input.questionTypes.length === 0) {
      return {
        questions: [],
        error: '질문 유형을 하나 이상 선택해주세요.',
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
        error: response.error ?? 'LLM 요청에 실패했습니다.',
        rawResponse: response.content,
      };
    }

    const questions = parseQuestionsFromResponse(response.content);

    if (questions.length === 0) {
      return {
        questions: [],
        error: '질문을 생성하지 못했습니다. 노트 내용이 너무 짧거나 모호할 수 있습니다.',
        rawResponse: response.content,
      };
    }

    return {
      questions,
      rawResponse: response.content,
    };
  }
}
