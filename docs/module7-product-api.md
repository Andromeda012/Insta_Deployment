# Module 7 Product API and UI integration

## Current implementation

The Module 7 interface now authenticates with Supabase Auth using email/password. It accepts only users whose server-verified `app_metadata.role` is `admin` or `product_manager`. The interface persists the Supabase session, obtains the current access token, and sends it as a bearer token for all write operations. A sign-out control is available in the module header.

The product catalog remains `public.products`, the single master catalog. Public catalog reads use the anonymous key; all writes use server-side service-role access after role verification.

## Consolidated endpoint

To remain within the Vercel Hobby plan's 12 Serverless Function limit, Module 7 operations share one function:

- `GET /api/module7?action=products`: public product catalog read.
- `POST /api/module7?action=products`: create/update by `slug`; requires `admin` or `product_manager`.
- `DELETE /api/module7?action=products`: delete by `slug`; requires `admin` or `product_manager`.
- `GET /api/module7?action=settings`: read product transformation settings.
- `PUT /api/module7?action=settings`: save product transformation settings; requires an authorized role.
- `POST /api/module7?action=media`: upload PNG/JPEG/WebP product image to the public `media` bucket; requires an authorized role. Upload limit is 3 MB.

The API validates product fields, slug, title, SKU, settings keys, image MIME type and image size. Service-role credentials remain server-side.

## Shared authentication

`api/_lib/auth.js` is the reusable role-verification helper. Module 2 delegates its existing `admin` / `content_manager` check to this helper, preserving its prior permission behavior.

## Migration safety

The Module 7 interface no longer writes directly to Supabase tables or Storage. However, the old public write policies are intentionally still in place during the compatibility period. Do not revoke them until the live UI has been verified with real authorized accounts and all other product writers/consumers have been audited.

## Remaining validation

1. Create or confirm a Supabase Auth user with `app_metadata.role=admin` or `product_manager`.
2. Sign in through Module 7 and test catalog read, product create/update/delete, image upload, and transformation settings.
3. Confirm unauthenticated and unauthorized writes are rejected.
4. Audit any remaining external product writers before tightening database and Storage policies.

## Publishing

Module 2 enqueue remains automatic: valid queued posts do not wait for a separate human approval state. Cancellation remains available while a task is pending. Live publishing still requires both `DRY_RUN=false` and `ENABLE_LIVE_PUBLISHING=true`.
