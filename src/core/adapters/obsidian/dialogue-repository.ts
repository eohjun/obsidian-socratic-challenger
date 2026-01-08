/**
 * ObsidianDialogueRepository
 * 대화 세션을 Obsidian 노트에 저장/로드합니다.
 */

import { normalizePath, type App, type TFile } from 'obsidian';
import { DialogueSession, type DialogueSessionData } from '../../domain/entities/dialogue-session';
import type { IDialogueRepository } from '../../domain/interfaces/dialogue-repository.interface';

const DIALOGUE_SECTION_MARKER = '## Socratic Dialogue';
const CALLOUT_START = '> [!abstract]- Socratic Data (세션 데이터 - 수정하지 마세요)';
const CALLOUT_DATA_PREFIX = '> ';

export class ObsidianDialogueRepository implements IDialogueRepository {
  constructor(private readonly app: App) {}

  async save(session: DialogueSession): Promise<void> {
    const normalizedPath = normalizePath(session.notePath);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (!file || !(file instanceof this.app.vault.adapter.constructor)) {
      // File might not exist or not be a TFile, try to get it differently
      const tFile = this.app.vault.getFileByPath(normalizedPath);
      if (!tFile) {
        throw new Error(`노트를 찾을 수 없습니다: ${normalizedPath}`);
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
    // Exclude noteContext from saved data to reduce file size
    const sessionData = JSON.stringify(session.toData({ excludeNoteContext: true }));

    // Use collapsible callout format (collapsed by default with '-')
    const dataBlock = `\n${CALLOUT_START}\n${CALLOUT_DATA_PREFIX}${sessionData}\n`;

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
    // noteId is the file path (normalize for cross-platform compatibility)
    const file = this.app.vault.getFileByPath(normalizePath(noteId));
    if (!file) {
      return [];
    }

    try {
      const content = await this.app.vault.read(file);
      // Extract note content without the Socratic Dialogue section for context
      const noteContext = this.extractNoteContext(content);
      return this.parseSessionsFromContent(content, noteContext);
    } catch {
      return [];
    }
  }

  private extractNoteContext(content: string): string {
    // Remove the Socratic Dialogue section to get the original note content
    const sectionIndex = content.indexOf(DIALOGUE_SECTION_MARKER);
    if (sectionIndex === -1) {
      return content;
    }
    // Find the separator before the section
    const separatorIndex = content.lastIndexOf('---', sectionIndex);
    if (separatorIndex > 0) {
      return content.substring(0, separatorIndex).trim();
    }
    return content.substring(0, sectionIndex).trim();
  }

  private parseSessionsFromContent(content: string, noteContext: string): DialogueSession[] {
    const sessions: DialogueSession[] = [];

    // Callout format: > [!abstract]- Socratic Data...\n> {json}
    const calloutRegex = /> \[!abstract\]- Socratic Data[^\n]*\n> (\{[\s\S]*?\})(?=\n(?!>)|$)/g;

    let match;
    while ((match = calloutRegex.exec(content)) !== null) {
      try {
        const dataStr = match[1].trim();
        const data: DialogueSessionData = JSON.parse(dataStr);
        sessions.push(DialogueSession.fromData(data, noteContext));
      } catch {
        console.warn('Failed to parse dialogue session data');
      }
    }

    return sessions;
  }

  async delete(sessionId: string): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const content = await this.app.vault.read(file);
      if (content.includes(sessionId)) {
        // Remove the session data block containing this ID (callout format)
        const calloutRegex = new RegExp(
          `> \\[!abstract\\]- Socratic Data[^\\n]*\\n> [^\\n]*"id"\\s*:\\s*"${sessionId}"[^\\n]*\\n?`,
          'g'
        );

        const updatedContent = content.replace(calloutRegex, '');

        // If no sessions remain, remove the entire dialogue section
        if (!updatedContent.includes('> [!abstract]- Socratic Data')) {
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
