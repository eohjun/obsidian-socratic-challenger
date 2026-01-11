/**
 * IntensityLevel Value Object
 * Defines the intensity levels for Socratic questions.
 */

export enum IntensityLevelEnum {
  /** Gentle: Encourages exploration with a supportive tone */
  GENTLE = 'GENTLE',
  /** Moderate: Balanced challenging questions */
  MODERATE = 'MODERATE',
  /** Challenging: Strongly examines arguments */
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
    displayText: 'Gentle',
    promptModifier: 'with a friendly and encouraging tone, guiding exploration in a low-pressure way',
    description: 'Encourages exploration with gentle, supportive guidance.',
    cssClass: 'intensity-gentle',
  },
  [IntensityLevelEnum.MODERATE]: {
    displayText: 'Moderate',
    promptModifier: 'with a balanced tone that is appropriately challenging yet constructive',
    description: 'Presents balanced, challenging questions.',
    cssClass: 'intensity-moderate',
  },
  [IntensityLevelEnum.CHALLENGING]: {
    displayText: 'Challenging',
    promptModifier: 'with a direct and sharp tone, probing deeply into argument weaknesses',
    description: 'Strongly examines arguments and identifies weaknesses.',
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
