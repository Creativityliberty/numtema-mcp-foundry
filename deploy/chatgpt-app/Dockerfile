FROM node:22-alpine
WORKDIR /app
COPY release/numtema-mcp-foundry-1.1.0.tgz /tmp/foundry.tgz
RUN npm install --global /tmp/foundry.tgz && rm /tmp/foundry.tgz
COPY . /app/runtime
WORKDIR /app/runtime
ENV NODE_ENV=production
EXPOSE 8788
CMD ["foundry", "app", "serve", "--config", "chatgpt-app-config.json"]
