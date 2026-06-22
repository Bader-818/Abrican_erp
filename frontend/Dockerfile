# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---------------------------------------------------------------------------
# development: used by docker-compose for local dev (Vite dev server + HMR)
# ---------------------------------------------------------------------------
FROM base AS development
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ---------------------------------------------------------------------------
# build: compiles the SPA for production
# ---------------------------------------------------------------------------
FROM base AS build
# Same-origin by default: the SPA calls "/api/v1", which nginx proxies to the
# backend. Override with --build-arg VITE_API_BASE_URL=... only if you serve
# the API on a different host.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm install
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# production: serve the static build with nginx
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
