FROM postgres:17-bookworm

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		postgresql-17-postgis-3 \
		postgresql-17-postgis-3-scripts \
		postgresql-17-ogr-fdw \
		postgresql-17-cron \
	&& rm -rf /var/lib/apt/lists/*

COPY --chown=postgres:postgres init.sql /docker-entrypoint-initdb.d/20_init.sql
COPY --chown=postgres:postgres data.sql /docker-entrypoint-initdb.d/30_data.sql