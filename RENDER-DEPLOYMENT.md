# Deploy ExpertHub on Render

This archive is configured for a Render Node.js web service. The app's Prisma schema currently uses **MySQL**, so this blueprint intentionally does not create a Render PostgreSQL database. Set `DATABASE_URL` to a reachable MySQL database connection string from a provider that permits connections from Render.

## Deploy
1. Extract this ZIP and push the contents of the `experthub/` folder to a GitHub repository.
2. In Render, choose **New + → Blueprint** and connect that repository. Render reads `render.yaml`.
3. When prompted, supply `DATABASE_URL`, `FRONTEND_URL`, and `APP_URL`.
   - `DATABASE_URL`: `mysql://USER:PASSWORD@HOST:3306/DATABASE` (URL-encode special characters in credentials).
   - `FRONTEND_URL`: your deployed frontend origin, e.g. `https://your-service.onrender.com` (comma-separated if multiple origins).
   - `APP_URL`: the public HTTPS URL for the app.
4. The blueprint generates separate JWT secrets automatically. Keep `MPESA_ENABLED=false` during testing.
5. Once the service deploys, open `https://YOUR-SERVICE.onrender.com/api/health`.
6. Confirm the response reports database connected. Then test registration, login, and simulator-only payment workflows using test accounts.

## Important deployment constraints
- The current Prisma datasource is MySQL. A Render-managed PostgreSQL database will not work with this schema unless you deliberately migrate the schema and application to PostgreSQL.
- The blueprint runs `prisma generate` during build; it does not run `prisma migrate deploy` because the archive does not include a verified migration history. Create and review migrations against your actual database before applying them.
- Render web-service filesystems are ephemeral by default. Uploaded files stored in `backend/uploads/` can be lost on redeploy/restart; use object storage or a suitable persistent disk for uploads.
- M-Pesa simulator mode does not charge money and is not proof of payment. Do not accept simulator confirmations as real payments.
- This package has not been deployed or integration-tested against your Render account or database. Review route/controller/schema consistency and run staging tests before launch.
