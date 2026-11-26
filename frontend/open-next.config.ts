import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Keep the first Cloudflare preview stateless: no new cache bucket or
// production resource is created as part of this setup.
export default defineCloudflareConfig();
