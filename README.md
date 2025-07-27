# sheets2sql

A lightweight ETL web service to sync data from Google Sheets to PostgreSQL.


## Quickstart

### 1. Clone the repository

```sh
git clone <your-repo-url>
cd extracto
```

### 2. Prepare environment variables

Copy the example environment files and edit them with your credentials:

```sh
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit backend/.env and frontend/.env in your editor
```

- **API_KEY**: Set a secret key for authenticating requests (use the same value in frontend and backend).
- **GOOGLE_API_KEY**: (Optional) For Google Sheets API if using API key auth. For service account, place your credentials JSON in the backend and update code as needed.
- **POSTGRES_CONNECTION_STRING**: Example: `postgresql://postgres:postgres@db:5432/sheets2sql`

### 3. Install Docker & Docker Compose

Make sure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 4. Build and start the services

```sh
docker-compose up --build
```

This will start:
- **Backend** (FastAPI): http://localhost:8000
- **Frontend** (Next.js): http://localhost:3000
- **Postgres**: http://localhost:5432 (internal)

### 5. Using the app

1. Open your browser and go to [http://localhost:3000](http://localhost:3000)
2. Fill in:
   - **Google Sheet URL** (or ID)
   - **Postgres Connection String** (should match your backend .env)
   - **Target Table Name** (the table to sync to)
   - **API Key** (must match your backend .env)
3. Click **Sync Now** to start the ETL process.
4. Use **Check Last Sync Status** to see the result of the last sync.

### 6. Stopping the app

Press `Ctrl+C` in your terminal, then run:
```sh
docker-compose down
```

---

## Development
...existing code...

## Development
- Backend: FastAPI in `/backend`
- Frontend: Next.js + Tailwind in `/frontend`

## Deployment
- See `docker-compose.yml`, `vercel.json`, and `render.yaml` for cloud options.

## License
MIT
