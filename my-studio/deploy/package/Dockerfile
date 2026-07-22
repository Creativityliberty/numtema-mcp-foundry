FROM node:22-alpine
WORKDIR /opt/foundry
COPY runtime-package/ ./
WORKDIR /opt/app
COPY template/ ./template/
COPY bootstrap.mjs healthcheck.mjs ./
ENV HOST=0.0.0.0 PORT=8788 DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8788
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 CMD ["node", "healthcheck.mjs"]
CMD ["node", "bootstrap.mjs"]
