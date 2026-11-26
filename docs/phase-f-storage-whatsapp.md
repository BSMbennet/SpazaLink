# Phase F — Cloudflare R2 and WhatsApp Cloud API

## Cloudflare R2 storage
- The Cloudflare R2 bucket is named spazalink-media and is private.
- Shop photos, product photos and seller verification documents are uploaded to R2 using the S3-compatible API.
- Public catalogue photos are delivered using short-lived signed GET URLs. Seller identity and supporting documents use 60-second signed URLs in the admin review queue.
- Supabase remains the authentication and relational database provider. Existing Supabase Storage buckets are retained but new uploads use R2.

### Required frontend server environment
- CLOUDFLARE_ACCOUNT_ID
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_BUCKET_NAME=spazalink-media

Create an R2 API token with object read/write permissions limited to the spazalink-media bucket. Do not use an account-wide token and do not expose these values through NEXT_PUBLIC_ variables. The bucket remains private; no public development URL or public bucket access is required because the app signs reads server-side.

## WhatsApp Business Cloud API
- Backend sends transactional order templates to buyer and seller only when each has opted in.
- Users can add an E.164 phone number and grant or revoke consent at /settings/notifications.
- Cash order placement and seller order-state changes request notifications. Verified Paystack payments also trigger a payment-received notification.
- The inbound webhook validates Meta's X-Hub-Signature-256 signature. It accepts ORDER 123 messages and replies with the order state and payment state when the sender's number is linked to an opted-in account. Incoming message text is not stored in the database.

### Required backend environment
- WHATSAPP_ACCESS_TOKEN — long-lived system-user token with WhatsApp Business Messaging permission
- WHATSAPP_PHONE_NUMBER_ID — registered Cloud API sender number ID
- WHATSAPP_GRAPH_API_VERSION — current supported Graph API version for your Meta app
- WHATSAPP_TEMPLATE_NAME — approved template name, e.g. spazalink_order_update
- WHATSAPP_TEMPLATE_LANGUAGE=en
- WHATSAPP_WEBHOOK_VERIFY_TOKEN — a long random string you create and enter in Meta webhook settings
- META_APP_SECRET — Meta app secret used to validate incoming webhook signatures
- FRONTEND_ORIGIN — deployed SpazaLink origin, used to build order links
- SUPABASE_SERVICE_ROLE_KEY — backend-only service-role key, also required for WhatsApp opt-in lookup

Create and get Meta approval for a utility template named spazalink_order_update with exactly three body placeholders, in this order: order number, update text, and order link. Suggested body:

SpazaLink order {{1}} update: {{2}}. View details: {{3}}

Configure the Meta webhook callback URL as:
https://YOUR_BACKEND_HOST/v1/webhooks/whatsapp

Use the same WHATSAPP_WEBHOOK_VERIFY_TOKEN in Meta's Verify Token field and subscribe the WhatsApp product to the messages webhook field. The phone number must be registered for the Cloud API, and the access token must have the appropriate business messaging permission.

## Activation status
- The R2 bucket exists, but R2 API credentials are not configured in the app environment yet.
- WhatsApp routes and consent UI are implemented, but Meta app credentials, a registered Cloud API phone number and an approved message template are still required.
- No real WhatsApp messages have been sent yet. Messaging is best-effort and does not block orders.
