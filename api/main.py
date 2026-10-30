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
            "description": {"type": "text"},
            "category": {"type": "keyword"},
        }}},
    )
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            'SELECT id, COALESCE(NULLIF("NAME_DE", \'\'), NULLIF("NAME_EN", \'\'), "NAME"), '
            '"ADM0NAME", "FEATURECLA" FROM populated_places'
        ).fetchall()
    helpers.bulk(
        os_client,
        ({"_index": INDEX, "_id": r[0],
          "_source": {"name": r[1], "description": r[2], "category": r[3]}} for r in rows),
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


@app.get("/search")
def search(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=100)):
    """Full-text search in OpenSearch"""
    res = os_client.search(index=INDEX, body={
        "size": limit,
        "query": {"multi_match": {
            "query": q,
            "fields": ["name^2", "description", "category"],
            "fuzziness": "AUTO",
        }},
    })
    scores = {int(h["_id"]): h["_score"] for h in res["hits"]["hits"]}
    if not scores:
        return {"type": "FeatureCollection", "features": []}

    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            'SELECT id, COALESCE(NULLIF("NAME_DE", \'\'), NULLIF("NAME_EN", \'\'), "NAME"), '
            '"ADM0NAME", "FEATURECLA", ST_AsGeoJSON(geom) '
            'FROM populated_places WHERE id = ANY(%s)',
            (list(scores),),
        ).fetchall()

    features = [{
        "type": "Feature",
        "geometry": json.loads(r[4]),
        "properties": {"id": r[0], "name": r[1], "description": r[2],
                       "category": r[3], "score": scores[r[0]]},
    } for r in rows]
    features.sort(key=lambda f: f["properties"]["score"], reverse=True)
    return {"type": "FeatureCollection", "features": features}
