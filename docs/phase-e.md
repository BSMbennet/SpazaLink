# Phase E — Admin onboarding and verification

## Delivered
- Admin verification queue at `/admin`.
- Review and approve/reject seller and agent role requests.
- Seller-only private document upload at `/seller/verification` (PDF, JPEG, PNG, WebP; max 5 MB).
- Private seller documents are visible to their owner and admins only; the admin page creates 60-second signed links.
- Admin can approve/reject submitted documents and approve/reject/suspend shops.
- Shop approval activates marketplace visibility and records reviewer, review time and verification time.
- Shop approval is blocked until the seller has at least one approved verification document.
- Notifications are created for applicants after each review.
- Admin review functions lock records and check the current signed-in user's database role. Direct client writes to review records remain revoked.

## First-admin bootstrap (manual, project-owner only)
The production database currently has zero profiles and therefore zero admins. Do not make an admin through public sign-up or user-editable metadata.

1. Create your own account through the normal SpazaLink sign-up flow and confirm the email.
2. In the Supabase Dashboard for project `cnkfehrftjvknrohayna`, open SQL Editor.
3. Find your own Auth user ID:
   ```sql
   select id, email from auth.users order by created_at;
   ```
4. Promote only the exact user ID you control:
   ```sql
   update public.profiles
   set role = 'admin'::public.app_role, updated_at = now()
   where id = 'YOUR_AUTH_USER_UUID'::uuid
     and role = 'buyer'::public.app_role;
   ```
5. Verify the role:
   ```sql
   select id, role from public.profiles
   where id = 'YOUR_AUTH_USER_UUID'::uuid;
   ```
This is an owner-operated one-time bootstrap, not an app endpoint. Do not share admin credentials.

## Review sequence
1. Review the seller/agent request and approve the role only when the applicant is appropriate.
2. Applicant uploads a private supporting document.
3. Review the document; shop approval is blocked until at least one document is approved.
4. Review the shop details and approve it to make the shop visible in the marketplace.
5. Use review notes to explain a rejection or what needs correction.

## Security and limits
- No service-role key is used in the browser or these server actions.
- Private bucket files are never exposed as public URLs; temporary signed links expire after 60 seconds.
- RPC functions are in the exposed public schema and intentionally use tightly scoped SECURITY DEFINER because the app's direct profile/role/shop verification writes are not granted to users. Each checks auth.uid() and private.has_role('admin'); execution is revoked from PUBLIC and anon and granted to authenticated only.
- Uploaded identity or business documents are sensitive personal information. Collect only what is needed, restrict admin access, and define a retention/deletion process before the public pilot.
- No real admin, applicants, shops or uploaded documents exist yet. The bootstrap and real review workflow still need an authenticated end-to-end test.
