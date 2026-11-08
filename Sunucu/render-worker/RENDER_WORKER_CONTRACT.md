# GLOBAL MOBİLYA — MODÜL 8 CREATIVE PRODUCTION WORKER CONTRACT
## Headless 3D Render & AI Video Worker Communication Specification

### 1. Architectural Scope & Worker Isolation
The **Module 8 Production Worker** is an independent compute worker designed to run on dedicated GPU infrastructure (e.g. Ubuntu GPU VPS, RunPod, or local workstation) separate from the social media publisher (`Sunucu/publisher`).

> **CRITICAL RULE:** The existing social media publisher process (`Sunucu/publisher`) MUST NOT be overloaded with Blender 3D rendering or heavy FFmpeg transcoding tasks. This worker architecture guarantees 100% operational decoupling.

---

### 2. Supported Engine Types & Capabilities

| Engine ID | Role | Hardware Requirements | Typical Outputs |
|---|---|---|---|
| `blender_headless` | Cycles / EEVEE-Next photorealistic rendering | NVIDIA RTX GPU (CUDA/OptiX), min 8GB VRAM | 16:9 4K stills, 360° turntable video, 9:16 vertical |
| `ai_enhancer` | Texture & Dynamic range enhancement | CPU or moderate GPU | High-res WebP, PNG, PBR maps |
| `ai_3d_recon` | Multi-view photogrammetry & mesh synthesis | GPU with CUDA, 16GB RAM | GLB, GLTF, OBJ 3D models |
| `ffmpeg_transcoder` | Multi-format transcode & audio mastering | Multi-core CPU or NVENC | 9:16 Reels/Shorts, 1:1 Square, 16:9 Showroom |

---

### 3. REST API Communication Endpoints

All worker communication is conducted over HTTPS to `/api/module8` using standard JSON payloads.

#### 3.1 Worker Authentication
The worker authenticates using a secure shared secret:
- Header: `x-worker-key: <RENDER_WORKER_KEY>` OR `Authorization: Bearer <RENDER_WORKER_KEY>`
- Validated server-side against environment variable `RENDER_WORKER_KEY` (fallback: `SUPABASE_SERVICE_ROLE_KEY`).

---

### 4. Lifecycle Contracts

#### 4.1 Job Claiming Contract
- **Endpoint:** `POST /api/module8?action=worker-claim`
- **Request Payload:**
```json
{
  "worker_id": "gpu-node-fra-01",
  "supported_engines": ["blender_headless", "ffmpeg_transcoder"]
}
```
- **Response (When Job Available):**
```json
{
  "ok": true,
  "success": true,
  "job": {
    "id": "job-1731078900000",
    "production_type": "blender_render",
    "selected_engine": "blender_headless",
    "product_slug": "viyana-yatak-odasi-rs83",
    "config_params": {
      "sceneTemplateId": "vienna_luxury_salon",
      "resolution": "1920x1080",
      "samples": 256
    },
    "lease_expires_at": "2026-11-08T15:30:00.000Z"
  }
}
```
- **Response (Queue Empty):**
```json
{
  "ok": true,
  "success": true,
  "job": null,
  "message": "İş kuyruğu boş."
}
```

#### 4.2 Heartbeat & Progress Contract
- **Endpoint:** `POST /api/module8?action=worker-update`
- **Request Payload:**
```json
{
  "job_id": "job-1731078900000",
  "progress_percent": 65,
  "current_phase": "rendering",
  "status_message": "Rendering tile 128/200 on Cycles (OptiX)"
}
```
- **Response:** `{ "ok": true, "success": true, "job": { ... } }`

#### 4.3 Job Completion Contract
- **Endpoint:** `POST /api/module8?action=worker-complete`
- **Request Payload:**
```json
{
  "job_id": "job-1731078900000",
  "outputs": [
    {
      "output_type": "hero_still",
      "storage_path": "studio/render_frame/viyana/1731078999-render.jpg",
      "file_name": "viyana_salon_cycles_1920x1080.jpg",
      "file_format": "jpg",
      "resolution_label": "1920x1080",
      "width_px": 1920,
      "height_px": 1080,
      "file_size_bytes": 1450200
    }
  ],
  "metrics": {
    "gpu_seconds": 42.5,
    "cost_amount": 0.0350
  }
}
```
- **Server Action:**
  1. Sets job status to `completed` and `progress_percent: 100`.
  2. Creates records in `production_outputs`.
  3. Registers outputs in `media_assets`.
  4. Records cost in `production_costs`.
  5. Appends `worker_completed` event in `production_events`.

#### 4.4 Job Failure Contract
- **Endpoint:** `POST /api/module8?action=worker-fail`
- **Request Payload:**
```json
{
  "job_id": "job-1731078900000",
  "error_code": "OUT_OF_VRAM",
  "error_message": "CUDA out of memory error during denoising pass.",
  "error_details": {
    "vram_available_mb": 8192,
    "vram_requested_mb": 9400,
    "pass": "optix_denoise"
  }
}
```
- **Server Action:**
  1. Sets job status to `failed`.
  2. Stores structured error object `{ code, message, details, timestamp }`.
  3. Appends `worker_failed` event in `production_events`.

---

### 5. Idempotency & Fault Tolerance
1. **Idempotent Job Creation:** Every job has a unique `idempotency_key`. Duplicate submissions return the existing job (HTTP 200) without spawning a secondary job.
2. **Lease Timeout (Ghost Worker Recovery):** If a worker claims a job but crashes without completing or sending a heartbeat within 15 minutes (`lease_expires_at`), the supervisor marks the job eligible for reclamation.
3. **Structured Retries:** Failed jobs can be retried up to `max_retries` (default 3). The retry operation increments `retry_count`, resets status to `queued`, and preserves historical events.
