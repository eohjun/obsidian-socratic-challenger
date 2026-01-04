/**
 * Question Entity
 * 개별 소크라테스식 질문을 나타냅니다.
 */

import { QuestionType, QuestionTypeEnum } from '../value-objects/question-type';

export interface QuestionData {
  id: string;
  type: QuestionTypeEnum;
  content: string;
  createdAt: number;
}

export class Question {
  private constructor(
    private readonly _id: string,
    private readonly _type: QuestionType,
    private readonly _content: string,
    private readonly _createdAt: Date
  ) {}

  static create(type: QuestionType | QuestionTypeEnum, content: string): Question {
    const questionType = type instanceof QuestionType ? type : QuestionType.create(type);
    return new Question(
      Question.generateId(),
      questionType,
      content,
      new Date()
    );
  }

  static fromData(data: QuestionData): Question {
    return new Question(
      data.id,
      QuestionType.create(data.type),
      data.content,
      new Date(data.createdAt)
    );
  }

  private static generateId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  get id(): string {
    return this._id;
  }

  get type(): QuestionType {
    return this._type;
  }

  get content(): string {
    return this._content;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  getTypeDisplayText(): string {
    return this._type.getDisplayText();
  }

  getTypeIcon(): string {
    return this._type.getIcon();
  }

  toData(): QuestionData {
    return {
      id: this._id,
      type: this._type.getValue(),
      content: this._content,
      createdAt: this._createdAt.getTime(),
    };
  }

  toMarkdown(): string {
    const icon = this._type.getIcon();
    const typeText = this._type.getDisplayText();
    return `**${icon} ${typeText}**: ${this._content}`;
  }
}
