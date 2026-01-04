/**
 * ObsidianDialogueRepository
 * 대화 세션을 Obsidian 노트에 저장/로드합니다.
 */

import type { App, TFile } from 'obsidian';
import { DialogueSession, type DialogueSessionData } from '../../domain/entities/dialogue-session';
import type { IDialogueRepository } from '../../domain/interfaces/dialogue-repository.interface';

const DIALOGUE_SECTION_MARKER = '## Socratic Dialogue';
const DATA_BLOCK_START = '%%SOCRATIC_DATA_START%%';
const DATA_BLOCK_END = '%%SOCRATIC_DATA_END%%';

export class ObsidianDialogueRepository implements IDialogueRepository {
  constructor(private readonly app: App) {}

  async save(session: DialogueSession): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(session.notePath);
    if (!file || !(file instanceof this.app.vault.adapter.constructor)) {
      // File might not exist or not be a TFile, try to get it differently
      const tFile = this.app.vault.getFileByPath(session.notePath);
      if (!tFile) {
        throw new Error(`노트를 찾을 수 없습니다: ${session.notePath}`);
      }
      await this.saveToFile(tFile as TFile, session);
    } else {
      await this.saveToFile(file as unknown as TFile, session);
    }
  }

  private async saveToFile(file: TFile, session: DialogueSession): Promise<void> {
    const content = await this.app.vault.read(file);
    const updatedContent = this.updateContentWithSession(content, session);
    await this.app.vault.modify(file, updatedContent);
  }

  private updateContentWithSession(content: string, session: DialogueSession): string {
    const sessionMarkdown = session.toMarkdown();
    const sessionData = JSON.stringify(session.toData());

    const dataBlock = `\n${DATA_BLOCK_START}\n${sessionData}\n${DATA_BLOCK_END}\n`;

    // Check if dialogue section already exists
    const sectionIndex = content.indexOf(DIALOGUE_SECTION_MARKER);

    if (sectionIndex === -1) {
      // Add new section at the end
      return `${content.trim()}\n\n---\n\n${sessionMarkdown}${dataBlock}`;
    }

    // Replace existing section
    // Find the end of the dialogue section (next ## heading or end of file)
    const afterSection = content.substring(sectionIndex);
    const nextHeadingMatch = afterSection.match(/\n## [^\n]+/);
    const nextHeadingIndex = nextHeadingMatch
      ? sectionIndex + (nextHeadingMatch.index ?? afterSection.length)
      : content.length;

    const beforeSection = content.substring(0, sectionIndex);
    const afterNextHeading = content.substring(nextHeadingIndex);

    return `${beforeSection.trim()}\n\n${sessionMarkdown}${dataBlock}\n${afterNextHeading.trim()}`.trim() + '\n';
  }

  async findByNoteId(noteId: string): Promise<DialogueSession | null> {
    const sessions = await this.getHistory(noteId);
    return sessions.length > 0 ? sessions[0] : null;
  }

  async getHistory(noteId: string): Promise<DialogueSession[]> {
    // noteId is the file path
    const file = this.app.vault.getFileByPath(noteId);
    if (!file) {
      return [];
    }

    try {
      const content = await this.app.vault.read(file);
      return this.parseSessionsFromContent(content);
    } catch {
      return [];
    }
  }

  private parseSessionsFromContent(content: string): DialogueSession[] {
    const sessions: DialogueSession[] = [];

    // Find all data blocks
    const regex = new RegExp(
      `${DATA_BLOCK_START}\\n([\\s\\S]*?)\\n${DATA_BLOCK_END}`,
      'g'
    );

    let match;
    while ((match = regex.exec(content)) !== null) {
      try {
        const dataStr = match[1].trim();
        const data: DialogueSessionData = JSON.parse(dataStr);
        sessions.push(DialogueSession.fromData(data));
      } catch {
        // Skip invalid data blocks
        console.warn('Failed to parse dialogue session data');
      }
    }

    return sessions;
  }

  async delete(sessionId: string): Promise<void> {
    // Find the session first to get the file path
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const content = await this.app.vault.read(file);
      if (content.includes(sessionId)) {
        // Remove the session data block containing this ID
        const regex = new RegExp(
          `${DATA_BLOCK_START}\\n[\\s\\S]*?"id"\\s*:\\s*"${sessionId}"[\\s\\S]*?\\n${DATA_BLOCK_END}`,
          'g'
        );

        const updatedContent = content.replace(regex, '');

        // If no sessions remain, remove the entire dialogue section
        if (!updatedContent.includes(DATA_BLOCK_START)) {
          const sectionRegex = new RegExp(
            `\\n*---\\n*\\n*${DIALOGUE_SECTION_MARKER}[\\s\\S]*$`,
            ''
          );
          const cleanedContent = updatedContent.replace(sectionRegex, '').trim() + '\n';
          await this.app.vault.modify(file, cleanedContent);
        } else {
          await this.app.vault.modify(file, updatedContent);
        }

        break;
      }
    }
  }
}
