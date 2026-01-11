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
    containerEl.createEl('h2', { text: 'AI Settings' });

    // Provider Selection
    new Setting(containerEl)
      .setName('AI Provider')
      .setDesc('Select the AI service to use')
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
      .setName(`${AI_PROVIDERS[currentProvider].displayName} API Key`)
      .setDesc('Enter your API key')
      .addText((text) => {
        text
          .setPlaceholder('Enter API key')
          .setValue(this.plugin.settings.ai.apiKeys[currentProvider] ?? '')
          .onChange(async (value) => {
            this.plugin.settings.ai.apiKeys[currentProvider] = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
      })
      .addButton((button) => {
        button
          .setButtonText('Test')
          .onClick(async () => {
            const provider = this.plugin.getCurrentProvider();
            const apiKey = this.plugin.settings.ai.apiKeys[currentProvider];

            if (!provider) {
              new Notice('Provider not found.');
              return;
            }

            if (!apiKey) {
              new Notice('Please enter an API key first.');
              return;
            }

            button.setDisabled(true);
            button.setButtonText('Testing...');

            try {
              const isValid = await provider.testApiKey(apiKey);
              if (isValid) {
                new Notice('✅ API key is valid!');
              } else {
                new Notice('❌ API key is invalid.');
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unknown error';
              new Notice(`❌ Test failed: ${message}`);
            } finally {
              button.setDisabled(false);
              button.setButtonText('Test');
            }
          });
      });

    // Model Selection
    new Setting(containerEl)
      .setName('Model')
      .setDesc('Select the model to use')
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
      .setName('Budget Limit (USD)')
      .setDesc('Set monthly API usage budget limit (optional)')
      .addText((text) => {
        text
          .setPlaceholder('e.g., 10.00')
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
    containerEl.createEl('h2', { text: 'Dialogue Settings' });

    // Default Intensity
    new Setting(containerEl)
      .setName('Default Question Intensity')
      .setDesc('Select the default intensity for questions')
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
      .setName('Default Question Types')
      .setDesc('Select question types to enable by default');

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
      .setName('Default Question Count')
      .setDesc('Default number of questions to generate at a time (1-5)')
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
      .setName('Auto Save')
      .setDesc('Automatically save dialogue to the note')
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
