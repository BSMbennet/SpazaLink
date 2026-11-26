# Cloudflare Workers preview

This configuration is for an isolated **preview Worker** named `spazalink-preview`. It does not change the production hosting setup, attach a production domain, or configure production secrets.

## Cloudflare Workers Builds settings

- Repository: `BSMbennet/SpazaLink`
- Production branch: do not change it to `main` for a live launch. Use a dedicated preview branch/build while evaluating this setup.
- Root directory: `frontend`
- Build command:

```sh
npm install --no-save --package-lock=false @opennextjs/cloudflare@1.20.19 wrangler@4.168.0 && npx @opennextjs/cloudflare build
```

- Deploy command:

```sh
npx @opennextjs/cloudflare deploy
```

The adapter and Wrangler are pinned in these commands because this repository is an npm-workspaces monorepo and the one-time migration previously timed out while attempting to rewrite dependencies at the repository root. This keeps the existing root lockfile and application dependencies untouched for the preview setup.

## First preview safety checks

1. Do not add Supabase service-role keys, Paystack keys, WhatsApp tokens, or other production secrets to this preview Worker.
2. Do not connect a production domain or route traffic from the live app to this Worker.
3. The first build only verifies packaging. Before testing login, orders, uploads, or database writes, create a separate Supabase test project and use test-only credentials.
4. Check the Worker logs and test the public pages first. Cloudflare compatibility is not yet established for server-side image handling (`sharp`) or the S3-compatible upload path; do not treat a successful build as proof those features work.
5. Keep production on its existing host until the preview passes a full mobile and role-based test.

## Notes

- `frontend/open-next.config.ts` deliberately uses the adapter defaults. No R2 incremental-cache bucket is created by this configuration.
- `frontend/wrangler.jsonc` uses a separate Worker name and the required OpenNext asset and self-reference bindings.
- The application UI is not redesigned by this setup.
