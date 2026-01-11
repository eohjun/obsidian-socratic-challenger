/**
 * QuestionType Value Object
 * Defines the 5 types of Socratic questions.
 */

export enum QuestionTypeEnum {
  /** Assumption Challenge: Examines hidden premises and assumptions */
  ASSUMPTION = 'ASSUMPTION',
  /** Perspective Shift: Views from different angles */
  PERSPECTIVE = 'PERSPECTIVE',
  /** Expansion: Connects with broader contexts */
  EXPANSION = 'EXPANSION',
  /** Clarification: Specifies ambiguous parts */
  CLARIFICATION = 'CLARIFICATION',
  /** Implication: Explores conclusions and impacts */
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
    displayText: 'Assumption',
    icon: '🔍',
    promptHint: 'Generate questions that examine hidden premises or assumptions in this claim.',
    description: 'Examines hidden premises and taken-for-granted assumptions.',
  },
  [QuestionTypeEnum.PERSPECTIVE]: {
    displayText: 'Perspective',
    icon: '👁️',
    promptHint: 'Generate questions that view this idea from different perspectives or angles.',
    description: 'Explores viewpoints from different positions or timeframes.',
  },
  [QuestionTypeEnum.EXPANSION]: {
    displayText: 'Expansion',
    icon: '🌐',
    promptHint: 'Generate questions that connect or expand this idea in broader contexts.',
    description: 'Explores connections with broader contexts and other domains.',
  },
  [QuestionTypeEnum.CLARIFICATION]: {
    displayText: 'Clarification',
    icon: '💡',
    promptHint: 'Generate questions that clarify ambiguous or unclear parts.',
    description: 'Clarifies ambiguous concepts or expressions.',
  },
  [QuestionTypeEnum.IMPLICATION]: {
    displayText: 'Implication',
    icon: '🎯',
    promptHint: 'Generate questions that explore conclusions, impacts, and limitations of this idea.',
    description: 'Explores logical conclusions and practical impacts.',
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
