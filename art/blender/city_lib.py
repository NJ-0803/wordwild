"""Township-style building kit for Wordwild, built procedurally in Blender (run headless via build_city.py).
Chunky proportions, saturated colours, soft bevels, glowing windows at night (material named 'glass' has emission).
Every model sits on z=0, centred, within roughly a 2 x 2 footprint (the site scales them to a tile)."""
import bpy, bmesh, math
from mathutils import Vector

PAL = dict(
    cream="#F5E6BE", butter="#F7CF5F", pink="#F3A7A2", sky="#83B7EA", white="#F8F5EF", brick="#C9573F", wood="#A97240", darkwood="#7A4B2A",
    red="#DC4A3D", orange="#EC8A3C", teal="#2F9089", slate="#4F5F80", terracotta="#C9673F", green="#6FBE4E", dkgreen="#3F9440", lime="#A8D84E",
    gold="#F3C431", teal2="#38B8A7", purple="#8D6DD8", stone="#B9B4A8", dkstone="#8C8779", water="#57B8E8", earth="#7C5A34", hay="#E3B94F",
    glass="GLASS", glasspane="PANE", cloth1="#E9564B", cloth2="#F8F5EF", cloth3="#3E7FD6", cloth4="#F2C230", black="#2B2F3A", crop_wheat="#E8B93E", crop_green="#57B24A", crop_corn="#9CCB3F",
)
_mat = {}
def mat(key):
    if key in _mat: return _mat[key]
    m = bpy.data.materials.new(key); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    if key == "PANE" or key == "glasspane":
        b.inputs["Base Color"].default_value = (0.7, 0.88, 0.95, 1); b.inputs["Roughness"].default_value = 0.1; b.inputs["Alpha"].default_value = 0.35
        try: m.surface_render_method = "BLENDED"
        except Exception: pass
    elif key == "glass":
        b.inputs["Base Color"].default_value = (0.55, 0.78, 0.95, 1); b.inputs["Roughness"].default_value = 0.15
        b.inputs["Emission Color"].default_value = (1.0, 0.82, 0.45, 1); b.inputs["Emission Strength"].default_value = 1.0
    else:
        h = PAL[key].lstrip("#"); r, g, bl = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
        lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        b.inputs["Base Color"].default_value = (lin(r), lin(g), lin(bl), 1); b.inputs["Roughness"].default_value = 0.72
        b.inputs["Metallic"].default_value = 0.0
    _mat[key] = m; return m

class Kit:
    def __init__(self, name): self.name = name; self.parts = []
    def _add(self, bm, color, tag):
        me = bpy.data.meshes.new(f"{self.name}_{len(self.parts)}"); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(me.name, me); bpy.context.scene.collection.objects.link(ob)
        ob.data.materials.append(mat(color)); self.parts.append(ob)
        for p in me.polygons: p.use_smooth = False
        return ob
    def box(self, cx, cy, z0, sx, sy, sz, color, bevel=0.035, rz=0.0, rx=0.0, ry=0.0):
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= sx; v.co.y *= sy; v.co.z = (v.co.z + 0.5) * sz
        if bevel > 0: bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, sx / 3, sy / 3, sz / 3), segments=2, affect='EDGES')
        from mathutils import Matrix
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(rx, 3, 'X') @ Matrix.Rotation(ry, 3, 'Y') @ Matrix.Rotation(rz, 3, 'Z'))
        bmesh.ops.translate(bm, verts=bm.verts, vec=(cx, cy, z0)); return self._add(bm, color, "box")
    def cyl(self, cx, cy, z0, r, h, color, r2=None, seg=20, rx=0.0, ry=0.0):
        from mathutils import Matrix
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=(r if r2 is None else r2), depth=h)
        if rx or ry: bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(rx, 3, 'X') @ Matrix.Rotation(ry, 3, 'Y'))
        bmesh.ops.translate(bm, verts=bm.verts, vec=(cx, cy, z0 + h / 2)); return self._add(bm, color, "cyl")
    def sphere(self, cx, cy, cz, r, color, seg=14, sz=1.0):
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg // 2), radius=r)
        for v in bm.verts: v.co.z *= sz
        bmesh.ops.translate(bm, verts=bm.verts, vec=(cx, cy, cz)); return self._add(bm, color, "sph")
    def gable(self, cx, cy, z0, w, d, h, color, over=0.14, ridge_x=False):
        """Gable roof. Ridge runs along y (or x when ridge_x)."""
        a, b = (w / 2 + over, d / 2 + over) if not ridge_x else (d / 2 + over, w / 2 + over)
        vs = [(-a, -b, 0), (a, -b, 0), (a, b, 0), (-a, b, 0), (0, -b, h), (0, b, h)]
        fs = [(0, 1, 4), (2, 3, 5), (1, 2, 5, 4), (3, 0, 4, 5), (0, 3, 2, 1)]
        return self._poly(vs, fs, cx, cy, z0, color, rot=(math.pi / 2 if ridge_x else 0))
    def hip(self, cx, cy, z0, w, d, h, color, over=0.14, top=0.0):
        a, b = w / 2 + over, d / 2 + over; t = top
        vs = [(-a, -b, 0), (a, -b, 0), (a, b, 0), (-a, b, 0), (-t, -t, h), (t, -t, h), (t, t, h), (-t, t, h)]
        fs = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7), (0, 3, 2, 1)]
        return self._poly(vs, fs, cx, cy, z0, color)
    def _poly(self, vs, fs, cx, cy, z0, color, rot=0):
        bm = bmesh.new(); vv = [bm.verts.new(v) for v in vs]
        for f in fs:
            try: bm.faces.new([vv[i] for i in f])
            except ValueError: pass
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        if rot: bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(rot, 3, 'Z'))
        bmesh.ops.translate(bm, verts=bm.verts, vec=(cx, cy, z0)); return self._add(bm, color, "poly")
    # ---- details ----
    def window(self, x, y, z, face, w=0.26, h=0.32):
        """A framed window on a wall. face: 'front'(-y), 'back'(+y), 'left'(-x), 'right'(+x)."""
        o = {"front": (0, -1), "back": (0, 1), "left": (-1, 0), "right": (1, 0)}[face]; horiz = face in ("front", "back")
        sx, sy = (w + 0.08, 0.05) if horiz else (0.05, w + 0.08)
        self.box(x + o[0] * 0.0, y + o[1] * 0.0, z, sx, sy, h + 0.08, "white", bevel=0.01)
        sx2, sy2 = (w, 0.07) if horiz else (0.07, w)
        self.box(x + o[0] * 0.012, y + o[1] * 0.012, z + 0.04, sx2, sy2, h, "glass", bevel=0.0)
        self.box(x + o[0] * 0.02, y + o[1] * 0.02, z + 0.04 + h / 2 - 0.012, sx2 * (1 if horiz else 0.4), sy2 * (0.4 if horiz else 1), 0.024, "white", bevel=0.0)
    def door(self, x, y, face="front", w=0.3, h=0.5, color="darkwood"):
        o = {"front": (0, -1), "back": (0, 1), "left": (-1, 0), "right": (1, 0)}[face]; horiz = face in ("front", "back")
        self.box(x, y, 0, w + 0.1 if horiz else 0.06, 0.06 if horiz else w + 0.1, h + 0.08, "white", bevel=0.012)
        self.box(x + o[0] * 0.015, y + o[1] * 0.015, 0, w if horiz else 0.07, 0.07 if horiz else w, h, color, bevel=0.012)
        self.sphere(x + o[0] * 0.05 + (w * 0.3 if horiz else 0), y + o[1] * 0.05 + (0 if horiz else w * 0.3), h * 0.5, 0.03, "gold", seg=8)
    def chimney(self, x, y, z, h=0.4, color="brick"):
        self.box(x, y, z, 0.16, 0.16, h, color, bevel=0.015); self.box(x, y, z + h, 0.21, 0.21, 0.05, "stone", bevel=0.01)
    def awning(self, cx, y, z, w, depth=0.28, colors=("cloth1", "cloth2"), stripes=6):
        sw = w / stripes
        for i in range(stripes):
            x = cx - w / 2 + sw * (i + 0.5)
            vs = [(x - sw / 2, 0, 0.16), (x + sw / 2, 0, 0.16), (x + sw / 2, -depth, 0), (x - sw / 2, -depth, 0),
                  (x - sw / 2, 0, 0.13), (x + sw / 2, 0, 0.13), (x + sw / 2, -depth, -0.03), (x - sw / 2, -depth, -0.03)]
            fs = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (3, 2, 6, 7), (0, 3, 7, 4), (1, 5, 6, 2)]
            self._poly(vs, fs, 0, y, z, colors[i % 2])
    def finish(self):
        bpy.ops.object.select_all(action="DESELECT")
        for p in self.parts: p.select_set(True)
        bpy.context.view_layer.objects.active = self.parts[0]
        bpy.ops.object.join(); ob = bpy.context.view_layer.objects.active; ob.name = self.name
        bpy.ops.object.shade_flat(); return ob

# --------------------------------------------------------------------------------------------- buildings
def house(name, wall="cream", roof="red", w=1.5, d=1.2, h=0.9, floors=1, chimney=True, porch=True, hip=False, flowers=True):
    k = Kit(name); H = h * floors
    k.box(0, 0, 0.0, w + 0.1, d + 0.1, 0.1, "stone", bevel=0.02)          # plinth
    k.box(0, 0, 0.1, w, d, H, wall)
    (k.hip if hip else k.gable)(0, 0, 0.1 + H, w, d, 0.62, roof)
    if chimney: k.chimney(w * 0.25, d * 0.05, 0.1 + H + 0.25, 0.42)
    k.door(-w * 0.18 if porch else 0, -d / 2 - 0.005, "front")
    for f in range(floors):
        z = 0.1 + h * f + 0.36
        for x in ([w * 0.24] if f == 0 else [-w * 0.26, w * 0.26]): k.window(x, -d / 2 - 0.005, z, "front")
        k.window(-w / 2 - 0.005, 0, z, "left"); k.window(w / 2 + 0.005, 0, z, "right")
    if porch:
        k.box(-w * 0.18, -d / 2 - 0.16, 0.1, 0.62, 0.3, 0.06, "wood", bevel=0.01)
        k.box(-w * 0.18, -d / 2 - 0.16, 0.1 + 0.62, 0.7, 0.34, 0.05, roof, bevel=0.01)
        for sx in (-1, 1): k.box(-w * 0.18 + sx * 0.28, -d / 2 - 0.3, 0.16, 0.05, 0.05, 0.56, "white", bevel=0.008)
    if flowers:
        k.box(w * 0.24, -d / 2 - 0.09, 0.28, 0.4, 0.12, 0.1, "wood", bevel=0.01)
        for i in range(4): k.sphere(w * 0.24 - 0.14 + i * 0.093, -d / 2 - 0.09, 0.42, 0.045, ("red", "butter", "pink", "purple")[i], seg=8)
    return k.finish()

def cottage(): return house("cottage", "butter", "orange", 1.35, 1.1, 0.8)
def house_red(): return house("house_red", "cream", "red", 1.55, 1.25, 0.95)
def townhouse():
    k = house("townhouse", "sky", "slate", 1.05, 1.15, 0.85, floors=2, porch=False, flowers=False); return k
def villa(): return house("villa", "pink", "terracotta", 1.75, 1.35, 1.0, hip=True)
def farmhouse(): return house("farmhouse", "wood", "green", 1.5, 1.2, 0.85, hip=False)

def apartments():
    k = Kit("apartments"); w, d, H = 1.5, 1.3, 2.3
    k.box(0, 0, 0, w + 0.1, d + 0.1, 0.1, "stone", 0.02); k.box(0, 0, 0.1, w, d, H, "brick")
    k.box(0, 0, 0.1 + H, w + 0.16, d + 0.16, 0.12, "white", 0.02); k.box(0, 0, 0.1 + H + 0.12, w - 0.1, d - 0.1, 0.08, "dkstone", 0.01)
    for f in range(4):
        for x in (-0.48, 0, 0.48):
            if f == 0 and x == 0: continue
            k.window(x, -d / 2 - 0.005, 0.28 + f * 0.55, "front", 0.24, 0.3)
        for y in (-0.3, 0.3): k.window(w / 2 + 0.005, y, 0.28 + f * 0.55, "right", 0.24, 0.3)
    k.door(0, -d / 2 - 0.005, "front", 0.34, 0.55, "teal"); k.awning(0, -d / 2 - 0.02, 0.72, 0.6, 0.3, ("teal", "white"), 4)
    k.box(0.4, 0.2, 0.1 + H + 0.2, 0.3, 0.3, 0.2, "stone", 0.01); k.box(-0.35, -0.2, 0.1 + H + 0.2, 0.22, 0.22, 0.32, "slate", 0.01)
    return k.finish()

def barn():
    k = Kit("barn"); w, d, H = 1.7, 1.3, 0.85
    k.box(0, 0, 0, w + 0.1, d + 0.1, 0.08, "stone", 0.02); k.box(0, 0, 0.08, w, d, H, "red")
    k.gable(0, 0, 0.08 + H, w, d, 0.7, "dkstone", 0.12, ridge_x=True)
    k.box(0, -d / 2 - 0.005, 0.08, 0.8, 0.06, 0.66, "white", 0.01); k.box(0, -d / 2 - 0.015, 0.1, 0.72, 0.06, 0.62, "red", 0.01)
    for s in (-1, 1): k.box(s * 0.0, -d / 2 - 0.05, 0.1 + 0.31, 0.02 if False else 0.86, 0.02, 0.05, "white", 0.005, rz=0)
    k.box(0, -d / 2 - 0.02, 0.08 + H + 0.3, 0.3, 0.05, 0.3, "white", 0.01); k.box(0, -d / 2 - 0.03, 0.08 + H + 0.32, 0.22, 0.05, 0.22, "darkwood", 0.01)
    k.cyl(w / 2 + 0.28, 0.1, 0.0, 0.26, 1.35, "stone", 0.26, 18); k.cyl(w / 2 + 0.28, 0.1, 1.35, 0.27, 0.05, "white", 0.27, 18)
    k.sphere(w / 2 + 0.28, 0.1, 1.42, 0.27, "stone", 16, 0.7)
    return k.finish()

def windmill():
    k = Kit("windmill"); k.cyl(0, 0, 0, 0.55, 0.12, "stone", 0.55); k.cyl(0, 0, 0.12, 0.48, 1.35, "cream", 0.3, 20)
    k.cyl(0, 0, 1.47, 0.42, 0.06, "white", 0.42, 20); k.cyl(0, 0, 1.53, 0.4, 0.5, "red", 0.0, 20)
    k.door(0, -0.47, "front", 0.28, 0.42); k.window(0, -0.4, 0.75, "front", 0.2, 0.26)
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        k.box(0, -0.5, 1.3, 0.05, 0.04, 0.95, "darkwood", 0.0, ry=a); k.box(0, -0.5, 1.3, 0.3, 0.03, 0.75, "cloth2", 0.0, ry=a).location = (0, 0, 0)
    k.sphere(0, -0.5, 1.3, 0.09, "gold", 10)
    return k.finish()

def greenhouse():
    k = Kit("greenhouse"); w, d, H = 1.6, 1.1, 0.7
    k.box(0, 0, 0, w + 0.06, d + 0.06, 0.08, "white", 0.01); k.box(0, 0, 0.08, w, d, H, "glasspane", 0.0)
    k.gable(0, 0, 0.08 + H, w, d, 0.4, "glasspane", 0.02)
    for x in (-w / 2, -w / 4, 0, w / 4, w / 2): k.box(x, -d / 2, 0.08, 0.04, 0.04, H, "white", 0.005); k.box(x, d / 2, 0.08, 0.04, 0.04, H, "white", 0.005)
    for s in (-1, 1): k.box(0, s * d / 2, 0.08 + H, w, 0.04, 0.04, "white", 0.005)
    k.box(0, 0, 0.08 + H + 0.4, w + 0.28, 0.05, 0.04, "white", 0.005)
    for i in range(5):
        k.box(-0.6 + i * 0.3, 0, 0.1, 0.22, 0.6, 0.14, "earth", 0.02); k.sphere(-0.6 + i * 0.3, 0, 0.3, 0.13, ("green", "lime", "dkgreen", "green", "lime")[i], 8)
    return k.finish()

def shop(name, wall, roof, awn, sign, w=1.7, d=1.3, H=1.0, chimney=True):
    k = Kit(name)
    k.box(0, 0, 0, w + 0.1, d + 0.1, 0.1, "stone", 0.02); k.box(0, 0, 0.1, w, d, H, wall)
    k.box(0, 0, 0.1 + H, w + 0.1, d + 0.1, 0.1, "white", 0.02); k.gable(0, 0, 0.2 + H, w, d, 0.5, roof, 0.1, ridge_x=True)
    if chimney: k.chimney(-w * 0.3, 0.2, 0.2 + H + 0.2, 0.45)
    k.window(-w * 0.28, -d / 2 - 0.005, 0.36, "front", 0.5, 0.4); k.window(w * 0.3, -d / 2 - 0.005, 0.36, "front", 0.3, 0.4)
    k.door(w * 0.06, -d / 2 - 0.005, "front", 0.3, 0.55, "darkwood"); k.awning(-w * 0.28, -d / 2 - 0.02, 0.86, 0.62, 0.3, awn, 6)
    k.box(0, -d / 2 - 0.06, 0.1 + H - 0.16, 0.9, 0.05, 0.2, sign, 0.01); return k.finish()
def bakery(): return shop("bakery", "pink", "terracotta", ("cloth1", "cloth2"), "butter")
def cafe():
    k = Kit("cafe"); w, d, H = 1.3, 1.0, 0.85
    k.box(0, 0.25, 0, w + 0.1, d + 0.1, 0.1, "stone", 0.02); k.box(0, 0.25, 0.1, w, d, H, "butter"); k.box(0, 0.25, 0.1 + H, w + 0.1, d + 0.1, 0.1, "white", 0.02)
    k.gable(0, 0.25, 0.2 + H, w, d, 0.45, "teal", 0.1, ridge_x=True); k.chimney(0.4, 0.35, 0.2 + H + 0.2, 0.4)
    k.window(-0.3, -0.25 - 0.005, 0.34, "front", 0.4, 0.38); k.door(0.32, -0.25 - 0.005, "front"); k.awning(-0.3, -0.27, 0.84, 0.55, 0.3, ("cloth3", "cloth2"), 6)
    for x in (-0.55, 0.55):                                  # parasol tables
        k.cyl(x, -0.75, 0, 0.02, 0.5, "white", 0.02, 8); k.cyl(x, -0.75, 0.5, 0.3, 0.02, "cloth1", 0.3, 12)
        k.cyl(x, -0.75, 0.52, 0.28, 0.14, "cloth1", 0.02, 12); k.cyl(x, -0.75, 0, 0.16, 0.03, "white", 0.16, 12)
    return k.finish()
def school():
    k = Kit("school"); w, d, H = 2.0, 1.3, 1.0
    k.box(0, 0, 0, w + 0.1, d + 0.1, 0.1, "stone", 0.02); k.box(0, 0, 0.1, w, d, H, "brick"); k.box(0, 0, 0.1 + H, w + 0.12, d + 0.12, 0.1, "white", 0.02)
    k.gable(0, 0, 0.2 + H, w, d, 0.45, "slate", 0.1, ridge_x=True)
    k.box(0, -0.1, 0.2 + H + 0.3, 0.5, 0.5, 0.75, "brick", 0.02); k.hip(0, -0.1, 0.2 + H + 1.05, 0.5, 0.5, 0.4, "slate", 0.06)
    k.cyl(0, -0.37, 0.2 + H + 0.5, 0.15, 0.03, "white", 0.15, 16); k.window(0, -0.36, 0.2 + H + 0.42, "front", 0.1, 0.1)
    for x in (-0.7, -0.35, 0.35, 0.7): k.window(x, -d / 2 - 0.005, 0.42, "front", 0.26, 0.4)
    k.door(0, -d / 2 - 0.005, "front", 0.4, 0.6); k.box(0, -d / 2 - 0.2, 0.1, 0.9, 0.36, 0.05, "stone", 0.01)
    k.cyl(0.9, -0.55, 0.1, 0.02, 1.3, "white", 0.02, 6); k.box(0.99, -0.55, 1.1, 0.16, 0.02, 0.1, "cloth1", 0.0)
    return k.finish()
def workshop():
    k = shop("workshop", "sky", "slate", ("orange", "cloth2"), "orange", 1.8, 1.4, 0.95)
    return k
def clinic():
    k = Kit("clinic"); w, d, H = 1.8, 1.3, 1.0
    k.box(0, 0, 0, w + 0.1, d + 0.1, 0.1, "stone", 0.02); k.box(0, 0, 0.1, w, d, H, "white"); k.box(0, 0, 0.1 + H, w + 0.1, d + 0.1, 0.12, "teal2", 0.02)
    k.box(0, 0, 0.22 + H, w - 0.1, d - 0.1, 0.06, "stone", 0.01)
    for x in (-0.6, 0, 0.6): k.window(x, -d / 2 - 0.005, 0.44, "front", 0.3, 0.4)
    k.door(0, -d / 2 - 0.005, "front", 0.4, 0.55, "teal2")
    k.box(0, -d / 2 - 0.03, 0.1 + H - 0.1, 0.34, 0.03, 0.09, "red", 0.0); k.box(0, -d / 2 - 0.03, 0.1 + H - 0.1 - 0.0, 0.09, 0.03, 0.34, "red", 0.0)
    k.box(0, 0.1, 0.28 + H, 0.5, 0.05, 0.15, "red", 0.0); k.box(0, 0.1, 0.28 + H - 0.05, 0.15, 0.05, 0.5, "red", 0.0)
    return k.finish()
def hall():
    k = Kit("hall"); w, d, H = 2.0, 1.4, 0.95
    k.box(0, 0, 0, w + 0.14, d + 0.14, 0.12, "stone", 0.02); k.box(0, 0, 0.12, w, d, H, "cream")
    k.gable(0, 0, 0.12 + H, w, d, 0.55, "red", 0.14, ridge_x=True)
    k.box(0, -d / 2 - 0.25, 0.12, 1.3, 0.5, 0.06, "stone", 0.01)
    for x in (-0.55, -0.18, 0.18, 0.55): k.cyl(x, -d / 2 - 0.35, 0.18, 0.07, 0.85, "white", 0.07, 12)
    k.box(0, -d / 2 - 0.35, 0.18 + 0.85, 1.4, 0.34, 0.08, "white", 0.01); k.gable(0, -d / 2 - 0.35, 0.18 + 0.93, 1.3, 0.26, 0.28, "white", 0.06, ridge_x=True)
    k.door(0, -d / 2 - 0.005, "front", 0.4, 0.62, "darkwood")
    for x in (-0.75, 0.75): k.window(x, -d / 2 - 0.005, 0.42, "front", 0.3, 0.45)
    k.cyl(0, 0.1, 0.12 + H + 0.55, 0.33, 0.35, "white", 0.33, 18); k.sphere(0, 0.1, 0.12 + H + 0.9, 0.34, "gold", 16, 0.8)
    return k.finish()
def library():
    k = Kit("library"); w, d, H = 1.9, 1.3, 1.05
    k.box(0, 0, 0, w + 0.1, d + 0.1, 0.1, "stone", 0.02); k.box(0, 0, 0.1, w, d, H, "purple"); k.box(0, 0, 0.1 + H, w + 0.12, d + 0.12, 0.1, "white", 0.02)
    k.hip(0, 0, 0.2 + H, w, d, 0.5, "dkstone", 0.1, top=0.35)
    for x in (-0.6, -0.2, 0.2, 0.6): k.box(x, -d / 2 - 0.005, 0.24, 0.24, 0.06, 0.62, "white", 0.02); k.box(x, -d / 2 - 0.012, 0.28, 0.17, 0.06, 0.54, "glass", 0.0)
    k.door(0, -d / 2 - 0.005, "front", 0.34, 0.5, "gold"); k.box(0, -d / 2 - 0.2, 0.1, 0.8, 0.36, 0.05, "stone", 0.01)
    for i, c in enumerate(("red", "butter", "teal2", "cloth3")): k.box(-0.3 + i * 0.2, -d / 2 - 0.035, 0.1 + H - 0.12, 0.15, 0.03, 0.14, c, 0.0)
    return k.finish()

# --------------------------------------------------------------------------------------------- props / fields
def fountain():
    k = Kit("fountain"); k.cyl(0, 0, 0, 0.95, 0.16, "stone", 0.95, 32); k.cyl(0, 0, 0.16, 0.85, 0.1, "water", 0.85, 32)
    k.cyl(0, 0, 0.16, 0.14, 0.7, "dkstone", 0.1, 16); k.cyl(0, 0, 0.86, 0.42, 0.08, "stone", 0.34, 20); k.cyl(0, 0, 0.9, 0.36, 0.05, "water", 0.36, 20)
    k.cyl(0, 0, 0.9, 0.05, 0.28, "water", 0.03, 8); k.sphere(0, 0, 1.2, 0.07, "water", 8)
    return k.finish()
def clocktower():
    k = Kit("clocktower"); k.box(0, 0, 0, 0.9, 0.9, 0.12, "stone", 0.02); k.box(0, 0, 0.12, 0.7, 0.7, 1.9, "brick", 0.03)
    k.box(0, 0, 2.02, 0.84, 0.84, 0.1, "white", 0.02); k.hip(0, 0, 2.12, 0.66, 0.66, 0.65, "slate", 0.05)
    for s, (x, y, f) in enumerate([(0, -0.36, "front"), (0, 0.36, "back"), (-0.36, 0, "left"), (0.36, 0, "right")]):
        horiz = f in ("front", "back"); k.cyl(x, y, 1.65, 0.24, 0.03, "white", 0.24, 20, rx=(math.pi / 2 if horiz else 0), ry=(0 if horiz else math.pi / 2))
    k.door(0, -0.355, "front", 0.26, 0.42); k.window(0, -0.355, 1.0, "front", 0.16, 0.26)
    return k.finish()
def bench():
    k = Kit("bench"); k.box(0, 0, 0.22, 0.7, 0.22, 0.05, "wood", 0.01); k.box(0, 0.09, 0.4, 0.7, 0.04, 0.22, "wood", 0.01)
    for x in (-0.28, 0.28): k.box(x, 0, 0, 0.05, 0.2, 0.22, "black", 0.01)
    return k.finish()
def lamp():
    k = Kit("lamp"); k.cyl(0, 0, 0, 0.1, 0.06, "black", 0.1, 10); k.cyl(0, 0, 0.06, 0.03, 1.1, "black", 0.025, 8); k.sphere(0, 0, 1.22, 0.12, "glass", 10)
    k.cyl(0, 0, 1.32, 0.13, 0.04, "black", 0.13, 10); return k.finish()
def tree(name="tree_round", crown="green", trunk="darkwood", r=0.55, h=0.9):
    k = Kit(name); k.cyl(0, 0, 0, 0.11, h * 0.6, trunk, 0.08, 8)
    k.sphere(0, 0, h * 0.6 + r * 0.55, r, crown, 14, 0.9); k.sphere(0.2, 0.08, h * 0.6 + r * 0.25, r * 0.6, crown, 10, 0.9); k.sphere(-0.18, -0.1, h * 0.6 + r * 0.4, r * 0.6, "lime" if crown == "green" else crown, 10, 0.9)
    return k.finish()
def orchard_tree():
    k = Kit("tree_fruit"); k.cyl(0, 0, 0, 0.1, 0.5, "darkwood", 0.08, 8); k.sphere(0, 0, 0.85, 0.5, "green", 14, 0.85)
    for i in range(7):
        a = i * 0.9; k.sphere(math.cos(a) * 0.36, math.sin(a) * 0.36, 0.75 + (i % 3) * 0.12, 0.07, ("red", "orange")[i % 2], 8)
    return k.finish()
def pine():
    k = Kit("tree_pine"); k.cyl(0, 0, 0, 0.09, 0.3, "darkwood", 0.09, 8)
    for i, (r, z) in enumerate([(0.5, 0.25), (0.4, 0.6), (0.3, 0.92)]): k.cyl(0, 0, z, r, 0.5, "dkgreen", 0.02, 12)
    return k.finish()
def field(name, crop):
    k = Kit(name); k.box(0, 0, 0, 2.0, 1.5, 0.06, "earth", 0.02)
    for i in range(6):
        y = -0.62 + i * 0.25; k.box(0, y, 0.06, 1.8, 0.14, 0.05, "darkwood" if False else "earth", 0.02)
        for j in range(9):
            x = -0.8 + j * 0.2
            if crop == "wheat": k.cyl(x, y, 0.1, 0.045, 0.3, "crop_wheat", 0.02, 6)
            elif crop == "corn": k.cyl(x, y, 0.1, 0.04, 0.45, "crop_corn", 0.03, 6); k.sphere(x, y, 0.5, 0.05, "gold", 6)
            else: k.sphere(x, y, 0.16, 0.09, ("crop_green", "lime", "crop_green")[j % 3], 8, 0.8)
    for s in (-1, 1): k.box(0, s * 0.78, 0, 2.1, 0.05, 0.16, "wood", 0.01)
    for s in (-1, 1): k.box(s * 1.03, 0, 0, 0.05, 1.55, 0.16, "wood", 0.01)
    return k.finish()
def pond():
    k = Kit("pond"); k.cyl(0, 0, 0, 0.95, 0.1, "stone", 0.95, 28); k.cyl(0, 0, 0.1, 0.82, 0.03, "water", 0.82, 28)
    for a in range(9): k.sphere(math.cos(a * 0.7) * 0.9, math.sin(a * 0.7) * 0.9, 0.1, 0.13, "dkstone", 8, 0.7)
    for x, y in ((0.2, 0.1), (-0.3, -0.2), (0.35, -0.3)): k.cyl(x, y, 0.13, 0.13, 0.02, "green", 0.13, 10)
    k.sphere(0.2, 0.1, 0.16, 0.05, "pink", 8)
    return k.finish()
def playground():
    k = Kit("playground"); k.box(0, 0, 0, 1.9, 1.5, 0.05, "hay", 0.02)
    for x in (-0.3, 0.3): k.box(x - 0.45, 0, 0.05, 0.05, 0.05, 0.9, "cloth1", 0.01, rz=0); k.box(x - 0.45, 0.4, 0.05, 0.05, 0.05, 0.9, "cloth1", 0.01)
    k.box(-0.45, 0.2, 0.92, 1.0, 0.7, 0.05, "cloth1", 0.01)
    k.box(0.45, -0.1, 0.5, 0.35, 0.9, 0.04, "cloth3", 0.01, rx=0.55)
    k.box(0.25, 0.35, 0.05, 0.05, 0.05, 0.6, "cloth4", 0.01); k.box(0.75, 0.35, 0.05, 0.05, 0.05, 0.6, "cloth4", 0.01); k.box(0.5, 0.35, 0.65, 0.6, 0.04, 0.04, "cloth4", 0.01)
    for x in (0.4, 0.6): k.box(x, 0.35, 0.3, 0.04, 0.02, 0.32, "black", 0.0); k.box(x, 0.35, 0.28, 0.14, 0.14, 0.03, "cloth3", 0.005)
    return k.finish()
def gazebo():
    k = Kit("gazebo"); k.cyl(0, 0, 0, 0.9, 0.12, "stone", 0.9, 8); k.cyl(0, 0, 0.12, 0.8, 0.05, "wood", 0.8, 8)
    for i in range(8):
        a = i * math.pi / 4 + math.pi / 8; k.cyl(math.cos(a) * 0.68, math.sin(a) * 0.68, 0.17, 0.045, 0.85, "white", 0.045, 8)
    k.cyl(0, 0, 1.02, 0.85, 0.06, "white", 0.85, 8); k.cyl(0, 0, 1.08, 0.82, 0.5, "cloth1", 0.03, 8); k.sphere(0, 0, 1.6, 0.06, "gold", 8)
    return k.finish()
def stall():
    k = Kit("market_stall"); k.box(0, 0, 0.0, 1.3, 0.6, 0.5, "wood", 0.02)
    for x in (-0.6, 0.6): k.box(x, -0.25, 0, 0.05, 0.05, 1.1, "white", 0.008); k.box(x, 0.25, 0, 0.05, 0.05, 1.1, "white", 0.008)
    k.awning(0, 0.32, 1.02, 1.4, 0.7, ("cloth1", "cloth2"), 7)
    for i in range(5): k.sphere(-0.45 + i * 0.22, -0.05, 0.56, 0.09, ("red", "orange", "green", "butter", "red")[i], 8)
    return k.finish()
def bridge():
    k = Kit("bridge_town"); k.box(0, 0, 0.0, 1.0, 2.0, 0.12, "stone", 0.02)
    for s in (-1, 1): k.box(s * 0.46, 0, 0.12, 0.08, 2.0, 0.22, "wood", 0.01)
    return k.finish()
ALL = [cottage, house_red, townhouse, villa, farmhouse, apartments, barn, windmill, greenhouse, bakery, cafe, school, workshop, clinic, hall, library,
       fountain, clocktower, bench, lamp, tree, orchard_tree, pine, lambda: field("field_wheat", "wheat"), lambda: field("field_corn", "corn"), lambda: field("field_veg", "veg"),
       pond, playground, gazebo, stall]
