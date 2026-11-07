FROM node:22-bookworm-slim
# RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
    sed -i \
        -e 's|https\?://deb.debian.org|http://mirrors.tuna.tsinghua.edu.cn|g' \
        -e 's|https\?://security.debian.org|http://mirrors.tuna.tsinghua.edu.cn|g' \
        -e 's|https://mirrors.tuna.tsinghua.edu.cn|http://mirrors.tuna.tsinghua.edu.cn|g' \
        /etc/apt/sources.list.d/debian.sources; \
    apt-get update -o APT::Update::Error-Mode=any; \
    apt-get install -y --no-install-recommends ca-certificates; \
    update-ca-certificates; \
    sed -i \
        's|http://mirrors.tuna.tsinghua.edu.cn|https://mirrors.tuna.tsinghua.edu.cn|g' \
        /etc/apt/sources.list.d/debian.sources; \
    apt-get update -o APT::Update::Error-Mode=any; \
    apt-get install -y --no-install-recommends ffmpeg; \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --chown=node:node package.json server.mjs cleanup.mjs ./
COPY --chown=node:node public ./public
RUN mkdir work && chown node:node work
USER node
ENV HOST=0.0.0.0 PORT=3815 FFMPEG_PATH=/usr/bin/ffmpeg FFPROBE_PATH=/usr/bin/ffprobe
EXPOSE 3815
CMD ["node", "server.mjs"]
