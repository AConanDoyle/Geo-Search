# Geo Search Stack

A small, self-contained demo stack for searching geographic data: places are stored in **PostgreSQL/PostGIS**, indexed in **OpenSearch** for full-text search, exposed through a **FastAPI** service, and displayed on a **Leaflet** map.

## Architecture

| Service      | Image / Tech                      | Port | Purpose                                   |
|--------------|-----------------------------------|------|-------------------------------------------|
| `db`         | PostgreSQL 17 + PostGIS, `ogr_fdw`, `pg_cron` | 5432 | Stores country polygons, places, and earthquake data |
| `opensearch` | `opensearchproject/opensearch`    | 9200 | Full-text search index                    |
| `api`        | FastAPI (Python 3.12)             | 8000 | Indexing and search endpoints (GeoJSON)   |
| `web`        | nginx + Leaflet                   | 3000 | Search box and map                        |

## Quick start & restart
#### Start:

```bash
docker compose --env-file .env up -d --build
```

#### Restart:
```bash
docker compose down -v && docker compose --env-file .env up -d --build
```

Then open:

- **Map:** http://localhost:3000 (try searching for "Schloss" or "Dom")
- **API docs:** http://localhost:8000/docs
- **DBeaver:** connect to PostgreSQL at `localhost:5432`, database `gis`, user `postgres` (defaults; credentials can be overridden in `.env`).

## How it works

1. On the first start with an empty database volume, PostGIS runs `db/init.sql` to create tables, indexes, and database objects, then `db/data.sql` to load countries and cities.
2. On startup, the API reads all places from PostGIS and (re)builds the OpenSearch index.
3. `GET /search?q=<term>` runs a fuzzy multi-field search in OpenSearch, then fetches the matching geometries from PostGIS and returns a GeoJSON `FeatureCollection`.
4. The API returns stored earthquakes from `GET /earthquakes` as GeoJSON; the web map displays them as a toggleable layer with event details.
5. The web page sends place queries to `/api/search` and renders the results as markers with popups.

## API

| Method | Endpoint                 | Description                                      |
|--------|--------------------------|--------------------------------------------------|
| GET    | `/countries`             | Return country polygons as a GeoJSON FeatureCollection |
| GET    | `/populated_places`      | Return populated-place points as GeoJSON         |
| GET    | `/earthquakes?limit=1000` | Return recent stored earthquakes as GeoJSON     |
| GET    | `/search?q=...&limit=20` | Search places and return GeoJSON sorted by relevance |
| POST   | `/reindex`               | Rebuild the OpenSearch index from PostGIS        |

## Configuration

Defaults can be overridden with a `.env` file in the project root, next to this README:

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=passwordIsSave123456789
POSTGRES_DB=gis
```

## Source 

- Made with Natural Earth. Free vector and raster map data [naturalearthdata.com](https://www.naturalearthdata.com).
- Earthquake data from the [USGS all-day GeoJSON feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson).