# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY pokemon-prop-hunt/package.json pokemon-prop-hunt/package-lock.json ./
RUN npm ci
COPY pokemon-prop-hunt/ .
RUN npm run build

# Stage 2: Nginx (reverse proxy + static file serving)
FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
