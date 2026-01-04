/**
 * DialogueSession Entity
 * 소크라테스식 대화 세션을 나타냅니다.
 */

import { IntensityLevel, IntensityLevelEnum } from '../value-objects/intensity-level';
import { Question, QuestionData } from './question';

export interface DialogueResponse {
  questionId: string;
  content: string;
  createdAt: number;
}

export interface DialogueSessionData {
  id: string;
  noteId: string;
  notePath: string;
  noteContext: string;
  questions: QuestionData[];
  responses: DialogueResponse[];
  intensity: IntensityLevelEnum;
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

  static fromData(data: DialogueSessionData): DialogueSession {
    const session = new DialogueSession(
      data.id,
      data.noteId,
      data.notePath,
      data.noteContext,
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
  toData(): DialogueSessionData {
    return {
      id: this._id,
      noteId: this._noteId,
      notePath: this._notePath,
      noteContext: this._noteContext,
      questions: this._questions.map((q) => q.toData()),
      responses: Array.from(this._responses.values()),
      intensity: this._intensity.getValue(),
      createdAt: this._createdAt.getTime(),
      updatedAt: this._updatedAt.getTime(),
    };
  }

  toMarkdown(): string {
    const lines: string[] = [
      '## Socratic Dialogue',
      '',
      `**시작 시간**: ${this._createdAt.toLocaleString('ko-KR')}`,
      `**강도**: ${this._intensity.getDisplayText()}`,
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
        lines.push('**나의 답변:**');
        lines.push('');
        lines.push(response.content);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  }
}
