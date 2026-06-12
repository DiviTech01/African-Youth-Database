FROM node:20-alpine

# Default to production. main.ts only enables localhost CORS origins and the
# JWKS TLS-validation bypass when NODE_ENV !== 'production', so this must be set.
# A platform (Render/Railway) can still override it via injected env.
ENV NODE_ENV=production

WORKDIR /app

# Copy everything
COPY . .

# Install all dependencies from root
RUN npm install --legacy-peer-deps

# Install workspace packages
RUN cd packages/database && npm install --legacy-peer-deps 2>/dev/null; true
RUN cd apps/api && npm install --legacy-peer-deps 2>/dev/null; true

# Generate Prisma client
RUN cd packages/database && npx prisma generate

# Build the API
RUN cd apps/api && npm run build

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
