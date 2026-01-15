# Socratic Challenger

소크라테스식 질문을 통해 사고를 심화하고 인사이트를 추출하는 AI 기반 Obsidian 플러그인입니다.

## Features

- **비판적 질문 생성**: AI가 현재 노트의 내용을 분석하여 깊이 있는 소크라테스식 질문 제시
- **대화형 심화**: 질문에 답변하면서 생각을 발전시키는 인터랙티브 대화
- **인사이트 추출**: 대화 과정에서 도출된 핵심 인사이트 자동 정리
- **새 주제 제안**: 심화 과정에서 발견된 새로운 노트 주제 추천
- **대화 기록 저장**: Q&A 세션을 노트에 저장하여 나중에 참조

## PKM Workflow

```
작성 중인 노트 → Socratic Challenger → Q&A 대화 → 인사이트 + 새 노트 주제
                    (심화 Deepen)
```

## Supported AI Providers

| Provider | Model | 특징 |
|----------|-------|------|
| **OpenAI** | GPT-4o, GPT-4o-mini 등 | 가장 안정적인 질문 생성 |
| **Google Gemini** | Gemini 1.5 Pro/Flash | 무료 티어 제공 |
| **Anthropic** | Claude 3.5 Sonnet | 깊이 있는 철학적 질문 |

## Installation

### BRAT (권장)

1. [BRAT](https://github.com/TfTHacker/obsidian42-brat) 플러그인 설치
2. BRAT 설정 열기
3. "Add Beta plugin" 클릭
4. 입력: `eohjun/obsidian-socratic-challenger`
5. 플러그인 활성화

### Manual

1. 최신 릴리스에서 `main.js`, `manifest.json`, `styles.css` 다운로드
2. 폴더 생성: `<vault>/.obsidian/plugins/socratic-challenger/`
3. 다운로드한 파일을 폴더에 복사
4. Obsidian 설정에서 플러그인 활성화

## Setup

### API 키 설정

1. Settings → Socratic Challenger 열기
2. **AI Provider** 섹션에서:
   - AI Provider 선택
   - API 키 입력

## Commands

| 명령어 | 설명 |
|--------|------|
| **Start Socratic dialogue** | 현재 노트에 대한 소크라테스 대화 시작 |
| **Continue dialogue** | 이전 대화 이어서 진행 |
| **Extract insights** | 대화에서 인사이트 추출 |
| **Suggest new topics** | 새 노트 주제 제안받기 |

## Usage Workflow

```
1. 노트를 열거나 작성
2. "Start Socratic dialogue" 명령 실행
3. AI가 던지는 질문에 답변 작성
4. 여러 라운드 대화 진행
5. "Extract insights"로 핵심 인사이트 정리
6. 필요시 "Suggest new topics"로 후속 노트 주제 확보
```

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| AI Provider | 사용할 AI 프로바이더 | OpenAI |
| API Key | 선택한 프로바이더의 API 키 | - |
| Questions per round | 한 번에 생성할 질문 수 | 3 |
| Save dialogues | 대화 기록 자동 저장 | true |
| Language | 질문 생성 언어 | 한국어 |

## Related Plugins

이 플러그인은 다음 플러그인들과 잘 연계됩니다:

- **[Evergreen Note Cultivator](https://github.com/eohjun/obsidian-evergreen-note-cultivator)**: 품질 검증된 노트로 심화 대화
- **[PKM Note Recommender](https://github.com/eohjun/obsidian-pkm-note-recommender)**: 심화된 노트의 연결 추천
- **[Note Topic Finder](https://github.com/eohjun/obsidian-note-topic-finder)**: 추출된 인사이트를 새 주제 탐색에 활용

## Development

```bash
# Install dependencies
npm install

# Development with watch mode
npm run dev

# Production build
npm run build
```

## License

MIT
