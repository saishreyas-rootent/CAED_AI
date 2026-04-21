import io
import math
import os
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import ezdxf
import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

try:
    import vtracer
except ImportError:
    vtracer = None


SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp"}
SUPPORTED_FORMATS = {"PNG", "JPEG", "TIFF", "BMP"}
COMMAND_RE = re.compile(r"[MmZzLlHhVvCcSsQqTtAa]|[-+]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][-+]?\d+)?")
TRANSFORM_RE = re.compile(r"([A-Za-z]+)\s*\(([^)]*)\)")


class RasterToDXFError(Exception):
    """Base error raised for raster-to-DXF conversion failures."""


class UnsupportedRasterFormatError(RasterToDXFError):
    """Raised when the provided image format is not supported."""


class VectorizationError(RasterToDXFError):
    """Raised when raster vectorization fails."""


def _is_path_like(value):
    return isinstance(value, (str, os.PathLike, Path))


def _read_source_bytes(source):
    """Normalizes a file path, bytes object, or file-like object into raw bytes."""
    if isinstance(source, (bytes, bytearray)):
        return bytes(source)
    if _is_path_like(source):
        with open(source, "rb") as handle:
            return handle.read()
    if hasattr(source, "read"):
        current_pos = source.tell() if hasattr(source, "tell") else None
        data = source.read()
        if current_pos is not None and hasattr(source, "seek"):
            source.seek(current_pos)
        return data
    raise TypeError("Raster source must be a path, bytes object, or file-like object.")


def _svg_length_to_float(value):
    if not value:
        return None
    match = re.search(r"[-+]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][-+]?\d+)?", str(value))
    return float(match.group(0)) if match else None


def _identity_matrix():
    return ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0))


def _multiply_matrices(left, right):
    return tuple(
        tuple(sum(left[row][index] * right[index][col] for index in range(3)) for col in range(3))
        for row in range(3)
    )


def _apply_matrix(point, matrix):
    x, y = point
    return (
        matrix[0][0] * x + matrix[0][1] * y + matrix[0][2],
        matrix[1][0] * x + matrix[1][1] * y + matrix[1][2],
    )


def _parse_transform(transform_value):
    matrix = _identity_matrix()
    if not transform_value:
        return matrix

    for transform_name, values_text in TRANSFORM_RE.findall(transform_value):
        values = [float(value) for value in re.findall(r"[-+]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][-+]?\d+)?", values_text)]
        name = transform_name.lower()

        if name == "matrix" and len(values) == 6:
            current = (
                (values[0], values[2], values[4]),
                (values[1], values[3], values[5]),
                (0.0, 0.0, 1.0),
            )
        elif name == "translate":
            tx = values[0] if values else 0.0
            ty = values[1] if len(values) > 1 else 0.0
            current = ((1.0, 0.0, tx), (0.0, 1.0, ty), (0.0, 0.0, 1.0))
        elif name == "scale":
            sx = values[0] if values else 1.0
            sy = values[1] if len(values) > 1 else sx
            current = ((sx, 0.0, 0.0), (0.0, sy, 0.0), (0.0, 0.0, 1.0))
        elif name == "rotate":
            angle = math.radians(values[0] if values else 0.0)
            cos_angle = math.cos(angle)
            sin_angle = math.sin(angle)
            rotation = (
                (cos_angle, -sin_angle, 0.0),
                (sin_angle, cos_angle, 0.0),
                (0.0, 0.0, 1.0),
            )
            if len(values) >= 3:
                cx, cy = values[1], values[2]
                current = _multiply_matrices(
                    _multiply_matrices(
                        ((1.0, 0.0, cx), (0.0, 1.0, cy), (0.0, 0.0, 1.0)),
                        rotation,
                    ),
                    ((1.0, 0.0, -cx), (0.0, 1.0, -cy), (0.0, 0.0, 1.0)),
                )
            else:
                current = rotation
        else:
            continue

        matrix = _multiply_matrices(matrix, current)

    return matrix


def load_raster_image(source, input_name=None):
    """Loads and validates a raster image from disk, bytes, or a file-like object."""
    image_bytes = _read_source_bytes(source)

    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.load()
    except UnidentifiedImageError as exc:
        raise UnsupportedRasterFormatError("Unsupported image format. Use PNG, JPG, JPEG, TIFF, or BMP.") from exc

    image_format = (image.format or "").upper()
    suffix = Path(input_name or getattr(source, "name", "") or "").suffix.lower()
    if image_format not in SUPPORTED_FORMATS and suffix not in SUPPORTED_EXTENSIONS:
        raise UnsupportedRasterFormatError("Unsupported image format. Use PNG, JPG, JPEG, TIFF, or BMP.")

    return image, image_bytes


def preprocess_image(source, threshold=128, invert=False):
    """Converts a raster image to grayscale and applies a binary threshold."""
    image, _ = load_raster_image(source)
    grayscale = image.convert("L")

    if invert:
        grayscale = ImageOps.invert(grayscale)

    # Keep the preview image in 8-bit mode so Streamlit and DXF conversion share the same binary result.
    binary = grayscale.point(lambda pixel: 255 if pixel >= threshold else 0, mode="L")

    # Morphological cleanup significantly reduces double contours and tiny artifacts.
    binary_array = np.array(binary, dtype=np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    binary_array = cv2.morphologyEx(binary_array, cv2.MORPH_CLOSE, kernel, iterations=1)
    binary_array = cv2.morphologyEx(binary_array, cv2.MORPH_OPEN, kernel, iterations=1)
    binary_array = cv2.medianBlur(binary_array, 3)

    return Image.fromarray(binary_array, mode="L")


def _run_potrace(binary_image):
    """Falls back to potrace by tracing a temporary PBM file into SVG."""
    if shutil.which("potrace") is None:
        raise VectorizationError("vtracer is not installed and potrace was not found on PATH.")

    with tempfile.TemporaryDirectory() as tmp_dir:
        pbm_path = os.path.join(tmp_dir, "input.pbm")
        svg_path = os.path.join(tmp_dir, "output.svg")
        binary_image.convert("1").save(pbm_path)

        try:
            subprocess.run(
                ["potrace", pbm_path, "-s", "-o", svg_path],
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as exc:
            stderr = exc.stderr.strip() or exc.stdout.strip() or "potrace failed"
            raise VectorizationError(stderr) from exc

        with open(svg_path, "r", encoding="utf-8") as handle:
            return handle.read()


def vectorize_binary_image(binary_image):
    """Vectorizes a binarized image to SVG using vtracer or, if needed, potrace."""
    if vtracer is not None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = os.path.join(tmp_dir, "input.png")
            output_path = os.path.join(tmp_dir, "output.svg")
            binary_image.save(input_path, format="PNG")

            try:
                vtracer.convert_image_to_svg_py(
                    input_path,
                    output_path,
                    colormode="binary",
                    mode="polygon",
                    hierarchical="cutout",
                    filter_speckle=8,
                    path_precision=5,
                )
            except Exception as exc:
                raise VectorizationError(f"vtracer vectorization failed: {exc}") from exc

            with open(output_path, "r", encoding="utf-8") as handle:
                return handle.read()

    return _run_potrace(binary_image)


def _tokenize_path(path_data):
    return COMMAND_RE.findall(path_data or "")


def _read_numbers(tokens, index, count):
    numbers = []
    while len(numbers) < count and index < len(tokens):
        token = tokens[index]
        if re.fullmatch(r"[A-Za-z]", token):
            break
        numbers.append(float(token))
        index += 1
    if len(numbers) != count:
        raise ValueError("Invalid SVG path data.")
    return numbers, index


def _sample_arc(start, rx, ry, rotation, large_arc_flag, sweep_flag, end, segments=16):
    if rx == 0 or ry == 0 or start == end:
        return [end]

    phi = math.radians(rotation % 360)
    cos_phi = math.cos(phi)
    sin_phi = math.sin(phi)
    x1, y1 = start
    x2, y2 = end

    dx2 = (x1 - x2) / 2.0
    dy2 = (y1 - y2) / 2.0
    x1p = cos_phi * dx2 + sin_phi * dy2
    y1p = -sin_phi * dx2 + cos_phi * dy2

    rx = abs(rx)
    ry = abs(ry)
    radius_scale = (x1p ** 2) / (rx ** 2) + (y1p ** 2) / (ry ** 2)
    if radius_scale > 1:
        scale = math.sqrt(radius_scale)
        rx *= scale
        ry *= scale

    sign = -1 if large_arc_flag == sweep_flag else 1
    numerator = (rx ** 2) * (ry ** 2) - (rx ** 2) * (y1p ** 2) - (ry ** 2) * (x1p ** 2)
    denominator = (rx ** 2) * (y1p ** 2) + (ry ** 2) * (x1p ** 2)
    factor = 0.0 if denominator == 0 else sign * math.sqrt(max(0.0, numerator / denominator))
    cxp = factor * (rx * y1p) / ry
    cyp = factor * (-ry * x1p) / rx

    cx = cos_phi * cxp - sin_phi * cyp + (x1 + x2) / 2.0
    cy = sin_phi * cxp + cos_phi * cyp + (y1 + y2) / 2.0

    def _angle(u, v):
        dot = u[0] * v[0] + u[1] * v[1]
        det = u[0] * v[1] - u[1] * v[0]
        return math.atan2(det, dot)

    start_vector = ((x1p - cxp) / rx, (y1p - cyp) / ry)
    end_vector = ((-x1p - cxp) / rx, (-y1p - cyp) / ry)

    theta1 = _angle((1, 0), start_vector)
    delta_theta = _angle(start_vector, end_vector)

    if not sweep_flag and delta_theta > 0:
        delta_theta -= 2 * math.pi
    elif sweep_flag and delta_theta < 0:
        delta_theta += 2 * math.pi

    points = []
    for step in range(1, segments + 1):
        angle = theta1 + (delta_theta * step / segments)
        cos_angle = math.cos(angle)
        sin_angle = math.sin(angle)
        x = cx + rx * cos_phi * cos_angle - ry * sin_phi * sin_angle
        y = cy + rx * sin_phi * cos_angle + ry * cos_phi * sin_angle
        points.append((x, y))
    return points


def parse_svg_path(path_data):
    """Parses SVG path data into line, cubic, and close segments."""
    tokens = _tokenize_path(path_data)
    index = 0
    command = None
    current = (0.0, 0.0)
    start_point = None
    last_control = None
    segments = []

    while index < len(tokens):
        token = tokens[index]
        if re.fullmatch(r"[A-Za-z]", token):
            command = token
            index += 1
        elif command is None:
            raise ValueError("SVG path data must begin with a command.")

        cmd = command
        upper = cmd.upper()
        relative = cmd.islower()

        if upper == "M":
            numbers, index = _read_numbers(tokens, index, 2)
            point = (numbers[0], numbers[1])
            if relative:
                point = (current[0] + point[0], current[1] + point[1])
            current = point
            start_point = point
            last_control = None
            command = "l" if relative else "L"

        elif upper == "L":
            while index < len(tokens) and not re.fullmatch(r"[A-Za-z]", tokens[index]):
                numbers, index = _read_numbers(tokens, index, 2)
                point = (numbers[0], numbers[1])
                if relative:
                    point = (current[0] + point[0], current[1] + point[1])
                segments.append(("line", current, point))
                current = point
                last_control = None

        elif upper == "H":
            while index < len(tokens) and not re.fullmatch(r"[A-Za-z]", tokens[index]):
                numbers, index = _read_numbers(tokens, index, 1)
                x = current[0] + numbers[0] if relative else numbers[0]
                point = (x, current[1])
                segments.append(("line", current, point))
                current = point
                last_control = None

        elif upper == "V":
            while index < len(tokens) and not re.fullmatch(r"[A-Za-z]", tokens[index]):
                numbers, index = _read_numbers(tokens, index, 1)
                y = current[1] + numbers[0] if relative else numbers[0]
                point = (current[0], y)
                segments.append(("line", current, point))
                current = point
                last_control = None

        elif upper == "C":
            while index < len(tokens) and not re.fullmatch(r"[A-Za-z]", tokens[index]):
                numbers, index = _read_numbers(tokens, index, 6)
                control1 = (numbers[0], numbers[1])
                control2 = (numbers[2], numbers[3])
                point = (numbers[4], numbers[5])
                if relative:
                    control1 = (current[0] + control1[0], current[1] + control1[1])
                    control2 = (current[0] + control2[0], current[1] + control2[1])
                    point = (current[0] + point[0], current[1] + point[1])
                segments.append(("cubic", current, control1, control2, point))
                current = point
                last_control = control2

        elif upper == "S":
            while index < len(tokens) and not re.fullmatch(r"[A-Za-z]", tokens[index]):
                numbers, index = _read_numbers(tokens, index, 4)
                if last_control is None:
                    control1 = current
                else:
                    control1 = (2 * current[0] - last_control[0], 2 * current[1] - last_control[1])
                control2 = (numbers[0], numbers[1])
                point = (numbers[2], numbers[3])
                if relative:
                    control2 = (current[0] + control2[0], current[1] + control2[1])
                    point = (current[0] + point[0], current[1] + point[1])
                segments.append(("cubic", current, control1, control2, point))
                current = point
                last_control = control2

        elif upper == "Q":
            while index < len(tokens) and not re.fullmatch(r"[A-Za-z]", tokens[index]):
                numbers, index = _read_numbers(tokens, index, 4)
                control = (numbers[0], numbers[1])
                point = (numbers[2], numbers[3])
                if relative:
                    control = (current[0] + control[0], current[1] + control[1])
                    point = (current[0] + point[0], current[1] + point[1])
                cubic1 = (
                    current[0] + (2.0 / 3.0) * (control[0] - current[0]),
                    current[1] + (2.0 / 3.0) * (control[1] - current[1]),
                )
                cubic2 = (
                    point[0] + (2.0 / 3.0) * (control[0] - point[0]),
                    point[1] + (2.0 / 3.0) * (control[1] - point[1]),
                )
                segments.append(("cubic", current, cubic1, cubic2, point))
                current = point
                last_control = control

        elif upper == "T":
            while index < len(tokens) and not re.fullmatch(r"[A-Za-z]", tokens[index]):
                numbers, index = _read_numbers(tokens, index, 2)
                if last_control is None:
                    control = current
                else:
                    control = (2 * current[0] - last_control[0], 2 * current[1] - last_control[1])
                point = (numbers[0], numbers[1])
                if relative:
                    point = (current[0] + point[0], current[1] + point[1])
                cubic1 = (
                    current[0] + (2.0 / 3.0) * (control[0] - current[0]),
                    current[1] + (2.0 / 3.0) * (control[1] - current[1]),
                )
                cubic2 = (
                    point[0] + (2.0 / 3.0) * (control[0] - point[0]),
                    point[1] + (2.0 / 3.0) * (control[1] - point[1]),
                )
                segments.append(("cubic", current, cubic1, cubic2, point))
                current = point
                last_control = control

        elif upper == "A":
            while index < len(tokens) and not re.fullmatch(r"[A-Za-z]", tokens[index]):
                numbers, index = _read_numbers(tokens, index, 7)
                rx, ry, rotation, large_arc_flag, sweep_flag, x, y = numbers
                point = (x, y)
                if relative:
                    point = (current[0] + point[0], current[1] + point[1])
                for sampled_point in _sample_arc(current, rx, ry, rotation, int(large_arc_flag), int(sweep_flag), point):
                    segments.append(("line", current, sampled_point))
                    current = sampled_point
                last_control = None

        elif upper == "Z":
            if start_point is not None and current != start_point:
                segments.append(("close", current, start_point))
            current = start_point if start_point is not None else current
            last_control = None
            start_point = current

        else:
            raise ValueError(f"Unsupported SVG command: {cmd}")

    return segments


def _local_name(tag_name):
    return tag_name.split("}", 1)[-1] if "}" in tag_name else tag_name


def _transform_segment(segment, matrix):
    segment_type = segment[0]
    if segment_type in {"line", "close"}:
        return (
            segment_type,
            _apply_matrix(segment[1], matrix),
            _apply_matrix(segment[2], matrix),
        )
    if segment_type == "cubic":
        return (
            segment_type,
            _apply_matrix(segment[1], matrix),
            _apply_matrix(segment[2], matrix),
            _apply_matrix(segment[3], matrix),
            _apply_matrix(segment[4], matrix),
        )
    return segment


def _iter_svg_segments_recursive(element, parent_matrix):
    local_matrix = _multiply_matrices(parent_matrix, _parse_transform(element.attrib.get("transform")))
    tag_name = _local_name(element.tag)

    if tag_name == "path":
        path_data = element.attrib.get("d", "")
        if path_data.strip():
            for segment in parse_svg_path(path_data):
                yield _transform_segment(segment, local_matrix)

    elif tag_name == "polyline":
        points = [_apply_matrix(point, local_matrix) for point in _parse_points_attribute(element.attrib.get("points", ""))]
        for start, end in zip(points, points[1:]):
            yield ("line", start, end)

    elif tag_name == "polygon":
        points = [_apply_matrix(point, local_matrix) for point in _parse_points_attribute(element.attrib.get("points", ""))]
        for start, end in zip(points, points[1:]):
            yield ("line", start, end)
        if len(points) > 2:
            yield ("close", points[-1], points[0])

    elif tag_name == "line":
        start = _apply_matrix(
            (float(element.attrib.get("x1", 0.0)), float(element.attrib.get("y1", 0.0))),
            local_matrix,
        )
        end = _apply_matrix(
            (float(element.attrib.get("x2", 0.0)), float(element.attrib.get("y2", 0.0))),
            local_matrix,
        )
        yield ("line", start, end)

    elif tag_name == "rect":
        x = float(element.attrib.get("x", 0.0))
        y = float(element.attrib.get("y", 0.0))
        width = float(element.attrib.get("width", 0.0))
        height = float(element.attrib.get("height", 0.0))
        corners = [
            _apply_matrix((x, y), local_matrix),
            _apply_matrix((x + width, y), local_matrix),
            _apply_matrix((x + width, y + height), local_matrix),
            _apply_matrix((x, y + height), local_matrix),
        ]
        for start, end in zip(corners, corners[1:]):
            yield ("line", start, end)
        if width > 0 and height > 0:
            yield ("close", corners[-1], corners[0])

    for child in list(element):
        for segment in _iter_svg_segments_recursive(child, local_matrix):
            yield segment


def iter_svg_segments(svg_text):
    """Extracts drawable segments from SVG path-like elements."""
    root = ET.fromstring(svg_text)
    yield from _iter_svg_segments_recursive(root, _identity_matrix())


def _parse_points_attribute(value):
    tokens = re.findall(r"[-+]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][-+]?\d+)?", value or "")
    if len(tokens) % 2 != 0:
        return []
    return [(float(tokens[i]), float(tokens[i + 1])) for i in range(0, len(tokens), 2)]


def _svg_canvas_size(svg_text, fallback_size):
    root = ET.fromstring(svg_text)
    view_box = root.attrib.get("viewBox")
    if view_box:
        parts = [float(value) for value in view_box.replace(",", " ").split()]
        if len(parts) == 4:
            return parts[0], parts[1], parts[2], parts[3]

    width = _svg_length_to_float(root.attrib.get("width"))
    height = _svg_length_to_float(root.attrib.get("height"))
    if width and height:
        return 0.0, 0.0, width, height

    return 0.0, 0.0, fallback_size[0], fallback_size[1]


def _quantized_point(point, tolerance):
    return (round(point[0] / tolerance), round(point[1] / tolerance))


def _line_key(start, end, tolerance):
    a = _quantized_point(start, tolerance)
    b = _quantized_point(end, tolerance)
    return (a, b) if a <= b else (b, a)


def _segment_length(start, end):
    return math.hypot(end[0] - start[0], end[1] - start[1])


class RasterToDXFConverter:
    """Converts a raster image to vector DXF linework."""

    def __init__(self, raster_source, input_name=None):
        self.raster_source = raster_source
        self.input_name = input_name
        self.dxf = None
        self.msp = None
        self.verbose = True

    def _setup_dxf(self, layer_name):
        """Initializes the DXF document and output layer."""
        self.dxf = ezdxf.new()
        self.msp = self.dxf.modelspace()

        if layer_name not in self.dxf.layers:
            self.dxf.layers.new(name=layer_name, dxfattribs={"color": 7})

    def _transform_point(self, point, canvas_height, x_offset=0.0, y_offset=0.0):
        """Transforms SVG coordinates into DXF coordinates by offsetting and flipping the Y axis."""
        x, y = point
        return (x - x_offset, canvas_height - (y - y_offset))

    def convert(self, output_path, threshold=128, invert=False, layer_name="RASTER_VECTOR"):
        """Runs the full raster -> binary image -> SVG -> DXF pipeline."""
        binary_image = preprocess_image(self.raster_source, threshold=threshold, invert=invert)

        self._setup_dxf(layer_name)

        svg_text = vectorize_binary_image(binary_image)

        min_x, min_y, canvas_width, canvas_height = _svg_canvas_size(svg_text, binary_image.size)
        if canvas_width <= 0 or canvas_height <= 0:
            raise VectorizationError("The generated SVG does not contain a valid canvas size.")

        dedupe_tolerance = max(0.05, max(canvas_width, canvas_height) * 0.0003)
        min_segment_length = max(0.4, dedupe_tolerance * 3.0)
        line_keys = set()
        entity_count = 0
        for segment in iter_svg_segments(svg_text):
            segment_type = segment[0]

            if segment_type in {"line", "close"}:
                start = self._transform_point(segment[1], canvas_height, x_offset=min_x, y_offset=min_y)
                end = self._transform_point(segment[2], canvas_height, x_offset=min_x, y_offset=min_y)
                if start != end and _segment_length(start, end) >= min_segment_length:
                    key = _line_key(start, end, dedupe_tolerance)
                    if key in line_keys:
                        continue
                    self.msp.add_line(start, end, dxfattribs={"layer": layer_name})
                    line_keys.add(key)
                    entity_count += 1
            elif segment_type == "cubic":
                start = self._transform_point(segment[1], canvas_height, x_offset=min_x, y_offset=min_y)
                control1 = self._transform_point(segment[2], canvas_height, x_offset=min_x, y_offset=min_y)
                control2 = self._transform_point(segment[3], canvas_height, x_offset=min_x, y_offset=min_y)
                end = self._transform_point(segment[4], canvas_height, x_offset=min_x, y_offset=min_y)
                self.msp.add_spline([start, control1, control2, end], degree=3, dxfattribs={"layer": layer_name})
                entity_count += 1

        if entity_count == 0:
            raise VectorizationError("No vector paths were generated from the raster image.")

        self.dxf.saveas(output_path)
        if self.verbose:
            print(f"DXF saved to {output_path}")

    def convert_to_bytes(self, threshold=128, invert=False, layer_name="RASTER_VECTOR", output_name="output.dxf"):
        """Writes the DXF to a temporary file and returns its bytes for UI downloads."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            output_path = os.path.join(tmp_dir, output_name)
            self.convert(output_path, threshold=threshold, invert=invert, layer_name=layer_name)
            with open(output_path, "rb") as handle:
                return handle.read()
