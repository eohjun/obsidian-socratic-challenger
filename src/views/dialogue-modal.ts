/**
 * Dialogue Modal
 * Modal UI for Socratic dialogue
 */

import { App, Modal, Setting, Notice, TextAreaComponent, ButtonComponent } from 'obsidian';
import type SocraticChallengerPlugin from '../main';
import { DialogueSession } from '../core/domain/entities/dialogue-session';
import { Question } from '../core/domain/entities/question';
import { QuestionType, QuestionTypeEnum } from '../core/domain/value-objects/question-type';
import { IntensityLevel, IntensityLevelEnum } from '../core/domain/value-objects/intensity-level';
import { GenerateQuestionsUseCase } from '../core/application/use-cases/generate-questions';
import { ContinueDialogueUseCase } from '../core/application/use-cases/continue-dialogue';
import { ExtractInsightsUseCase, type ExtractInsightsOutput } from '../core/application/use-cases/extract-insights';
import { ObsidianDialogueRepository } from '../core/adapters/obsidian/dialogue-repository';

export class DialogueModal extends Modal {
  private plugin: SocraticChallengerPlugin;
  private noteContent: string;
  private notePath: string;
  private noteId: string;

  private session: DialogueSession | null = null;
  private selectedTypes: QuestionTypeEnum[];
  private selectedIntensity: IntensityLevel;
  private questionCount: number;

  private responseInputs: Map<string, TextAreaComponent> = new Map();
  private questionContainer: HTMLElement | null = null;
  private actionsContainer: HTMLElement | null = null;
  private insightsContainer: HTMLElement | null = null;
  private isLoading = false;
  private extractedInsights: ExtractInsightsOutput | null = null;

  constructor(
    app: App,
    plugin: SocraticChallengerPlugin,
    noteContent: string,
    notePath: string
  ) {
    super(app);
    this.plugin = plugin;
    this.noteContent = noteContent;
    this.notePath = notePath;
    this.noteId = notePath;

    // Initialize with defaults
    this.selectedTypes = [...plugin.settings.dialogue.defaultQuestionTypes];
    this.selectedIntensity = IntensityLevel.create(
      plugin.settings.dialogue.defaultIntensity
    );
    this.questionCount = plugin.settings.dialogue.defaultQuestionCount;
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('socratic-challenger-modal');

    this.renderHeader(contentEl);
    this.renderNoteContext(contentEl);
    this.renderControls(contentEl);
    this.renderQuestionArea(contentEl);
    this.renderInsightsArea(contentEl);
    this.renderActions(contentEl);

    // Check for previous dialogue
    await this.checkForPreviousDialogue();
  }

  onClose(): void {
    this.contentEl.empty();
    this.responseInputs.clear();
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: 'socratic-header' });
    header.createEl('h2', { text: '🏛️ Socratic Challenger' });
    header.createEl('p', {
      text: 'Deep questions to challenge and expand your ideas.',
      cls: 'socratic-subtitle',
    });
  }

  private renderNoteContext(container: HTMLElement): void {
    const contextDiv = container.createDiv({ cls: 'socratic-note-context' });
    contextDiv.createEl('h4', { text: '📝 Note Content' });

    const preview =
      this.noteContent.length > 500
        ? this.noteContent.substring(0, 500) + '...'
        : this.noteContent;

    contextDiv.createDiv({ cls: 'note-content', text: preview });
  }

  private renderControls(container: HTMLElement): void {
    const controlsDiv = container.createDiv({ cls: 'socratic-controls' });

    // Intensity selector
    new Setting(controlsDiv)
      .setName('Question Intensity')
      .addDropdown((dropdown) => {
        IntensityLevel.all().forEach((level) => {
          dropdown.addOption(level.getValue(), level.getDisplayText());
        });
        dropdown.setValue(this.selectedIntensity.getValue());
        dropdown.onChange((value) => {
          this.selectedIntensity = IntensityLevel.create(value as IntensityLevelEnum);
        });
      });

    // Question count
    new Setting(controlsDiv)
      .setName('Question Count')
      .addDropdown((dropdown) => {
        for (let i = 1; i <= 5; i++) {
          dropdown.addOption(i.toString(), `${i}`);
        }
        dropdown.setValue(this.questionCount.toString());
        dropdown.onChange((value) => {
          this.questionCount = parseInt(value);
        });
      });

    // Question types
    const typesDiv = controlsDiv.createDiv({ cls: 'socratic-question-types' });
    typesDiv.createEl('span', { text: 'Question Types: ' });

    QuestionType.all().forEach((type) => {
      const info = type.getInfo();
      const label = typesDiv.createEl('label', { cls: 'question-type-toggle' });
      const checkbox = label.createEl('input', { type: 'checkbox' });
      checkbox.checked = this.selectedTypes.includes(info.type);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (!this.selectedTypes.includes(info.type)) {
            this.selectedTypes.push(info.type);
          }
        } else {
          const index = this.selectedTypes.indexOf(info.type);
          if (index > -1) {
            this.selectedTypes.splice(index, 1);
          }
        }
      });
      label.createSpan({ text: info.displayText });
    });
  }

  private renderQuestionArea(container: HTMLElement): void {
    this.questionContainer = container.createDiv({ cls: 'socratic-question-list' });

    if (!this.session) {
      this.questionContainer.createDiv({
        cls: 'socratic-empty-state',
        text: 'Click "Generate Questions" to start.',
      });
    }
  }

  private renderInsightsArea(container: HTMLElement): void {
    this.insightsContainer = container.createDiv({ cls: 'socratic-insights-area' });
    // Initially hidden, shown after extraction
  }

  private renderActions(container: HTMLElement): void {
    this.actionsContainer = container.createDiv({ cls: 'socratic-actions' });
    this.updateActionButtons();
  }

  private updateActionButtons(): void {
    if (!this.actionsContainer) return;
    this.actionsContainer.empty();

    if (!this.session) {
      // Initial state: Generate button
      new ButtonComponent(this.actionsContainer)
        .setButtonText('🎯 Generate Questions')
        .setCta()
        .onClick(() => this.generateQuestions());
    } else {
      // After questions generated
      new ButtonComponent(this.actionsContainer)
        .setButtonText('💬 Follow-up Questions')
        .onClick(() => this.continueDialogue());

      new ButtonComponent(this.actionsContainer)
        .setButtonText('💡 Extract Insights')
        .onClick(() => this.extractInsights());

      new ButtonComponent(this.actionsContainer)
        .setButtonText('💾 Save Dialogue')
        .onClick(() => this.saveDialogue());

      new ButtonComponent(this.actionsContainer)
        .setButtonText('🔄 Start Over')
        .onClick(() => this.resetDialogue());
    }
  }

  private async generateQuestions(): Promise<void> {
    if (this.isLoading) return;

    if (this.selectedTypes.length === 0) {
      new Notice('Please select at least one question type.');
      return;
    }

    const provider = this.plugin.getCurrentProvider();
    if (!provider) {
      new Notice('AI provider not configured. Please enter API key in settings.');
      return;
    }

    this.setLoading(true);

    try {
      const useCase = new GenerateQuestionsUseCase(provider);
      const result = await useCase.execute({
        noteContent: this.noteContent,
        questionTypes: this.selectedTypes,
        intensity: this.selectedIntensity,
        maxQuestions: this.questionCount,
      });

      if (result.error) {
        new Notice(`Error: ${result.error}`);
        return;
      }

      // Create session
      this.session = DialogueSession.create(
        this.noteId,
        this.notePath,
        this.noteContent,
        this.selectedIntensity
      );

      // Add questions to session
      this.session.addQuestions(result.questions);

      // Render questions
      this.renderQuestions();
      this.updateActionButtons();

      new Notice(`${result.questions.length} questions generated.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate questions.';
      new Notice(`Error: ${message}`);
    } finally {
      this.setLoading(false);
    }
  }

  private async continueDialogue(): Promise<void> {
    if (this.isLoading || !this.session) return;

    // Check if at least one question has been answered
    if (this.session.getAnsweredQuestions().length === 0) {
      new Notice('Please answer at least one question to generate follow-ups.');
      return;
    }

    const provider = this.plugin.getCurrentProvider();
    if (!provider) {
      new Notice('AI provider not configured.');
      return;
    }

    this.setLoading(true);

    try {
      const useCase = new ContinueDialogueUseCase(provider);
      const result = await useCase.execute({
        session: this.session,
        maxQuestions: 2,
      });

      if (result.error) {
        new Notice(`Error: ${result.error}`);
        return;
      }

      // Add new questions to session
      this.session.addQuestions(result.questions);

      // Re-render questions
      this.renderQuestions();

      new Notice(`${result.questions.length} follow-up questions generated.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate follow-up questions.';
      new Notice(`Error: ${message}`);
    } finally {
      this.setLoading(false);
    }
  }

  private async extractInsights(): Promise<void> {
    if (this.isLoading || !this.session) return;

    // Check if at least one question has been answered
    if (this.session.getAnsweredQuestions().length === 0) {
      new Notice('Please answer at least one question to extract insights.');
      return;
    }

    const provider = this.plugin.getCurrentProvider();
    if (!provider) {
      new Notice('AI provider not configured.');
      return;
    }

    this.setLoading(true, 'Extracting insights...');

    try {
      const useCase = new ExtractInsightsUseCase(provider);
      const result = await useCase.execute({
        session: this.session,
      });

      if (result.error) {
        new Notice(`Error: ${result.error}`);
        return;
      }

      this.extractedInsights = result;

      // Save insights to session for persistence
      this.session.setExtractedInsights({
        insights: result.insights,
        noteTopics: result.noteTopics,
        unansweredQuestions: result.unansweredQuestions,
        noteEnhancements: result.noteEnhancements,
        extractedAt: Date.now(),
      });

      this.renderInsights();

      const totalItems = result.insights.length + result.noteTopics.length;
      new Notice(`Extracted ${totalItems} insights and topics.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to extract insights.';
      new Notice(`Error: ${message}`);
    } finally {
      this.setLoading(false);
      this.renderQuestions();
    }
  }

  private renderInsights(): void {
    if (!this.insightsContainer || !this.extractedInsights) return;

    this.insightsContainer.empty();

    const { insights, noteTopics, unansweredQuestions, noteEnhancements } = this.extractedInsights;

    // Header
    this.insightsContainer.createEl('h3', { text: '💡 Extracted Insights', cls: 'insights-header' });

    // Insights section
    if (insights.length > 0) {
      const insightsDiv = this.insightsContainer.createDiv({ cls: 'insights-section' });
      insightsDiv.createEl('h4', { text: '🔍 Key Insights' });

      insights.forEach((insight) => {
        const itemDiv = insightsDiv.createDiv({ cls: `insight-item insight-${insight.category}` });
        const categoryIcon = this.getCategoryIcon(insight.category);
        itemDiv.createDiv({ cls: 'insight-title', text: `${categoryIcon} ${insight.title}` });
        itemDiv.createDiv({ cls: 'insight-description', text: insight.description });
      });
    }

    // Note topics section
    if (noteTopics.length > 0) {
      const topicsDiv = this.insightsContainer.createDiv({ cls: 'insights-section' });
      topicsDiv.createEl('h4', { text: '📝 Suggested Note Topics' });

      noteTopics.forEach((topic) => {
        const itemDiv = topicsDiv.createDiv({ cls: 'note-topic-item' });
        itemDiv.createDiv({ cls: 'topic-title', text: topic.title });
        itemDiv.createDiv({ cls: 'topic-description', text: topic.description });
        if (topic.suggestedTags.length > 0) {
          const tagsDiv = itemDiv.createDiv({ cls: 'topic-tags' });
          topic.suggestedTags.forEach((tag) => {
            tagsDiv.createSpan({ cls: 'topic-tag', text: `#${tag}` });
          });
        }
      });
    }

    // Unanswered questions section
    if (unansweredQuestions.length > 0) {
      const questionsDiv = this.insightsContainer.createDiv({ cls: 'insights-section' });
      questionsDiv.createEl('h4', { text: '❓ Unanswered Questions' });

      const ul = questionsDiv.createEl('ul', { cls: 'unanswered-questions' });
      unansweredQuestions.forEach((q) => {
        ul.createEl('li', { text: q });
      });
    }

    // Note enhancements section
    if (noteEnhancements.length > 0) {
      const enhancementsDiv = this.insightsContainer.createDiv({ cls: 'insights-section' });
      enhancementsDiv.createEl('h4', { text: '✨ Suggested Note Enhancements' });

      const ul = enhancementsDiv.createEl('ul', { cls: 'note-enhancements' });
      noteEnhancements.forEach((e) => {
        ul.createEl('li', { text: e });
      });
    }
  }

  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      discovery: '💡',
      perspective: '🔭',
      question: '❓',
      connection: '🔗',
    };
    return icons[category] || '💡';
  }

  private renderQuestions(): void {
    if (!this.questionContainer || !this.session) return;

    this.questionContainer.empty();
    this.responseInputs.clear();

    const questions = this.session.questions;

    questions.forEach((question, index) => {
      this.renderQuestionItem(question, index);
    });
  }

  private renderQuestionItem(question: Question, index: number): void {
    if (!this.questionContainer || !this.session) return;

    const typeClass = `question-type-${question.type.getValue().toLowerCase()}`;
    const itemDiv = this.questionContainer.createDiv({
      cls: `socratic-question-item ${typeClass}`,
    });

    // Question type badge
    itemDiv.createDiv({
      cls: 'question-type',
      text: `${question.getTypeIcon()} ${question.getTypeDisplayText()}`,
    });

    // Question content
    itemDiv.createDiv({
      cls: 'question-content',
      text: `Q${index + 1}. ${question.content}`,
    });

    // Response area
    const existingResponse = this.session.getResponse(question.id);

    if (existingResponse) {
      // Show saved response with edit option
      const responseDiv = itemDiv.createDiv({ cls: 'socratic-response-saved' });

      const headerDiv = responseDiv.createDiv({ cls: 'response-header' });
      headerDiv.createSpan({ cls: 'response-label', text: 'My Response:' });

      const editBtn = new ButtonComponent(headerDiv);
      editBtn.setButtonText('✏️ Edit');
      editBtn.setClass('response-edit-btn');
      editBtn.onClick(() => this.showEditMode(question.id, existingResponse.content, itemDiv, index));

      responseDiv.createDiv({ cls: 'response-content', text: existingResponse.content });
    } else {
      // Show input area
      this.renderResponseInput(question.id, '', itemDiv);
    }
  }

  private renderResponseInput(questionId: string, initialValue: string, container: HTMLElement): void {
    // Remove existing response area if any
    const existingArea = container.querySelector('.socratic-response-area');
    if (existingArea) existingArea.remove();
    const existingSaved = container.querySelector('.socratic-response-saved');
    if (existingSaved) existingSaved.remove();

    const responseArea = container.createDiv({ cls: 'socratic-response-area' });

    const textArea = new TextAreaComponent(responseArea);
    textArea.setPlaceholder('Write your thoughts on this question...');
    textArea.setValue(initialValue);
    textArea.inputEl.rows = 3;
    this.responseInputs.set(questionId, textArea);

    const btnContainer = responseArea.createDiv({ cls: 'response-btn-container' });

    const saveBtn = new ButtonComponent(btnContainer);
    saveBtn.setButtonText(initialValue ? 'Save Edit' : 'Save Response');
    saveBtn.onClick(() => this.saveResponse(questionId));

    if (initialValue) {
      const cancelBtn = new ButtonComponent(btnContainer);
      cancelBtn.setButtonText('Cancel');
      cancelBtn.onClick(() => this.renderQuestions());
    }
  }

  private showEditMode(questionId: string, currentContent: string, container: HTMLElement, _index: number): void {
    this.renderResponseInput(questionId, currentContent, container);
  }

  private saveResponse(questionId: string): void {
    if (!this.session) return;

    const textArea = this.responseInputs.get(questionId);
    if (!textArea) return;

    const response = textArea.getValue().trim();
    if (!response) {
      new Notice('Please enter a response.');
      return;
    }

    const isEdit = !!this.session.getResponse(questionId);

    try {
      this.session.addResponse(questionId, response);
      this.renderQuestions();
      new Notice(isEdit ? 'Response updated.' : 'Response saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save response.';
      new Notice(`Error: ${message}`);
    }
  }

  private async saveDialogue(): Promise<void> {
    if (!this.session) return;

    try {
      const repository = new ObsidianDialogueRepository(this.app);
      await repository.save(this.session);
      new Notice('Dialogue saved to note.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save dialogue.';
      new Notice(`Error: ${message}`);
    }
  }

  private resetDialogue(): void {
    this.session = null;
    this.responseInputs.clear();

    if (this.questionContainer) {
      this.questionContainer.empty();
      this.questionContainer.createDiv({
        cls: 'socratic-empty-state',
        text: 'Click "Generate Questions" to start.',
      });
    }

    this.updateActionButtons();
    new Notice('Dialogue reset.');
  }

  private setLoading(loading: boolean, message?: string): void {
    this.isLoading = loading;

    if (this.questionContainer) {
      if (loading) {
        this.questionContainer.empty();
        const loadingDiv = this.questionContainer.createDiv({ cls: 'socratic-loading' });
        loadingDiv.createSpan({ cls: 'loading-spinner', text: '⏳' });
        loadingDiv.createSpan({ text: message || 'Generating questions...' });
      }
    }
  }

  private async checkForPreviousDialogue(): Promise<void> {
    try {
      const repository = new ObsidianDialogueRepository(this.app);
      const previousSession = await repository.findByNoteId(this.noteId);

      if (previousSession && this.questionContainer) {
        // Show option to load previous dialogue
        this.questionContainer.empty();

        const previousDiv = this.questionContainer.createDiv({ cls: 'socratic-previous-dialogue' });
        previousDiv.createEl('h4', { text: '📚 Previous Dialogue Found' });

        const infoDiv = previousDiv.createDiv({ cls: 'previous-info' });
        const questionCount = previousSession.questions.length;
        const answeredCount = previousSession.getAnsweredQuestions().length;
        const createdAt = new Date(previousSession.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        infoDiv.createDiv({
          text: `Created: ${createdAt}`,
          cls: 'previous-date',
        });
        infoDiv.createDiv({
          text: `${answeredCount} of ${questionCount} questions answered`,
          cls: 'previous-stats',
        });

        const actionsDiv = previousDiv.createDiv({ cls: 'previous-actions' });

        new ButtonComponent(actionsDiv)
          .setButtonText('📖 Load Previous Dialogue')
          .setCta()
          .onClick(() => this.loadPreviousDialogue(previousSession));

        new ButtonComponent(actionsDiv)
          .setButtonText('🆕 Start New')
          .onClick(() => this.startNewDialogue());
      }
    } catch (error) {
      console.warn('Failed to check for previous dialogue:', error);
    }
  }

  private loadPreviousDialogue(session: DialogueSession): void {
    this.session = session;

    // Update intensity from loaded session
    this.selectedIntensity = session.intensity;

    // Restore extracted insights if present
    if (session.extractedInsights) {
      this.extractedInsights = {
        insights: session.extractedInsights.insights,
        noteTopics: session.extractedInsights.noteTopics,
        unansweredQuestions: session.extractedInsights.unansweredQuestions,
        noteEnhancements: session.extractedInsights.noteEnhancements,
      };
      this.renderInsights();
    }

    // Render the loaded questions
    this.renderQuestions();
    this.updateActionButtons();

    new Notice('Previous dialogue loaded.');
  }

  private startNewDialogue(): void {
    if (!this.questionContainer) return;

    this.questionContainer.empty();
    this.questionContainer.createDiv({
      cls: 'socratic-empty-state',
      text: 'Click "Generate Questions" to start.',
    });
  }
}
