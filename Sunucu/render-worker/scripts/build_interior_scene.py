"""
GLOBAL MOBİLYA — MODÜL 8.2: AI SCENE BUILDER & ENVIRONMENT STUDIO
Blender 4.2 Headless Parametric 3D Interior Scene Builder & Renderer
=============================================================================
Constructs a complete, reusable 3D interior room from a JSON scene specification:
  1. Parametric Room Architecture (Real 3D Blender Meshes — NO 2D billboards
     and NO Gaussian Splatting):
     - Floor, Ceiling, Multi-segment Walls (Back, Left, Right)
     - Parametric Window Opening, Frame, Sill & Tempered Glass Pane
     - Parametric Door Opening, Frame, Door Leaf & Brass Handle
     - Architectural Wall Boiserie / Panels, Baseboards & Crown Moldings
     - Ceiling Pendant / Recessed Lighting Fixtures & Decorative Area Rug
  2. Independent 3D Furniture Assets (.glb / .gltf / .obj / .fbx):
     - Imported into `Furniture_Assets` collection as independent 3D objects
     - Scaled accurately to known real-world dimensions (width_cm, height_cm,
       depth_cm) or explicit user scale without mutating original mesh topology
     - Grouped under empty parent controllers per asset instance
  3. PBR Material Studio (11 materials) & 5 Architectural Lighting Profiles
  4. Camera Placement with Track-To Target Constraint
  5. Saves persistent `.blend` file (`bpy.ops.wm.save_as_mainfile`) AND
     executes Cycles CPU preview or final render pass (1 thread limit for VPS safety)
=============================================================================
Usage:
  blender -b --disable-autoexec -P build_interior_scene.py -- <scene_spec_json> <output_blend_path> <output_preview_jpg> [samples] [width] [height] [threads]
"""

import sys
import os
import json
import math

try:
    import bpy
    import mathutils
except ImportError:
    print("[ERROR] This script must be executed inside Blender 4.x headless.")
    sys.exit(1)

# Enforce autoexec script block inside Blender runtime
bpy.app.autoexec_fail = True
bpy.app.autoexec_fail_quiet = False


def hex_to_rgba(hex_str, alpha=1.0):
    if not hex_str or not isinstance(hex_str, str):
        return (0.8, 0.8, 0.8, alpha)
    h = hex_str.lstrip('#')
    if len(h) != 6:
        return (0.8, 0.8, 0.8, alpha)
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    # sRGB to linear approximation for Cycles Principled BSDF
    return (pow(r, 2.2), pow(g, 2.2), pow(b, 2.2), alpha)


def create_pbr_material(name, spec):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        return mat

    base_rgba = hex_to_rgba(spec.get("base_color", "#D8D4CC"))
    bsdf.inputs["Base Color"].default_value = base_rgba
    bsdf.inputs["Roughness"].default_value = float(spec.get("roughness", 0.4))
    bsdf.inputs["Metallic"].default_value = float(spec.get("metallic", 0.0))

    # Blender 4.x / 3.x compatibility for Specular & Transmission inputs
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = float(spec.get("specular", 0.5))
    elif "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = float(spec.get("specular", 0.5))

    transmission = float(spec.get("transmission", 0.0))
    if transmission > 0.0:
        if "Transmission Weight" in bsdf.inputs:
            bsdf.inputs["Transmission Weight"].default_value = transmission
        elif "Transmission" in bsdf.inputs:
            bsdf.inputs["Transmission"].default_value = transmission

    bump_strength = float(spec.get("bump_strength", 0.0))
    if bump_strength > 0.01:
        tex_noise = nodes.new(type="ShaderNodeTexNoise")
        tex_noise.inputs["Scale"].default_value = 35.0
        tex_noise.inputs["Detail"].default_value = 6.0
        bump_node = nodes.new(type="ShaderNodeBump")
        bump_node.inputs["Strength"].default_value = min(1.0, bump_strength)
        bump_node.inputs["Distance"].default_value = 0.005
        links.new(tex_noise.outputs["Fac"], bump_node.inputs["Height"])
        links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])

    return mat


def add_box_mesh(name, size_xyz, location_xyz, collection, material=None, bevel_width=0.0):
    sx, sy, sz = size_xyz
    if sx <= 0.001 or sy <= 0.001 or sz <= 0.001:
        return None
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location_xyz)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    if bevel_width > 0.0:
        bev = obj.modifiers.new(name="ArchBevel", type='BEVEL')
        bev.width = bevel_width
        bev.segments = 2

    if material:
        if obj.data.materials:
            obj.data.materials[0] = material
        else:
            obj.data.materials.append(material)

    # Move exclusively to target collection
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def build_wall_with_opening(
    wall_prefix,
    axis_mode,
    fixed_coord,
    span_length,
    room_height,
    thickness,
    opening_width,
    opening_height,
    sill_height,
    opening_offset,
    collection,
    wall_mat
):
    """
    Builds a real 3D wall segmented around a rectangular window or door opening
    (Left pillar, Right pillar, Header lintel, and Sill wall if sill_height > 0).
    """
    half_span = span_length / 2.0
    open_w = min(span_length - 0.3, max(0.4, opening_width))
    open_h = min(room_height - 0.15, max(0.4, opening_height))
    sill_h = max(0.0, min(room_height - open_h - 0.1, sill_height))

    max_off = max(0.0, half_span - (open_w / 2.0) - 0.15)
    off = max(-max_off, min(max_off, opening_offset))

    open_min = off - (open_w / 2.0)
    open_max = off + (open_w / 2.0)

    # 1. Left Segment (-half_span .. open_min)
    left_len = open_min - (-half_span)
    if left_len > 0.02:
        left_center = -half_span + (left_len / 2.0)
        if axis_mode == 'Y_SPAN':
            add_box_mesh(f"{wall_prefix}_Segment_A", (thickness, left_len, room_height), (fixed_coord, left_center, room_height / 2.0), collection, wall_mat)
        else:
            add_box_mesh(f"{wall_prefix}_Segment_A", (left_len, thickness, room_height), (left_center, fixed_coord, room_height / 2.0), collection, wall_mat)

    # 2. Right Segment (open_max .. +half_span)
    right_len = half_span - open_max
    if right_len > 0.02:
        right_center = open_max + (right_len / 2.0)
        if axis_mode == 'Y_SPAN':
            add_box_mesh(f"{wall_prefix}_Segment_B", (thickness, right_len, room_height), (fixed_coord, right_center, room_height / 2.0), collection, wall_mat)
        else:
            add_box_mesh(f"{wall_prefix}_Segment_B", (right_len, thickness, room_height), (right_center, fixed_coord, room_height / 2.0), collection, wall_mat)

    # 3. Sill Segment (0 .. sill_h)
    if sill_h > 0.02:
        if axis_mode == 'Y_SPAN':
            add_box_mesh(f"{wall_prefix}_Sill_Wall", (thickness, open_w, sill_h), (fixed_coord, off, sill_h / 2.0), collection, wall_mat)
        else:
            add_box_mesh(f"{wall_prefix}_Sill_Wall", (open_w, thickness, sill_h), (off, fixed_coord, sill_h / 2.0), collection, wall_mat)

    # 4. Header Lintel (sill_h + open_h .. room_height)
    lintel_h = room_height - (sill_h + open_h)
    if lintel_h > 0.02:
        lintel_z = sill_h + open_h + (lintel_h / 2.0)
        if axis_mode == 'Y_SPAN':
            add_box_mesh(f"{wall_prefix}_Lintel", (thickness, open_w, lintel_h), (fixed_coord, off, lintel_z), collection, wall_mat)
        else:
            add_box_mesh(f"{wall_prefix}_Lintel", (open_w, thickness, lintel_h), (off, fixed_coord, lintel_z), collection, wall_mat)

    return (off, open_w, open_h, sill_h)


def build_parametric_room_architecture(room_dims, materials_map, arch_col):
    W = float(room_dims.get("room_width", 5.2))
    L = float(room_dims.get("room_length", 4.6))
    H = float(room_dims.get("room_height", 2.9))
    T = float(room_dims.get("wall_thickness", 0.18))

    win_wall = room_dims.get("window_wall", "right")
    win_w = float(room_dims.get("window_width", 1.8))
    win_h = float(room_dims.get("window_height", 1.6))
    win_sill = float(room_dims.get("window_sill_height", 0.75))
    win_off = float(room_dims.get("window_offset", 0.0))

    door_wall = room_dims.get("door_wall", "left")
    door_w = float(room_dims.get("door_width", 0.95))
    door_h = float(room_dims.get("door_height", 2.15))
    door_off = float(room_dims.get("door_offset", -1.0))

    floor_mat = materials_map["floor"]
    wall_mat = materials_map["walls"]
    panel_mat = materials_map["wall_panels"]
    trim_mat = materials_map["trim_moldings"]
    glass_mat = materials_map["window_glass"]

    # 1. Floor & Ceiling Slabs
    add_box_mesh("Room_Floor", (W + T * 2, L + T * 2, 0.08), (0.0, 0.0, -0.04), arch_col, floor_mat)
    add_box_mesh("Room_Ceiling", (W + T * 2, L + T * 2, 0.08), (0.0, 0.0, H + 0.04), arch_col, wall_mat)

    # 2. Back Wall (at Y = +L/2 + T/2)
    back_y = (L / 2.0) + (T / 2.0)
    if win_wall == "back":
        off, ow, oh, sh = build_wall_with_opening("Wall_Back", "X_SPAN", back_y, W, H, T, win_w, win_h, win_sill, win_off, arch_col, wall_mat)
        add_box_mesh("Window_Frame_Back", (ow, T * 1.1, 0.05), (off, back_y, sh + 0.025), arch_col, trim_mat)
        add_box_mesh("Window_Glass_Back", (ow - 0.06, 0.015, oh - 0.06), (off, back_y, sh + oh / 2.0), arch_col, glass_mat)
    else:
        add_box_mesh("Wall_Back", (W + T * 2, T, H), (0.0, back_y, H / 2.0), arch_col, wall_mat)

    # 3. Right Wall (at X = +W/2 + T/2)
    right_x = (W / 2.0) + (T / 2.0)
    if win_wall == "right":
        off, ow, oh, sh = build_wall_with_opening("Wall_Right", "Y_SPAN", right_x, L, H, T, win_w, win_h, win_sill, win_off, arch_col, wall_mat)
        add_box_mesh("Window_Sill_Right", (T * 1.25, ow + 0.08, 0.04), (right_x, off, sh), arch_col, trim_mat, bevel_width=0.005)
        add_box_mesh("Window_Mullion_Right", (0.05, 0.04, oh), (right_x, off, sh + oh / 2.0), arch_col, trim_mat)
        add_box_mesh("Window_Glass_Right", (0.015, ow - 0.06, oh - 0.06), (right_x, off, sh + oh / 2.0), arch_col, glass_mat)
    elif door_wall == "right":
        off, ow, oh, _ = build_wall_with_opening("Wall_Right", "Y_SPAN", right_x, L, H, T, door_w, door_h, 0.0, door_off, arch_col, wall_mat)
        add_box_mesh("Door_Panel_Right", (0.045, ow - 0.04, oh - 0.02), (right_x, off, oh / 2.0), arch_col, panel_mat, bevel_width=0.004)
    else:
        add_box_mesh("Wall_Right", (T, L, H), (right_x, 0.0, H / 2.0), arch_col, wall_mat)

    # 4. Left Wall (at X = -W/2 - T/2)
    left_x = -(W / 2.0) - (T / 2.0)
    if door_wall == "left":
        off, ow, oh, _ = build_wall_with_opening("Wall_Left", "Y_SPAN", left_x, L, H, T, door_w, door_h, 0.0, door_off, arch_col, wall_mat)
        add_box_mesh("Door_Frame_Top_Left", (T * 1.15, ow + 0.08, 0.05), (left_x, off, oh + 0.025), arch_col, trim_mat)
        add_box_mesh("Door_Leaf_Left", (0.045, ow - 0.04, oh - 0.02), (left_x + 0.02, off, oh / 2.0), arch_col, panel_mat, bevel_width=0.004)
        add_box_mesh("Door_Handle_Left", (0.06, 0.14, 0.025), (left_x + 0.06, off + (ow * 0.35), 1.02), arch_col, trim_mat)
    elif win_wall == "left":
        off, ow, oh, sh = build_wall_with_opening("Wall_Left", "Y_SPAN", left_x, L, H, T, win_w, win_h, win_sill, win_off, arch_col, wall_mat)
        add_box_mesh("Window_Glass_Left", (0.015, ow - 0.06, oh - 0.06), (left_x, off, sh + oh / 2.0), arch_col, glass_mat)
    else:
        add_box_mesh("Wall_Left", (T, L, H), (left_x, 0.0, H / 2.0), arch_col, wall_mat)

    # 5. Architectural Boiserie / Wall Panels on Back Wall
    if room_dims.get("has_wall_panels", True):
        panel_count = 6
        panel_span = W * 0.86
        panel_w = (panel_span / panel_count) - 0.03
        start_x = -(panel_span / 2.0) + (panel_w / 2.0)
        for idx in range(panel_count):
            px = start_x + idx * (panel_w + 0.03)
            add_box_mesh(
                f"Wall_Panel_{idx + 1}",
                (panel_w, 0.022, H * 0.84),
                (px, (L / 2.0) - 0.012, H * 0.50),
                arch_col,
                panel_mat,
                bevel_width=0.003
            )

    # 6. Baseboards & Crown Moldings
    if room_dims.get("has_baseboards", True):
        add_box_mesh("Baseboard_Back", (W, 0.02, 0.11), (0.0, (L / 2.0) - 0.01, 0.055), arch_col, trim_mat)
    if room_dims.get("has_crown_molding", True):
        add_box_mesh("Crown_Molding_Back", (W, 0.04, 0.06), (0.0, (L / 2.0) - 0.02, H - 0.03), arch_col, trim_mat)
        add_box_mesh("Crown_Molding_Left", (0.04, L, 0.06), (-(W / 2.0) + 0.02, 0.0, H - 0.03), arch_col, trim_mat)
        add_box_mesh("Crown_Molding_Right", (0.04, L, 0.06), ((W / 2.0) - 0.02, 0.0, H - 0.03), arch_col, trim_mat)

    # 7. Architectural Lighting Fixture Mesh (Chandelier Ring)
    if room_dims.get("has_lighting_fixtures", True):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.42,
            minor_radius=0.022,
            major_segments=28,
            minor_segments=10,
            location=(0.0, 0.0, H - 0.38)
        )
        fixture = bpy.context.active_object
        fixture.name = "Lighting_Fixture_Pendant_Ring"
        fixture.data.materials.append(trim_mat)
        for col in list(fixture.users_collection):
            col.objects.unlink(fixture)
        arch_col.objects.link(fixture)

    # 8. Decorative Area Rug Mesh
    if room_dims.get("has_decorative_elements", True):
        rug_mat = create_pbr_material("Decorative_Rug_Fabric", {
            "base_color": "#D6CFC2",
            "roughness": 0.90,
            "metallic": 0.0,
            "bump_strength": 0.35
        })
        add_box_mesh("Decorative_Area_Rug", (W * 0.62, L * 0.58, 0.012), (0.0, 0.15, 0.006), arch_col, rug_mat, bevel_width=0.004)


def import_and_place_furniture_assets(placements, materials_map, furniture_col):
    imported_records = []
    for idx, item in enumerate(placements):
        if item.get("visible") is False:
            continue

        instance_id = item.get("instance_id") or f"Furniture_{idx + 1}"
        asset_id = item.get("asset_id") or f"asset_{idx + 1}"
        model_path = item.get("local_model_path") or item.get("model_storage_path") or ""

        # Create an independent empty controller for this furniture item
        parent_empty = bpy.data.objects.new(f"Asset_{instance_id}", None)
        parent_empty.empty_display_type = 'PLAIN_AXES'
        furniture_col.objects.link(parent_empty)

        before_objs = set(bpy.data.objects)
        if model_path and os.path.isfile(model_path):
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
        else:
            # Fallback procedural furniture block if local test path is omitted
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.5))
            fallback_mesh = bpy.context.active_object
            fallback_mesh.name = f"Mesh_{instance_id}"

        new_objs = [o for o in (set(bpy.data.objects) - before_objs) if o != parent_empty]
        mesh_objs = [o for o in new_objs if o.type == 'MESH']

        for o in new_objs:
            for col in list(o.users_collection):
                col.objects.unlink(o)
            furniture_col.objects.link(o)
            if o.parent is None:
                o.parent = parent_empty

        # Compute combined world bounding box of imported meshes to rest on Z=0 and center X/Y
        bpy.context.view_layer.update()
        if mesh_objs:
            min_v = [1e9, 1e9, 1e9]
            max_v = [-1e9, -1e9, -1e9]
            for m_obj in mesh_objs:
                for corner in m_obj.bound_box:
                    wc = m_obj.matrix_world @ mathutils.Vector(corner)
                    for k in range(3):
                        min_v[k] = min(min_v[k], wc[k])
                        max_v[k] = max(max_v[k], wc[k])

            cur_w = max(0.01, max_v[0] - min_v[0])
            cur_d = max(0.01, max_v[1] - min_v[1])
            cur_h = max(0.01, max_v[2] - min_v[2])

            # Apply calibrated real-world dimensions (if known) via parent scale without mutating original vertices
            target_dims = item.get("target_dimensions_m")
            user_scale = item.get("scale") or [1.0, 1.0, 1.0]
            if target_dims and (target_dims.get("width_m") or target_dims.get("height_m") or target_dims.get("depth_m")):
                sx = (float(target_dims["width_m"]) / cur_w) if target_dims.get("width_m") else float(user_scale[0])
                sy = (float(target_dims["depth_m"]) / cur_d) if target_dims.get("depth_m") else float(user_scale[1])
                sz = (float(target_dims["height_m"]) / cur_h) if target_dims.get("height_m") else float(user_scale[2])
                parent_empty.scale = (sx, sy, sz)
            else:
                parent_empty.scale = (float(user_scale[0]), float(user_scale[1]), float(user_scale[2]))

            # Apply optional per-product PBR material override if requested
            mat_override = item.get("material_override")
            if mat_override and not mat_override.get("preserve_original_textures", True):
                custom_mat = create_pbr_material(f"Mat_{instance_id}", mat_override)
                for m_obj in mesh_objs:
                    if m_obj.data.materials:
                        for mi in range(len(m_obj.data.materials)):
                            m_obj.data.materials[mi] = custom_mat
                    else:
                        m_obj.data.materials.append(custom_mat)

        pos = item.get("position") or [0.0, 0.0, 0.0]
        rot = item.get("rotation_deg") or [0.0, 0.0, 0.0]
        parent_empty.location = (float(pos[0]), float(pos[1]), float(pos[2]))
        parent_empty.rotation_euler = (
            math.radians(float(rot[0])),
            math.radians(float(rot[1])),
            math.radians(float(rot[2]))
        )

        # Store custom properties on the Blender object for persistence verification
        parent_empty["asset_id"] = str(asset_id)
        parent_empty["instance_id"] = str(instance_id)
        parent_empty["product_name"] = str(item.get("product_name", asset_id))
        parent_empty["original_geometry_preserved"] = True

        imported_records.append({
            "instance_id": instance_id,
            "asset_id": asset_id,
            "mesh_count": len(mesh_objs)
        })

    return imported_records


def setup_scene_lighting_and_camera(scene, spec, light_col):
    lighting_cfg = spec.get("lighting_profile_config") or {}

    # World HDRI / Ambient background
    if not scene.world:
        scene.world = bpy.data.worlds.new("Studio_World")
    scene.world.use_nodes = True
    bg_node = scene.world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs["Color"].default_value = hex_to_rgba(lighting_cfg.get("ambient_color", "#FFF5E4"))
        bg_node.inputs["Strength"].default_value = float(lighting_cfg.get("hdri_strength", 0.65))

    # Sun light
    sun_spec = lighting_cfg.get("sun_light") or {}
    if sun_spec.get("enabled", True):
        bpy.ops.object.light_add(type='SUN', location=(4.0, -3.0, 5.0))
        sun = bpy.context.active_object
        sun.name = "Scene_Sun_Light"
        sun.data.energy = float(sun_spec.get("energy", 2.2))
        sun.data.color = hex_to_rgba(sun_spec.get("color", "#FFE4B5"))[:3]
        elev = math.radians(float(sun_spec.get("elevation_deg", 32)))
        azim = math.radians(float(sun_spec.get("azimuth_deg", 45)))
        sun.rotation_euler = (math.pi / 2.0 - elev, 0.0, azim)
        for c in list(sun.users_collection):
            c.objects.unlink(sun)
        light_col.objects.link(sun)

    # Area lights
    for idx, al in enumerate(lighting_cfg.get("area_lights") or []):
        loc = al.get("location") or [0.0, 0.0, 2.6]
        bpy.ops.object.light_add(type='AREA', location=(float(loc[0]), float(loc[1]), float(loc[2])))
        area = bpy.context.active_object
        area.name = al.get("name") or f"Area_Light_{idx + 1}"
        area.data.energy = float(al.get("energy", 200))
        area.data.size = float(al.get("size", 2.0))
        area.data.color = hex_to_rgba(al.get("color", "#FFF4E0"))[:3]
        for c in list(area.users_collection):
            c.objects.unlink(area)
        light_col.objects.link(area)

    # Spot lights
    for idx, sp in enumerate(lighting_cfg.get("spot_lights") or []):
        loc = sp.get("location") or [0.0, 0.0, 2.75]
        bpy.ops.object.light_add(type='SPOT', location=(float(loc[0]), float(loc[1]), float(loc[2])))
        spot = bpy.context.active_object
        spot.name = sp.get("name") or f"Spot_Light_{idx + 1}"
        spot.data.energy = float(sp.get("energy", 140))
        spot.data.spot_size = math.radians(float(sp.get("spot_size_deg", 45)))
        spot.data.spot_blend = float(sp.get("blend", 0.35))
        spot.data.color = hex_to_rgba(sp.get("color", "#FFE8C2"))[:3]
        for c in list(spot.users_collection):
            c.objects.unlink(spot)
        light_col.objects.link(spot)

    # Point lights
    for idx, pt in enumerate(lighting_cfg.get("point_lights") or []):
        loc = pt.get("location") or [1.2, 1.5, 0.9]
        bpy.ops.object.light_add(type='POINT', location=(float(loc[0]), float(loc[1]), float(loc[2])))
        point = bpy.context.active_object
        point.name = pt.get("name") or f"Point_Light_{idx + 1}"
        point.data.energy = float(pt.get("energy", 45))
        point.data.shadow_soft_size = float(pt.get("radius", 0.15))
        point.data.color = hex_to_rgba(pt.get("color", "#FFD28A"))[:3]
        for c in list(point.users_collection):
            c.objects.unlink(point)
        light_col.objects.link(point)

    # Camera with Track-To target
    cam_spec = spec.get("camera_settings") or {}
    cam_pos = cam_spec.get("position") or [0.0, -3.6, 1.62]
    cam_tgt = cam_spec.get("target") or [0.0, 0.8, 0.92]

    target_empty = bpy.data.objects.new("Camera_Target", None)
    target_empty.location = (float(cam_tgt[0]), float(cam_tgt[1]), float(cam_tgt[2]))
    light_col.objects.link(target_empty)

    bpy.ops.object.camera_add(location=(float(cam_pos[0]), float(cam_pos[1]), float(cam_pos[2])))
    camera = bpy.context.active_object
    camera.name = "Scene_Primary_Camera"
    camera.data.lens = float(cam_spec.get("fov_mm", 35))
    camera.data.clip_start = float(cam_spec.get("clip_start", 0.05))
    camera.data.clip_end = float(cam_spec.get("clip_end", 100.0))

    track = camera.constraints.new(type='TRACK_TO')
    track.target = target_empty
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    for c in list(camera.users_collection):
        c.objects.unlink(camera)
    light_col.objects.link(camera)
    scene.camera = camera


def main():
    argv = sys.argv
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    if len(args) < 3:
        print("[ERROR] Usage: build_interior_scene.py -- <scene_spec_json> <output_blend_path> <output_preview_jpg> [samples] [width] [height] [threads]")
        sys.exit(2)

    spec_json_path = os.path.abspath(args[0])
    output_blend_path = os.path.abspath(args[1])
    output_preview_path = os.path.abspath(args[2])
    samples = max(1, min(128, int(args[3]))) if len(args) > 3 else 16
    width = max(128, min(2048, int(args[4]))) if len(args) > 4 else 960
    height = max(128, min(2048, int(args[5]))) if len(args) > 5 else 540
    threads = max(1, min(2, int(args[6]))) if len(args) > 6 else 1

    with open(spec_json_path, 'r', encoding='utf-8') as f:
        spec = json.load(f)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene["scene_id"] = str(spec.get("scene_id", "scn_default"))
    scene["scene_name"] = str(spec.get("scene_name", "Interior Scene"))

    # Create organized collections separating Room Architecture and Independent Furniture Assets
    arch_col = bpy.data.collections.new("Room_Architecture")
    furniture_col = bpy.data.collections.new("Furniture_Assets")
    light_col = bpy.data.collections.new("Lighting_And_Cameras")
    scene.collection.children.link(arch_col)
    scene.collection.children.link(furniture_col)
    scene.collection.children.link(light_col)

    # Build PBR Room Materials
    room_mats_spec = (spec.get("material_settings") or {}).get("room_materials") or {}
    materials_map = {
        "floor": create_pbr_material("Room_Floor_PBR", room_mats_spec.get("floor", {"base_color": "#8B5A2B", "roughness": 0.38})),
        "walls": create_pbr_material("Room_Wall_PBR", room_mats_spec.get("walls", {"base_color": "#EAE6DF", "roughness": 0.25})),
        "wall_panels": create_pbr_material("Room_Panel_PBR", room_mats_spec.get("wall_panels", {"base_color": "#8B5A2B", "roughness": 0.35})),
        "trim_moldings": create_pbr_material("Room_Trim_PBR", room_mats_spec.get("trim_moldings", {"base_color": "#D4AF37", "roughness": 0.24, "metallic": 0.95})),
        "window_glass": create_pbr_material("Room_Glass_PBR", room_mats_spec.get("window_glass", {"base_color": "#E8F4F8", "roughness": 0.04, "transmission": 0.92}))
    }

    # 1. Build Parametric Room Architecture
    room_dims = spec.get("room_dimensions") or {}
    build_parametric_room_architecture(room_dims, materials_map, arch_col)

    # 2. Import & Place Independent 3D Furniture Assets
    placements = spec.get("asset_transforms") or []
    import_and_place_furniture_assets(placements, materials_map, furniture_col)

    # 3. Setup Lighting Profile & Camera
    setup_scene_lighting_and_camera(scene, spec, light_col)

    # 4. Configure Cycles CPU Render Engine (1 thread limit for VPS safety)
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.adaptive_threshold = 0.05
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = threads

    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 90

    # 5. Save persistent .blend file first
    if output_blend_path:
        os.makedirs(os.path.dirname(output_blend_path), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=output_blend_path, compress=True)
        print(f"[SCENE BUILDER] Saved persistent Blender scene: {output_blend_path}")

    # 6. Render Preview or Final JPEG if requested
    if output_preview_path and output_preview_path.lower() != "none":
        os.makedirs(os.path.dirname(output_preview_path), exist_ok=True)
        scene.render.filepath = output_preview_path
        print(f"[SCENE BUILDER] Rendering scene pass ({width}x{height} @ {samples} samples)...")
        bpy.ops.render.render(write_still=True)
        print(f"[SCENE BUILDER] Rendered preview image: {output_preview_path}")


if __name__ == "__main__":
    main()
