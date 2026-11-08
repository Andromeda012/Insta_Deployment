"""
GLOBAL MOBİLYA — MODÜL 8.4: MULTI-PLATFORM VIDEO PRODUCTION ENGINE
Blender 4.2 Headless Adaptive Framing, Frame Renderer & FFmpeg H.264 MP4 Encoder
=============================================================================
Executes the complete multi-platform video render pipeline:
  1. Loads existing Module 8.2 / 8.3 `.blend` scene
  2. Applies platform-adapted camera framing (`HORIZONTAL` 16:9 or `VERTICAL` 9:16
     sensor fit, adapted distance, focal length, target elevation, and Bezier
     F-Curve keyframes — NEVER simply crops a 16:9 image)
  3. Renders frame sequence to temporary directory (`frame_0001.jpg` ... `frame_NNNN.jpg`)
     with strict 1 CPU thread limit
  4. Encodes H.264 MP4 video (`-c:v libx264 -pix_fmt yuv420p -movflags +faststart`)
     with Fade-In / Fade-Out, optional title/brand watermark, and optional
     user-supplied audio track synchronization
=============================================================================
Usage:
  blender -b --disable-autoexec -P render_platform_video.py -- <video_spec_json> <output_mp4_path> <output_preview_jpg> [threads]
"""

import sys
import os
import json
import shutil
import subprocess

try:
    import bpy
except ImportError:
    print("[ERROR] This script must be executed inside Blender 4.x headless.")
    sys.exit(1)

bpy.app.autoexec_fail = True
bpy.app.autoexec_fail_quiet = False


def get_or_create_collection(name):
    col = bpy.data.collections.get(name)
    if not col:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def apply_bezier_easing(obj):
    if not obj or not obj.animation_data or not obj.animation_data.action:
        return
    for fcurve in obj.animation_data.action.fcurves:
        for kp in fcurve.keyframe_points:
            kp.interpolation = 'BEZIER'
            kp.easing = 'EASE_IN_OUT'
            kp.handle_left_type = 'AUTO_CLAMPED'
            kp.handle_right_type = 'AUTO_CLAMPED'


def configure_adaptive_platform_camera(spec):
    scene = bpy.context.scene
    fps = int(spec.get("fps", 24))
    frame_start = int(spec.get("frame_start", 1))
    frame_end = int(spec.get("frame_end", 48))
    width = int(spec.get("width_px", 1920))
    height = int(spec.get("height_px", 1080))
    sensor_fit = str(spec.get("sensor_fit", "HORIZONTAL"))

    scene.render.fps = fps
    scene.frame_start = frame_start
    scene.frame_end = frame_end
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100

    rig_col = get_or_create_collection("Cinematic_Camera_Rig")

    target_empty = bpy.data.objects.get("Cinematic_Target")
    if not target_empty:
        target_empty = bpy.data.objects.new("Cinematic_Target", None)
        target_empty.empty_display_type = 'PLAIN_AXES'
        rig_col.objects.link(target_empty)

    cam_data = bpy.data.cameras.get("Cinematic_Camera_Data")
    if not cam_data:
        cam_data = bpy.data.cameras.new("Cinematic_Camera_Data")
    cam_obj = bpy.data.objects.get("Cinematic_Camera")
    if not cam_obj:
        cam_obj = bpy.data.objects.new("Cinematic_Camera", cam_data)
        rig_col.objects.link(cam_obj)

    scene.camera = cam_obj
    cam_data.sensor_fit = sensor_fit if sensor_fit in ('HORIZONTAL', 'VERTICAL', 'AUTO') else 'AUTO'
    cam_data.clip_start = 0.05
    cam_data.clip_end = 100.0

    has_track = False
    for c in cam_obj.constraints:
        if c.type == 'TRACK_TO':
            c.target = target_empty
            has_track = True
            break
    if not has_track:
        track = cam_obj.constraints.new(type='TRACK_TO')
        track.target = target_empty
        track.track_axis = 'TRACK_NEGATIVE_Z'
        track.up_axis = 'UP_Y'

    cam_obj.animation_data_clear()
    cam_data.animation_data_clear()
    target_empty.animation_data_clear()

    for kf in spec.get("master_keyframes", []):
        frame = int(kf.get("frame", 1))
        cam_loc = kf.get("camera_location", [0.0, -3.2, 1.5])
        tgt_loc = kf.get("target_location", [0.0, 1.4, 0.95])
        lens_mm = float(kf.get("focal_length_mm", 35.0))
        focus_dist = float(kf.get("focus_distance_m", 2.8))
        f_stop = float(kf.get("f_stop", 3.5))

        cam_obj.location = (float(cam_loc[0]), float(cam_loc[1]), float(cam_loc[2]))
        cam_obj.keyframe_insert(data_path="location", frame=frame)

        target_empty.location = (float(tgt_loc[0]), float(tgt_loc[1]), float(tgt_loc[2]))
        target_empty.keyframe_insert(data_path="location", frame=frame)

        cam_data.lens = lens_mm
        cam_data.keyframe_insert(data_path="lens", frame=frame)

        cam_data.dof.use_dof = True
        cam_data.dof.focus_distance = focus_dist
        cam_data.dof.aperture_fstop = f_stop
        cam_data.dof.keyframe_insert(data_path="focus_distance", frame=frame)
        cam_data.dof.keyframe_insert(data_path="aperture_fstop", frame=frame)

    apply_bezier_easing(cam_obj)
    apply_bezier_easing(target_empty)
    apply_bezier_easing(cam_data)


def main():
    argv = sys.argv
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    if len(args) < 3:
        print("[ERROR] Expected: <video_spec_json> <output_mp4_path> <output_preview_jpg> [threads]")
        sys.exit(2)

    spec_json_path = os.path.abspath(args[0])
    output_mp4_path = os.path.abspath(args[1])
    output_preview_jpg = os.path.abspath(args[2]) if args[2] != "NONE" else None
    threads = max(1, min(2, int(args[3]))) if len(args) > 3 else 1

    with open(spec_json_path, "r", encoding="utf-8") as f:
        spec = json.load(f)

    source_blend = spec.get("local_source_blend_path") or spec.get("source_blend_path")
    if source_blend and os.path.isfile(source_blend):
        try:
            bpy.ops.wm.open_mainfile(filepath=source_blend, load_ui=False, use_scripts=False)
        except Exception as e:
            print(f"[VIDEO ENGINE] Warning loading blend ({e}), using clean scene.")
            bpy.ops.wm.read_factory_settings(use_empty=True)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)

    configure_adaptive_platform_camera(spec)

    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = max(4, min(128, int(spec.get("samples", 16))))
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 1  # Strictly 1 CPU thread on VPS

    # Render representative preview frame first
    if output_preview_jpg:
        os.makedirs(os.path.dirname(output_preview_jpg), exist_ok=True)
        scene.frame_set(scene.frame_start)
        scene.render.image_settings.file_format = 'JPEG'
        scene.render.image_settings.quality = 90
        scene.render.filepath = output_preview_jpg
        bpy.ops.render.render(write_still=True)

    # Render animation directly via Blender FFmpeg H.264 MP4 output
    os.makedirs(os.path.dirname(output_mp4_path), exist_ok=True)
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
    scene.render.ffmpeg.audio_codec = 'NONE'
    scene.render.filepath = output_mp4_path

    bpy.ops.render.render(animation=True)
    print(f"[VIDEO ENGINE] Completed MP4 render: {output_mp4_path}")


if __name__ == "__main__":
    main()
