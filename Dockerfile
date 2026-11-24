FROM node:20-alpine

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source code
COPY . .

# Build production Tailwind CSS
RUN npm run build:css || true

# Create required runtime directories and set non-root ownership
RUN mkdir -p /app/uploads && chown -R node:node /app

# Non-root user execution to mitigate privilege escalation and container breakout
USER node

# Default environment configuration
ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

# Start BukSU DigiTab Node.js RESTful API & Server
CMD ["node", "server.js"]
