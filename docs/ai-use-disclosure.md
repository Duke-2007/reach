# AI use disclosure

[TODO: Duke, read every line, correct it so it is true, and delete this note before submitting. Do not keep any statement you cannot stand behind.]

| Tool | What it was used for | What the team did |
|---|---|---|
| Claude (Anthropic, chat assistant) | Planning the build order; writing the Python pipeline scripts (`00`-`05`), the tests and the sensitivity check; reviewing outputs; drafting the documentation | Ran every script locally, checked the results against published figures (27.4% and 5.4%), chose the definitions, and reviewed the text |
| Trae (AI code editor) | Repository scaffold; early web app screens (navigation, gap map, missed vs covered, model screen) [TODO: confirm exact split] | Reviewed and tested each screen; fixed errors found in the browser |
| Devin (AI coding agent) | Parts of the web app and fixes [TODO: confirm which] | Reviewed and tested the results |
| Codex (OpenAI coding agent) | Simulator and district brief screens, and fixes [TODO: confirm] | Reviewed and tested the results |

## Data handling
[TODO: confirm] The raw survey microdata stayed on the team's own computer. Only column names, labels, counts and aggregated results were shared with AI assistants. The AI coding tools were instructed not to open `data/raw` or `data/processed`.

## Human responsibility
All code was run, checked and accepted by the team. The team is responsible for the submission, including its statistical choices and the wording of its conclusions.
