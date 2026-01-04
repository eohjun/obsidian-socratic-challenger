/**
 * IDialogueRepository Interface
 * 대화 세션의 저장 및 로드를 위한 인터페이스
 */

import { DialogueSession } from '../entities/dialogue-session';

export interface IDialogueRepository {
  /**
   * 대화 세션을 노트에 저장합니다.
   * @param session 저장할 대화 세션
   */
  save(session: DialogueSession): Promise<void>;

  /**
   * 특정 노트의 대화 세션을 불러옵니다.
   * @param noteId 노트 ID
   * @returns 대화 세션 또는 null
   */
  findByNoteId(noteId: string): Promise<DialogueSession | null>;

  /**
   * 특정 노트의 모든 대화 히스토리를 불러옵니다.
   * @param noteId 노트 ID
   * @returns 대화 세션 배열
   */
  getHistory(noteId: string): Promise<DialogueSession[]>;

  /**
   * 특정 대화 세션을 삭제합니다.
   * @param sessionId 세션 ID
   */
  delete(sessionId: string): Promise<void>;
}
