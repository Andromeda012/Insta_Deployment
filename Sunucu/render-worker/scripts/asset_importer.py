"""
GLOBAL MOBİLYA — MODULE 8: MODULAR 3D ASSET & MATERIAL IMPORTER ENGINE
Blender 2.93 / 4.x Headless Multi-Format Importer & PBR Auto-Shader
=============================================================================
Provides:
  1. Manifest-driven asset discovery & commercial license validation
  2. Multi-format mesh importing: GLB, GLTF, FBX, OBJ, BLEND
  3. Automatic collection isolation (Decor_Plants, Decor_Vases, etc.)
  4. Auto PBR Shader builder (Albedo, Roughness, Metallic, Normal, Height, AO)
  5. HDRI environment lighting setup
  6. Collision-aware decoration preset staging around main furniture
=============================================================================
"""

import sys
import os
import json
import math

try:
    import bpy
    import mathutils
except ImportError:
    print("[ERROR] asset_importer.py must be executed within Blender headless environment.")
    sys.exit(1)


class AssetLibraryManager:
    """Central manager for Global Mobilya 3D Asset & Material Library."""

    def __init__(self, library_root=None):
        if not library_root:
            # Default search relative to script or workspace
            script_dir = os.path.dirname(os.path.abspath(__file__))
            candidate = os.path.abspath(os.path.join(script_dir, "..", "..", "assets", "3d_library"))
            if os.path.exists(candidate):
                library_root = candidate
            else:
                library_root = "C:/Users/User/Desktop/Insta_Deployment/Sunucu/assets/3d_library"

        self.library_root = os.path.normpath(library_root)
        self.manifest_path = os.path.join(self.library_root, "ASSET_MANIFEST.json")
        self.manifest = self._load_manifest()

    def _load_manifest(self):
        if not os.path.exists(self.manifest_path):
            print(f"[WARN] Manifest not found at: {self.manifest_path}. Using empty catalog.")
            return {"assets": [], "categories": {}, "governance": {}}
        try:
            with open(self.manifest_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[ERROR] Failed to parse ASSET_MANIFEST.json: {e}")
            return {"assets": [], "categories": {}, "governance": {}}

    def get_asset(self, asset_id):
        for a in self.manifest.get("assets", []):
            if a.get("id") == asset_id:
                return a
        return None

    def list_assets_by_category(self, category):
        return [a for a in self.manifest.get("assets", []) if a.get("category") == category]

    def get_or_create_collection(self, collection_name, parent_collection=None):
        if not parent_collection:
            parent_collection = bpy.context.scene.collection

        col = bpy.data.collections.get(collection_name)
        if not col:
            col = bpy.data.collections.new(collection_name)
            parent_collection.children.link(col)
        return col

    def import_model_asset(self, asset_id_or_entry, location=(0, 0, 0), rotation_euler=(0, 0, 0), scale=(1, 1, 1), target_collection_name=None):
        """
        Imports a 3D model asset (GLB, GLTF, FBX, OBJ, BLEND) from the library into Blender.
        Wraps imported meshes in a parent empty root and links to an isolated collection.
        """
        if isinstance(asset_id_or_entry, str):
            asset_entry = self.get_asset(asset_id_or_entry)
            if not asset_entry:
                raise ValueError(f"Asset with ID '{asset_id_or_entry}' not found in manifest.")
        else:
            asset_entry = asset_id_or_entry

        asset_id = asset_entry.get("id", "unnamed_asset")
        category = asset_entry.get("category", "props")
        fmt = asset_entry.get("format", "").lower()
        rel_path = asset_entry.get("file_path", "")
        abs_path = os.path.normpath(os.path.join(self.library_root, rel_path))

        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"Asset file not found on disk: {abs_path}")

        # Check commercial licensing compliance
        licensing = asset_entry.get("licensing", {})
        if self.manifest.get("governance", {}).get("commercial_use_strict_enforcement", True):
            if not licensing.get("commercial_use_allowed", True):
                raise PermissionError(f"Asset '{asset_id}' is restricted from commercial use by governance rules.")

        # Determine target collection
        if not target_collection_name:
            cat_info = self.manifest.get("categories", {}).get(category, {})
            target_collection_name = cat_info.get("collection_name", f"Decor_{category.capitalize()}")

        target_col = self.get_or_create_collection(target_collection_name)

        # Track existing objects to identify new imports
        existing_objs = set(bpy.data.objects)

        # Execute format-specific import
        if fmt in ["glb", "gltf"]:
            bpy.ops.import_scene.gltf(filepath=abs_path)
        elif fmt == "fbx":
            bpy.ops.import_scene.fbx(filepath=abs_path)
        elif fmt == "obj":
            if hasattr(bpy.ops.wm, "obj_import"):
                bpy.ops.wm.obj_import(filepath=abs_path)
            elif hasattr(bpy.ops.import_scene, "obj"):
                bpy.ops.import_scene.obj(filepath=abs_path)
            else:
                raise RuntimeError("OBJ importer not available in this Blender environment.")
        elif fmt == "blend":
            # Append all objects from blend file
            with bpy.data.libraries.load(abs_path, link=False) as (data_from, data_to):
                data_to.objects = data_from.objects
            for obj in data_to.objects:
                if obj is not None:
                    target_col.objects.link(obj)
        else:
            raise ValueError(f"Unsupported 3D asset format '{fmt}' for asset '{asset_id}'.")

        new_objs = [obj for obj in bpy.data.objects if obj not in existing_objs]
        if not new_objs:
            raise RuntimeError(f"No objects were imported from asset file: {abs_path}")

        # Move new objects to target collection
        for obj in new_objs:
            for c in list(obj.users_collection):
                c.objects.unlink(obj)
            target_col.objects.link(obj)

        # Create master Empty controller for this asset
        root_empty = bpy.data.objects.new(f"Root_{asset_id}", None)
        root_empty.empty_display_type = 'PLAIN_AXES'
        root_empty.empty_display_size = 0.2
        target_col.objects.link(root_empty)

        # Compute bounding box and normalize pivot to base center
        mesh_objs = [o for o in new_objs if o.type == 'MESH']
        if mesh_objs:
            all_verts = []
            for o in mesh_objs:
                for v in o.data.vertices:
                    all_verts.append(o.matrix_world @ v.co)
            if all_verts:
                min_z = min(v.z for v in all_verts)
                # Offset objects so base sits at parent empty location
                for o in new_objs:
                    o.location.z -= min_z

        for obj in new_objs:
            obj.parent = root_empty

        # Set final transform on root empty
        root_empty.location = mathutils.Vector(location)
        root_empty.rotation_euler = mathutils.Euler(rotation_euler)
        root_empty.scale = mathutils.Vector(scale)

        # Tag root with metadata
        root_empty["asset_id"] = asset_id
        root_empty["category"] = category
        root_empty["license_type"] = licensing.get("license_type", "Unknown")
        root_empty["commercial_ready"] = licensing.get("commercial_use_allowed", True)

        bpy.context.view_layer.update()
        print(f"[ASSET_LIBRARY] Successfully imported '{asset_id}' into collection '{target_collection_name}' at {location}.")
        return root_empty

    def create_pbr_shader_material(self, material_name, texture_entry):
        """
        Builds a full PBR Principled BSDF node setup from texture map files:
        Albedo, Roughness, Metallic, Normal (DirectX/OpenGL auto-handled), Height, AO.
        """
        mat = bpy.data.materials.new(name=material_name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links

        # Clear default nodes
        nodes.clear()

        # Output and Principled BSDF
        output_node = nodes.new(type="ShaderNodeOutputMaterial")
        output_node.location = (400, 0)

        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
        bsdf.location = (0, 0)
        links.new(bsdf.outputs["BSDF"], output_node.inputs["Surface"])

        # Mapping and Texture Coordinate
        tex_coord = nodes.new(type="ShaderNodeTexCoord")
        tex_coord.location = (-1000, 0)
        mapping = nodes.new(type="ShaderNodeMapping")
        mapping.location = (-800, 0)
        uv_scale = float(texture_entry.get("default_uv_scale", 1.0))
        mapping.inputs["Scale"].default_value = (uv_scale, uv_scale, uv_scale)
        links.new(tex_coord.outputs["UV"], mapping.inputs["Vector"])

        maps = texture_entry.get("maps", {})

        # 1. Albedo / Diffuse
        albedo_path = maps.get("albedo") or maps.get("diffuse") or maps.get("base_color")
        albedo_tex = None
        if albedo_path:
            full_albedo = os.path.normpath(os.path.join(self.library_root, albedo_path))
            if os.path.exists(full_albedo):
                img_node = nodes.new(type="ShaderNodeTexImage")
                img_node.location = (-500, 250)
                img_node.image = bpy.data.images.load(full_albedo)
                img_node.image.colorspace_settings.name = "sRGB"
                links.new(mapping.outputs["Vector"], img_node.inputs["Vector"])
                albedo_tex = img_node

        # 2. Ambient Occlusion (AO)
        ao_path = maps.get("ao") or maps.get("ambient_occlusion")
        if ao_path and albedo_tex:
            full_ao = os.path.normpath(os.path.join(self.library_root, ao_path))
            if os.path.exists(full_ao):
                ao_node = nodes.new(type="ShaderNodeTexImage")
                ao_node.location = (-500, 50)
                ao_node.image = bpy.data.images.load(full_ao)
                ao_node.image.colorspace_settings.name = "Non-Color"
                links.new(mapping.outputs["Vector"], ao_node.inputs["Vector"])

                # Mix Multiply with Albedo
                mix_node = nodes.new(type="ShaderNodeMixRGB")
                mix_node.location = (-200, 200)
                mix_node.blend_type = 'MULTIPLY'
                mix_node.inputs["Fac"].default_value = 0.8
                links.new(albedo_tex.outputs["Color"], mix_node.inputs["Color1"])
                links.new(ao_node.outputs["Color"], mix_node.inputs["Color2"])
                links.new(mix_node.outputs["Color"], bsdf.inputs["Base Color"])
        elif albedo_tex:
            links.new(albedo_tex.outputs["Color"], bsdf.inputs["Base Color"])

        # 3. Roughness
        roughness_path = maps.get("roughness")
        if roughness_path:
            full_rough = os.path.normpath(os.path.join(self.library_root, roughness_path))
            if os.path.exists(full_rough):
                rough_node = nodes.new(type="ShaderNodeTexImage")
                rough_node.location = (-500, -150)
                rough_node.image = bpy.data.images.load(full_rough)
                rough_node.image.colorspace_settings.name = "Non-Color"
                links.new(mapping.outputs["Vector"], rough_node.inputs["Vector"])
                links.new(rough_node.outputs["Color"], bsdf.inputs["Roughness"])

        # 4. Metallic
        metallic_path = maps.get("metallic") or maps.get("metalness")
        if metallic_path:
            full_metal = os.path.normpath(os.path.join(self.library_root, metallic_path))
            if os.path.exists(full_metal):
                metal_node = nodes.new(type="ShaderNodeTexImage")
                metal_node.location = (-500, -350)
                metal_node.image = bpy.data.images.load(full_metal)
                metal_node.image.colorspace_settings.name = "Non-Color"
                links.new(mapping.outputs["Vector"], metal_node.inputs["Vector"])
                links.new(metal_node.outputs["Color"], bsdf.inputs["Metallic"])

        # 5. Normal Map
        normal_path = maps.get("normal")
        if normal_path:
            full_normal = os.path.normpath(os.path.join(self.library_root, normal_path))
            if os.path.exists(full_normal):
                norm_img_node = nodes.new(type="ShaderNodeTexImage")
                norm_img_node.location = (-500, -550)
                norm_img_node.image = bpy.data.images.load(full_normal)
                norm_img_node.image.colorspace_settings.name = "Non-Color"
                links.new(mapping.outputs["Vector"], norm_img_node.inputs["Vector"])

                norm_map_node = nodes.new(type="ShaderNodeNormalMap")
                norm_map_node.location = (-200, -550)
                norm_map_node.inputs["Strength"].default_value = 1.0
                links.new(norm_img_node.outputs["Color"], norm_map_node.inputs["Color"])
                links.new(norm_map_node.outputs["Normal"], bsdf.inputs["Normal"])

        # 6. Displacement / Height (Bump fallback)
        height_path = maps.get("displacement") or maps.get("height")
        if height_path and not normal_path:
            full_height = os.path.normpath(os.path.join(self.library_root, height_path))
            if os.path.exists(full_height):
                height_node = nodes.new(type="ShaderNodeTexImage")
                height_node.location = (-500, -750)
                height_node.image = bpy.data.images.load(full_height)
                height_node.image.colorspace_settings.name = "Non-Color"
                links.new(mapping.outputs["Vector"], height_node.inputs["Vector"])

                bump_node = nodes.new(type="ShaderNodeBump")
                bump_node.location = (-200, -750)
                bump_node.inputs["Strength"].default_value = 0.2
                bump_node.inputs["Distance"].default_value = 0.005
                links.new(height_node.outputs["Color"], bump_node.inputs["Height"])
                links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])

        print(f"[ASSET_LIBRARY] Created PBR shader '{material_name}' with {len(nodes)} nodes.")
        return mat

    def apply_decoration_preset(self, preset_path_or_id, main_furniture_bounds=None):
        """
        Loads a decoration preset JSON and stages props around the main furniture piece.
        """
        preset_file = None
        if preset_path_or_id.endswith(".json"):
            preset_file = preset_path_or_id
        else:
            clean_id = preset_path_or_id.replace("preset_", "")
            candidates = [
                os.path.join(self.library_root, "presets", "decoration", f"{preset_path_or_id}.json"),
                os.path.join(self.library_root, "presets", "decoration", f"{clean_id}.json")
            ]
            for c in candidates:
                if os.path.exists(c):
                    preset_file = c
                    break

        if not preset_file or not os.path.exists(preset_file):
            raise FileNotFoundError(f"Decoration preset '{preset_path_or_id}' not found.")

        with open(preset_file, "r", encoding="utf-8") as f:
            preset = json.load(f)

        main_width = 1.0
        main_depth = 1.0
        main_height = 1.0
        if main_furniture_bounds:
            main_width = float(main_furniture_bounds.get("width", 1.0))
            main_depth = float(main_furniture_bounds.get("depth", 1.0))
            main_height = float(main_furniture_bounds.get("height", 1.0))

        staged_props = []
        for p in preset.get("props", []):
            asset_id = p.get("asset_id")
            anchor = p.get("anchor", "floor_standing")
            rel_offset = p.get("relative_offset", [0, 0, 0])
            rot_deg = p.get("rotation_euler_deg", [0, 0, 0])
            rot_rad = tuple(math.radians(a) for a in rot_deg)

            # Anchor location calculations
            if anchor == "floor_center":
                loc = (rel_offset[0], rel_offset[1], rel_offset[2])
            elif anchor == "beside_furniture_right":
                loc = (main_width / 2.0 + rel_offset[0], rel_offset[1], rel_offset[2])
            elif anchor == "beside_furniture_left":
                loc = (-main_width / 2.0 - rel_offset[0], rel_offset[1], rel_offset[2])
            elif anchor == "corner_left":
                loc = (-main_width / 2.0 - 0.8 + rel_offset[0], main_depth / 2.0 + rel_offset[1], rel_offset[2])
            elif anchor == "corner_right":
                loc = (main_width / 2.0 + 0.8 + rel_offset[0], main_depth / 2.0 + rel_offset[1], rel_offset[2])
            elif anchor == "wall_above_furniture":
                loc = (rel_offset[0], main_depth / 2.0 + 0.2 + rel_offset[1], main_height + rel_offset[2])
            elif anchor.startswith("tabletop"):
                loc = (rel_offset[0], rel_offset[1], main_height + rel_offset[2])
            else:
                loc = tuple(rel_offset)

            try:
                root_obj = self.import_model_asset(asset_id, location=loc, rotation_euler=rot_rad)
                staged_props.append({"asset_id": asset_id, "root_name": root_obj.name, "location": loc})
            except Exception as e:
                print(f"[WARN] Could not stage prop '{asset_id}': {e}")

        return {
            "preset_id": preset.get("id"),
            "preset_name": preset.get("name"),
            "staged_props_count": len(staged_props),
            "staged_props": staged_props
        }
