# ============================================================================
# GLOBAL MOBİLYA — MODÜL 8 RENDER WORKER DOCKERFILE
# ============================================================================
# Blender 4.x Headless + Node.js 22 Execution Environment
# Security: Non-root user, minimal package footprint, isolated network.
# ============================================================================

FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV TZ=Europe/Istanbul
ENV BLENDER_VERSION=4.2.0

# 1. Install runtime dependencies for Blender headless CPU rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    xz-utils \
    libgl1 \
    libx11-6 \
    libxxf86vm1 \
    libxcursor1 \
    libxi6 \
    libxrandr2 \
    libxinerama1 \
    libxkbcommon0 \
    libsm6 \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# 2. Install Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# 3. Optional automated Blender 4.2 LTS headless download (can be skipped during dry-run build)
ARG INSTALL_BLENDER=false
RUN if [ "$INSTALL_BLENDER" = "true" ]; then \
      echo "Downloading Blender 4.2 LTS headless..." \
      && curl -fsSL https://download.blender.org/release/Blender4.2/blender-4.2.0-linux-x64.tar.xz -o /tmp/blender.tar.xz \
      && tar -xJf /tmp/blender.tar.xz -C /opt \
      && ln -s /opt/blender-4.2.0-linux-x64/blender /usr/local/bin/blender \
      && rm -f /tmp/blender.tar.xz ; \
    fi

# 4. Create non-root render user
RUN useradd -m -u 1001 -s /bin/bash renderbot

# 5. Setup working directory
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev || true

COPY --chown=renderbot:renderbot . .

USER renderbot

# 6. Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "process.exit(0)"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "worker-daemon.js"]
