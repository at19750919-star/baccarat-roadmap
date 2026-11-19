import subprocess, sys
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
T0, T1 = float(sys.argv[3]) if len(sys.argv) > 3 else 60, float(sys.argv[4]) if len(sys.argv) > 4 else 120
W, H = 1280, 720
dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', src, '-an', '-vf', f'scale={W}:{H}',
                        '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}',
                        '-r', '24', '-i', '-', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-crf', '32', '-b:v', '0', '-deadline', 'good', '-cpu-used', '1', '-row-mt', '1',
                        '-auto-alt-ref', '0', '-metadata:s:v:0', 'alpha_mode=1', dst], stdin=subprocess.PIPE)
n = 0
while True:
    buf = dec.stdout.read(W * H * 3)
    if len(buf) < W * H * 3:
        break
    f = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32)
    # key color = median of the border (follows any drift of the generated background)
    border = np.concatenate([f[:8].reshape(-1, 3), f[-8:].reshape(-1, 3), f[:, :8].reshape(-1, 3), f[:, -8:].reshape(-1, 3)])
    gmask = (border[:, 1] - np.maximum(border[:, 0], border[:, 2])) > 80
    K = np.median(border[gmask], 0) if gmask.sum() > 100 else np.array([4, 192, 19], np.float32)
    dist = np.sqrt(((f - K) ** 2).sum(-1))
    dom = f[..., 1] - np.maximum(f[..., 0], f[..., 2])
    a = np.clip((dist - T0) / (T1 - T0), 0, 1)
    a = np.where(dom < 20, 1.0, a)  # pixels without green dominance are never keyed
    # emerald jewels are blue-green (B/G ~0.7); the key is pure green (B/G ~0.1)
    k = np.clip((0.45 - f[..., 2] / np.maximum(f[..., 1], 1)) / 0.2, 0, 1)
    a = 1 - (1 - a) * k
    # unmix the background from semi-transparent edges, then limit residual green spill on edges
    am = np.maximum(a, 1e-3)[..., None]
    c = np.clip((f - (1 - am) * K) / am, 0, 255)
    edge = (a < 0.98) & (a > 0)
    g_lim = np.maximum(c[..., 0], c[..., 2])
    c[..., 1] = np.where(edge, np.minimum(c[..., 1], g_lim), c[..., 1])
    a[a < 0.03] = 0
    out = np.dstack([c, a[..., None] * 255]).round().astype(np.uint8)
    enc.stdin.write(out.tobytes())
    n += 1
enc.stdin.close(); enc.wait(); dec.wait()
print('frames', n)
