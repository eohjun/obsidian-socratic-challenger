/**
 * Plugin Settings Types
 */

import type { AIProviderType } from './core/application/services/ai-service';
import { IntensityLevelEnum } from './core/domain/value-objects/intensity-level';
import { QuestionTypeEnum } from './core/domain/value-objects/question-type';

export interface AISettings {
  provider: AIProviderType;
  apiKeys: Partial<Record<AIProviderType, string>>;
  models: Partial<Record<AIProviderType, string>>;
  budgetLimit?: number;
}

export interface DialogueSettings {
  defaultIntensity: IntensityLevelEnum;
  defaultQuestionTypes: QuestionTypeEnum[];
  defaultQuestionCount: number;
  autoSaveDialogue: boolean;
}

export interface SocraticChallengerSettings {
  ai: AISettings;
  dialogue: DialogueSettings;
}

export const DEFAULT_SETTINGS: SocraticChallengerSettings = {
  ai: {
    provider: 'claude',
    apiKeys: {},
    models: {
      claude: 'claude-sonnet-4-6',
      openai: 'gpt-5.4-mini',
      gemini: 'gemini-2.5-flash',
      grok: 'grok-4-1-fast',
    },
    budgetLimit: undefined,
  },
  dialogue: {
    defaultIntensity: IntensityLevelEnum.MODERATE,
    defaultQuestionTypes: [
      QuestionTypeEnum.ASSUMPTION,
      QuestionTypeEnum.PERSPECTIVE,
      QuestionTypeEnum.EXPANSION,
    ],
    defaultQuestionCount: 3,
    autoSaveDialogue: true,
  },
};
