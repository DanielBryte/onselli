# Browser uploads to the private R2 bucket

Media Library and digital-download files are sent directly from the browser to the private Cloudflare R2 bucket using short-lived signed `PUT` URLs. This keeps large files out of application request-body limits, but the bucket must allow browser cross-origin requests from each app origin.

In Cloudflare R2, open the bucket configured by `R2_BUCKET_NAME` (currently `onselli-digital-products`) and add a CORS policy with:

- Allowed origins: the exact production origin from `NEXT_PUBLIC_APP_URL`, plus `http://localhost:3000` for local development. Add each preview deployment origin that needs uploads.
- Allowed methods: `PUT`, `GET`, `HEAD`.
- Allowed headers: `Content-Type`.
- Exposed headers: `ETag`.
- Max age: `3600` seconds.

Do not use `*` for production origins and do not make the private bucket public. CORS is configured on the bucket, not in the app's response headers. The app's R2 token currently does not have permission to read bucket CORS settings, so deployment operators must configure and verify this policy in Cloudflare.

After saving the policy, reload the app and retry an upload. A browser `XMLHttpRequest.onerror` while sending the signed `PUT` is surfaced as a storage reachability/CORS error; the server-side completion check then verifies the uploaded object's size, MIME type, and file signature before publishing it to the library.
