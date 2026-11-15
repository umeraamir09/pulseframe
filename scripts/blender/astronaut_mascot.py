"""
Procedural astronaut mascot (based on public/mascot.jpg) with posed, looping animations.

Usage (headless):
  blender -b --factory-startup --python scripts/blender/astronaut_mascot.py -- <pose> <out.glb> [preview.png]
  pose: wave | point | type

Conventions: Blender Z-up, character faces -Y (towards the camera). "L" limbs are on +X,
which is the viewer's RIGHT side. The glTF export converts to Y-up, facing +Z.
"""
import math
import sys

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
POSE = argv[0]
OUT = argv[1]
PREVIEW = argv[2] if len(argv) > 2 else None

FPS = 24
FRAMES = 48  # 2 second loop

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = f"mascot-{POSE}"
scene.render.fps = FPS
scene.frame_start = 0
scene.frame_end = FRAMES

DOWN = Vector((0, 0, -1))


# ---------------------------------------------------------------- materials
def mat(name, color, rough=0.45, metal=0.0, emit=None, strength=0.0, alpha=1.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if coat:
        b.inputs["Coat Weight"].default_value = coat
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except AttributeError:
            m.blend_method = "BLEND"
    return m


M_SUIT = mat("Suit", (0.86, 0.86, 0.87), rough=0.55)
M_SUIT_SHADE = mat("SuitShade", (0.70, 0.71, 0.73), rough=0.6)
M_STRIPE = mat("Stripe", (0.20, 0.055, 0.03), rough=0.5)
M_VISOR = mat("Visor", (0.07, 0.035, 0.02), rough=0.06, metal=0.85, coat=1.0)
M_DARK = mat("Button", (0.12, 0.13, 0.15), rough=0.25, metal=0.4)
M_GLOW = mat("Glow", (0.1, 0.45, 1.0), rough=0.3, emit=(0.15, 0.5, 1.0), strength=4.0)
M_SOLE = mat("Sole", (0.62, 0.63, 0.65), rough=0.7)
M_HOLO = mat("Holo", (0.1, 0.55, 1.0), rough=0.2, emit=(0.1, 0.45, 1.0), strength=0.6, alpha=0.35)
M_KEY = mat("HoloKey", (0.3, 0.75, 1.0), rough=0.3, emit=(0.3, 0.75, 1.0), strength=2.5)


# ---------------------------------------------------------------- helpers
def joint(name, parent, loc):
    e = bpy.data.objects.new(name, None)
    scene.collection.objects.link(e)
    e.empty_display_size = 0.05
    e.parent = parent
    e.location = loc
    e.rotation_mode = "QUATERNION"
    return e


def prim(kind, parent, loc, size, m, name="part", rot=(0, 0, 0), bevel=0.0, minor=0.03, seg=28):
    """size = half extents (sphere/cube/cyl) or (rx, ry, rz) ellipse scale for torus."""
    if kind == "capsule":
        # size = (rx, ry, total_length) along -Z from the origin's centre
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1)
        o = bpy.context.active_object
        rx, ry, length = size
        rz = (rx + ry) / 2
        half = max(0.0, length / 2 - rz)
        for v in o.data.vertices:
            z = v.co.z * rz
            v.co.x *= rx
            v.co.y *= ry
            v.co.z = z + (half if z > 0 else -half)
        size = (1, 1, 1)
    elif kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1)
    elif kind == "cube":
        bpy.ops.mesh.primitive_cube_add(size=2)
    elif kind == "cyl":
        bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=1, depth=2)
    elif kind == "torus":
        bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=minor, major_segments=seg, minor_segments=12)
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    if kind == "torus":
        # scale only the major radius so the tube thickness stays uniform
        for v in o.data.vertices:
            co = v.co
            r = math.hypot(co.x, co.y)
            if r > 1e-6:
                ring = Vector((co.x / r, co.y / r, 0))
                off = co - ring
                co.x = ring.x * size[0] + off.x
                co.y = ring.y * size[1] + off.y
    else:
        o.data.transform(Matrix.Diagonal((*size, 1)))
    o.data.update()
    for p in o.data.polygons:
        p.use_smooth = True
    if bevel:
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 4
        mod.limit_method = "NONE"
    o.data.materials.append(m)
    o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    return o


def rounded_box(parent, loc, half, m, r, name="box", rot=(0, 0, 0)):
    return prim("cube", parent, loc, half, m, name=name, bevel=r, rot=rot)


def _finish(o, parent, loc, m, rot=(0, 0, 0)):
    o.data.name = o.name
    for p in o.data.polygons:
        p.use_smooth = True
    o.data.materials.append(m)
    o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    return o


def lathe(parent, loc, profile, m, name="lathe", seg=40, rot=(0, 0, 0)):
    """Revolve a profile of (z, rx, ry) rows (top to bottom) around Z into a closed, smooth tube.
    Lets limbs taper and carry their wrinkles in the surface instead of floating rings."""
    verts, faces = [], []
    for z, rx, ry in profile:
        for k in range(seg):
            a = 2 * math.pi * k / seg
            verts.append((rx * math.cos(a), ry * math.sin(a), z))
    rows = len(profile)
    for r in range(rows - 1):
        for k in range(seg):
            a, b = r * seg + k, r * seg + (k + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    top = len(verts)
    verts.append((0, 0, profile[0][0] + 0.25 * min(profile[0][1], profile[0][2])))
    bot = len(verts)
    verts.append((0, 0, profile[-1][0] - 0.25 * min(profile[-1][1], profile[-1][2])))
    for k in range(seg):
        faces.append((top, (k + 1) % seg, k))
        last = (rows - 1) * seg
        faces.append((bot, last + k, last + (k + 1) % seg))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    return _finish(o, parent, loc, m, rot)


def limb_profile(z0, z1, r0, r1, bulge=0.0, cap0=1.0, cap1=1.0, grooves=(), groove_depth=0.012, flat=1.0, steps=26):
    """Profile for a padded suit segment from z0 (top) to z1 (bottom).
    Radius blends r0 -> r1 with a soft mid bulge, rounded caps at each end and optional
    fabric grooves (z positions) pressed into the surface."""
    out = []
    for i in range(steps + 1):
        t = i / steps
        z = z0 + (z1 - z0) * t
        r = r0 + (r1 - r0) * t + bulge * math.sin(math.pi * t)
        # rounded caps: shrink the radius over the last ~22% at each end
        for edge, cap in ((t, cap0), (1 - t, cap1)):
            if cap and edge < 0.22:
                u = edge / 0.22
                r *= (1 - cap) + cap * math.sqrt(max(0.0, 1 - (1 - u) ** 2))
        for g in grooves:
            r -= groove_depth * math.exp(-(((z - g) / 0.014) ** 2))
        out.append((z, max(r, 0.004), max(r, 0.004) * flat))
    return out


def profile_radius(profile, z):
    for (za, ra, _), (zb, rb, _) in zip(profile, profile[1:]):
        if zb <= z <= za:
            t = (za - z) / (za - zb) if za != zb else 0
            return ra + (rb - ra) * t
    return profile[-1][1]


def stripe(parent, loc_z, profile, m, name="stripe", minor=0.0085):
    """Thin band sitting half-sunk into a lathe surface at height loc_z."""
    r = profile_radius(profile, loc_z) + minor * 0.15
    return prim("torus", parent, (0, 0, loc_z), (r, r, 1), m, name, minor=minor, seg=40)


def blob(parent, loc, half, m, name="blob", power=0.55, seg=40, flat_bottom=None):
    """Superellipsoid: a soft rounded box (power 1 = ellipsoid, lower = boxier).
    flat_bottom clamps local z (as a fraction of half z) to give a flat sole."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1)
    o = bpy.context.active_object
    o.name = name
    for v in o.data.vertices:
        c = v.co
        n = [math.copysign(abs(x) ** power, x) for x in (c.x, c.y, c.z)]
        if flat_bottom is not None:
            n[2] = max(n[2], -flat_bottom)
        v.co = Vector((n[0] * half[0], n[1] * half[1], n[2] * half[2]))
    o.data.update()
    return _finish(o, parent, loc, m)


# ---------------------------------------------------------------- build
J = {}
root = joint("Astronaut", None, (0, 0, 0))
J["root"] = root
pelvis = joint("pelvis", root, (0, 0, 0.845))
chest = joint("chest", pelvis, (0, 0, 0))
J["chest"] = chest

# torso
rounded_box(chest, (0, 0, 0.27), (0.36, 0.27, 0.29), M_SUIT, 0.17, "torso")
blob(chest, (0, 0, -0.02), (0.34, 0.255, 0.2), M_SUIT, "hips", power=0.8)
prim("torus", chest, (0, 0, 0.06), (0.335, 0.255, 1), M_SUIT_SHADE, "belt", minor=0.025)
# chest box
rounded_box(chest, (0, -0.265, 0.33), (0.15, 0.05, 0.11), M_SUIT, 0.035, "chestbox")
for x in (-0.06, 0.06):
    rounded_box(chest, (x, -0.31, 0.38), (0.045, 0.012, 0.022), M_SUIT_SHADE, 0.008, "chestslot")
# round buttons
for x in (-0.255, 0.255):
    prim("cyl", chest, (x, -0.245, 0.43), (0.05, 0.05, 0.025), M_DARK, "btn", rot=(math.pi / 2, 0, 0))
for x in (-0.23, 0.23):
    prim("cyl", chest, (x, -0.255, 0.17), (0.058, 0.058, 0.025), M_DARK, "btn2", rot=(math.pi / 2, 0, 0))
    prim("torus", chest, (x, -0.283, 0.17), (0.045, 0.045, 1), M_GLOW, "glowring", rot=(math.pi / 2, 0, 0), minor=0.008)
# small control row: outlined square buttons along the belt
for i, x in enumerate((-0.2, -0.075, 0.075, 0.2)):
    rounded_box(chest, (x, -0.25, 0.05), (0.034, 0.02, 0.032), M_DARK, 0.008, "ctrl")
    if i != 0:
        rounded_box(chest, (x, -0.268, 0.05), (0.022, 0.006, 0.02), M_SUIT, 0.004, "ctrlface")
# C-shaped hoses from the chest box down to the belt, outside the blue buttons
for s in (-1, 1):
    hose = prim("torus", chest, (s * 0.19, -0.305, 0.19), (0.13, 0.145, 1), M_SUIT, "hose", rot=(math.pi / 2, 0, 0), minor=0.026)
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(hose.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.x * s < -0.01], context="VERTS")
    bm.to_mesh(hose.data)
    bm.free()
# backpack
rounded_box(chest, (0, 0.33, 0.3), (0.3, 0.12, 0.31), M_SUIT, 0.08, "backpack")
rounded_box(chest, (0, 0.45, 0.3), (0.2, 0.012, 0.2), M_SUIT_SHADE, 0.01, "backpanel")

# head / helmet
head = joint("head", chest, (0, 0, 0.55))
J["head"] = head
prim("torus", head, (0, 0, 0.03), (0.27, 0.25, 1), M_SUIT, "collar", minor=0.065)
prim("torus", head, (0, -0.005, 0.085), (0.27, 0.25, 1), M_STRIPE, "collarstripe", minor=0.012)
prim("sphere", head, (0, 0, 0.4), (0.46, 0.44, 0.47), M_SUIT, "helmet", seg=64)
# thick frame around the big visor, with a thin brown rim traced along the exact line
# where the visor emerges from the frame (like the reference)
FRAME_C, FRAME_R = Vector((0, -0.15, 0.37)), Vector((0.44, 0.33, 0.4))
VISOR_C, VISOR_R = Vector((0, -0.195, 0.36)), Vector((0.386, 0.315, 0.339))
prim("sphere", head, FRAME_C, FRAME_R, M_SUIT, "visorframe", seg=96)
prim("sphere", head, VISOR_C, VISOR_R, M_VISOR, "visor", seg=96)


def visor_rim(parent, m, tube=0.011, n=128, ring=10):
    def on_visor(theta, a):
        return VISOR_C + Vector((VISOR_R.x * math.sin(theta) * math.cos(a), -VISOR_R.y * math.cos(theta), VISOR_R.z * math.sin(theta) * math.sin(a)))

    def inside_frame(p):
        d = p - FRAME_C
        return (d.x / FRAME_R.x) ** 2 + (d.y / FRAME_R.y) ** 2 + (d.z / FRAME_R.z) ** 2 - 1

    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        lo, hi = 0.0, math.pi / 2  # front of visor is outside the frame, its rim is inside
        for _ in range(40):
            mid = (lo + hi) / 2
            if inside_frame(on_visor(mid, a)) > 0:
                lo = mid
            else:
                hi = mid
        pts.append(on_visor(lo, a))
    verts, faces = [], []
    for i, p in enumerate(pts):
        t = (pts[(i + 1) % n] - pts[i - 1]).normalized()
        nrm = (p - VISOR_C)
        nrm = (nrm - t * nrm.dot(t)).normalized()
        b = t.cross(nrm).normalized()
        for k in range(ring):
            a = 2 * math.pi * k / ring
            verts.append(p + (nrm * math.cos(a) + b * math.sin(a)) * tube)
    for i in range(n):
        for k in range(ring):
            j = (i + 1) % n
            faces.append((i * ring + k, i * ring + (k + 1) % ring, j * ring + (k + 1) % ring, j * ring + k))
    me = bpy.data.meshes.new("visorrim")
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    o = bpy.data.objects.new("visorrim", me)
    scene.collection.objects.link(o)
    return _finish(o, parent, (0, 0, 0), m)


visor_rim(head, M_STRIPE)
for s in (-1, 1):
    prim("cyl", head, (s * 0.44, 0.03, 0.4), (0.14, 0.15, 0.05), M_SUIT, "ear", rot=(0, math.pi / 2, 0), bevel=0.02)
    prim("cyl", head, (s * 0.49, 0.03, 0.4), (0.095, 0.105, 0.015), M_SUIT_SHADE, "earcap", rot=(0, math.pi / 2, 0))
    prim("torus", head, (s * 0.495, 0.03, 0.4), (0.105, 0.115, 1), M_SUIT, "earring", rot=(0, math.pi / 2, 0), minor=0.014)


def build_arm(side):
    tag = "L" if side > 0 else "R"
    sh = joint(f"shoulder_{tag}", chest, (side * 0.4, 0, 0.45))
    prim("sphere", sh, (0, 0, 0), (0.14, 0.14, 0.14), M_SUIT, "shoulderball", seg=40)
    up = limb_profile(0.04, -0.34, 0.122, 0.112, bulge=0.012, cap0=0.4, cap1=0.6, grooves=(-0.17, -0.215, -0.26))
    lathe(sh, (0, 0, 0), up, M_SUIT, "upperarm")
    stripe(sh, -0.085, up, M_STRIPE, "armstripe")
    el = joint(f"elbow_{tag}", sh, (0, 0, -0.3))
    prim("sphere", el, (0, 0, 0), (0.112, 0.112, 0.112), M_SUIT, "elbowball", seg=32)
    fo = limb_profile(0.03, -0.27, 0.112, 0.1, bulge=0.01, cap0=0.5, cap1=0.3, grooves=(-0.08, -0.125, -0.17))
    lathe(el, (0, 0, 0), fo, M_SUIT, "forearm")
    stripe(el, -0.035, fo, M_STRIPE, "elbowstripe")
    prim("torus", el, (0, 0, -0.25), (0.092, 0.092, 1), M_SUIT, "cuff", minor=0.034)
    wr = joint(f"wrist_{tag}", el, (0, 0, -0.28))
    # glove: palm faces -Y in rest pose, thumb on the outer side
    prim("cyl", wr, (0, 0, 0.0), (0.098, 0.098, 0.035), M_SUIT, "glovecuff", bevel=0.02)
    rounded_box(wr, (0, 0, -0.105), (0.1, 0.056, 0.09), M_SUIT, 0.05, "palm")
    fingers = []
    for i, (x, length) in enumerate(zip((0.069, 0.023, -0.023, -0.069), (0.125, 0.135, 0.125, 0.1))):
        fj = joint(f"finger{i}_{tag}", wr, (side * x, 0, -0.18))
        prim("capsule", fj, (0, 0, -length / 2 + 0.012), (0.027, 0.029, length), M_SUIT, "finger")
        fingers.append(fj)
    th = joint(f"thumb_{tag}", wr, (side * 0.088, -0.015, -0.07))
    prim("capsule", th, (0, 0, -0.04), (0.029, 0.031, 0.11), M_SUIT, "thumb")
    J[f"shoulder_{tag}"], J[f"elbow_{tag}"], J[f"wrist_{tag}"] = sh, el, wr
    J[f"fingers_{tag}"], J[f"thumb_{tag}"] = fingers, th


def build_leg(side):
    tag = "L" if side > 0 else "R"
    hip = joint(f"hip_{tag}", pelvis, (side * 0.205, 0, 0))
    # thigh: full at the top, easing in towards the knee, soft fabric folds
    th = limb_profile(0.08, -0.42, 0.158, 0.146, bulge=0.012, cap0=0.5, cap1=0.55, grooves=(-0.12, -0.17, -0.22))
    lathe(hip, (0, 0, 0), th, M_SUIT, "thigh")
    stripe(hip, -0.3, th, M_STRIPE, "thighstripe")
    kn = joint(f"knee_{tag}", hip, (0, 0, -0.38))
    # knee: a ball fills the joint so bending never opens a gap; padded cap on the front
    prim("sphere", kn, (0, 0, 0), (0.146, 0.146, 0.146), M_SUIT, "kneeball", seg=40)
    prim("sphere", kn, (0, -0.07, 0.005), (0.11, 0.09, 0.085), M_SUIT, "kneepad", seg=32)
    sh = limb_profile(0.04, -0.3, 0.146, 0.15, bulge=0.006, cap0=0.4, cap1=0.0, grooves=(-0.145, -0.185))
    lathe(kn, (0, 0, 0), sh, M_SUIT, "shin")
    stripe(kn, -0.07, sh, M_STRIPE, "shinstripe")
    stripe(kn, -0.235, sh, M_STRIPE, "shinstripe")
    # one-piece rounded boot: cuffed shaft flowing into a chunky toe, sole inset under it
    boot = limb_profile(-0.26, -0.43, 0.162, 0.168, cap0=0.25, cap1=0.0, grooves=(-0.3,), groove_depth=0.008)
    lathe(kn, (0, 0, 0), boot, M_SUIT, "bootshaft")
    blob(kn, (0, -0.055, -0.39), (0.168, 0.235, 0.085), M_SUIT, "bootfoot", power=0.6, flat_bottom=0.75)
    blob(kn, (0, -0.058, -0.448), (0.162, 0.229, 0.022), M_SOLE, "sole", power=0.45, flat_bottom=0.9)
    J[f"hip_{tag}"], J[f"knee_{tag}"] = hip, kn


for s in (1, -1):
    build_arm(s)
    build_leg(s)


# ---------------------------------------------------------------- props
def build_holo_keyboard():
    kb = joint("holo_keyboard", root, (0, -0.56, 0.865))
    kb.rotation_quaternion = Euler((math.radians(18), 0, 0)).to_quaternion()
    rounded_box(kb, (0, 0, 0), (0.46, 0.2, 0.012), M_HOLO, 0.01, "panel")
    for r in range(4):
        for c in range(11):
            w = 0.03
            x = -0.37 + c * 0.074
            y = 0.13 - r * 0.07
            rounded_box(kb, (x, y, 0.016), (w, w * 0.8, 0.006), M_KEY, 0.004, "key")
    rounded_box(kb, (0, -0.15, 0.016), (0.16, 0.024, 0.006), M_KEY, 0.004, "spacebar")


# ---------------------------------------------------------------- posing
_last = {}


def setq(j, q):
    q = q.copy()
    if j.name in _last:
        q.make_compatible(_last[j.name])
    _last[j.name] = q
    j.rotation_quaternion = q


def eul(x=0.0, y=0.0, z=0.0):
    return Euler((math.radians(x), math.radians(y), math.radians(z))).to_quaternion()


def aim(j, parent_wq, direction, twist=0.0):
    """Point a limb joint (rest direction -Z) along a world direction. Returns its world rotation."""
    wq = DOWN.rotation_difference(Vector(direction).normalized())
    if twist:
        wq = wq @ eul(z=twist)
    setq(j, parent_wq.inverted() @ wq)
    return wq


def bend_y(j, parent_wq, direction):
    """Hinge a joint about its local Y axis only, so the palm never flips (stable even when pointing up)."""
    local = parent_wq.inverted() @ Vector(direction)
    q = Quaternion((0, 1, 0), math.atan2(-local.x, -local.z))
    setq(j, q)
    return parent_wq @ q


def hand(tag, side, curl=(0, 0, 0, 0), spread=0.0, thumb=None):
    for i, fj in enumerate(J[f"fingers_{tag}"]):
        sp = side * spread * (1.5 - i)  # fan out around the middle
        setq(fj, eul(x=-curl[i], y=-sp))
    th = thumb if thumb is not None else (side * 0.8, -0.3, -1)
    J[f"thumb_{tag}"].rotation_quaternion  # noqa (ensure exists)
    setq(J[f"thumb_{tag}"], DOWN.rotation_difference(Vector(th).normalized()))


def legs(spread=7.0, knee=4.0, step=8.0, toe_out=7.0):
    """Relaxed stance with the viewer-right leg stepping slightly forward, like the reference."""
    for tag, s, fwd in (("L", 1, -step), ("R", -1, step * 0.4)):
        # +Y rotation swings a downward limb towards -X, so splay outwards with -side
        setq(J[f"hip_{tag}"], eul(x=fwd, y=-s * spread, z=s * toe_out))
        # counter the hip splay at the knee so the boots stay flat on the ground
        setq(J[f"knee_{tag}"], eul(x=knee + max(0.0, -fwd) * 0.9, y=s * spread))


def wave_frame(t):
    ph = 2 * math.pi * t
    setq(root, Quaternion())
    root.location.z = 0.035 * math.sin(ph)
    chest_wq = eul(y=-4 + 1.5 * math.sin(ph))
    setq(J["chest"], chest_wq)
    setq(J["head"], eul(x=-6, y=6, z=6 + 2 * math.sin(ph)))
    # waving arm: character left (+X, viewer right)
    sh = aim(J["shoulder_L"], chest_wq, (0.9, -0.08, 0.22))
    sway = math.sin(ph * 4)  # 4 waves per loop
    el = bend_y(J["elbow_L"], sh, (0.22 + 0.22 * sway, 0, 1))
    bend_y(J["wrist_L"], el, (0.25 + 0.4 * sway, 0, 1))
    hand("L", 1, curl=(4, 2, 4, 8), spread=7, thumb=(1, -0.2, -0.6))
    # relaxed arm
    sh = aim(J["shoulder_R"], chest_wq, (-0.32, 0.02 + 0.04 * math.sin(ph), -1))
    el = aim(J["elbow_R"], sh, (-0.22, -0.18, -1))
    aim(J["wrist_R"], el, (-0.18, -0.2, -1))
    hand("R", -1, curl=(25, 30, 35, 40), spread=2)
    legs()


def point_frame(t):
    ph = 2 * math.pi * t
    setq(root, Quaternion())
    root.location.z = 0.03 * math.sin(ph)
    chest_wq = eul(y=6, z=-4)
    setq(J["chest"], chest_wq)
    setq(J["head"], eul(x=-14, y=-4, z=22))
    # pointing arm towards the viewer's top-right
    jab = 0.5 + 0.5 * math.sin(ph * 2)
    target = Vector((0.78, -0.22, 0.62))
    sh = aim(J["shoulder_L"], chest_wq, target + Vector((0, 0, -0.18 + 0.06 * jab)))
    el = aim(J["elbow_L"], sh, target + Vector((0, 0, 0.02 * jab)))
    aim(J["wrist_L"], el, target, twist=-90)
    hand("L", 1, curl=(0, 165, 165, 160), thumb=(-0.9, -0.5, -0.4))
    J["fingers_L"][0].scale = (1.15, 1.15, 1.45)  # longer, chunkier index finger
    # other hand resting near the hip
    sh = aim(J["shoulder_R"], chest_wq, (-0.45, 0.05, -1))
    el = aim(J["elbow_R"], sh, (-0.05, -0.3, -1))
    aim(J["wrist_R"], el, (0.05, -0.3, -1))
    hand("R", -1, curl=(30, 35, 40, 45), spread=2)
    legs(spread=8, knee=6)


def type_frame(t):
    ph = 2 * math.pi * t
    setq(root, Quaternion())
    root.location.z = 0.02 * math.sin(ph)
    chest_wq = eul(x=8)
    setq(J["chest"], chest_wq)
    setq(J["head"], eul(x=16 + 2 * math.sin(ph * 2), z=4 * math.sin(ph)))
    for tag, s, phase in (("L", 1, 0.0), ("R", -1, math.pi)):
        tap = math.sin(ph * 6 + phase)
        sh = aim(J[f"shoulder_{tag}"], chest_wq, (s * 0.22, -0.42, -1))
        el = aim(J[f"elbow_{tag}"], sh, (-s * 0.28, -1, -0.12 + 0.05 * tap))
        aim(J[f"wrist_{tag}"], el, (-s * 0.2, -1, -0.32 + 0.08 * tap), twist=180)
        curls = []
        for i in range(4):
            k = max(0.0, math.sin(ph * 8 + i * 1.7 + phase))
            curls.append(25 + 40 * k)
        hand(tag, s, curl=curls, spread=4, thumb=(s * 0.4, -0.6, -1))
    legs(spread=6, knee=4)


FRAME_FN = {"wave": wave_frame, "point": point_frame, "type": type_frame}[POSE]
if POSE == "type":
    build_holo_keyboard()

animated = [o for o in scene.objects if o.type == "EMPTY" and not o.name.startswith("holo")]
for f in range(FRAMES + 1):
    FRAME_FN(f / FRAMES)
    for o in animated:
        o.keyframe_insert("rotation_quaternion", frame=f)
    root.keyframe_insert("location", frame=f)

scene.frame_set(0)

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_active_scene=True,  # otherwise every scene in the .blend ends up in the file
    export_apply=True,
    export_animations=True,
    export_animation_mode="SCENE",
    export_anim_scene_split_object=False,  # one clip containing every joint
    export_force_sampling=True,
    export_cameras=False,
    export_lights=False,
)
print(f"exported {OUT}")

# ---------------------------------------------------------------- preview render
if PREVIEW:
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 60
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (1.2, -4.9, 1.45)
    target = Vector((0.15, 0, 1.15))
    if len(argv) > 3:  # optional close-up: x,y,z of focus point
        target = Vector([float(v) for v in argv[3].split(",")])
        cam.location = target + Vector((0.5, -2.0, 0.3))
    look = target - cam.location
    cam.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    for name, loc, energy, size in (("key", (-3, -4, 5), 900, 3), ("fill", (4, -3, 2), 350, 4), ("rim", (0, 4, 4), 500, 3)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy
        ld.size = size
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 1)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.04, 0.05, 0.08, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    scene.world = world
    for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = eng
            break
        except TypeError:
            pass
    scene.render.resolution_x = 640
    scene.render.resolution_y = 800
    scene.render.filepath = PREVIEW
    scene.frame_set({"wave": 3, "point": 12, "type": 5}[POSE])
    bpy.ops.render.render(write_still=True)
    print(f"rendered {PREVIEW}")
