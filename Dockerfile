# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm ci --only=production

# Copy the rest of the application's source code
COPY . .

# Create necessary directories
RUN mkdir -p pictures/generated pictures/toupload

# The command to run the application
ENTRYPOINT ["node", "src/index.js"] 