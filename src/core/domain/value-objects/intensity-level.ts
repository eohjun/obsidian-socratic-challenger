/**
 * IntensityLevel Value Object
 * 질문의 강도 수준을 정의합니다.
 */

export enum IntensityLevelEnum {
  /** 부드러운: 격려하며 탐구를 유도 */
  GENTLE = 'GENTLE',
  /** 보통: 균형 잡힌 도전적 질문 */
  MODERATE = 'MODERATE',
  /** 도전적: 강하게 논증을 검증 */
  CHALLENGING = 'CHALLENGING',
}

export type IntensityLevelValue = keyof typeof IntensityLevelEnum;

export interface IntensityLevelInfo {
  level: IntensityLevelEnum;
  displayText: string;
  promptModifier: string;
  description: string;
  cssClass: string;
}

const INTENSITY_LEVEL_INFO: Record<IntensityLevelEnum, Omit<IntensityLevelInfo, 'level'>> = {
  [IntensityLevelEnum.GENTLE]: {
    displayText: '부드러움',
    promptModifier: '친근하고 격려하는 톤으로, 탐구를 유도하며 부담 없이 생각해볼 수 있는',
    description: '격려하며 부드럽게 탐구를 유도합니다.',
    cssClass: 'intensity-gentle',
  },
  [IntensityLevelEnum.MODERATE]: {
    displayText: '보통',
    promptModifier: '균형 잡힌 톤으로, 적절히 도전적이면서도 건설적인',
    description: '균형 잡힌 도전적 질문을 제시합니다.',
    cssClass: 'intensity-moderate',
  },
  [IntensityLevelEnum.CHALLENGING]: {
    displayText: '도전적',
    promptModifier: '직접적이고 날카로운 톤으로, 논증의 약점을 정면으로 파고드는',
    description: '강하게 논증을 검증하고 약점을 지적합니다.',
    cssClass: 'intensity-challenging',
  },
};

export class IntensityLevel {
  private constructor(private readonly value: IntensityLevelEnum) {}

  static create(level: IntensityLevelEnum | IntensityLevelValue): IntensityLevel {
    const enumValue = typeof level === 'string' ? IntensityLevelEnum[level] : level;
    if (!enumValue || !Object.values(IntensityLevelEnum).includes(enumValue)) {
      throw new Error(`Invalid intensity level: ${level}`);
    }
    return new IntensityLevel(enumValue);
  }

  static all(): IntensityLevel[] {
    return Object.values(IntensityLevelEnum).map((l) => new IntensityLevel(l));
  }

  static default(): IntensityLevel {
    return new IntensityLevel(IntensityLevelEnum.MODERATE);
  }

  getValue(): IntensityLevelEnum {
    return this.value;
  }

  getDisplayText(): string {
    return INTENSITY_LEVEL_INFO[this.value].displayText;
  }

  getPromptModifier(): string {
    return INTENSITY_LEVEL_INFO[this.value].promptModifier;
  }

  getDescription(): string {
    return INTENSITY_LEVEL_INFO[this.value].description;
  }

  getCssClass(): string {
    return INTENSITY_LEVEL_INFO[this.value].cssClass;
  }

  getInfo(): IntensityLevelInfo {
    return {
      level: this.value,
      ...INTENSITY_LEVEL_INFO[this.value],
    };
  }

  equals(other: IntensityLevel): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
