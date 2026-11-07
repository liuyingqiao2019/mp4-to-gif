FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --chown=node:node package.json server.mjs cleanup.mjs ./
COPY --chown=node:node public ./public
RUN mkdir work && chown node:node work
USER node
ENV HOST=0.0.0.0 PORT=3815 FFMPEG_PATH=/usr/bin/ffmpeg FFPROBE_PATH=/usr/bin/ffprobe
EXPOSE 3815
CMD ["node", "server.mjs"]
