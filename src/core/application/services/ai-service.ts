/**
 * AIService
 * Unified LLM provider management service
 */

import type { ILLMProvider, LLMMessage, LLMResponse, LLMGenerateOptions } from '../../domain/interfaces/llm-provider.interface';

export type AIProviderType = 'claude' | 'openai' | 'gemini' | 'grok';

export interface AISettings {
  provider: AIProviderType;
  apiKeys: Partial<Record<AIProviderType, string>>;
  models: Partial<Record<AIProviderType, string>>;
  budgetLimit?: number;
}

export class AIService {
  private providers: Map<AIProviderType, ILLMProvider> = new Map();
  private settings: AISettings;

  constructor(settings: AISettings) {
    this.settings = settings;
  }

  /**
   * Register a provider
   */
  registerProvider(type: AIProviderType, provider: ILLMProvider): void {
    this.providers.set(type, provider);
  }

  /**
   * Update settings
   */
  updateSettings(settings: AISettings): void {
    this.settings = settings;
  }

  /**
   * Get current provider
   */
  getCurrentProvider(): ILLMProvider | undefined {
    return this.providers.get(this.settings.provider);
  }

  /**
   * Get current API key
   */
  getCurrentApiKey(): string | undefined {
    return this.settings.apiKeys[this.settings.provider];
  }

  /**
   * Get current model
   */
  getCurrentModel(): string | undefined {
    return this.settings.models[this.settings.provider];
  }

  /**
   * Check if provider is available
   */
  isAvailable(): boolean {
    const provider = this.getCurrentProvider();
    const apiKey = this.getCurrentApiKey();
    return !!provider && !!apiKey;
  }

  /**
   * Generate text
   */
  async generateText(
    messages: LLMMessage[],
    options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    const provider = this.getCurrentProvider();

    if (!provider) {
      return { success: false, content: '', error: 'No provider selected.' };
    }

    if (!provider.isAvailable()) {
      return { success: false, content: '', error: 'API key is not configured.' };
    }

    return provider.generate(messages, options);
  }

  /**
   * Simple text generation
   */
  async simpleGenerate(
    userPrompt: string,
    systemPrompt?: string,
    options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    const messages: LLMMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });
    return this.generateText(messages, options);
  }

  /**
   * List of registered providers
   */
  getAvailableProviders(): AIProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if provider is configured
   */
  isProviderConfigured(provider: AIProviderType): boolean {
    return !!this.settings.apiKeys[provider];
  }
}

// Singleton management
let aiServiceInstance: AIService | null = null;

export function initializeAIService(settings: AISettings): AIService {
  aiServiceInstance = new AIService(settings);
  return aiServiceInstance;
}

export function getAIService(): AIService | null {
  return aiServiceInstance;
}

export function updateAIServiceSettings(settings: AISettings): void {
  if (aiServiceInstance) {
    aiServiceInstance.updateSettings(settings);
  }
}

export function resetAIService(): void {
  aiServiceInstance = null;
}
