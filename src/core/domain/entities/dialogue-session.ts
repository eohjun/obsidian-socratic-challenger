/**
 * DialogueSession Entity
 * Represents a Socratic dialogue session.
 */

import { IntensityLevel, IntensityLevelEnum } from '../value-objects/intensity-level';
import { Question, QuestionData } from './question';

export interface DialogueResponse {
  questionId: string;
  content: string;
  createdAt: number;
}

export interface InsightData {
  title: string;
  description: string;
  category: 'discovery' | 'perspective' | 'question' | 'connection';
}

export interface NoteTopicData {
  title: string;
  description: string;
  suggestedTags: string[];
}

export interface ExtractedInsightsData {
  insights: InsightData[];
  noteTopics: NoteTopicData[];
  unansweredQuestions: string[];
  noteEnhancements: string[];
  extractedAt: number;
}

export interface DialogueSessionData {
  id: string;
  noteId: string;
  notePath: string;
  noteContext?: string; // Optional - not saved to file, reconstructed on load
  questions: QuestionData[];
  responses: DialogueResponse[];
  intensity: IntensityLevelEnum;
  extractedInsights?: ExtractedInsightsData; // Optional - only present if insights were extracted
  createdAt: number;
  updatedAt: number;
}

export interface DialogueEntry {
  question: Question;
  response: string | null;
  responseCreatedAt: Date | null;
}

export class DialogueSession {
  private _questions: Question[] = [];
  private _responses: Map<string, DialogueResponse> = new Map();
  private _extractedInsights: ExtractedInsightsData | null = null;
  private _updatedAt: Date;

  private constructor(
    private readonly _id: string,
    private readonly _noteId: string,
    private readonly _notePath: string,
    private readonly _noteContext: string,
    private _intensity: IntensityLevel,
    private readonly _createdAt: Date
  ) {
    this._updatedAt = this._createdAt;
  }

  static create(
    noteId: string,
    notePath: string,
    noteContext: string,
    intensity?: IntensityLevel
  ): DialogueSession {
    return new DialogueSession(
      DialogueSession.generateId(),
      noteId,
      notePath,
      noteContext,
      intensity ?? IntensityLevel.default(),
      new Date()
    );
  }

  static fromData(data: DialogueSessionData, noteContext?: string): DialogueSession {
    const session = new DialogueSession(
      data.id,
      data.noteId,
      data.notePath,
      noteContext ?? data.noteContext ?? '',
      IntensityLevel.create(data.intensity),
      new Date(data.createdAt)
    );

    // Restore questions
    data.questions.forEach((q) => {
      session._questions.push(Question.fromData(q));
    });

    // Restore responses
    data.responses.forEach((r) => {
      session._responses.set(r.questionId, r);
    });

    // Restore extracted insights if present
    if (data.extractedInsights) {
      session._extractedInsights = data.extractedInsights;
    }

    session._updatedAt = new Date(data.updatedAt);

    return session;
  }

  private static generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get noteId(): string {
    return this._noteId;
  }

  get notePath(): string {
    return this._notePath;
  }

  get noteContext(): string {
    return this._noteContext;
  }

  get intensity(): IntensityLevel {
    return this._intensity;
  }

  get questions(): ReadonlyArray<Question> {
    return this._questions;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get extractedInsights(): ExtractedInsightsData | null {
    return this._extractedInsights;
  }

  // Mutations
  addQuestion(question: Question): void {
    this._questions.push(question);
    this._updatedAt = new Date();
  }

  addQuestions(questions: Question[]): void {
    questions.forEach((q) => this._questions.push(q));
    this._updatedAt = new Date();
  }

  addResponse(questionId: string, content: string): void {
    const question = this._questions.find((q) => q.id === questionId);
    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    this._responses.set(questionId, {
      questionId,
      content,
      createdAt: Date.now(),
    });
    this._updatedAt = new Date();
  }

  getResponse(questionId: string): DialogueResponse | undefined {
    return this._responses.get(questionId);
  }

  setIntensity(intensity: IntensityLevel): void {
    this._intensity = intensity;
    this._updatedAt = new Date();
  }

  setExtractedInsights(insights: ExtractedInsightsData): void {
    this._extractedInsights = insights;
    this._updatedAt = new Date();
  }

  // Query methods
  getHistory(): DialogueEntry[] {
    return this._questions.map((question) => {
      const response = this._responses.get(question.id);
      return {
        question,
        response: response?.content ?? null,
        responseCreatedAt: response ? new Date(response.createdAt) : null,
      };
    });
  }

  getUnansweredQuestions(): Question[] {
    return this._questions.filter((q) => !this._responses.has(q.id));
  }

  getAnsweredQuestions(): Question[] {
    return this._questions.filter((q) => this._responses.has(q.id));
  }

  hasUnansweredQuestions(): boolean {
    return this.getUnansweredQuestions().length > 0;
  }

  getLastExchange(): { question: Question; response: string } | null {
    const answeredQuestions = this.getAnsweredQuestions();
    if (answeredQuestions.length === 0) return null;

    const lastQuestion = answeredQuestions[answeredQuestions.length - 1];
    const response = this._responses.get(lastQuestion.id);
    if (!response) return null;

    return { question: lastQuestion, response: response.content };
  }

  // Serialization
  toData(options?: { excludeNoteContext?: boolean }): DialogueSessionData {
    const data: DialogueSessionData = {
      id: this._id,
      noteId: this._noteId,
      notePath: this._notePath,
      questions: this._questions.map((q) => q.toData()),
      responses: Array.from(this._responses.values()),
      intensity: this._intensity.getValue(),
      createdAt: this._createdAt.getTime(),
      updatedAt: this._updatedAt.getTime(),
    };

    // Only include noteContext if not excluded (for storage, we exclude it)
    if (!options?.excludeNoteContext) {
      data.noteContext = this._noteContext;
    }

    // Include extracted insights if present
    if (this._extractedInsights) {
      data.extractedInsights = this._extractedInsights;
    }

    return data;
  }

  toMarkdown(): string {
    const lines: string[] = [
      '## Socratic Dialogue',
      '',
      `**Started**: ${this._createdAt.toLocaleString('en-US')}`,
      `**Intensity**: ${this._intensity.getDisplayText()}`,
      '',
      '---',
      '',
    ];

    this._questions.forEach((question, index) => {
      const response = this._responses.get(question.id);

      lines.push(`### Q${index + 1}. ${question.getTypeIcon()} ${question.getTypeDisplayText()}`);
      lines.push('');
      lines.push(`> ${question.content}`);
      lines.push('');

      if (response) {
        lines.push('**My Response:**');
        lines.push('');
        lines.push(response.content);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    });

    // Add extracted insights if present
    if (this._extractedInsights) {
      lines.push('## 💡 Extracted Insights');
      lines.push('');

      // Key insights
      if (this._extractedInsights.insights.length > 0) {
        lines.push('### 🔍 Key Insights');
        lines.push('');
        this._extractedInsights.insights.forEach((insight) => {
          const icon = this.getCategoryIcon(insight.category);
          lines.push(`#### ${icon} ${insight.title}`);
          lines.push('');
          lines.push(insight.description);
          lines.push('');
        });
      }

      // Note topics
      if (this._extractedInsights.noteTopics.length > 0) {
        lines.push('### 📝 Suggested Note Topics');
        lines.push('');
        this._extractedInsights.noteTopics.forEach((topic) => {
          lines.push(`#### ${topic.title}`);
          lines.push('');
          lines.push(topic.description);
          if (topic.suggestedTags.length > 0) {
            lines.push('');
            lines.push(`**Tags**: ${topic.suggestedTags.map(t => `#${t}`).join(' ')}`);
          }
          lines.push('');
        });
      }

      // Unanswered questions
      if (this._extractedInsights.unansweredQuestions.length > 0) {
        lines.push('### ❓ Unanswered Questions');
        lines.push('');
        this._extractedInsights.unansweredQuestions.forEach((q) => {
          lines.push(`- ${q}`);
        });
        lines.push('');
      }

      // Note enhancements
      if (this._extractedInsights.noteEnhancements.length > 0) {
        lines.push('### ✨ Suggested Note Enhancements');
        lines.push('');
        this._extractedInsights.noteEnhancements.forEach((e) => {
          lines.push(`- ${e}`);
        });
        lines.push('');
      }
    }

    return lines.join('\n');
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
}
