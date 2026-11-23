# Web search with a local model

Float Dot supports optional SearXNG search without a paid search API. Local inference still requires an installed Ollama model. Cloud providers retain their own billing.

## Setup

1. Start Docker Desktop with its Linux engine.
2. From this repository run `npm run setup:search`.
3. In Float Dot AI Settings, save `http://127.0.0.1:8888` as the SearXNG URL and enable **Search web with SearXNG**.
4. Ask a specific question, such as "Explain JavaScript Map lookup complexity with references."

The setup command creates a dedicated `float-dot-search` Compose project, binds port 8888 only on localhost, enables JSON search, and generates a random server secret under ignored `.artifacts/searxng/`. It uses the official SearXNG latest image; the first run downloads it. Stop it with `docker compose -p float-dot-search -f .artifacts/searxng/compose.json stop`.

An existing self-hosted instance also works. Its search settings must allow JSON. Remote endpoints require HTTPS. Endpoint redirects are rejected. No search API key is required.

## Behavior and limits

- Search is off by default. Enabling it sends the typed question or reviewed voice transcript as a query to SearXNG and its search engines. Do not include secrets in a search question.
- Ollama gets one bounded search-tool planning request. Unsupported models, invalid tool arguments, or a missing tool call fall back to searching the question. Other providers use direct search followed by their normal answer generation.
- Only `search_web` is available. The model cannot capture the screen, execute code, browse arbitrary pages, or access files through this tool.
- Up to five search snippets are supplied as untrusted reference data. They are not full-page reads. Source buttons open returned URLs only after a user click. Sources do not prove every generated claim is correct.
- Screenshots and conversation history are not included in the search planner request. Explicitly attached screen context still goes to the chosen answer model as before.
- Search failures show a recovery message. Turn off web search to answer without SearXNG. An empty result set allows an answer from model knowledge without sources.
- Web search does not validate generated code or eliminate small-model reasoning errors. Existing code-request formatting and hints-only policies remain active.

## Verification

100 unit tests pass, including search HTTP encoding, output limits, cancellation, unsupported tools, and provider preservation. `npm run smoke` covers the native app, source rendering, forged source IDs, and zero screen captures while searching, using synthetic local services. Live SearXNG and Ollama integration was verified after the runtime-directory recovery described below.

References: [SearXNG search API](https://docs.searxng.org/dev/search_api.html), [SearXNG server settings](https://docs.searxng.org/admin/settings/settings_server.html), [Ollama tool calling](https://docs.ollama.com/capabilities/tool-calling).

## Connection check and current machine blocker

Use **Test search connection** beside the endpoint in AI Settings. It sends only the fixed public query `JavaScript Map documentation`, does not change saved settings, and does not capture the screen or call the answer model. A successful response with zero results is shown separately from a working search.

On 10 October 2026, Docker startup was diagnosed more precisely: the backend cannot rename the inaccessible runtime socket `C:/Users/Aniket/AppData/Local/Docker/run/sailor-ingest.sock`. The backend log reports an unexpected startup error. A normal Docker stop completed; renaming the stale socket failed. Automatic approval review blocked removing that socket, so no alternative deletion method or factory reset was attempted. Containers and images were not removed. That initial attempt left live validation pending; the subsequent recovery below resolved the startup blocker.


## Recovery and live verification — 10 October 2026

With Docker processes stopped, inspected both runtime directories and confirmed their entries were zero-byte socket objects. Preserved them intact by renaming the parent directories, then created fresh empty directories. No sockets, containers, images, volumes, or persistent disks were deleted. Backups remain at:

- `C:/Users/Aniket/AppData/Local/Docker/run.backup-20261010-230934`
- `C:/Users/Aniket/AppData/Local/docker-secrets-engine.backup-20261010-230934`

Docker then started successfully (engine 29.8.0). `npm run setup:search` pulled the official image and started `float-dot-search-search-1`, bound only to `127.0.0.1:8888`. A live documentation search returned five results, including MDN.

`node scripts/live-web-check.cjs` verified that installed `qwen3:1.7b` issued `search_web`, received five live snippets, and generated a streamed answer. The report is saved to ignored `.artifacts/live-web-verification.json`. This integration check does not certify answer quality: the observed answer omitted inline citations and exceeded the requested three sentences. Source buttons still display the actual retrieved references.

The recovery is based on a [reported workaround in Docker's issue tracker](https://github.com/docker/desktop-feedback/issues/554), not a confirmed permanent fix. Other reports describe recurrence after stopping Docker. Do not automatically repeat filesystem repair or reset Docker data.
