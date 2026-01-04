/**
 * Gemini Provider
 * Google Gemini API implementation
 */

import { BaseProvider } from './base-provider';
import type { AIProviderType } from '../../application/services/ai-service';
import type { LLMMessage, LLMResponse, LLMGenerateOptions } from '../../domain/interfaces/llm-provider.interface';

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
}

interface GeminiResponse {
  candidates?: { content: { parts: { text: string }[] } }[];
  usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
  error?: { message: string; code: number };
}

export class GeminiProvider extends BaseProvider {
  readonly providerType: AIProviderType = 'gemini';
  readonly name = 'Google Gemini';

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      return { success: false, content: '', error: 'API 키가 설정되지 않았습니다.' };
    }

    const { contents, systemInstruction } = this.convertMessages(messages);

    const requestBody: GeminiRequest = {
      contents,
      generationConfig: {
        maxOutputTokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
      },
    };

    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction;
    }

    if (options?.topP !== undefined && requestBody.generationConfig) {
      requestBody.generationConfig.topP = options.topP;
    }

    if (options?.stopSequences && requestBody.generationConfig) {
      requestBody.generationConfig.stopSequences = options.stopSequences;
    }

    try {
      const url = `${this.config.endpoint}/models/${this.modelId}:generateContent?key=${this.apiKey}`;

      const response = await this.makeRequest<GeminiResponse>({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.error) {
        return {
          success: false,
          content: '',
          error: response.error.message,
        };
      }

      const content =
        response.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';

      return {
        success: true,
        content,
        usage: response.usageMetadata
          ? {
              inputTokens: response.usageMetadata.promptTokenCount,
              outputTokens: response.usageMetadata.candidatesTokenCount,
              totalTokens:
                response.usageMetadata.promptTokenCount +
                response.usageMetadata.candidatesTokenCount,
            }
          : undefined,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private convertMessages(messages: LLMMessage[]): {
    contents: GeminiContent[];
    systemInstruction: { parts: { text: string }[] } | null;
  } {
    const contents: GeminiContent[] = [];
    let systemInstruction: { parts: { text: string }[] } | null = null;

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    return { contents, systemInstruction };
  }
}
