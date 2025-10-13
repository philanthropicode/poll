# This Dockerfile is designed for a Node.js development environment.
FROM node:22-bookworm

# Create a consistent workspace
WORKDIR /usr/src/app

# Install global dependencies needed for development
COPY package*.json ./
RUN npm install

# The following are in the package.json file, but 
# will not run unless they are installed separately here...
RUN npm install firebase
RUN npm install -g firebase-tools


# Copy the rest of the source
COPY . .

# Expose likely dev ports
EXPOSE 3001 5173 3000 8080

# Default to a harmless long-running process; compose will override with per-service commands
CMD ["bash", "-lc", "node -e \"setInterval(()=>{},1e9)\""]


# NOTE
#   Don’t run firebase login during build.
#   Run `firebase login --no-localhost` in the container to authenticate
#   Use firebase deploy --token "$FIREBASE_TOKEN" at runtime when you actually deploy.
#
#   To get a token locally: 
#       `firebase login:ci` (copies a token you can put in .env and pass into compose).
#       Inside the container, `firebase login --no-localhost` also works interactively.

# NOTE
#   To execute commands in the container, use:
#     podman exec -it poll bash