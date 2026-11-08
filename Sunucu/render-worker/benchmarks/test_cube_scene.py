"""
GLOBAL MOBİLYA — MODÜL 8 RENDER WORKER
Blender 4.x Headless CPU Studio Scene & Benchmark Driver
=============================================================================
Supports:
  1. Validated 3D Model Studio Rendering (.glb, .gltf, .obj, .fbx, .blend)
  2. Explicit Benchmark Test Scene (ONLY when --mode=benchmark is passed)
Enforces CPU Cycles rendering, fixed thread limits, and exact width x height.
=============================================================================
Usage in Blender headless:
  blender -b --disable-autoexec -P test_cube_scene.py -- <output_file> <samples> <width> <height> <threads> <mode> [model_path]
"""

import sys
import os

try:
    import bpy
except ImportError:
    print("[ERROR] This script must be executed within Blender (e.g. blender -b --disable-autoexec -P test_cube_scene.py)")
    sys.exit(1)

# Enforce autoexec script block inside Blender runtime as secondary defense
bpy.app.autoexec_fail = True
bpy.app.autoexec_fail_quiet = False


def setup_studio_lighting_and_camera(scene):
    # Studio Ground / Backdrop Plane
    bpy.ops.mesh.primitive_plane_add(size=12.0, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "Studio_Floor"
    floor_mat = bpy.data.materials.new(name="Floor_Material")
    floor_mat.use_nodes = True
    floor_bsdf = floor_mat.node_tree.nodes.get("Principled BSDF")
    if floor_bsdf:
        floor_bsdf.inputs["Base Color"].default_value = (0.08, 0.10, 0.14, 1.0)
        floor_bsdf.inputs["Roughness"].default_value = 0.4
    floor.data.materials.append(floor_mat)

    # 3-Point Studio Lighting Setup
    # Key Light (Warm 5600K)
    bpy.ops.object.light_add(type='AREA', location=(3.0, -3.0, 4.0))
    key_light = bpy.context.active_object
    key_light.data.energy = 250
    key_light.data.size = 2.0
    key_light.data.color = (1.0, 0.95, 0.85)

    # Fill Light (Cool & Soft)
    bpy.ops.object.light_add(type='AREA', location=(-3.5, -2.0, 2.5))
    fill_light = bpy.context.active_object
    fill_light.data.energy = 80
    fill_light.data.size = 3.0
    fill_light.data.color = (0.85, 0.92, 1.0)

    bpy.ops.object.light_add(type='POINT', location=(0, 3.5, 3.0))
    rim_light = bpy.context.active_object
    rim_light.data.energy = 120
    rim_light.data.color = (1.0, 1.0, 1.0)

    # Architectural Camera (45mm natural furniture lens)
    bpy.ops.object.camera_add(location=(3.6, -4.2, 2.8), rotation=(1.12, 0.0, 0.70))
    camera = bpy.context.active_object
    camera.data.lens = 45
    scene.camera = camera


def load_real_product_model(model_path):
    if not model_path or not os.path.isfile(model_path):
        raise RuntimeError(f"Real 3D model file does not exist: {model_path}")

    ext = os.path.splitext(model_path)[1].lower()
    if ext in ('.glb', '.gltf'):
        bpy.ops.import_scene.gltf(filepath=model_path)
    elif ext == '.obj':
        if hasattr(bpy.ops.wm, 'obj_import'):
            bpy.ops.wm.obj_import(filepath=model_path)
        else:
            bpy.ops.import_scene.obj(filepath=model_path)
    elif ext == '.fbx':
        bpy.ops.import_scene.fbx(filepath=model_path)
    elif ext == '.blend':
        bpy.ops.wm.open_mainfile(filepath=model_path, load_ui=False, use_scripts=False)
    else:
        raise RuntimeError(f"Unsupported 3D model extension: {ext}")


def create_benchmark_geometry():
    bpy.ops.mesh.primitive_cube_add(size=1.6, location=(0, 0, 0.8))
    cube = bpy.context.active_object
    cube.name = "Furniture_Benchmark_Cube"

    bevel = cube.modifiers.new(name="Bevel", type='BEVEL')
    bevel.width = 0.04
    bevel.segments = 3

    cube_mat = bpy.data.materials.new(name="Warm_Oak_Material")
    cube_mat.use_nodes = True
    cube_bsdf = cube_mat.node_tree.nodes.get("Principled BSDF")
    if cube_bsdf:
        cube_bsdf.inputs["Base Color"].default_value = (0.78, 0.58, 0.36, 1.0)
        cube_bsdf.inputs["Roughness"].default_value = 0.25
        cube_bsdf.inputs["Metallic"].default_value = 0.05
    cube.data.materials.append(cube_mat)


def build_and_render():
    argv = sys.argv
    args = argv[argv.index("--") + 1:] if "--" in argv else []

    if len(args) < 4:
        print("[ERROR] Insufficient arguments. Expected: <output_path> <samples> <width> <height> [threads] [mode] [model_path]")
        sys.exit(2)

    output_path = os.path.abspath(args[0])
    samples = max(1, min(128, int(args[1])))
    width = max(128, min(2048, int(args[2])))
    height = max(128, min(2048, int(args[3])))
    threads = max(1, min(2, int(args[4]))) if len(args) > 4 else 1
    mode = args[5] if len(args) > 5 else "product"
    model_path = args[6] if len(args) > 6 else ""

    print(f"[BLENDER WORKER] Mode: {mode} | Output: {output_path} | Resolution: {width}x{height} | Samples: {samples} | Threads: {threads}")

    bpy.ops.wm.read_factory_settings(use_empty=True)

    if mode == "product":
        if not model_path:
            print("[ERROR] Product render mode requires a valid 3D model path.")
            sys.exit(3)
        load_real_product_model(model_path)
        scene = bpy.context.scene
        if not scene.camera:
            setup_studio_lighting_and_camera(scene)
    elif mode == "benchmark":
        scene = bpy.context.scene
        setup_studio_lighting_and_camera(scene)
        create_benchmark_geometry()
    else:
        print(f"[ERROR] Unknown render mode: {mode}")
        sys.exit(4)

    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.adaptive_threshold = 0.05
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 1  # Strictly 1 CPU thread on 1 vCPU VPS to protect publisher

    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 92
    scene.render.filepath = output_path

    print("[BLENDER WORKER] Starting Cycles CPU render pass...")
    bpy.ops.render.render(write_still=True)
    print(f"[BLENDER WORKER] Render completed: {output_path}")


if __name__ == "__main__":
    build_and_render()
