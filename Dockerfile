FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --production && npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose bridge port
EXPOSE 8811

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8811/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start bridge
CMD ["npm", "start"]
