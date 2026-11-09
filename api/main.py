import json
import os
from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from opensearchpy import OpenSearch, helpers

DATABASE_URL = os.environ["DATABASE_URL"]
INDEX = "populated_places"
os_client = OpenSearch(hosts=[os.getenv("OPENSEARCH_URL", "http://opensearch:9200")])

def reindex() -> int:
    """Reads all places from PostGIS database and builds a OpenSearch-Index"""
    if os_client.indices.exists(index=INDEX):
        os_client.indices.delete(index=INDEX)
    os_client.indices.create(
        index=INDEX,
        body={"mappings": {"properties": {
            "name": {"type": "text"},
            "ADM0NAME": {"type": "text"},
        }}},
    )
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            'SELECT id, COALESCE(NULLIF("NAME_DE", \'\'), NULLIF("NAME_EN", \'\'), "NAME"), '
            '"ADM0NAME" FROM populated_places'
        ).fetchall()
    helpers.bulk(
        os_client,
        ({"_index": INDEX, "_id": r[0],
          "_source": {"name": r[1], "ADM0NAME": r[2], }} for r in rows),
        refresh=True,
    )
    return len(rows)

@asynccontextmanager
async def lifespan(app: FastAPI):
    reindex()
    yield

app = FastAPI(title="Geo-Suche", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.post("/reindex")
def reindex_endpoint():
    return {"indexed": reindex()}

@app.get("/countries")
def get_countries():
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            'SELECT id, "ADMIN", "CONTINENT", ST_AsGeoJSON(geom) '
            'FROM countries WHERE geom IS NOT NULL'
        ).fetchall()

    features = [{
        "type": "Feature",
        "geometry": json.loads(row[3]),
        "properties": {
            "id": row[0],
            "name": row[1],
            "continent": row[2],
        },
    } for row in rows]
    return {"type": "FeatureCollection", "features": features}

@app.get("/populated_places")
def get_populated_places():
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            'SELECT id, "NAME", "ADM0NAME", ST_AsGeoJSON(geom) '
            'FROM populated_places WHERE geom IS NOT NULL'
        ).fetchall()

    features = [{
        "type": "Feature",
        "geometry": json.loads(row[3]),
        "properties": {
            "id": row[0],
            "name": row[1],
            "adm0name": row[2],
        },
    } for row in rows]
    return {"type": "FeatureCollection", "features": features}

@app.get("/earthquakes")
def get_earthquakes(limit: int = Query(1000, ge=1, le=5000)):
    """Return recent earthquakes as GeoJSON (last 24 hours)."""
    with psycopg.connect(DATABASE_URL) as conn:
        # Filter earthquakes from the last 24 hours
        now_utc = "NOW() AT TIME ZONE 'UTC'"
        rows = conn.execute(
            """
            SELECT id, place, mag, depth_km, event_time, url, ST_AsGeoJSON(geom)
            FROM earthquakes AS e
            WHERE event_time >= NOW() - INTERVAL '24 hours'
            ORDER BY event_time DESC
            LIMIT %s
            """,
            (limit,),
        ).fetchall()

    features = [{
        "type": "Feature",
        "geometry": json.loads(row[6]),
        "properties": {
            "id": row[0],
            "place": row[1],
            "magnitude": row[2],
            "depth_km": row[3],
            "event_time": row[4].isoformat(),
            "url": row[5],
        },
    } for row in rows]
    return {"type": "FeatureCollection", "features": features}

@app.get("/search")
def search(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=100)):
    """Full-text search in OpenSearch"""
    res = os_client.search(index=INDEX, body={
        "size": limit,
        "query": {"multi_match": {
            "query": q,
            "fields": ["name^2"],
            "fuzziness": "1",
        }},
    })
    scores = {int(h["_id"]): h["_score"] for h in res["hits"]["hits"]}
    if not scores:
        return {"type": "FeatureCollection", "features": []}

    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            'SELECT id, COALESCE(NULLIF("NAME_DE", \'\'), NULLIF("NAME_EN", \'\'), "NAME"), '
            '"ADM0NAME", ST_AsGeoJSON(geom) '
            'FROM populated_places WHERE id = ANY(%s)',
            (list(scores),),
        ).fetchall()

    features = [{
        "type": "Feature",
        "geometry": json.loads(r[3]),
        "properties": {"id": r[0], "name": r[1], "ADM0NAME": r[2], "score": scores[r[0]]},
    } for r in rows]
    features.sort(key=lambda f: f["properties"]["score"], reverse=True)
    return {"type": "FeatureCollection", "features": features}
