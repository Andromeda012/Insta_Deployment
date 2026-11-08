"""
GLOBAL MOBİLYA — MODÜL 8 RENDER WORKER
Blender 4.x Headless CPU Test Scene Generator & Benchmark
=============================================================================
Creates a minimal geometric test scene with studio lighting to benchmark
CPU Cycles rendering without stressing the $12 DigitalOcean VPS.
=============================================================================
Usage in Blender headless:
  blender -b -P test_cube_scene.py -- <output_file> <samples> <resolution_xy>
"""

import sys
import os

try:
    import bpy
except ImportError:
    print("[ERROR] This script must be executed within Blender (e.g. blender -b -P test_cube_scene.py)")
    sys.exit(1)

def build_and_render_test_scene():
    # 1. Parse arguments after '--'
    argv = sys.argv
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    output_path = args[0] if len(args) > 0 else os.path.abspath("test_cube_output.jpg")
    samples = int(args[1]) if len(args) > 1 else 32
    resolution = int(args[2]) if len(args) > 2 else 800

    print(f"[BLENDER BENCHMARK] Initializing test scene...")
    print(f"  -> Output Path: {output_path}")
    print(f"  -> Samples: {samples}")
    print(f"  -> Resolution: {resolution}x{resolution}")

    # 2. Reset scene: delete all existing mesh & light objects
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    # 3. Configure Render Engine: Cycles on CPU (safe for $12 VPS)
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.adaptive_threshold = 0.05
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 1  # Strictly 1 CPU thread to avoid starving VPS publisher!

    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 90
    scene.render.filepath = output_path

    # 4. Create Studio Ground / Backdrop Plane
    bpy.ops.mesh.primitive_plane_add(size=10.0, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "Studio_Floor"
    floor_mat = bpy.data.materials.new(name="Floor_Material")
    floor_mat.use_nodes = True
    floor_nodes = floor_mat.node_tree.nodes
    floor_bsdf = floor_nodes.get("Principled BSDF")
    if floor_bsdf:
        floor_bsdf.inputs["Base Color"].default_value = (0.08, 0.10, 0.14, 1.0) # Deep charcoal studio floor
        floor_bsdf.inputs["Roughness"].default_value = 0.4
    floor.data.materials.append(floor_mat)

    # 5. Create Central Furniture Geometry Prototype (Beveled Cube Stand)
    bpy.ops.mesh.primitive_cube_add(size=1.6, location=(0, 0, 0.8))
    cube = bpy.context.active_object
    cube.name = "Furniture_Benchmark_Cube"

    # Add Bevel Modifier for realistic furniture edges
    bevel = cube.modifiers.new(name="Bevel", type='BEVEL')
    bevel.width = 0.04
    bevel.segments = 3

    # Warm Oak Wood Material Simulation
    cube_mat = bpy.data.materials.new(name="Warm_Oak_Material")
    cube_mat.use_nodes = True
    cube_nodes = cube_mat.node_tree.nodes
    cube_bsdf = cube_nodes.get("Principled BSDF")
    if cube_bsdf:
        cube_bsdf.inputs["Base Color"].default_value = (0.78, 0.58, 0.36, 1.0) # Warm oak tone
        cube_bsdf.inputs["Roughness"].default_value = 0.25
        cube_bsdf.inputs["Metallic"].default_value = 0.05
    cube.data.materials.append(cube_mat)

    # 6. Lighting: 3-Point Studio Setup
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

    # Rim / Hair Light (Separates silhouette from background)
    bpy.ops.object.light_add(type='POINT', location=(0, 3.5, 3.0))
    rim_light = bpy.context.active_object
    rim_light.data.energy = 120
    rim_light.data.color = (1.0, 1.0, 1.0)

    # 7. Architectural Camera (35mm, Centered & Angled)
    bpy.ops.object.camera_add(location=(3.6, -4.2, 2.8), rotation=(1.12, 0.0, 0.70))
    camera = bpy.context.active_object
    camera.data.lens = 45 # 45mm lens for natural furniture proportions
    scene.camera = camera

    # 8. Execute Render
    print("[BLENDER BENCHMARK] Starting render pass...")
    bpy.ops.render.render(write_still=True)
    print(f"[BLENDER BENCHMARK] Render successfully finished! Output saved to: {output_path}")

if __name__ == "__main__":
    build_and_render_test_scene()
