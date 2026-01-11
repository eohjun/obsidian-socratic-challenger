/**
 * RecordResponseUseCase
 * Records the user's response to the dialogue session.
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
        error: 'Response content is empty.',
      };
    }

    try {
      // Add response to session
      session.addResponse(questionId, response.trim());

      // Save to repository
      await this.dialogueRepository.save(session);

      return { session };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save response.';
      return {
        session,
        error: message,
      };
    }
  }
}
