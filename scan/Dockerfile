# Finance scan service: Claude Code (headless) behind a tiny HTTP endpoint. See README.md.
FROM node:22-alpine
ARG CLAUDE_CODE_VERSION=2.1.316
RUN npm install -g --no-audit --no-fund @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
 && npm cache clean --force
ENV NODE_ENV=production \
    DISABLE_AUTOUPDATER=1 \
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    DISABLE_TELEMETRY=1
COPY server.mjs /app/server.mjs
USER node
WORKDIR /home/node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["node", "/app/server.mjs"]
