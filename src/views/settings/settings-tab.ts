/**
 * Socratic Challenger Settings Tab
 */

import { App, PluginSettingTab, Setting, DropdownComponent, Notice } from 'obsidian';
import type SocraticChallengerPlugin from '../../main';
import type { AIProviderType } from '../../core/application/services/ai-service';
import { AI_PROVIDERS, getModelsByProvider } from '../../core/domain/constants/model-configs';
import { IntensityLevel, IntensityLevelEnum } from '../../core/domain/value-objects/intensity-level';
import { QuestionType, QuestionTypeEnum } from '../../core/domain/value-objects/question-type';

export class SocraticChallengerSettingTab extends PluginSettingTab {
  plugin: SocraticChallengerPlugin;
  private modelDropdown: DropdownComponent | null = null;

  constructor(app: App, plugin: SocraticChallengerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderAISettings(containerEl);
    this.renderDialogueSettings(containerEl);
  }

  private renderAISettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'AI 설정' });

    // Provider Selection
    new Setting(containerEl)
      .setName('AI 프로바이더')
      .setDesc('사용할 AI 서비스를 선택하세요')
      .addDropdown((dropdown) => {
        Object.entries(AI_PROVIDERS).forEach(([key, config]) => {
          dropdown.addOption(key, config.displayName);
        });
        dropdown.setValue(this.plugin.settings.ai.provider);
        dropdown.onChange(async (value) => {
          this.plugin.settings.ai.provider = value as AIProviderType;
          await this.plugin.saveSettings();
          this.updateModelDropdown();
          this.display();
        });
      });

    // API Key
    const currentProvider = this.plugin.settings.ai.provider;
    new Setting(containerEl)
      .setName(`${AI_PROVIDERS[currentProvider].displayName} API 키`)
      .setDesc('API 키를 입력하세요')
      .addText((text) => {
        text
          .setPlaceholder('API 키 입력')
          .setValue(this.plugin.settings.ai.apiKeys[currentProvider] ?? '')
          .onChange(async (value) => {
            this.plugin.settings.ai.apiKeys[currentProvider] = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
      })
      .addButton((button) => {
        button
          .setButtonText('테스트')
          .onClick(async () => {
            const provider = this.plugin.getCurrentProvider();
            const apiKey = this.plugin.settings.ai.apiKeys[currentProvider];

            if (!provider) {
              new Notice('프로바이더를 찾을 수 없습니다.');
              return;
            }

            if (!apiKey) {
              new Notice('API 키를 먼저 입력해주세요.');
              return;
            }

            button.setDisabled(true);
            button.setButtonText('테스트 중...');

            try {
              const isValid = await provider.testApiKey(apiKey);
              if (isValid) {
                new Notice('✅ API 키가 유효합니다!');
              } else {
                new Notice('❌ API 키가 유효하지 않습니다.');
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : '알 수 없는 오류';
              new Notice(`❌ 테스트 실패: ${message}`);
            } finally {
              button.setDisabled(false);
              button.setButtonText('테스트');
            }
          });
      });

    // Model Selection
    new Setting(containerEl)
      .setName('모델')
      .setDesc('사용할 모델을 선택하세요')
      .addDropdown((dropdown) => {
        this.modelDropdown = dropdown;
        this.populateModelDropdown(dropdown, currentProvider);
        dropdown.setValue(
          this.plugin.settings.ai.models[currentProvider] ??
            AI_PROVIDERS[currentProvider].defaultModel
        );
        dropdown.onChange(async (value) => {
          this.plugin.settings.ai.models[currentProvider] = value;
          await this.plugin.saveSettings();
        });
      });

    // Budget Limit
    new Setting(containerEl)
      .setName('예산 한도 (USD)')
      .setDesc('월간 API 사용 예산 한도를 설정하세요 (선택 사항)')
      .addText((text) => {
        text
          .setPlaceholder('예: 10.00')
          .setValue(
            this.plugin.settings.ai.budgetLimit?.toString() ?? ''
          )
          .onChange(async (value) => {
            const numValue = parseFloat(value);
            this.plugin.settings.ai.budgetLimit = isNaN(numValue)
              ? undefined
              : numValue;
            await this.plugin.saveSettings();
          });
      });
  }

  private renderDialogueSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: '대화 설정' });

    // Default Intensity
    new Setting(containerEl)
      .setName('기본 질문 강도')
      .setDesc('질문의 기본 강도를 선택하세요')
      .addDropdown((dropdown) => {
        IntensityLevel.all().forEach((level) => {
          dropdown.addOption(level.getValue(), level.getDisplayText());
        });
        dropdown.setValue(this.plugin.settings.dialogue.defaultIntensity);
        dropdown.onChange(async (value) => {
          this.plugin.settings.dialogue.defaultIntensity =
            value as IntensityLevelEnum;
          await this.plugin.saveSettings();
        });
      });

    // Default Question Types
    new Setting(containerEl)
      .setName('기본 질문 유형')
      .setDesc('기본으로 활성화할 질문 유형을 선택하세요');

    const questionTypesContainer = containerEl.createDiv({
      cls: 'socratic-question-types-container',
    });

    QuestionType.all().forEach((type) => {
      const typeInfo = type.getInfo();
      new Setting(questionTypesContainer)
        .setName(`${typeInfo.icon} ${typeInfo.displayText}`)
        .setDesc(typeInfo.description)
        .addToggle((toggle) => {
          toggle
            .setValue(
              this.plugin.settings.dialogue.defaultQuestionTypes.includes(
                typeInfo.type
              )
            )
            .onChange(async (value) => {
              const types = this.plugin.settings.dialogue.defaultQuestionTypes;
              if (value) {
                if (!types.includes(typeInfo.type)) {
                  types.push(typeInfo.type);
                }
              } else {
                const index = types.indexOf(typeInfo.type);
                if (index > -1) {
                  types.splice(index, 1);
                }
              }
              await this.plugin.saveSettings();
            });
        });
    });

    // Default Question Count
    new Setting(containerEl)
      .setName('기본 질문 개수')
      .setDesc('한 번에 생성할 기본 질문 개수 (1-5)')
      .addSlider((slider) => {
        slider
          .setLimits(1, 5, 1)
          .setValue(this.plugin.settings.dialogue.defaultQuestionCount)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.dialogue.defaultQuestionCount = value;
            await this.plugin.saveSettings();
          });
      });

    // Auto Save
    new Setting(containerEl)
      .setName('자동 저장')
      .setDesc('대화 내용을 노트에 자동으로 저장합니다')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.dialogue.autoSaveDialogue)
          .onChange(async (value) => {
            this.plugin.settings.dialogue.autoSaveDialogue = value;
            await this.plugin.saveSettings();
          });
      });
  }

  private populateModelDropdown(
    dropdown: DropdownComponent,
    provider: AIProviderType
  ): void {
    const models = getModelsByProvider(provider);
    models.forEach((model) => {
      dropdown.addOption(model.id, model.displayName);
    });
  }

  private updateModelDropdown(): void {
    if (!this.modelDropdown) return;

    const provider = this.plugin.settings.ai.provider;

    // Clear existing options
    this.modelDropdown.selectEl.empty();

    // Add new options
    this.populateModelDropdown(this.modelDropdown, provider);

    // Set default value
    this.modelDropdown.setValue(
      this.plugin.settings.ai.models[provider] ??
        AI_PROVIDERS[provider].defaultModel
    );
  }
}
