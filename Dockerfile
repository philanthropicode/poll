# This Dockerfile is designed for a Node.js development environment.
FROM node:22-bookworm

# Create a consistent workspace
WORKDIR /workspace

# Install global dependencies needed for development
COPY package*.json ./
RUN npm install

# The following are in the package.json file, but 
# will not run unless they are installed separately here...
RUN npm install firebase
RUN npm install -g firebase-tools
# NOTE
#   Run `firebase login --no-localhost` in the container to authenticate.

COPY . .

# Expose likely dev ports
EXPOSE 3001 5173 3000 8080

# Default to a harmless long-running process; compose will override with per-service commands
CMD ["bash", "-lc", "node -e \"setInterval(()=>{},1e9)\""]


# NOTE: TO execute commands in the container, use:
#   podman exec -it poll bash