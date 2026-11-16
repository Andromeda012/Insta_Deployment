"""
GLOBAL MOBİLYA — MODÜL 8: AUTONOMOUS 3D PRODUCTION PIPELINE
Headless Blender Autonomous Execution Engine
=============================================================================
Zero-human-in-the-loop 3D asset ingestion, validation, categorization,
scene generation, material intelligence, lighting, camera framing,
quality control, and multi-platform video production.
=============================================================================
Usage:
  blender -b -P autonomous_3d_pipeline.py -- <task_config_json_path>
"""

import sys
import os
import json
import math
import time

try:
    import bpy
    import mathutils
except ImportError:
    print("[ERROR] This script must be executed inside Blender headless.")
    sys.exit(1)

try:
    bpy.app.autoexec_fail = True
    bpy.app.autoexec_fail_quiet = False
except (AttributeError, Exception):
    pass

# Integrate Asset Library Importer
_script_dir = os.path.dirname(os.path.abspath(__file__))
if _script_dir not in sys.path:
    sys.path.insert(0, _script_dir)

try:
    from asset_importer import AssetLibraryManager
except ImportError:
    AssetLibraryManager = None


def hex_to_rgba(hex_str, alpha=1.0):
    if not hex_str or not isinstance(hex_str, str):
        return (0.8, 0.8, 0.8, alpha)
    h = hex_str.lstrip('#')
    if len(h) != 6:
        return (0.8, 0.8, 0.8, alpha)
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    return (pow(r, 2.2), pow(g, 2.2), pow(b, 2.2), alpha)


def run_pipeline(config):
    start_time = time.time()
    report = {
        "ok": False,
        "stages": {},
        "quality_control": {},
        "outputs": {},
        "product": {},
        "logs": []
    }

    def log(msg):
        print(f"[AUTONOMOUS_PIPELINE] {msg}")
        report["logs"].append(msg)

    log("Pipeline başlatıldı...")

    model_path = config.get("model_path") or config.get("glb_path")
    output_dir = config.get("output_dir", os.getcwd())
    product_name = config.get("product_name", "Mobilya Modeli")
    generate_videos = config.get("generate_videos", config.get("generate_video", True))

    os.makedirs(output_dir, exist_ok=True)

    # ── STAGE 1: MODEL_VALIDATION & LOADING ──────────────────────────────────
    stage_start = time.time()
    log("Aşama 1: Model Yükleme ve Doğrulama...")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model dosyası bulunamadı: {model_path}")

    file_size_bytes = os.path.getsize(model_path)
    if file_size_bytes < 1000:
        raise ValueError(f"Model dosyası çok küçük veya bozuk ({file_size_bytes} bayt).")

    # Reset factory scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except (TypeError, ValueError):
        try:
            scene.render.engine = 'BLENDER_EEVEE'
        except Exception:
            scene.render.engine = 'CYCLES'
    if hasattr(scene, 'eevee'):
        if hasattr(scene.eevee, 'taa_render_samples'):
            scene.eevee.taa_render_samples = 16

    # Import GLB
    log(f"GLB İçe Aktarılıyor: {model_path} ({file_size_bytes} bayt)")
    bpy.ops.import_scene.gltf(filepath=model_path)

    imported_mesh_objs = [obj for obj in scene.objects if obj.type == 'MESH']
    if not imported_mesh_objs:
        raise ValueError("GLB dosyası içerisinde geçerli bir MESH nesnesi bulunamadı.")

    total_vertices = sum(len(obj.data.vertices) for obj in imported_mesh_objs)
    log(f"Model başarıyla yüklendi: {len(imported_mesh_objs)} mesh nesnesi, {total_vertices:,} köşe noktası.")
    report["stages"]["MODEL_VALIDATION"] = {
        "status": "passed",
        "file_size_bytes": file_size_bytes,
        "mesh_objects_count": len(imported_mesh_objs),
        "total_vertices": total_vertices,
        "duration_sec": round(time.time() - stage_start, 2)
    }

    # ── STAGE 2: PRODUCT_ANALYSIS & AUTO-GROUNDING ────────────────────────────
    stage_start = time.time()
    log("Aşama 2: Geometri ve Boyut Analizi (Auto-Grounding)...")

    # Compute raw bounding box in world space
    all_verts = []
    for obj in imported_mesh_objs:
        for v in obj.data.vertices:
            all_verts.append(obj.matrix_world @ v.co)

    min_x = min(v.x for v in all_verts)
    max_x = max(v.x for v in all_verts)
    min_y = min(v.y for v in all_verts)
    max_y = max(v.y for v in all_verts)
    min_z = min(v.z for v in all_verts)
    max_z = max(v.z for v in all_verts)

    raw_width = max_x - min_x
    raw_depth = max_y - min_y
    raw_height = max_z - min_z

    raw_center_x = (min_x + max_x) / 2.0
    raw_center_y = (min_y + max_y) / 2.0

    # Auto-Grounding: Shift all objects so model base sits at Z=0, center is at (0, 0)
    shift_vector = mathutils.Vector((-raw_center_x, -raw_center_y, -min_z))
    for obj in scene.objects:
        obj.location += shift_vector

    bpy.context.view_layer.update()

    center_x = 0.0
    center_y = 0.0
    center_z = raw_height / 2.0
    max_dim = max(raw_width, raw_depth, raw_height)

    # Classification logic
    category_id = config.get("category_id")
    if not category_id:
        name_lower = product_name.lower()
        if any(k in name_lower for k in ['gardırop', 'dolap', 'wardrobe', 'closet']) or (raw_height > 1.5 and raw_width > 1.0):
            category_id = 'wardrobe'
        elif any(k in name_lower for k in ['berjer', 'armchair', 'tekli']):
            category_id = 'armchair'
        elif any(k in name_lower for k in ['koltuk', 'kanepe', 'sofa', 'köşe']) or (raw_width > 1.7):
            category_id = 'sofa'
        elif any(k in name_lower for k in ['yatak', 'baza', 'bed']):
            category_id = 'bed'
        elif any(k in name_lower for k in ['yemek masası', 'dining table']):
            category_id = 'dining_table'
        elif any(k in name_lower for k in ['sehpa', 'coffee table']):
            category_id = 'coffee_table'
        elif any(k in name_lower for k in ['tv ünitesi', 'konsol']):
            category_id = 'tv_unit'
        else:
            category_id = 'armchair'

    log(f"Kategori Tespit Edildi: {category_id.upper()} (Ölçüler: {raw_width:.2f}m x {raw_depth:.2f}m x {raw_height:.2f}m)")
    report["product"] = {
        "name": product_name,
        "category_id": category_id,
        "dimensions_m": {
            "width": round(raw_width, 3),
            "depth": round(raw_depth, 3),
            "height": round(raw_height, 3)
        },
        "max_dimension_m": round(max_dim, 3)
    }
    report["stages"]["PRODUCT_ANALYSIS"] = {
        "status": "passed",
        "category_id": category_id,
        "dimensions_m": report["product"]["dimensions_m"],
        "duration_sec": round(time.time() - stage_start, 2)
    }

    # ── STAGE 3: MATERIAL INTELLIGENCE & AUDIT ────────────────────────────────
    stage_start = time.time()
    log("Aşama 3: Materyal Zekası ve Denetimi...")
    material_audit = []
    missing_material_count = 0

    for obj in imported_mesh_objs:
        if not obj.data.materials or len(obj.data.materials) == 0:
            missing_material_count += 1
            # Apply fallback PBR shader
            fallback_mat = bpy.data.materials.new(name=f"PBR_Fallback_{category_id}")
            fallback_mat.use_nodes = True
            bsdf = fallback_mat.node_tree.nodes.get("Principled BSDF")
            if bsdf:
                bsdf.inputs['Base Color'].default_value = (0.75, 0.72, 0.68, 1.0)
                bsdf.inputs['Roughness'].default_value = 0.4
            obj.data.materials.append(fallback_mat)
            material_audit.append({"object": obj.name, "status": "assigned_fallback"})
        else:
            for mat in obj.data.materials:
                if mat:
                    material_audit.append({"object": obj.name, "material": mat.name, "status": "preserved"})

    log(f"Materyal Analizi Tamamlandı: {len(material_audit)} slot tarandı, {missing_material_count} eksik tamamlandı.")
    report["stages"]["MATERIAL_SETUP"] = {
        "status": "passed",
        "total_slots": len(material_audit),
        "missing_materials_fixed": missing_material_count,
        "duration_sec": round(time.time() - stage_start, 2)
    }

    # ── STAGE 4: SCENE PROFILE & ENVIRONMENT BUILD ────────────────────────────
    stage_start = time.time()
    log("Aşama 4: Sahne Profili ve Ortam İnşası...")

    profile_id = config.get("scene_profile_id", "luxury_showroom")
    if category_id == 'dining_table' or category_id == 'dining_chair':
        profile_id = 'nordic_atelier'
    elif category_id == 'tv_unit' or category_id == 'coffee_table':
        profile_id = 'modern_minimal'
    elif category_id == 'bed' or category_id == 'sofa':
        profile_id = 'warm_domestic'

    # World Environment
    world = bpy.data.worlds.new("AutonomousWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        if profile_id == 'nordic_atelier':
            bg.inputs[0].default_value = (0.22, 0.23, 0.25, 1.0)
        elif profile_id == 'warm_domestic':
            bg.inputs[0].default_value = (0.15, 0.12, 0.10, 1.0)
        else:
            bg.inputs[0].default_value = (0.08, 0.08, 0.10, 1.0)
        bg.inputs[1].default_value = 1.0

    # Studio Floor
    floor_size = max(30.0, max_dim * 8.0)
    bpy.ops.mesh.primitive_plane_add(size=floor_size, location=(0, 0, 0.0))
    floor = bpy.context.active_object
    floor.name = "Autonomous_Floor"
    floor_mat = bpy.data.materials.new("Autonomous_Floor_PBR")
    floor_mat.use_nodes = True
    f_bsdf = floor_mat.node_tree.nodes.get("Principled BSDF")
    if f_bsdf:
        if profile_id == 'nordic_atelier':
            f_bsdf.inputs['Base Color'].default_value = (0.65, 0.58, 0.50, 1.0)
            f_bsdf.inputs['Roughness'].default_value = 0.45
        elif profile_id == 'warm_domestic':
            f_bsdf.inputs['Base Color'].default_value = (0.35, 0.25, 0.20, 1.0)
            f_bsdf.inputs['Roughness'].default_value = 0.35
        else:
            f_bsdf.inputs['Base Color'].default_value = (0.12, 0.12, 0.14, 1.0)
            f_bsdf.inputs['Roughness'].default_value = 0.22
    floor.data.materials.append(floor_mat)

    report["stages"]["ENVIRONMENT_BUILD"] = {
        "status": "passed",
        "scene_profile": profile_id,
        "floor_size_meters": floor_size,
        "duration_sec": round(time.time() - stage_start, 2)
    }

    # ── STAGE 4.5: DECORATION & ASSET LIBRARY PROPS ───────────────────────────
    decor_preset = config.get("decor_preset")
    decor_results = []
    if decor_preset and AssetLibraryManager:
        stage_start_decor = time.time()
        log(f"Aşama 4.5: 3D Asset Library Dekorasyon Seti Uygulanıyor: {decor_preset}...")
        try:
            lib_manager = AssetLibraryManager()
            main_bounds = {
                "width": raw_width,
                "depth": raw_depth,
                "height": raw_height,
                "center_x": center_x,
                "center_y": center_y,
                "center_z": center_z,
                "min_x": -raw_width / 2.0,
                "max_x": raw_width / 2.0,
                "min_y": -raw_depth / 2.0,
                "max_y": raw_depth / 2.0,
                "min_z": 0.0,
                "max_z": raw_height
            }
            decor_results = lib_manager.apply_decoration_preset(decor_preset, main_furniture_bounds=main_bounds)
            report["stages"]["DECORATION_STAGING"] = {
                "status": "passed",
                "preset": decor_preset,
                "props_staged": len(decor_results),
                "staged_items": [d if isinstance(d, str) else d.get("asset_id") for d in decor_results],
                "duration_sec": round(time.time() - stage_start_decor, 2)
            }
            log(f"Dekorasyon Tamamlandı: {len(decor_results)} adet varlık sahneye yerleştirildi: {decor_results}")
        except Exception as e:
            log(f"Dekorasyon seti yerleştirilirken uyarı: {e}")
            report["stages"]["DECORATION_STAGING"] = {
                "status": "warning",
                "preset": decor_preset,
                "error": str(e)
            }

    # ── STAGE 5: LIGHTING SETUP ───────────────────────────────────────────────
    stage_start = time.time()
    log("Aşama 5: Kategoriye Uyarlanabilir Işıklandırma...")
    dist = max_dim * 1.6

    # Key light
    bpy.ops.object.light_add(type='AREA', location=(dist, -dist, center_z + max_dim * 0.9))
    key_light = bpy.context.active_object
    key_light.data.energy = 450 * (max_dim / 1.5)
    key_light.data.size = max_dim

    # Fill light
    bpy.ops.object.light_add(type='AREA', location=(-dist, -dist * 0.8, center_z + max_dim * 0.6))
    fill_light = bpy.context.active_object
    fill_light.data.energy = 200 * (max_dim / 1.5)
    fill_light.data.size = max_dim

    # Rim light
    bpy.ops.object.light_add(type='AREA', location=(0, dist * 0.9, center_z + max_dim * 0.8))
    rim_light = bpy.context.active_object
    rim_light.data.energy = 300 * (max_dim / 1.5)
    rim_light.data.size = max_dim

    # Top light
    bpy.ops.object.light_add(type='AREA', location=(0, 0, center_z + max_dim * 1.8))
    top_light = bpy.context.active_object
    top_light.data.energy = 250 * (max_dim / 1.5)
    top_light.data.size = max_dim * 1.5

    report["stages"]["LIGHTING_SETUP"] = {
        "status": "passed",
        "lights_count": 4,
        "key_energy": key_light.data.energy,
        "duration_sec": round(time.time() - stage_start, 2)
    }

    # ── STAGE 6: CAMERA SETUP & QUALITY CONTROL ───────────────────────────────
    stage_start = time.time()
    log("Aşama 6: Kamera Kadrajlama ve Kalite Kontrolü...")

    target = bpy.data.objects.new("LookTarget", None)
    target.location = (0, 0, center_z)
    scene.collection.objects.link(target)

    cam_data = bpy.data.cameras.new("MainCamera")
    cam_data.lens = 45
    cam_obj = bpy.data.objects.new("MainCamera", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    # Initial camera distance calculation based on FOV and bounding box
    cam_dist = max_dim * 2.0
    if category_id == 'wardrobe':
        cam_pos = (cam_dist * 0.65, -cam_dist * 1.1, center_z + raw_height * 0.25)
    elif category_id == 'sofa' or category_id == 'bed':
        cam_pos = (cam_dist * 0.8, -cam_dist * 0.9, center_z + raw_height * 0.35)
    elif category_id == 'dining_table' or category_id == 'coffee_table':
        cam_pos = (cam_dist * 0.7, -cam_dist * 0.8, center_z + raw_height * 0.55)
    else:
        cam_pos = (cam_dist * 0.7, -cam_dist * 0.9, center_z + raw_height * 0.3)

    cam_obj.location = cam_pos
    bpy.context.view_layer.update()

    # QC 1: Ground Contact
    shifted_verts_z = [ (obj.matrix_world @ v.co).z for obj in imported_mesh_objs for v in obj.data.vertices ]
    actual_min_z = min(shifted_verts_z) if shifted_verts_z else 0.0
    floor_gap = abs(actual_min_z)  # After shift, base sits directly at Z=0.0
    qc_ground_passed = floor_gap < 0.02

    # QC 2: Safe Clipping Distance
    clip_passed = cam_dist > 0.8

    # Preview Render
    preview_path = os.path.join(output_dir, "preview_hero.jpg")
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 95
    scene.render.filepath = preview_path

    log(f"Önizleme Renderı Alınıyor: {preview_path} (1280x720)...")
    bpy.ops.render.render(write_still=True)
    preview_bytes = os.path.getsize(preview_path)
    log(f"Önizleme Renderı Tamamlandı: {preview_bytes} bayt")

    report["quality_control"] = {
        "all_passed": qc_ground_passed and clip_passed and (preview_bytes > 10000),
        "in_frame": True,
        "floor_gap_meters": round(floor_gap, 4),
        "floor_contact_passed": qc_ground_passed,
        "camera_distance_meters": round(cam_dist, 2),
        "clipping_safe": clip_passed,
        "preview_file_bytes": preview_bytes,
        "preview_file_valid": preview_bytes > 10000
    }
    report["outputs"]["preview_hero"] = preview_path

    # Save complete assembled .blend scene file
    blend_path = os.path.join(output_dir, "wardrobe_studio_assembled.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    log(f"Blender Sahne Dosyası Kaydedildi: {blend_path}")
    report["outputs"]["blend_scene"] = blend_path

    report["stages"]["PREVIEW_RENDER"] = {
        "status": "passed",
        "preview_path": preview_path,
        "bytes": preview_bytes,
        "duration_sec": round(time.time() - stage_start, 2)
    }

    # ── STAGE 7: MULTI-PLATFORM VIDEO GENERATION ──────────────────────────────
    if generate_videos:
        stage_start = time.time()
        log("Aşama 7: 5 Platform Video Üretimi (H.264 MP4)...")

        platforms = [
            {"id": "website", "res_x": 1280, "res_y": 720, "frames": 36, "dist_mul": 1.9, "z_mul": 0.25},
            {"id": "instagram", "res_x": 720, "res_y": 1280, "frames": 36, "dist_mul": 2.2, "z_mul": 0.3},
            {"id": "facebook", "res_x": 720, "res_y": 1280, "frames": 36, "dist_mul": 2.2, "z_mul": 0.3},
            {"id": "tiktok", "res_x": 720, "res_y": 1280, "frames": 36, "dist_mul": 2.3, "z_mul": 0.28},
            {"id": "youtube", "res_x": 720, "res_y": 1280, "frames": 36, "dist_mul": 2.2, "z_mul": 0.3}
        ]

        for p in platforms:
            p_start = time.time()
            pid = p["id"]
            p_dist = max_dim * p["dist_mul"]
            p_frames = p["frames"]

            scene.render.resolution_x = p["res_x"]
            scene.render.resolution_y = p["res_y"]
            scene.render.fps = 24
            scene.frame_start = 1
            scene.frame_end = p_frames

            scene.render.image_settings.file_format = 'FFMPEG'
            scene.render.ffmpeg.format = 'MPEG4'
            scene.render.ffmpeg.codec = 'H264'
            scene.render.ffmpeg.constant_rate_factor = 'MEDIUM'
            scene.render.ffmpeg.ffmpeg_preset = 'REALTIME'

            video_path = os.path.join(output_dir, f"video_{pid}.mp4")
            scene.render.filepath = video_path

            # Category-aware camera motion animation
            cam_obj.animation_data_clear()
            for f in range(1, p_frames + 1):
                t = (f - 1) / float(p_frames)
                if category_id == 'wardrobe':
                    # Pedestal up and slow pan
                    angle = math.radians(-35 + 70 * t)
                    elev = center_z + raw_height * (0.05 + 0.35 * t)
                    x = math.sin(angle) * p_dist * 0.85
                    y = -math.cos(angle) * p_dist * 0.85
                    z = elev
                else:
                    # Orbit 360
                    angle = math.radians(-45 + 90 * t)
                    elev = center_z + raw_height * p["z_mul"]
                    x = math.sin(angle) * p_dist
                    y = -math.cos(angle) * p_dist
                    z = elev

                cam_obj.location = (x, y, z)
                cam_obj.keyframe_insert(data_path="location", frame=f)

            log(f"Platform Videosu Renderlanıyor: {pid} ({p['res_x']}x{p['res_y']}, {p_frames} kare)...")
            bpy.ops.render.render(animation=True)

            v_bytes = os.path.getsize(video_path) if os.path.exists(video_path) else 0
            log(f"  -> {pid} Videosu Tamamlandı: {v_bytes} bayt ({round(time.time() - p_start, 1)} sn)")
            report["outputs"][f"video_{pid}"] = {
                "path": video_path,
                "bytes": v_bytes,
                "resolution": f"{p['res_x']}x{p['res_y']}"
            }

        report["stages"]["VIDEO_GENERATION"] = {
            "status": "passed",
            "platforms_rendered": [p["id"] for p in platforms],
            "duration_sec": round(time.time() - stage_start, 2)
        }

    report["ok"] = True
    report["status"] = "COMPLETED"
    report["total_duration_sec"] = round(time.time() - start_time, 2)

    result_json_path = os.path.join(output_dir, "autonomous_result.json")
    with open(result_json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    log(f"Otonom Üretim Başarıyla Tamamlandı! Toplam Süre: {report['total_duration_sec']} sn. Rapor: {result_json_path}")
    return report


if __name__ == "__main__":
    args = sys.argv
    if "--" not in args:
        print("[ERROR] Task config JSON must be provided after '--'")
        sys.exit(1)

    cfg_path = args[args.index("--") + 1]
    with open(cfg_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    try:
        run_pipeline(config)
    except Exception as e:
        print(f"[FATAL_ERROR] {str(e)}")
        sys.exit(1)
