# Firefly III Custom: upstream's image with this branch's views and front-end assets.
#
#   docker build -f custom/Dockerfile -t firefly-custom:6.7.9 .
#
# resources/views and the rebuilt public/build change, plus the custom pages' route
# (routes/web.php) and controllers (app/Http/Controllers/Custom). The database and
# the API stay upstream's, so rolling back means running upstream's image again.
# FIREFLY_VERSION must match the upstream tag this branch is based on.
ARG FIREFLY_VERSION=6.7.9

FROM node:22-alpine AS assets
WORKDIR /src
COPY package.json package-lock.json ./
COPY resources/assets/v3/package.json resources/assets/v3/package.json
RUN npm ci --no-audit --no-fund
COPY resources/assets/v3 resources/assets/v3
RUN cd resources/assets/v3 && npm run build

FROM fireflyiii/core:version-${FIREFLY_VERSION}
COPY --chown=www-data:www-data resources/views /var/www/html/resources/views
COPY --from=assets --chown=www-data:www-data /src/public/build /var/www/html/public/build
COPY --chown=www-data:www-data routes/web.php /var/www/html/routes/web.php
COPY --chown=www-data:www-data app/Http/Controllers/Custom /var/www/html/app/Http/Controllers/Custom
LABEL org.opencontainers.image.source="https://github.com/gauv2/firefly-iii-custom" \
      org.opencontainers.image.description="Firefly III with the Firefly III Custom redesign"
