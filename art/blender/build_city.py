"""Build the Wordwild city kit. Run: /Applications/Blender.app/Contents/MacOS/Blender -b --python art/blender/build_city.py
Exports one GLB per model to web/public/town/models/city and renders a contact sheet to art/blender/preview.png."""
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import city_lib as L
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "web", "public", "town", "models", "city"); os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
objs = []
for fn in L.ALL:
    ob = fn(); objs.append(ob)
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, ob.name + ".glb"), export_format="GLB", use_selection=True, export_yup=True, export_apply=True)
    print("exported", ob.name, len(ob.data.polygons), "faces")
# preview sheet
cols = 9
for i, ob in enumerate(objs): ob.location = ((i % cols) * 3.0, -(i // cols) * 3.0, 0)
g = bpy.data.objects.new("ground", bpy.data.meshes.new("g")); bpy.context.scene.collection.objects.link(g)
import bmesh
bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30); bm.to_mesh(g.data); bm.free()
g.location = (12, -9, -0.01); gm = bpy.data.materials.new("ground"); gm.use_nodes = True; gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.32, 0.62, 0.2, 1); g.data.materials.append(gm)
sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 4.0; so = bpy.data.objects.new("sun", sun); so.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35)); bpy.context.scene.collection.objects.link(so)
w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.88, 1.0, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 1.0; bpy.context.scene.world = w
cam = bpy.data.cameras.new("cam"); cam.type = "ORTHO"; cam.ortho_scale = 32; co = bpy.data.objects.new("cam", cam); bpy.context.scene.collection.objects.link(co)
co.location = (12 + 9, -8 - 12, 12); co.rotation_euler = (math.radians(58), 0, math.radians(38)); bpy.context.scene.camera = co
sc = bpy.context.scene; sc.render.resolution_x = 2400; sc.render.resolution_y = 1500
sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE_NEXT"
sc.render.filepath = os.path.join(os.path.dirname(__file__), "preview.png"); bpy.ops.render.render(write_still=True)
print("done")
