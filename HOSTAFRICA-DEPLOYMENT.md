# ExpertHub deployment on HOSTAFRICA

## Important hosting note
This repository is a Node.js + Express + Prisma application. A normal PHP-only shared hosting package cannot run `backend/server.js` as a persistent Node server. Before deploying, confirm that your specific HOSTAFRICA package provides **Node.js application hosting** (including a supported Node version, app startup/restart, environment variables, and a persistent process). If it does not, use a Node.js-capable VPS/cloud host for the backend and HOSTAFRICA for the domain/DNS or static frontend.

The backend also needs a MySQL-compatible database reachable by the Node app. Use the database hostname, database name, username, and password supplied in your hosting control panel. Do not assume `localhost` unless the host specifies it.

## Prepare the project
1. Upload/extract the project files in your hosting account or deploy from your Git repository.
2. Set the backend working directory to `backend/` if your control panel requires an application root.
3. Use a Node version supported by the host and compatible with the `backend/package.json`.
4. Install dependencies using the host's app manager or `npm install`.
5. Create a production environment file from `backend/.env.example`; never upload a real `.env` to a public repository.
6. Set `NODE_ENV=production`, `PORT` to the port assigned by the host, `APP_URL` and `FRONTEND_URL` to your actual HTTPS domain, and configure `DATABASE_URL` with your hosting database credentials.
7. Generate two different long random secrets for `JWT_SECRET` and `JWT_REFRESH_SECRET`.
8. Keep `MPESA_ENABLED=false` while testing. The simulator is not a real payment and must never be represented to customers as money received.
9. Run the Prisma generation/migration/seed commands defined in `backend/package.json` after checking the schema and database configuration.
10. Configure the app's startup command as `node server.js` only if the host's Node app manager expects that command; use its own documented startup workflow.
11. Point your domain/subdomain to the app using the DNS records supplied by HOSTAFRICA. Enable SSL/HTTPS in the hosting panel.
12. Test `/api/health`, registration, login, consultation creation, simulator payment, and role-based access before public launch.

## Frontend/API domains
For same-origin deployment, the frontend uses `/api` automatically. If frontend and backend are on different domains, set `window.__API_HOST__` before loading `frontend/js/config.js`, and add the frontend origin to `FRONTEND_URL` on the backend.

## Before launch
- Turn off development reset-link exposure: `DEV_EXPOSE_RESET_URL=false`.
- Use strong unique JWT secrets and production database credentials.
- Configure SMTP if transactional email is required.
- Configure backups, logging, upload limits, HTTPS, and access controls.
- Review the simulator and payment confirmation endpoints carefully. Simulator confirmations are test-only and do not verify actual money received.
- Do not set `MPESA_ENABLED=true` until you have valid Daraja production credentials and a publicly reachable HTTPS callback URL.
