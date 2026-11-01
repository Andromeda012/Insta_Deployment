# Module 1 CMS workflow

Module 1 content changes now use a server-side CMS API. The browser never receives the Supabase service-role key.

## Content ownership

- Blog, gallery, supplier and the `genel` / `anasayfa` site settings are edited in Module 1.
- Module 1 product controls edit website presentation only.
- Module 7 remains the owner of product master data (name, SKU, dimensions, images and product deletion).
- Module 2/7 retain their existing non-Module-1 `site_settings` keys.
- The shared media bucket keeps legacy write access outside Module 1's protected folders. Module 1 folders are restricted to CMS managers.

## Required Vercel environment variables

Add these to the Vercel project for Production, Preview and Development:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | The project's Supabase URL |
| `SUPABASE_ANON_KEY` | The project's legacy anon key used by the Module 1 browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | The project's service-role secret key |

`SUPABASE_SERVICE_ROLE_KEY` must be a server-only variable. Never prefix it with `NEXT_PUBLIC_`, never put it in browser code, and never commit its value. Redeploy after adding or changing the variables.

## Create the first CMS administrator

1. In Supabase Dashboard, open **Authentication → Users** and create an email/password user.
2. Open that user and set **App Metadata** to:

   ```json
   { "role": "admin" }
   ```

3. Save the metadata, then sign in to Module 1 with that email and password.

Additional editors can use `{"role":"content_manager"}`. Do not put roles in user-editable User Metadata; the API and Storage policies trust App Metadata only.

## Workflow

1. Save a Module 1 form. It creates a numbered draft revision.
2. Choose **Publish now** in the confirmation prompt to publish immediately, or leave it as a draft.
3. Open **Taslaklar** to preview the saved revision payload and publish a pending draft.
4. Published revisions and before/after payloads are retained in `publication_logs`.

The preview panel currently displays the revision payload as JSON; a fully rendered public-site iframe preview and one-click rollback UI are not part of this first integration.

## Database migrations

The following migrations are committed under `supabase/migrations` and have been applied to the connected Supabase project:

- `202611010001_module1_cms_workflow.sql`
- `202611010002_module1_cms_policy_cleanup.sql`
- `202611010003_module1_product_web_settings_bridge.sql`
- `202611010004_module1_media_folder_security.sql`
- `202611010005_restore_module7_product_crud.sql`

Do not rerun the full `supabase_setup.sql` on the live database; it is a base-install script. It has been updated for future fresh installations.

## Notes on shared-module compatibility

- Anonymous writes to `blogs`, `gallery` and `suppliers` are disabled.
- Public reads remain available for the website.
- Public writes to `site_settings` are limited to keys other than `genel` and `anasayfa`, preserving Module 2/7 settings workflows.
- The existing Module 7 `products` master write workflow is intentionally unchanged.
- Shared media uploads in Module 2/7 folders remain compatible; Module 1's `urunler`, `anasayfa`, `galeri`, `blog` and `tedarikciler` folders require a CMS role.
