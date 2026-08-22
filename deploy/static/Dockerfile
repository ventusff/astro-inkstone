# Static build, nginx serve. No CMS, no credentials, no runtime git — the
# reader-facing site is a record, not an editing surface, so it needs none of
# the machinery the editing machine carries.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
# The base path has to be baked in at build time: Astro writes it into every
# generated href.
# For a sub-path mount set /your/prefix/ (leading and trailing slash);
# for a root mount leave it as /.
ENV SITE_BASE=/
RUN npm run build

FROM nginx:alpine
# For a sub-path mount, place the output under a directory of the same name
# so nginx try_files matches without stripping the prefix; for a root mount,
# copy straight into the html root as below.
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/static/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
