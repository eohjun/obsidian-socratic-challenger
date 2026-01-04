/**
 * QuestionType Value Object
 * 소크라테스식 질문의 5가지 유형을 정의합니다.
 */

export enum QuestionTypeEnum {
  /** 가정 도전: 숨겨진 전제와 가정을 검토 */
  ASSUMPTION = 'ASSUMPTION',
  /** 관점 전환: 다른 시각에서 바라보기 */
  PERSPECTIVE = 'PERSPECTIVE',
  /** 확장: 더 넓은 맥락과 연결 */
  EXPANSION = 'EXPANSION',
  /** 명확화: 모호한 부분을 구체화 */
  CLARIFICATION = 'CLARIFICATION',
  /** 함의: 결론과 영향 탐구 */
  IMPLICATION = 'IMPLICATION',
}

export type QuestionTypeValue = keyof typeof QuestionTypeEnum;

export interface QuestionTypeInfo {
  type: QuestionTypeEnum;
  displayText: string;
  icon: string;
  promptHint: string;
  description: string;
}

const QUESTION_TYPE_INFO: Record<QuestionTypeEnum, Omit<QuestionTypeInfo, 'type'>> = {
  [QuestionTypeEnum.ASSUMPTION]: {
    displayText: '가정 도전',
    icon: '🔍',
    promptHint: '이 주장의 숨겨진 전제나 가정을 검토하는 질문을 생성하세요.',
    description: '숨겨진 전제와 당연시되는 가정을 검토합니다.',
  },
  [QuestionTypeEnum.PERSPECTIVE]: {
    displayText: '관점 전환',
    icon: '👁️',
    promptHint: '다른 관점이나 시각에서 이 아이디어를 바라보는 질문을 생성하세요.',
    description: '다른 입장이나 시간대에서 바라보는 시각을 탐구합니다.',
  },
  [QuestionTypeEnum.EXPANSION]: {
    displayText: '확장',
    icon: '🌐',
    promptHint: '이 아이디어를 더 넓은 맥락에서 연결하거나 확장하는 질문을 생성하세요.',
    description: '더 넓은 맥락과 다른 영역과의 연결을 탐구합니다.',
  },
  [QuestionTypeEnum.CLARIFICATION]: {
    displayText: '명확화',
    icon: '💡',
    promptHint: '모호하거나 불명확한 부분을 구체화하는 질문을 생성하세요.',
    description: '모호한 개념이나 표현을 구체화합니다.',
  },
  [QuestionTypeEnum.IMPLICATION]: {
    displayText: '함의',
    icon: '🎯',
    promptHint: '이 아이디어의 결론, 영향, 한계를 탐구하는 질문을 생성하세요.',
    description: '논리적 결론과 실제적 영향을 탐구합니다.',
  },
};

export class QuestionType {
  private constructor(private readonly value: QuestionTypeEnum) {}

  static create(type: QuestionTypeEnum | QuestionTypeValue): QuestionType {
    const enumValue = typeof type === 'string' ? QuestionTypeEnum[type] : type;
    if (!enumValue || !Object.values(QuestionTypeEnum).includes(enumValue)) {
      throw new Error(`Invalid question type: ${type}`);
    }
    return new QuestionType(enumValue);
  }

  static all(): QuestionType[] {
    return Object.values(QuestionTypeEnum).map((t) => new QuestionType(t));
  }

  getValue(): QuestionTypeEnum {
    return this.value;
  }

  getDisplayText(): string {
    return QUESTION_TYPE_INFO[this.value].displayText;
  }

  getIcon(): string {
    return QUESTION_TYPE_INFO[this.value].icon;
  }

  getPromptHint(): string {
    return QUESTION_TYPE_INFO[this.value].promptHint;
  }

  getDescription(): string {
    return QUESTION_TYPE_INFO[this.value].description;
  }

  getInfo(): QuestionTypeInfo {
    return {
      type: this.value,
      ...QUESTION_TYPE_INFO[this.value],
    };
  }

  equals(other: QuestionType): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
