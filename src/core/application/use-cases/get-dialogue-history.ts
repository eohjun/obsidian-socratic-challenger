/**
 * GetDialogueHistoryUseCase
 * 특정 노트의 대화 히스토리를 조회합니다.
 */

import { DialogueSession } from '../../domain/entities/dialogue-session';
import type { IDialogueRepository } from '../../domain/interfaces/dialogue-repository.interface';

export interface GetDialogueHistoryInput {
  noteId: string;
}

export interface GetDialogueHistoryOutput {
  sessions: DialogueSession[];
  error?: string;
}

export class GetDialogueHistoryUseCase {
  constructor(private readonly dialogueRepository: IDialogueRepository) {}

  async execute(input: GetDialogueHistoryInput): Promise<GetDialogueHistoryOutput> {
    try {
      const sessions = await this.dialogueRepository.getHistory(input.noteId);

      // Sort by creation date, most recent first
      sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return { sessions };
    } catch (error) {
      const message = error instanceof Error ? error.message : '대화 히스토리를 불러오는데 실패했습니다.';
      return {
        sessions: [],
        error: message,
      };
    }
  }
}
