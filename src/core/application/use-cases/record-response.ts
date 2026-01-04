/**
 * RecordResponseUseCase
 * 사용자의 응답을 대화 세션에 기록합니다.
 */

import { DialogueSession } from '../../domain/entities/dialogue-session';
import type { IDialogueRepository } from '../../domain/interfaces/dialogue-repository.interface';

export interface RecordResponseInput {
  session: DialogueSession;
  questionId: string;
  response: string;
}

export interface RecordResponseOutput {
  session: DialogueSession;
  error?: string;
}

export class RecordResponseUseCase {
  constructor(private readonly dialogueRepository: IDialogueRepository) {}

  async execute(input: RecordResponseInput): Promise<RecordResponseOutput> {
    const { session, questionId, response } = input;

    if (!response.trim()) {
      return {
        session,
        error: '응답 내용이 비어있습니다.',
      };
    }

    try {
      // Add response to session
      session.addResponse(questionId, response.trim());

      // Save to repository
      await this.dialogueRepository.save(session);

      return { session };
    } catch (error) {
      const message = error instanceof Error ? error.message : '응답 저장에 실패했습니다.';
      return {
        session,
        error: message,
      };
    }
  }
}
