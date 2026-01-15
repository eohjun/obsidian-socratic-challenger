# Socratic Challenger

An AI-powered Obsidian plugin that deepens your thinking through Socratic questioning and extracts insights.

## Features

- **Critical Question Generation**: AI analyzes your note content and presents deep Socratic questions
- **Interactive Dialogue**: Develop your thoughts by answering questions in an interactive conversation
- **Insight Extraction**: Automatically organize key insights derived from the dialogue
- **New Topic Suggestions**: Recommend new note topics discovered during the deepening process
- **Dialogue History**: Save Q&A sessions to notes for future reference

## PKM Workflow

```
Current note → Socratic Challenger → Q&A Dialogue → Insights + New Topics
                    (Deepen)
```

## Supported AI Providers

| Provider | Model | Notes |
|----------|-------|-------|
| **OpenAI** | GPT-4o, GPT-4o-mini | Most stable question generation |
| **Google Gemini** | Gemini 1.5 Pro/Flash | Free tier available |
| **Anthropic** | Claude 3.5 Sonnet | Deep philosophical questions |

## Installation

### BRAT (Recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Open BRAT settings
3. Click "Add Beta plugin"
4. Enter: `eohjun/obsidian-socratic-challenger`
5. Enable the plugin

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from the latest release
2. Create folder: `<vault>/.obsidian/plugins/socratic-challenger/`
3. Copy downloaded files to the folder
4. Enable the plugin in Obsidian settings

## Setup

### API Key Configuration

1. Open Settings → Socratic Challenger
2. In **AI Provider** section:
   - Select AI Provider
   - Enter API key

## Commands

| Command | Description |
|---------|-------------|
| **Start Socratic dialogue** | Start Socratic dialogue for current note |
| **Continue dialogue** | Continue previous dialogue |
| **Extract insights** | Extract insights from dialogue |
| **Suggest new topics** | Get new note topic suggestions |

## Usage Workflow

```
1. Open or write a note
2. Run "Start Socratic dialogue" command
3. Write answers to AI-generated questions
4. Continue for multiple rounds
5. Use "Extract insights" to organize key insights
6. Optionally use "Suggest new topics" for follow-up note topics
```

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| AI Provider | AI provider to use | OpenAI |
| API Key | API key for selected provider | - |
| Questions per round | Number of questions per round | 3 |
| Save dialogues | Auto-save dialogue history | true |
| Language | Language for question generation | English |

## Related Plugins

This plugin works well with:

- **[Evergreen Note Cultivator](https://github.com/eohjun/obsidian-evergreen-note-cultivator)**: Deepen quality-verified notes
- **[PKM Note Recommender](https://github.com/eohjun/obsidian-pkm-note-recommender)**: Get connection recommendations for deepened notes
- **[Note Topic Finder](https://github.com/eohjun/obsidian-note-topic-finder)**: Use extracted insights for new topic exploration

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
