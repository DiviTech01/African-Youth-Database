# Known Issues

Pre-existing errors flagged during Task 1 (CORS/domain fix). Not fixed in this commit — scheduled for Task 7 (end-to-end verification).

## TypeScript errors

1. `apps/api/src/modules/ai-chat/ai-chat.service.ts:50` — TS18046: 'error' is of type 'unknown'. Needs narrowing before accessing properties.
2. `apps/api/src/modules/ai-chat/ai-chat.service.ts:71` — TS2531: Object is possibly 'null'. Missing null guard.
3. `apps/api/src/modules/expert-directory/expert-directory.service.ts:221` — TS2353: 'status' does not exist in ExpertCreateInput. Schema/code mismatch.
4. `apps/api/src/modules/expert-directory/expert-directory.service.ts:242` — TS2551: Property 'country' does not exist. Should be 'countryId'.

These compile in production because the Docker build skips strict type checking.
