/**
 * Dialogue Modal
 * 소크라테스식 대화를 위한 모달 UI
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
      text: '당신의 아이디어에 대해 깊이 있는 질문을 던져드립니다.',
      cls: 'socratic-subtitle',
    });
  }

  private renderNoteContext(container: HTMLElement): void {
    const contextDiv = container.createDiv({ cls: 'socratic-note-context' });
    contextDiv.createEl('h4', { text: '📝 노트 내용' });

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
      .setName('질문 강도')
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
      .setName('질문 개수')
      .addDropdown((dropdown) => {
        for (let i = 1; i <= 5; i++) {
          dropdown.addOption(i.toString(), `${i}개`);
        }
        dropdown.setValue(this.questionCount.toString());
        dropdown.onChange((value) => {
          this.questionCount = parseInt(value);
        });
      });

    // Question types
    const typesDiv = controlsDiv.createDiv({ cls: 'socratic-question-types' });
    typesDiv.createEl('span', { text: '질문 유형: ' });

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
        text: '"질문 생성" 버튼을 클릭하여 시작하세요.',
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
        .setButtonText('🎯 질문 생성')
        .setCta()
        .onClick(() => this.generateQuestions());
    } else {
      // After questions generated
      new ButtonComponent(this.actionsContainer)
        .setButtonText('💬 후속 질문')
        .onClick(() => this.continueDialogue());

      new ButtonComponent(this.actionsContainer)
        .setButtonText('💡 인사이트 추출')
        .onClick(() => this.extractInsights());

      new ButtonComponent(this.actionsContainer)
        .setButtonText('💾 대화 저장')
        .onClick(() => this.saveDialogue());

      new ButtonComponent(this.actionsContainer)
        .setButtonText('🔄 새로 시작')
        .onClick(() => this.resetDialogue());
    }
  }

  private async generateQuestions(): Promise<void> {
    if (this.isLoading) return;

    if (this.selectedTypes.length === 0) {
      new Notice('질문 유형을 하나 이상 선택해주세요.');
      return;
    }

    const provider = this.plugin.getCurrentProvider();
    if (!provider) {
      new Notice('AI 프로바이더가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
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
        new Notice(`오류: ${result.error}`);
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

      new Notice(`${result.questions.length}개의 질문이 생성되었습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '질문 생성에 실패했습니다.';
      new Notice(`오류: ${message}`);
    } finally {
      this.setLoading(false);
    }
  }

  private async continueDialogue(): Promise<void> {
    if (this.isLoading || !this.session) return;

    // Check if at least one question has been answered
    if (this.session.getAnsweredQuestions().length === 0) {
      new Notice('후속 질문을 생성하려면 먼저 하나 이상의 질문에 답변해주세요.');
      return;
    }

    const provider = this.plugin.getCurrentProvider();
    if (!provider) {
      new Notice('AI 프로바이더가 설정되지 않았습니다.');
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
        new Notice(`오류: ${result.error}`);
        return;
      }

      // Add new questions to session
      this.session.addQuestions(result.questions);

      // Re-render questions
      this.renderQuestions();

      new Notice(`${result.questions.length}개의 후속 질문이 생성되었습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '후속 질문 생성에 실패했습니다.';
      new Notice(`오류: ${message}`);
    } finally {
      this.setLoading(false);
    }
  }

  private async extractInsights(): Promise<void> {
    if (this.isLoading || !this.session) return;

    // Check if at least one question has been answered
    if (this.session.getAnsweredQuestions().length === 0) {
      new Notice('인사이트를 추출하려면 먼저 하나 이상의 질문에 답변해주세요.');
      return;
    }

    const provider = this.plugin.getCurrentProvider();
    if (!provider) {
      new Notice('AI 프로바이더가 설정되지 않았습니다.');
      return;
    }

    this.setLoading(true, '인사이트를 추출하고 있습니다...');

    try {
      const useCase = new ExtractInsightsUseCase(provider);
      const result = await useCase.execute({
        session: this.session,
      });

      if (result.error) {
        new Notice(`오류: ${result.error}`);
        return;
      }

      this.extractedInsights = result;
      this.renderInsights();

      const totalItems = result.insights.length + result.noteTopics.length;
      new Notice(`${totalItems}개의 인사이트와 주제를 추출했습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '인사이트 추출에 실패했습니다.';
      new Notice(`오류: ${message}`);
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
    this.insightsContainer.createEl('h3', { text: '💡 추출된 인사이트', cls: 'insights-header' });

    // Insights section
    if (insights.length > 0) {
      const insightsDiv = this.insightsContainer.createDiv({ cls: 'insights-section' });
      insightsDiv.createEl('h4', { text: '🔍 핵심 인사이트' });

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
      topicsDiv.createEl('h4', { text: '📝 새 노트 주제 제안' });

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
      questionsDiv.createEl('h4', { text: '❓ 미해결 질문' });

      const ul = questionsDiv.createEl('ul', { cls: 'unanswered-questions' });
      unansweredQuestions.forEach((q) => {
        ul.createEl('li', { text: q });
      });
    }

    // Note enhancements section
    if (noteEnhancements.length > 0) {
      const enhancementsDiv = this.insightsContainer.createDiv({ cls: 'insights-section' });
      enhancementsDiv.createEl('h4', { text: '✨ 노트 보완 제안' });

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
      headerDiv.createSpan({ cls: 'response-label', text: '나의 답변:' });

      const editBtn = new ButtonComponent(headerDiv);
      editBtn.setButtonText('✏️ 수정');
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
    textArea.setPlaceholder('이 질문에 대한 생각을 적어보세요...');
    textArea.setValue(initialValue);
    textArea.inputEl.rows = 3;
    this.responseInputs.set(questionId, textArea);

    const btnContainer = responseArea.createDiv({ cls: 'response-btn-container' });

    const saveBtn = new ButtonComponent(btnContainer);
    saveBtn.setButtonText(initialValue ? '수정 저장' : '답변 저장');
    saveBtn.onClick(() => this.saveResponse(questionId));

    if (initialValue) {
      const cancelBtn = new ButtonComponent(btnContainer);
      cancelBtn.setButtonText('취소');
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
      new Notice('답변을 입력해주세요.');
      return;
    }

    const isEdit = !!this.session.getResponse(questionId);

    try {
      this.session.addResponse(questionId, response);
      this.renderQuestions();
      new Notice(isEdit ? '답변이 수정되었습니다.' : '답변이 저장되었습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '답변 저장에 실패했습니다.';
      new Notice(`오류: ${message}`);
    }
  }

  private async saveDialogue(): Promise<void> {
    if (!this.session) return;

    try {
      const repository = new ObsidianDialogueRepository(this.app);
      await repository.save(this.session);
      new Notice('대화가 노트에 저장되었습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '대화 저장에 실패했습니다.';
      new Notice(`오류: ${message}`);
    }
  }

  private resetDialogue(): void {
    this.session = null;
    this.responseInputs.clear();

    if (this.questionContainer) {
      this.questionContainer.empty();
      this.questionContainer.createDiv({
        cls: 'socratic-empty-state',
        text: '"질문 생성" 버튼을 클릭하여 시작하세요.',
      });
    }

    this.updateActionButtons();
    new Notice('대화가 초기화되었습니다.');
  }

  private setLoading(loading: boolean, message?: string): void {
    this.isLoading = loading;

    if (this.questionContainer) {
      if (loading) {
        this.questionContainer.empty();
        const loadingDiv = this.questionContainer.createDiv({ cls: 'socratic-loading' });
        loadingDiv.createSpan({ cls: 'loading-spinner', text: '⏳' });
        loadingDiv.createSpan({ text: message || '질문을 생성하고 있습니다...' });
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
        previousDiv.createEl('h4', { text: '📚 이전 대화 발견' });

        const infoDiv = previousDiv.createDiv({ cls: 'previous-info' });
        const questionCount = previousSession.questions.length;
        const answeredCount = previousSession.getAnsweredQuestions().length;
        const createdAt = new Date(previousSession.createdAt).toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        infoDiv.createDiv({
          text: `생성일: ${createdAt}`,
          cls: 'previous-date',
        });
        infoDiv.createDiv({
          text: `질문 ${questionCount}개 중 ${answeredCount}개 답변됨`,
          cls: 'previous-stats',
        });

        const actionsDiv = previousDiv.createDiv({ cls: 'previous-actions' });

        new ButtonComponent(actionsDiv)
          .setButtonText('📖 이전 대화 불러오기')
          .setCta()
          .onClick(() => this.loadPreviousDialogue(previousSession));

        new ButtonComponent(actionsDiv)
          .setButtonText('🆕 새로 시작')
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

    // Render the loaded questions
    this.renderQuestions();
    this.updateActionButtons();

    new Notice('이전 대화를 불러왔습니다.');
  }

  private startNewDialogue(): void {
    if (!this.questionContainer) return;

    this.questionContainer.empty();
    this.questionContainer.createDiv({
      cls: 'socratic-empty-state',
      text: '"질문 생성" 버튼을 클릭하여 시작하세요.',
    });
  }
}
