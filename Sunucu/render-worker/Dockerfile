# ============================================================================
# GLOBAL MOBİLYA — MODÜL 8 RENDER WORKER DOCKERFILE (PRODUCTION HARDENED)
# ============================================================================
# Blender 4.2 LTS Headless + Node.js 22 Execution Environment
# Security: Non-root user, fail-fast dependency install, verified Blender binary.
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

# 3. Install and verify Blender 4.2 LTS headless binary
ARG INSTALL_BLENDER=true
RUN if [ "$INSTALL_BLENDER" = "true" ]; then \
      echo "Downloading Blender 4.2.0 LTS headless..." \
      && curl -fsSL https://download.blender.org/release/Blender4.2/blender-4.2.0-linux-x64.tar.xz -o /tmp/blender.tar.xz \
      && tar -xJf /tmp/blender.tar.xz -C /opt \
      && ln -s /opt/blender-4.2.0-linux-x64/blender /usr/local/bin/blender \
      && rm -f /tmp/blender.tar.xz \
      && blender --version ; \
    fi

# 4. Create non-root render user
RUN useradd -m -u 1001 -s /bin/bash renderbot

# 5. Setup working directory & strict dependency install (fail-fast on error)
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY --chown=renderbot:renderbot . .

USER renderbot

# 6. Comprehensive Container Healthcheck (verifies config, Blender binary, and host health)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD ["node", "healthcheck.js"]

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "worker-daemon.js"]
