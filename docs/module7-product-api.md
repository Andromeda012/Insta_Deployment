# Module 7 Product API — Initial Backend Foundation

## Status

The authenticated product API has been added. The Module 7 browser UI has **not yet been migrated** and still uses its legacy direct Supabase access. Do not revoke the existing `public.products` write policy until the UI and Storage upload paths have been migrated and tested.

## Endpoint

- `GET /api/module7-products`: public catalog read from the canonical `public.products` table.
- `POST /api/module7-products`: create/update a product (upsert by `slug`).
- `DELETE /api/module7-products`: delete a product by `slug`.

Writes require a valid Supabase access token and an `app_metadata.role` of `admin` or `product_manager`. Roles in `user_metadata` are not trusted. The service-role key is used only server-side.

The API allowlists product columns and validates slug, title, SKU, array fields and request size. Website-specific flags remain in the existing product schema for compatibility during the transition.

## Shared authentication

`api/_lib/auth.js` contains reusable role authentication. Module 2 now delegates its existing `admin` / `content_manager` check to this helper; its current permission behavior is preserved.

## Required next steps before cutover

1. Add a real Supabase sign-in/session experience to the main shell and ensure the embedded Module 7 iframe can obtain the authenticated session.
2. Migrate Module 7 catalog reads/writes and image uploads to server APIs.
3. Migrate product transformation settings writes to an authenticated API.
4. Test with an admin and product-manager account, including denied unauthenticated writes.
5. Only then tighten `products` and Storage write policies. Keep public product reads available if required by the storefront.

## Publishing mode

Module 2 enqueue currently writes new jobs with `status: pending`; the Publisher worker consumes eligible pending jobs without a separate human approval state. Cancellation is available while the job remains pending. This is the intended automatic-publishing flow. Live publishing still remains fail-closed behind both `DRY_RUN=false` and `ENABLE_LIVE_PUBLISHING=true`.
