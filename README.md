# Geo Search Stack

A small, self-contained demo stack for searching geographic data: places are stored in **PostgreSQL/PostGIS**, indexed in **OpenSearch** for full-text search, exposed through a **FastAPI** service, and displayed on a **Leaflet** map.

## Architecture

| Service      | Image / Tech                      | Port | Purpose                                   |
|--------------|-----------------------------------|------|-------------------------------------------|
| `db`         | PostgreSQL 17 + PostGIS, `ogr_fdw`, `pg_cron` | 5432 | Stores country polygons, places, and earthquake data |
| `opensearch` | `opensearchproject/opensearch`    | 9200 | Full-text search index                    |
| `api`        | FastAPI (Python 3.12)             | 8000 | Indexing and search endpoints (GeoJSON)   |
| `web`        | nginx + Leaflet                   | 3000 | Search box and map                        |

## Configuration

Copy `.env.example` to `.env` in the project root and set a unique `POSTGRES_PASSWORD`. Compose requires this value and has no built-in password fallback. `.env` is ignored by Git.

## Quick start & restart
#### Start:

```bash
cp .env.example .env
docker compose --env-file .env up -d --build
```

Replace the `POSTGRES_PASSWORD` placeholder in `.env` with a unique password before starting.

#### Restart (keeps database and index data):
```bash
docker compose --env-file .env restart
```

#### Reset database (deletes PostgreSQL data; keeps the OpenSearch index):
```bash
docker compose down
docker volume rm geo-search_pgdata
docker compose --env-file .env up -d --build
```

Then open:

- **Map:** http://localhost:3000 (try searching for "Schloss" or "Dom")
- **API docs:** http://localhost:8000/docs
- **DBeaver:** connect to PostgreSQL at `localhost:5432`; use the database, user, and password configured in `.env`.

## How it works

1. On the first start with an empty database volume, PostGIS runs `db/init.sql` to create tables, indexes, and database objects, then `db/data.sql` to load countries and cities.
2. On startup, the API reads all places from PostGIS and (re)builds the OpenSearch index.
3. `pg_cron` imports the USGS all-day feed every five minutes and stores events with magnitude 2.5 or greater.
4. `GET /search?q=<term>` searches places in OpenSearch and returns matching geometries from PostGIS as a GeoJSON `FeatureCollection`.
5. `GET /earthquakes` returns stored events from the last 24 hours; the web map displays them as a toggleable layer.
6. The web page sends place queries to `/api/search` and renders the results as markers with popups.

## API

| Method | Endpoint                 | Description                                      |
|--------|--------------------------|--------------------------------------------------|
| GET    | `/countries`             | Return country polygons as a GeoJSON FeatureCollection |
| GET    | `/populated_places`      | Return populated-place points as GeoJSON         |
| GET    | `/earthquakes?limit=1000` | Events from the last 24 hours as GeoJSON; default limit 1000, maximum 5000 |
| GET    | `/search?q=...&limit=20` | Search places as GeoJSON; default limit 20, maximum 100 |
| POST   | `/reindex`               | Rebuild the OpenSearch index from PostGIS        |

## Source 

- Made with Natural Earth. Free vector and raster map data [naturalearthdata.com](https://www.naturalearthdata.com).
- Earthquake data from the [USGS all-day GeoJSON feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson).