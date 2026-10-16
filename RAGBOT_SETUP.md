# Portfolio RAG bot setup

This implementation adapts the supplied guide to this Hugo portfolio. It does not reuse the other project's filenames, domains, repository layout or credentials.

Existing Dify app: **AIDA**  
Public share page: <https://udify.app/chat/0VFSQcouOi4BwHQZ>

## Architecture

```text
static/knowledge/*.md
        |
        v
scripts/sync_dify.py ----> Dify knowledge base ----> Dify chat app
                                                        ^
                                                        |
Hugo Field Guide <---- Cloudflare Worker proxy ---------+
```

The browser never receives a Dify key. The dataset key is used only by GitHub Actions; the app key is stored only as a Cloudflare Worker secret.

## 1. Configure Dify

1. Create or choose a Dify knowledge base and copy its dataset ID.
2. Create a dataset API key for the sync workflow.
3. Create a Chatflow or Chat app, connect that knowledge base, enable retrieval, and add the instructions from `DIFY_ASSISTANT_PROMPT.md`.
4. Create a separate app API key for the chat app.

The existing AIDA share URL identifies the correct hosted interface, but it is not an API key and cannot authenticate the Worker. Create the app key from AIDA's API Access page in Dify Studio.

Test source discovery without credentials:

```sh
python3 scripts/sync_dify.py --dry-run
```

For a one-off local sync, set `DIFY_DATASET_ID` and `DIFY_DATASET_API_KEY` in the shell and run `python3 scripts/sync_dify.py`. The script updates documents with stable names, waits for indexing, and only deletes stale Dify documents when `--prune` is explicitly supplied.

## 2. Configure GitHub Actions

Add this repository variable:

- `DIFY_DATASET_ID`

Add this repository secret:

- `DIFY_DATASET_API_KEY`

`DIFY_BASE_URL` is optional and should be a repository variable only when using a self-hosted Dify instance. The workflow syncs on relevant pushes to `main` or `master`, and it can also be run manually.

## 3. Deploy the Cloudflare Worker

From `cloudflare-worker/`:

```sh
npm install
npm test
npx wrangler login
npx wrangler secret put DIFY_APP_API_KEY
npm run deploy
```

Before deploying, replace `YOUR-PORTFOLIO-DOMAIN` in `cloudflare-worker/wrangler.jsonc`. Keep `http://localhost:1313` only if local Hugo testing should be allowed.

## 4. Connect Hugo

Set the deployed Worker origin in `hugo.toml`:

```toml
[params]
  ragProxyUrl = 'https://emil-portfolio-rag-proxy.YOUR-SUBDOMAIN.workers.dev'
```

Rebuild the site. With an empty `ragProxyUrl`, the Field Guide stays disabled and links directly to AIDA. With a Worker URL, it streams Dify responses. There is intentionally no browser-side answer fallback.

## Security boundary

- Never put either Dify key in Hugo, browser JavaScript or Git.
- Keep the Dify dataset key and app key separate.
- Keep the Worker's origin allowlist narrow.
- The Worker limits body size, validates identifiers, applies per-user rate limiting and does not return Dify error bodies to the browser.
- Questions sent to the online assistant leave the static site and are processed by Cloudflare and Dify; the interface discloses this before use.
