"""Round two. Writes only three stats beads and the comparison; reports to stdout."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import binary_fill_holes, label, distance_transform_edt, gaussian_filter, shift
from scipy.sparse import diags
from scipy.sparse.linalg import spsolve
from scipy.optimize import least_squares

ROOT = Path(__file__).resolve().parents[1]
BEADS = ROOT / 'assets/beads'
FONT = Path('C:/Windows/Fonts/NotoSerifTC-VF.ttf')


def interpolate(field, missing):
    """Harmonic interpolation from surrounding blue; feather its outer seam."""
    small = np.array(Image.fromarray(field.astype('float32')).resize((314, 314)))
    hole = np.array(Image.fromarray(missing).resize((314, 314), Image.Resampling.NEAREST))
    n, w = small.size, small.shape[1]
    matrix = diags([-np.ones(n-w), -np.ones(n-1), np.ones(n)*4,
                    -np.ones(n-1), -np.ones(n-w)], [-w, -1, 0, 1, w], format='lil')
    rhs = np.zeros(n)
    known = np.flatnonzero(~hole.ravel())
    for i in known:
        matrix.rows[i], matrix.data[i] = [i], [1.0]
    rhs[known] = small.ravel()[known]
    filled = spsolve(matrix.tocsr(), rhs).reshape(small.shape)
    full = np.array(Image.fromarray(filled.astype('float32')).resize(
        (field.shape[1], field.shape[0]), Image.Resampling.BICUBIC))
    blend = np.minimum(distance_transform_edt(missing)/15, 1)
    return field*(1-blend)+full*blend


def hex_rgb(rgb):
    return '#' + ''.join(f'{int(v):02x}' for v in rgb)


def main():
    protected = ['blue-seven.png', 'banker.png', 'player.png', 'tie.png']
    hashes = {n: hashlib.sha256((BEADS/n).read_bytes()).hexdigest() for n in protected}
    source = np.array(Image.open(BEADS/'blue-seven.png').convert('RGBA'))
    assert source.shape == (1254, 1254, 4)
    blue = ((source[:, :, 2] > source[:, :, 0]) &
            (source[:, :, 2] > source[:, :, 1]) & (source[:, :, 3] > 200))
    components, _ = label(blue)
    counts = np.bincount(components.ravel()); counts[0] = 0
    inside = binary_fill_holes(components == counts.argmax())
    ys, xs = np.where(inside)
    center = ((xs.min()+xs.max())/2, (ys.min()+ys.max())/2)
    oy, ox = np.where(source[:, :, 3] > 200)
    diameter = (int(ox.max()-ox.min()+1)+int(oy.max()-oy.min()+1))/2
    target_height = round(diameter*.58)
    seven = inside & ~blue
    distance = distance_transform_edt(~seven)
    missing = inside & (distance < 95)  # Remove original seven AND its shadow.
    luminance = source[:, :, :3] @ np.array([.2126, .7152, .0722])
    lighting = interpolate(luminance, missing)
    # Fit visible source shadow. These are estimates, not original render settings.
    s = 4
    glyph_small = seven[::s, ::s].astype(float)
    observed = np.clip(1-luminance[::s, ::s]/np.maximum(lighting[::s, ::s], 1), 0, 1)
    region = (inside & blue & (distance > 3) & (distance < 65))[::s, ::s]

    def model(p):
        dx, dy, sigma, opacity = p
        return shift(gaussian_filter(glyph_small, sigma/s), (dy/s, dx/s),
                     order=1, mode='constant')*opacity

    fit = least_squares(lambda p: (model(p)-observed)[region], [7, 13, 12, .8],
                        bounds=([0, 0, 2, .1], [30, 40, 30, 1]), loss='soft_l1', f_scale=.05)
    dx, dy, sigma, opacity = fit.x
    # Anchor to an actual blue body pixel nearest #0042b2.
    candidates = inside & ~missing & (distance_transform_edt(inside) > 80)
    error = np.sum((source[:, :, :3].astype(float)-[0, 66, 178])**2, axis=2)
    error[~candidates] = np.inf
    by, bx = np.unravel_index(error.argmin(), error.shape)
    reference_lum = luminance[by, bx]
    ratio = lighting/reference_lum
    # Darken multiplicatively; reflect white above the body level to avoid RGB clipping.
    highlight = np.clip((lighting-reference_lum)/(255-reference_lum), 0, 1)
    samples = {'body': (int(bx), int(by)), 'upper_left': (250, 230), 'lower_right': (1080, 830)}
    reports, outputs = [], []
    for filename, glyph, color in [('banker-stats.png', '莊', '#d62121'),
                                    ('player-stats.png', '閒', '#1e5ec9'),
                                    ('tie-stats.png', '和', '#2ea94a')]:
        scale = 3
        font = ImageFont.truetype(str(FONT), 600*scale)
        font.set_variation_by_axes([900])
        left, top, right, bottom = font.getbbox(glyph)
        font_size = round(600*target_height/((bottom-top)/scale))
        font = ImageFont.truetype(str(FONT), font_size*scale)
        font.set_variation_by_axes([900])
        left, top, right, bottom = font.getbbox(glyph)
        mask = Image.new('L', (1254*scale, 1254*scale))
        ImageDraw.Draw(mask).text((center[0]*scale-(right+left)/2,
                                  center[1]*scale-(bottom+top)/2), glyph, font=font, fill=255)
        ink = np.array(mask.resize((1254, 1254), Image.Resampling.LANCZOS))
        assert not np.any((ink > 0) & ~inside)
        rgb = np.array([int(color[i:i+2], 16) for i in (1, 3, 5)])
        field = np.where((ratio <= 1)[:, :, None], rgb*ratio[:, :, None],
                         rgb+(255-rgb)*highlight[:, :, None])
        shadow = shift(gaussian_filter(ink.astype(float)/255, sigma),
                       (dy, dx), order=1, mode='constant')*opacity
        field *= (1-shadow[:, :, None])
        # Measured source top edge x=360: bright bevel y=271..277 (7 px).
        # Bottom edge x=500: dark edge y=1029..1032, soft shadow below.
        bevel_width = 7
        signed = distance_transform_edt(ink > 127)-distance_transform_edt(ink <= 127)
        gy, gx = np.gradient(gaussian_filter(signed, .8))
        normal = np.maximum(np.hypot(gx, gy), .01)
        facing = (gx+gy)/(np.sqrt(2)*normal)
        edge = np.clip(1-np.maximum(signed, 0)/bevel_width, 0, 1)
        face = 255-100*edge*np.maximum(-facing, 0)
        weight = ink[:, :, None]/255
        painted = np.clip(np.rint(field*(1-weight)+face[:, :, None]*weight), 0, 255).astype('uint8')
        result = source.copy()
        result[inside, :3] = painted[inside]
        output = BEADS/filename
        Image.fromarray(result).save(output)
        actual = np.array(Image.open(output))
        assert np.array_equal(actual[~inside], source[~inside])
        assert np.array_equal(actual[:, :, 3], source[:, :, 3])
        iy, ix = np.where(ink > 127)
        glyph_height = int(iy.max()-iy.min()+1)
        assert abs(glyph_height-target_height) <= 2
        measured = {}
        for name, (x, y) in samples.items():
            assert ink[y, x] == 0 and shadow[y, x] < .001, (name, x, y)
            measured[name] = {'xy': [x, y], 'actual': hex_rgb(actual[y, x, :3]),
                              'blue_seven': hex_rgb(source[y, x, :3])}
        assert measured['body']['actual'] == color
        reports.append(dict(file=str(output.relative_to(ROOT)), samples=measured,
                            font=FONT.name, weight=900, font_size_px=font_size,
                            glyph_height_px=glyph_height, bead_diameter_px=diameter,
                            glyph_height_percent=round(glyph_height/diameter*100, 3),
                            minimum_ink_frame_gap_px=round(float(distance_transform_edt(inside)[ink > 127].min()), 2),
                            frame_changed_pixels=0, alpha_changed_pixels=0))
        outputs.append(Image.fromarray(actual))
    comparison = Image.new('RGBA', (1254*4, 1254), (0, 0, 0, 0))
    for index, bead in enumerate(outputs+[Image.fromarray(source)]):
        comparison.paste(bead, (index*1254, 0))
    comparison.save(ROOT/'codex-tasks/bead-bpt-stats-compare.png')
    assert all(hashlib.sha256((BEADS/n).read_bytes()).hexdigest() == h for n, h in hashes.items())
    print(json.dumps({'shadow_fit_estimate': {'dx_px': round(dx, 2), 'dy_px': round(dy, 2),
                      'blur_sigma_px': round(sigma, 2), 'opacity': round(opacity, 3)},
                      'bevel_width_px': bevel_width, 'beads': reports}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
