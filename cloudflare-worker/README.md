# Portfolio RAG proxy

This Worker is the public boundary between the Hugo portfolio and Emil's Dify chat app. The Dify app key stays in Cloudflare; it is never shipped to the browser or committed to Git.

## Local setup

1. Copy `.dev.vars.example` to `.dev.vars` and replace the placeholder with the Dify **app** API key.
2. Replace `YOUR-PORTFOLIO-DOMAIN` in `wrangler.jsonc` with the deployed portfolio origin.
3. Run `npm install`, `npm test`, then `npm run dev`.
4. Set `params.ragProxyUrl` in the portfolio's `hugo.toml` to the local Wrangler URL while testing.

## Cloudflare deployment

```sh
npx wrangler login
npx wrangler secret put DIFY_APP_API_KEY
npm run deploy
```

After deployment, put the Worker URL in `hugo.toml` as `ragProxyUrl` and rebuild the Hugo site. Keep the dataset key separate; it belongs only in the sync workflow.

The rate-limit namespace ID in `wrangler.jsonc` is scoped to this Worker configuration. Change it if that ID is already used by another rate-limit binding in the same Cloudflare account.
