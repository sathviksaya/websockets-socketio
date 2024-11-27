## BUILD STAGE
# Imports a base Nodejs image from the docker repository and
# Implies that this stage is for building and compiling the TypeScript code
FROM node:16-alpine AS build

# Specifies the working directory in the container from which the app will be served
WORKDIR /app

# Copy files into the container’s working directory
COPY package*.json .

# Install the project dependencies
RUN npm install

# Copy the source code into the container’s work directory
COPY . .

# Build the TypeScript code
RUN npm run build

## PRODUCTION STAGE
# Create the final, optimized production image
FROM node:16-alpine AS production

# Specifies the working directory in the container from which the app will be served
WORKDIR /app

# Copy files into the container’s working directory
COPY package*.json .

# Install only production dependencies when creating the production image
RUN npm ci --only=production

# Copy the compiled code from the build stage into the dist folder in the production environment
COPY --from=build /app/dist ./dist

# Expose the port that our app will run on
EXPOSE 8000

# Execute the command to run the compiled app in the production environment
CMD ["node", "dist/server.js"]