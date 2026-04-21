import math
import os

import ezdxf
import fitz
import cv2
import numpy as np
from ezdxf.math import Vec3


def clip_line_to_rect(x1, y1, x2, y2, rect):
    INSIDE = 0
    LEFT = 1
    RIGHT = 2
    BOTTOM = 4
    TOP = 8

    def compute_code(x, y):
        code = INSIDE
        if x < rect.x0:
            code |= LEFT
        elif x > rect.x1:
            code |= RIGHT
        if y < rect.y0:
            code |= BOTTOM
        elif y > rect.y1:
            code |= TOP
        return code

    code1 = compute_code(x1, y1)
    code2 = compute_code(x2, y2)

    while True:
        if code1 == 0 and code2 == 0:
            return (x1, y1, x2, y2)
        if code1 & code2:
            return None

        code_out = code1 if code1 != 0 else code2

        if code_out & TOP:
            if y2 == y1:
                return None
            x = x1 + (x2 - x1) * (rect.y1 - y1) / (y2 - y1)
            y = rect.y1
        elif code_out & BOTTOM:
            if y2 == y1:
                return None
            x = x1 + (x2 - x1) * (rect.y0 - y1) / (y2 - y1)
            y = rect.y0
        elif code_out & RIGHT:
            if x2 == x1:
                return None
            y = y1 + (y2 - y1) * (rect.x1 - x1) / (x2 - x1)
            x = rect.x1
        else:
            if x2 == x1:
                return None
            y = y1 + (y2 - y1) * (rect.x0 - x1) / (x2 - x1)
            x = rect.x0

        if code_out == code1:
            x1, y1 = x, y
            code1 = compute_code(x1, y1)
        else:
            x2, y2 = x, y
            code2 = compute_code(x2, y2)


def _dist(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])


def _bezier_to_polyline(p1, p2, p3, p4):
    chord = _dist(p1, p4)
    ctrl = _dist(p1, p2) + _dist(p2, p3) + _dist(p3, p4)
    complexity = max(chord, ctrl)
    segments = max(12, min(96, int(complexity / 6.0)))

    points = []
    for i in range(segments + 1):
        t = i / segments
        mt = 1.0 - t
        x = (
            mt * mt * mt * p1[0]
            + 3 * mt * mt * t * p2[0]
            + 3 * mt * t * t * p3[0]
            + t * t * t * p4[0]
        )
        y = (
            mt * mt * mt * p1[1]
            + 3 * mt * mt * t * p2[1]
            + 3 * mt * t * t * p3[1]
            + t * t * t * p4[1]
        )
        points.append((x, y))
    return points


class PDF2DXFConverter:
    def __init__(self, pdf_path):
        self.pdf_path = pdf_path
        self.doc = None
        self.dxf = None
        self.msp = None
        self.verbose = True

    def load_pdf(self):
        if not os.path.exists(self.pdf_path):
            raise FileNotFoundError(f"PDF file not found: {self.pdf_path}")
        self.doc = fitz.open(self.pdf_path)

    def _setup_dxf(self):
        self.dxf = ezdxf.new("R2010")
        self.msp = self.dxf.modelspace()
        self.dxf.header["$INSUNITS"] = 0
        self.dxf.header["$MEASUREMENT"] = 1

        if "PDF_GEOMETRY" not in self.dxf.layers:
            self.dxf.layers.new(name="PDF_GEOMETRY", dxfattribs={"color": 7})
        if "PDF_TEXT" not in self.dxf.layers:
            self.dxf.layers.new(name="PDF_TEXT", dxfattribs={"color": 1})

    def convert(
        self,
        output_path,
        pages=None,
        crop_rect=None,
        min_size=0.0,
        skip_curves=False,
        include_geom=True,
        include_text=True,
    ):
        if not self.doc:
            self.load_pdf()

        if pages is None:
            pages = list(range(len(self.doc)))

        self._setup_dxf()

        x_offset = 0.0
        for page_num in pages:
            if page_num >= len(self.doc):
                continue

            page = self.doc[page_num]
            self._convert_page(
                page=page,
                x_offset=x_offset,
                crop_rect=crop_rect,
                min_size=min_size,
                skip_curves=skip_curves,
                include_geom=include_geom,
                include_text=include_text,
            )
            x_offset += page.rect.width + 20.0

        self.dxf.saveas(output_path)
        self._patch_dxf_extents(output_path)

        if self.verbose:
            print(f"DXF saved to {output_path}")

    def _convert_page(
        self,
        page,
        x_offset,
        crop_rect=None,
        min_size=0.0,
        skip_curves=False,
        include_geom=True,
        include_text=True,
    ):
        page_height = page.rect.height

        if crop_rect and not isinstance(crop_rect, fitz.Rect):
            crop_rect = fitz.Rect(*crop_rect)

        if not self._has_vector_content(page):
            if self.verbose:
                print("Page has no vector content. Using raster fallback.")
            self._rasterize_and_trace(page, x_offset, page_height)
            return

        if include_geom:
            for path in page.get_drawings() or []:
                path_rect = path.get("rect")
                if crop_rect and path_rect:
                    if not (
                        path_rect.x0 <= crop_rect.x1
                        and path_rect.x1 >= crop_rect.x0
                        and path_rect.y0 <= crop_rect.y1
                        and path_rect.y1 >= crop_rect.y0
                    ):
                        continue

                for item in path.get("items", []):
                    if not item:
                        continue

                    cmd = str(item[0]).lower()

                    if cmd == "l":
                        p1, p2 = item[1], item[2]
                        if min_size > 0 and max(abs(p1[0] - p2[0]), abs(p1[1] - p2[1])) < min_size:
                            continue

                        if crop_rect:
                            clipped = clip_line_to_rect(p1[0], p1[1], p2[0], p2[1], crop_rect)
                            if clipped is None:
                                continue
                            p1 = (clipped[0], clipped[1])
                            p2 = (clipped[2], clipped[3])

                        self.msp.add_line(
                            self._tp(p1, x_offset, page_height),
                            self._tp(p2, x_offset, page_height),
                            dxfattribs={"layer": "PDF_GEOMETRY"},
                        )

                    elif cmd == "c" and not skip_curves:
                        p1, p2, p3, p4 = item[1], item[2], item[3], item[4]
                        xs = [p1[0], p2[0], p3[0], p4[0]]
                        ys = [p1[1], p2[1], p3[1], p4[1]]

                        if min_size > 0 and max(max(xs) - min(xs), max(ys) - min(ys)) < min_size:
                            continue

                        if crop_rect:
                            if not (
                                max(xs) >= crop_rect.x0
                                and min(xs) <= crop_rect.x1
                                and max(ys) >= crop_rect.y0
                                and min(ys) <= crop_rect.y1
                            ):
                                continue

                        pts = _bezier_to_polyline(p1, p2, p3, p4)
                        dxf_pts = [self._tp(pt, x_offset, page_height) for pt in pts]
                        self.msp.add_lwpolyline(dxf_pts, dxfattribs={"layer": "PDF_GEOMETRY"})

                    elif cmd in ("re", "rect"):
                        rect = item[1]
                        w = rect.width
                        h = rect.height
                        if min_size > 0 and max(w, h) < min_size:
                            continue

                        points = [
                            (rect.x0, rect.y0),
                            (rect.x1, rect.y0),
                            (rect.x1, rect.y1),
                            (rect.x0, rect.y1),
                        ]

                        dxf_pts = [self._tp(pt, x_offset, page_height) for pt in points]
                        self.msp.add_lwpolyline(
                            dxf_pts,
                            close=True,
                            dxfattribs={"layer": "PDF_GEOMETRY"},
                        )

                    elif cmd == "qu":
                        quad = item[1]
                        try:
                            points = [
                                (quad.ul.x, quad.ul.y),
                                (quad.ur.x, quad.ur.y),
                                (quad.lr.x, quad.lr.y),
                                (quad.ll.x, quad.ll.y),
                            ]
                        except Exception:
                            continue

                        dxf_pts = [self._tp(pt, x_offset, page_height) for pt in points]
                        self.msp.add_lwpolyline(
                            dxf_pts,
                            close=True,
                            dxfattribs={"layer": "PDF_GEOMETRY"},
                        )

        if include_text:
            text_dict = page.get_text("dict", clip=crop_rect) if crop_rect else page.get_text("dict")
            for block in text_dict.get("blocks", []):
                if block.get("type") != 0:
                    continue

                for line in block.get("lines", []):
                    line_dir = line.get("dir", (1, 0))

                    for span in line.get("spans", []):
                        text = span.get("text", "").strip()
                        if not text:
                            continue

                        size = float(span.get("size", 10))
                        origin = span.get("origin", (0, 0))
                        insert = self._tp(origin, x_offset, page_height)

                        direction = span.get("dir", line_dir)
                        rotation = 0.0
                        if direction and len(direction) >= 2:
                            rotation = math.degrees(math.atan2(-direction[1], direction[0]))

                        text_entity = self.msp.add_text(
                            text,
                            dxfattribs={
                                "height": max(size, 0.1),
                                "rotation": rotation,
                                "layer": "PDF_TEXT",
                                "style": "Standard",
                            },
                        )
                        text_entity.set_placement(Vec3(insert[0], insert[1], 0))

    def _has_vector_content(self, page):
        drawings = page.get_drawings() or []
        text_blocks = [b for b in page.get_text("dict").get("blocks", []) if b.get("type") == 0]
        return bool(drawings or text_blocks)

    def _rasterize_and_trace(self, page, x_offset, page_height):
        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("png")

        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

        _, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)

        contours, hierarchy = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_TC89_KCOS)
        scale_x = page.rect.width / pix.width
        scale_y = page.rect.height / pix.height

        filtered = []
        if hierarchy is not None:
            hierarchy = hierarchy[0]
            for idx, contour in enumerate(contours):
                if hierarchy[idx][3] != -1:
                    continue
                if cv2.arcLength(contour, False) < 12:
                    continue
                filtered.append(contour)
        else:
            filtered = [c for c in contours if cv2.arcLength(c, False) >= 12]

        for contour in filtered:
            pts = contour.reshape(-1, 2)
            if len(pts) < 2:
                continue

            epsilon = max(0.6, 0.002 * cv2.arcLength(contour, True))
            approx = cv2.approxPolyDP(contour, epsilon, True)
            pts = approx.reshape(-1, 2) if len(approx) >= 2 else pts

            dxf_pts = [(px * scale_x + x_offset, page_height - py * scale_y) for px, py in pts]
            self.msp.add_lwpolyline(dxf_pts, dxfattribs={"layer": "PDF_GEOMETRY"})

    def _tp(self, point, x_offset, page_height):
        return (float(point[0]) + x_offset, float(page_height - point[1]))

    def _patch_dxf_extents(self, output_path):
        min_x = min_y = 1e20
        max_x = max_y = -1e20

        for entity in self.msp:
            try:
                if entity.dxftype() == "LINE":
                    pts = [entity.dxf.start, entity.dxf.end]
                elif entity.dxftype() in ("LWPOLYLINE", "POLYLINE"):
                    pts = list(entity.get_points())
                elif entity.dxftype() == "TEXT":
                    pts = [entity.dxf.insert]
                else:
                    continue

                for pt in pts:
                    x = pt[0]
                    y = pt[1]
                    min_x = min(min_x, x)
                    min_y = min(min_y, y)
                    max_x = max(max_x, x)
                    max_y = max(max_y, y)
            except Exception:
                continue

        if min_x == 1e20:
            return

        pad = 10.0
        self.dxf.header["$EXTMIN"] = (min_x - pad, min_y - pad, 0.0)
        self.dxf.header["$EXTMAX"] = (max_x + pad, max_y + pad, 0.0)
        self.dxf.header["$LIMMIN"] = (min_x - pad, min_y - pad)
        self.dxf.header["$LIMMAX"] = (max_x + pad, max_y + pad)

        self.dxf.saveas(output_path)
