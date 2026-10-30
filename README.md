# Geo Search Stack

A small, self-contained demo stack for searching geographic data: places are stored in **PostgreSQL/PostGIS**, indexed in **OpenSearch** for full-text search, exposed through a **FastAPI** service, and displayed on a **Leaflet** map.

## Architecture

| Service      | Image / Tech                      | Port | Purpose                                   |
|--------------|-----------------------------------|------|-------------------------------------------|
| `db`         | `postgis/postgis:17-3.5`          | 5432 | Stores places with point geometries       |
| `opensearch` | `opensearchproject/opensearch`    | 9200 | Full-text search index                    |
| `api`        | FastAPI (Python 3.12)             | 8000 | Indexing and search endpoints (GeoJSON)   |
| `web`        | nginx + Leaflet                   | 3000 | Search box and map                        |

## Quick start

```bash
docker compose --env-file .env up -d --build
```

Then open:

- **Map:** http://localhost:3000 (try searching for "Schloss" or "Dom")
- **API docs:** http://localhost:8000/docs
- **DBeaver:** connect to PostgreSQL at `localhost:5432`, database `gis`, user `postgres` (defaults; credentials can be overridden in `.env`).

## How it works

1. On the first start, PostGIS creates the `places` table and loads 10 sample locations from `db/populated_places.sql`.
2. On startup, the API reads all places from PostGIS and (re)builds the OpenSearch index.
3. `GET /search?q=<term>` runs a fuzzy multi-field search in OpenSearch, then fetches the matching geometries from PostGIS and returns a GeoJSON `FeatureCollection`.
4. The web page sends the query to `/api/search` and renders the results as markers with popups.

## API

| Method | Endpoint                 | Description                                          |
|--------|--------------------------|------------------------------------------------------|
| GET    | `/search?q=...&limit=20` | Search places, returns GeoJSON sorted by relevance   |
| POST   | `/reindex`               | Rebuild the OpenSearch index from PostGIS            |

## Configuration

Defaults can be overridden with a `.env` file in the project root, next to this README:

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=passwordIsSave123456789
POSTGRES_DB=gis
```

## Source 

- Made with Natural Earth. Free vector and raster map data [naturalearthdata.com](https://www.naturalearthdata.com).