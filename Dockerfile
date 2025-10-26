# ---------------- Base Image ----------------
FROM node:20-alpine

WORKDIR /app

# Copy package files and install deps
COPY package*.json ./
RUN npm install

# Copy the rest of your code
COPY . .

EXPOSE 5000

CMD ["npm", "run", "start"]
