# ExpertHub — HostAfrica-ready configuration update

This archive updates the supplied repository's environment template, environment configuration, M-Pesa service, frontend API configuration, and `.gitignore`, and adds HostAfrica deployment guidance.

## Start locally
1. Copy `backend/.env.example` to `backend/.env`.
2. Set `DATABASE_URL` to a reachable MySQL database and generate unique JWT secrets.
3. Keep `MPESA_ENABLED=false` for simulator testing.
4. From `backend/`, install dependencies and run the Prisma commands listed in `backend/package.json`.
5. Start the server using the script in `backend/package.json`.

## Important
This is not a verified one-click HostAfrica deployment. The project requires a Node.js-capable hosting plan; standard PHP hosting alone is insufficient for the Express server. Check `HOSTAFRICA-DEPLOYMENT.md`. Also review and test all existing controllers, routes, Prisma schema, package scripts, and payment simulator wiring before accepting real customer payments.
