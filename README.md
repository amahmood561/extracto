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


### 5. How to Use the App (Once Services Are Running)

1. **Open the Frontend**
   - Go to [http://localhost:3000](http://localhost:3000) in your web browser.

2. **Fill Out the Form**
   - **Google Sheet URL**: Paste the link to your public Google Sheet (or use a test link).
   - **Postgres Connection String**: Use the value from your backend `.env` (default: `postgresql://postgres:postgres@db:5432/sheets2sql`).
   - **Target Table Name**: Enter the name of the table you want to sync data into (e.g., `my_table`).
   - **API Key**: Enter the same API key you set in your backend `.env` file.

3. **Start the Sync**
   - Click the **Sync Now** button.
   - The backend will attempt to fetch the Google Sheet, clean the data, infer the schema, and upsert it into your Postgres database.

4. **Check Sync Status**
   - Click **Check Last Sync Status** to see if the sync succeeded and how many rows were processed.

5. **Troubleshooting**
   - If you see errors, check:
     - The API key matches in both frontend and backend.
     - The Google Sheet is public or accessible by your service account.
     - The Postgres connection string is correct.
     - Backend logs in the terminal for error details.

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
