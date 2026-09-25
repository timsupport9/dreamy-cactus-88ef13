# ExpertHub — Render deployment package

This version includes a Render Blueprint (`render.yaml`), Node 22+ engine declarations, health-check configuration, multi-origin CORS handling, and a Render deployment guide.

**Database:** Prisma schema is MySQL, so configure an external reachable MySQL `DATABASE_URL`. The blueprint does not provision Render PostgreSQL, which is incompatible with the current schema.

See `RENDER-DEPLOYMENT.md` for the exact deployment steps and limitations. Keep `MPESA_ENABLED=false` while testing.
