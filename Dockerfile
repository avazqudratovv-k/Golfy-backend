# LOCAL DEVELOPMENT ONLY (no production hardening, no hosting config)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3011 3012
CMD ["npm", "run", "start"]
