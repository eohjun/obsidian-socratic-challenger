/**
 * Socratic Challenger Plugin
 * AI dialogue partner that asks Socratic questions to deepen thinking
 */

import { Plugin, Notice, TFile } from 'obsidian';
import type { ILLMProvider } from './core/domain/interfaces/llm-provider.interface';
import { AIService, type AIProviderType, initializeAIService, updateAIServiceSettings, getAIService } from './core/application/services/ai-service';
import { ClaudeProvider, OpenAIProvider, GeminiProvider, GrokProvider } from './core/adapters/llm';
import { AI_PROVIDERS } from './core/domain/constants/model-configs';
import { DialogueModal, SocraticChallengerSettingTab } from './views';
import { DEFAULT_SETTINGS, type SocraticChallengerSettings } from './types';

export default class SocraticChallengerPlugin extends Plugin {
  settings!: SocraticChallengerSettings;
  private aiService: AIService | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Initialize AI Service
    this.initializeAIService();

    // Register command
    this.addCommand({
      id: 'start-socratic-dialogue',
      name: 'Start Socratic Dialogue',
      callback: () => this.startDialogue(),
    });

    // Add ribbon icon
    this.addRibbonIcon('message-circle', 'Socratic Challenger', () => {
      this.startDialogue();
    });

    // Add settings tab
    this.addSettingTab(new SocraticChallengerSettingTab(this.app, this));

    // Log successful load
    console.log('Socratic Challenger plugin loaded');
  }

  async onunload(): Promise<void> {
    console.log('Socratic Challenger plugin unloaded');
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();

    // Deep merge settings
    this.settings = {
      ...DEFAULT_SETTINGS,
      ai: {
        ...DEFAULT_SETTINGS.ai,
        apiKeys: { ...DEFAULT_SETTINGS.ai.apiKeys },
        models: { ...DEFAULT_SETTINGS.ai.models },
      },
      dialogue: {
        ...DEFAULT_SETTINGS.dialogue,
        defaultQuestionTypes: [...DEFAULT_SETTINGS.dialogue.defaultQuestionTypes],
      },
    };

    if (loaded) {
      // Merge AI settings
      if (loaded.ai) {
        if (loaded.ai.provider) this.settings.ai.provider = loaded.ai.provider;
        if (loaded.ai.apiKeys) {
          this.settings.ai.apiKeys = { ...this.settings.ai.apiKeys, ...loaded.ai.apiKeys };
        }
        if (loaded.ai.models) {
          this.settings.ai.models = { ...this.settings.ai.models, ...loaded.ai.models };
        }
        if (loaded.ai.budgetLimit !== undefined) {
          this.settings.ai.budgetLimit = loaded.ai.budgetLimit;
        }
      }

      // Merge dialogue settings
      if (loaded.dialogue) {
        if (loaded.dialogue.defaultIntensity) {
          this.settings.dialogue.defaultIntensity = loaded.dialogue.defaultIntensity;
        }
        if (loaded.dialogue.defaultQuestionTypes) {
          this.settings.dialogue.defaultQuestionTypes = loaded.dialogue.defaultQuestionTypes;
        }
        if (loaded.dialogue.defaultQuestionCount !== undefined) {
          this.settings.dialogue.defaultQuestionCount = loaded.dialogue.defaultQuestionCount;
        }
        if (loaded.dialogue.autoSaveDialogue !== undefined) {
          this.settings.dialogue.autoSaveDialogue = loaded.dialogue.autoSaveDialogue;
        }
      }
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.updateAIService();
  }

  private initializeAIService(): void {
    this.aiService = initializeAIService(this.settings.ai);

    // Register all providers
    const providers: [AIProviderType, ILLMProvider][] = [
      ['claude', new ClaudeProvider()],
      ['openai', new OpenAIProvider()],
      ['gemini', new GeminiProvider()],
      ['grok', new GrokProvider()],
    ];

    providers.forEach(([type, provider]) => {
      // Set API key if available
      const apiKey = this.settings.ai.apiKeys[type];
      if (apiKey) {
        provider.setApiKey(apiKey);
      }

      // Set model
      const model = this.settings.ai.models[type] ?? AI_PROVIDERS[type].defaultModel;
      provider.setModel(model);

      this.aiService?.registerProvider(type, provider);
    });
  }

  private updateAIService(): void {
    updateAIServiceSettings(this.settings.ai);

    // Update provider configurations
    const service = getAIService();
    if (!service) return;

    (['claude', 'openai', 'gemini', 'grok'] as AIProviderType[]).forEach((type) => {
      const provider = service['providers'].get(type);
      if (provider) {
        const apiKey = this.settings.ai.apiKeys[type];
        if (apiKey) {
          provider.setApiKey(apiKey);
        }

        const model = this.settings.ai.models[type] ?? AI_PROVIDERS[type].defaultModel;
        provider.setModel(model);
      }
    });
  }

  getCurrentProvider(): ILLMProvider | undefined {
    return this.aiService?.getCurrentProvider();
  }

  private async startDialogue(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile) {
      new Notice('노트를 열어주세요.');
      return;
    }

    await this.startDialogueForFile(activeFile);
  }

  private async startDialogueForFile(file: TFile): Promise<void> {
    // Check if AI is configured
    if (!this.aiService?.isAvailable()) {
      new Notice('AI 설정을 먼저 완료해주세요. (설정 → Socratic Challenger)');
      return;
    }

    try {
      const content = await this.app.vault.read(file);

      if (!content.trim()) {
        new Notice('노트 내용이 비어있습니다.');
        return;
      }

      const modal = new DialogueModal(
        this.app,
        this,
        content,
        file.path
      );
      modal.open();
    } catch (error) {
      const message = error instanceof Error ? error.message : '노트를 읽을 수 없습니다.';
      new Notice(`오류: ${message}`);
    }
  }
}
