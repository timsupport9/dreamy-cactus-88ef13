# ExpertHub Kenya
E-School & Consultation platform — MySQL + M-Pesa (KES) + role dashboards.

## Quick start
```bash
docker compose up -d                # MySQL + Redis
cd backend && cp .env.example .env  # then edit JWT_SECRET / MPESA_*
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev                         # http://localhost:5000
```

## Demo logins
| Role   | Email                | Password  |
|--------|----------------------|-----------|
| Admin  | admin@platform.com   | admin123  |
| Expert | expert@platform.com  | expert123 |
| User   | user@platform.com    | user123   |

## M-Pesa
Create a Daraja app → set `MPESA_CONSUMER_KEY/SECRET/SHORTCODE/PASSKEY/CALLBACK_URL`. Use ngrok in dev.
