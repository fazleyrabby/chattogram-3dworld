"""
Builds the Chattogram 3D player avatar: a soft, stylized low-poly humanoid
(cream beanie + oversized hoodie + taupe cuffed pants + chunky sneakers),
exported to public/models/character.glb.

Run via Blender MCP (execute_code) or:
    blender --background --python scripts/blender/build_character.py

Implementation notes
--------------------
* Blender is Z-up; the glTF exporter converts to Y-up. The avatar faces -Y in
  Blender so it faces +Z after export, matching the game's forward axis.
* Every part is parented to a joint Empty with its geometry baked in local space
  relative to that joint (object location = origin). This avoids
  matrix_parent_inverse, which does not survive glTF export reliably.
* Built into a dedicated "CTG_Character" collection so it never disturbs other
  scenes/objects. Only the character is exported (use_selection).
"""

import os
import bmesh
import bpy
from mathutils import Vector, Matrix

COLLECTION = "CTG_Character"
EXPORT_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "public", "models", "character.glb")
)


# ---------------------------------------------------------------- scene setup


def reset_collection():
    # Only ever touch our own collection; never the surrounding scene.
    existing = bpy.data.collections.get(COLLECTION)
    if existing:
        for obj in list(existing.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(existing)
    col = bpy.data.collections.new(COLLECTION)
    bpy.context.scene.collection.children.link(col)
    for layer in bpy.context.view_layer.layer_collection.children:
        if layer.collection == col:
            bpy.context.view_layer.active_layer_collection = layer
            break
    return col


def make_material(name, rgb, roughness=0.8):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    return mat


def select_only(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def _place(obj, center, pivot):
    """Bake geometry at (center - pivot); the parent joint supplies the pivot."""
    delta = Vector(center) - Vector(pivot)
    obj.location = (0.0, 0.0, 0.0)
    obj.data.transform(Matrix.Translation(delta))


def _finish(obj, name, material, smooth):
    obj.name = name
    obj.data.name = name
    obj.data.materials.append(material)
    if smooth:
        try:
            bpy.ops.object.shade_auto_smooth(angle=0.85)
        except Exception:
            bpy.ops.object.shade_smooth()
    else:
        bpy.ops.object.shade_flat()


# ---------------------------------------------------------------- primitives


def rounded_box(name, size, center, pivot, material, bevel=0.04, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=center)
    obj = bpy.context.active_object
    obj.scale = size
    select_only(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = bevel
    mod.segments = segments
    mod.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=mod.name)
    _place(obj, center, pivot)
    _finish(obj, name, material, smooth=True)
    return obj


def sphere(name, radius, center, pivot, material, scale=(1, 1, 1), segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius, segments=segments, ring_count=rings, location=center
    )
    obj = bpy.context.active_object
    obj.scale = scale
    select_only(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    _place(obj, center, pivot)
    _finish(obj, name, material, smooth=True)
    return obj


def dome(name, radius, center, pivot, material, scale=(1, 1, 1)):
    """Upper hemisphere (open bottom) for the beanie crown."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=24, ring_count=16,
                                         location=(0, 0, 0))
    obj = bpy.context.active_object
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    lower = [v for v in bm.verts if v.co.z < -1e-4]
    bmesh.ops.delete(bm, geom=lower, context="VERTS")
    bm.to_mesh(me)
    bm.free()
    obj.scale = scale
    obj.location = center
    select_only(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    _place(obj, center, pivot)
    _finish(obj, name, material, smooth=True)
    return obj


def cylinder(name, radius, depth, center, pivot, material, vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, depth=depth, vertices=vertices, location=center
    )
    obj = bpy.context.active_object
    _place(obj, center, pivot)
    _finish(obj, name, material, smooth=True)
    return obj


def torus(name, major, minor, center, pivot, material):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=28, minor_segments=12,
        location=center,
    )
    obj = bpy.context.active_object
    _place(obj, center, pivot)
    _finish(obj, name, material, smooth=True)
    return obj


def empty(name, location):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.1
    obj.location = Vector(location)
    bpy.context.view_layer.active_layer_collection.collection.objects.link(obj)
    return obj


def attach(child, joint):
    child.parent = joint
    child.matrix_parent_inverse = Matrix.Identity(4)


# ---------------------------------------------------------------- character


def build_character():
    cream = make_material("Cream", (0.93, 0.90, 0.82), 0.85)
    cream_dark = make_material("CreamDark", (0.86, 0.82, 0.73), 0.9)
    skin = make_material("Skin", (0.97, 0.83, 0.73), 0.75)
    cheek = make_material("Cheek", (0.95, 0.66, 0.60), 0.9)
    dark = make_material("Dark", (0.19, 0.13, 0.10), 0.85)
    pants = make_material("Pants", (0.55, 0.47, 0.41), 0.9)
    cuff = make_material("Cuff", (0.63, 0.56, 0.49), 0.9)
    shoe = make_material("Shoe", (0.95, 0.94, 0.91), 0.7)
    grey = make_material("Grey", (0.28, 0.28, 0.31), 0.6)
    tablet = make_material("Tablet", (0.20, 0.20, 0.23), 0.45)

    root = empty("Avatar", (0, 0, 0))
    p_torso = (0, 0, 0.92)
    p_head = (0, 0, 1.38)
    p_arm_l = (0.30, 0, 1.30)
    p_arm_r = (-0.30, 0, 1.30)
    p_leg_l = (0.12, 0, 0.92)
    p_leg_r = (-0.12, 0, 0.92)

    j_torso = empty("JointTorso", p_torso)
    j_head = empty("JointHead", p_head)
    j_arm_l = empty("JointArmL", p_arm_l)
    j_arm_r = empty("JointArmR", p_arm_r)
    j_leg_l = empty("JointLegL", p_leg_l)
    j_leg_r = empty("JointLegR", p_leg_r)
    for joint in (j_torso, j_head, j_arm_l, j_arm_r, j_leg_l, j_leg_r):
        attach(joint, root)

    # --- Hoodie torso (oversized, chunky) + hood + zipper
    attach(rounded_box("Torso", (0.58, 0.40, 0.56), (0, 0, 1.16), p_torso, cream, 0.14), j_torso)
    attach(sphere("Hood", 0.215, (0, 0.20, 1.37), p_torso, cream, (1.05, 0.72, 0.66)), j_torso)
    attach(rounded_box("Zipper", (0.04, 0.05, 0.50), (0, -0.205, 1.15), p_torso, grey, 0.01), j_torso)
    attach(torus("Collar", 0.13, 0.04, (0, -0.02, 1.40), p_torso, cream_dark), j_torso)

    # --- Head + face (large, rounded)
    attach(sphere("Head", 0.185, (0, 0, 1.53), p_head, skin, (1.0, 1.0, 1.03)), j_head)
    for side, tag in ((1, "L"), (-1, "R")):
        attach(sphere("Ear" + tag, 0.048, (side * 0.182, 0.005, 1.52), p_head, skin), j_head)
        attach(sphere("Cheek" + tag, 0.046, (side * 0.122, -0.14, 1.49), p_head, cheek,
                      (1.0, 0.7, 0.8)), j_head)
    attach(sphere("EyeL", 0.027, (0.072, -0.172, 1.565), p_head, dark), j_head)
    attach(sphere("EyeR", 0.027, (-0.072, -0.172, 1.565), p_head, dark), j_head)
    attach(sphere("Nose", 0.036, (0, -0.188, 1.515), p_head, skin), j_head)

    # --- Beanie (tall dome + ribbed brim) and hair peeking out
    attach(dome("Beanie", 0.20, (0, 0, 1.60), p_head, cream, (1.0, 1.0, 1.12)), j_head)
    attach(torus("BeanieBrim", 0.195, 0.036, (0, 0, 1.585), p_head, cream_dark), j_head)
    attach(torus("Hair", 0.182, 0.018, (0, 0, 1.565), p_head, dark), j_head)

    # --- Arms (hoodie sleeves + hands)
    for side, joint, tag, pivot in ((1, j_arm_l, "L", p_arm_l), (-1, j_arm_r, "R", p_arm_r)):
        x = side * 0.34
        attach(rounded_box("Sleeve" + tag, (0.18, 0.20, 0.42), (x, 0, 1.09), pivot, cream, 0.08), joint)
        attach(sphere("Hand" + tag, 0.075, (x, -0.01, 0.86), pivot, skin), joint)

    # --- Props: coffee cup (left hand) and tablet (right hand)
    attach(cylinder("Cup", 0.048, 0.14, (0.35, -0.11, 0.93), p_arm_l, cream, 16), j_arm_l)
    attach(cylinder("CupLid", 0.052, 0.028, (0.35, -0.11, 1.012), p_arm_l, grey, 16), j_arm_l)
    attach(rounded_box("Tablet", (0.19, 0.024, 0.25), (-0.35, -0.10, 0.95), p_arm_r, tablet, 0.016), j_arm_r)

    # --- Legs (wide cuffed pants + chunky sneakers)
    for side, joint, tag, pivot in ((1, j_leg_l, "L", p_leg_l), (-1, j_leg_r, "R", p_leg_r)):
        x = side * 0.12
        attach(rounded_box("Thigh" + tag, (0.22, 0.24, 0.60), (x, 0, 0.61), pivot, pants, 0.07), joint)
        attach(rounded_box("Cuff" + tag, (0.235, 0.255, 0.14), (x, 0, 0.21), pivot, cuff, 0.05), joint)
        attach(rounded_box("Sole" + tag, (0.21, 0.33, 0.05), (x, -0.055, 0.035), pivot, grey, 0.02), joint)
        attach(rounded_box("Foot" + tag, (0.19, 0.31, 0.12), (x, -0.05, 0.10), pivot, shoe, 0.05), joint)

    return root


def export(root):
    os.makedirs(os.path.dirname(EXPORT_PATH), exist_ok=True)
    col = bpy.data.collections[COLLECTION]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in col.all_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=EXPORT_PATH,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )
    print("[character] exported", EXPORT_PATH)


def main():
    reset_collection()
    root = build_character()
    export(root)


if __name__ == "__main__":
    main()
