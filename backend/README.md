# Taghvim Backend

Render Web Service settings:

```text
Root Directory: .
Build Command: npm install && npm --workspace backend run build
Start Command: npm --workspace backend run start
Health Check Path: /health
```

Required environment variables:

```env
PORT=10000
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
FRONTEND_URL=https://taghvim.vercel.app
```

The API endpoint stays:

```text
/api/workspace
```
