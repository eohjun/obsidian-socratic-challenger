/**
 * ExtractInsightsUseCase
 * 소크라테스식 대화에서 인사이트를 추출하고 새 노트 주제를 제안합니다.
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

const SYSTEM_PROMPT = `당신은 소크라테스식 대화를 분석하여 핵심 인사이트를 추출하는 전문가입니다.

사용자가 노트에 대해 질문을 받고 답변한 대화 내용을 분석하여:
1. 대화를 통해 발견된 핵심 인사이트
2. 새로운 영구 노트(Zettelkasten)로 발전시킬 수 있는 주제
3. 아직 해결되지 않은 질문들
4. 원본 노트에 추가하면 좋을 내용

을 도출합니다.

**인사이트 카테고리:**
- discovery: 새롭게 발견된 통찰 또는 깨달음
- perspective: 새로운 관점 또는 시각
- question: 더 탐구할 가치가 있는 질문
- connection: 다른 개념과의 연결점

**노트 주제 제안 원칙:**
- 원자적(atomic): 하나의 아이디어만 담을 것
- 독립적(standalone): 맥락 없이도 이해 가능할 것
- 연결 가능(linkable): 다른 노트와 연결될 수 있을 것

모든 응답은 한국어로 작성합니다.`;

function buildUserPrompt(session: DialogueSession): string {
  const history = session.getHistory();

  const dialogueText = history
    .map((entry, index) => {
      const q = `Q${index + 1}. [${entry.question.getTypeDisplayText()}] ${entry.question.content}`;
      const a = entry.response
        ? `A${index + 1}. ${entry.response}`
        : `A${index + 1}. (미답변)`;
      return `${q}\n${a}`;
    })
    .join('\n\n');

  return `다음 소크라테스식 대화를 분석하고 인사이트를 추출해주세요.

**원본 노트 내용:**
---
${session.noteContext}
---

**질문과 답변 대화:**
---
${dialogueText}
---

**응답 형식:**
다음 JSON 형식으로 응답하세요:
\`\`\`json
{
  "insights": [
    {
      "title": "인사이트 제목 (간결하게)",
      "description": "인사이트 설명 (2-3문장)",
      "category": "discovery|perspective|question|connection"
    }
  ],
  "noteTopics": [
    {
      "title": "새 노트 제목 (YYYYMMDDHHmm 형식 ID 없이, 개념 중심)",
      "description": "이 노트가 다룰 핵심 내용",
      "suggestedTags": ["tag1", "tag2"]
    }
  ],
  "unansweredQuestions": [
    "아직 탐구되지 않은 질문 1",
    "더 깊이 파고들 질문 2"
  ],
  "noteEnhancements": [
    "원본 노트에 추가하면 좋을 내용 1",
    "보완하면 좋을 관점 2"
  ]
}
\`\`\`

**주의사항:**
- insights는 3-5개
- noteTopics는 2-3개 (정말 새 노트로 발전시킬 가치가 있는 것만)
- unansweredQuestions는 1-3개
- noteEnhancements는 1-3개`;
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
        error: '인사이트를 추출하려면 최소 하나 이상의 질문에 답변해야 합니다.',
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
        error: response.error ?? 'LLM 요청에 실패했습니다.',
        rawResponse: response.content,
      };
    }

    const result = parseInsightsFromResponse(response.content);

    if (result.insights.length === 0 && result.noteTopics.length === 0) {
      return {
        ...result,
        error: '인사이트를 추출하지 못했습니다. 답변이 너무 짧을 수 있습니다.',
        rawResponse: response.content,
      };
    }

    return {
      ...result,
      rawResponse: response.content,
    };
  }
}
