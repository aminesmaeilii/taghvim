# Taghvim Backend

Render Web Service settings:

```text
Root Directory: .
Build Command: npm install && npm --workspace backend run build
Start Command: npm --workspace backend run start
Health Check Path: /health
Node Version: 20
```

Required environment variables:

```env
PORT=10000
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
FRONTEND_URL=https://taghvim.vercel.app
ALLOWED_ORIGINS=https://taghvim.vercel.app,http://localhost:1420,http://localhost:5173,http://127.0.0.1:1420,http://127.0.0.1:5173
```

The API endpoint stays:

```text
/api/workspace
```
