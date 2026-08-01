# Dawnly release checklist

This checklist is the final gate for a Vercel deployment. A local build can
prove the artifact and security checks, but the browser and hosting gates need
to be recorded against the actual Preview and Production URLs.

## Repository checks

- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run release:check`
- [ ] `git diff --check`
- [ ] `docs/implementation_plan.md` reflects only verified work

`npm run release:check` confirms that the production manifest and service
worker exist, that the manifest is Arabic/RTL and standalone, and that
server-only environment markers and configured values are absent from `dist`.

## Vercel checks

1. Configure Preview variables separately from Production variables using
   [docs/deployment-env.md](deployment-env.md).
2. Deploy a Preview from the release commit.
3. Open the Preview URL in Chrome DevTools and confirm the manifest, service
   worker, and install prompt are present.
4. Run the acceptance pass below against Preview.
5. Promote the same verified commit to Production, then repeat the health and
   PWA checks against the production domain.

## PWA checks

- [ ] Chrome desktop offers **Install Dawnly** and the installed window opens
  in standalone mode.
- [ ] Chrome Android offers **Add to Home screen** and the installed shortcut
  opens the same RTL app shell.
- [ ] A fresh installed-app launch shows the six-digit PIN gate before any
  ledger data is visible.
- [ ] With the network disabled after the first load, the app shell opens and
  cached ledger data remains available after unlock.
- [ ] `/api/*` requests are not served from the app-shell cache.

## Cloudflare keep-alive checks

The committed `wrangler.jsonc` defines the once-daily UTC schedule as
`0 3 * * *` for Preview and Production. Configure the Worker with the actual
Vercel URL before deployment:

```text
DAWNLY_PUBLIC_URL=https://<actual-dawnly-domain>
```

Set `DAWNLY_CRON_SECRET` as a Cloudflare Worker Secret and as a server-only
Vercel variable. Deploy the selected environment with the matching command:

```text
npx wrangler deploy --env preview
npx wrangler secret put DAWNLY_CRON_SECRET --env preview

npx wrangler deploy --env production
npx wrangler secret put DAWNLY_CRON_SECRET --env production
```

The health request is `GET /api/health/supabase` with the secret in the
`x-dawnly-cron-secret` header. The secret must never appear in the URL. After
the first scheduled run, confirm a 200 response in Vercel logs and no
transaction data in the response or Worker logs.

## Acceptance pass

- [ ] Correct PIN unlocks; five failures trigger the one-minute lockout.
- [ ] Manual add/edit/delete works and duplicate rules remain correct.
- [ ] Offline read and queued create/edit/delete survive reload and sync later.
- [ ] CSV preview, validation, import, and Settings export work on desktop and
  a narrow mobile viewport.
- [ ] Voice fallback is clear in a browser without SpeechRecognition; supported
  browser voice entry still requires review and explicit save.
- [ ] Light and dark modes remain Arabic and RTL.
- [ ] No source audio is retained.

Record the Preview and Production URLs, browser versions, date, and any failed
step in the deployment ticket before promoting Production.
