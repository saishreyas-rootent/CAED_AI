import os
import sys
import tempfile
import shutil
import uuid
import json
import zipfile
import io
import base64
import traceback
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

import fitz
from PIL import Image

# ── Path setup ────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR  = os.path.join(BASE_DIR, "pdfextract", "src")
sys.path.insert(0, SRC_DIR)

try:
    from converter import PDF2DXFConverter
    from raster_to_dxf import RasterToDXFConverter, preprocess_image
except ImportError as e:
    print(f"[WARN] Could not import converter modules: {e}")
    print(f"[WARN] SRC_DIR resolved to: {SRC_DIR}")

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="CAD AI API")

@app.middleware("http")
async def log_errors(request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        print(f"\n[CRASH] {request.url.path}")
        print(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal Error: {str(e)}", "trace": traceback.format_exc()}
        )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DATA_DIR = os.path.join(BASE_DIR, "temp_data")
os.makedirs(TEMP_DATA_DIR, exist_ok=True)

# ── Helpers ────────────────────────────────────────────────────────────────────
def cleanup(path: str):
    try:
        if os.path.isdir(path):
            shutil.rmtree(path)
        elif os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


def pil_to_base64_png(img: Image.Image) -> str:
    """Convert any PIL Image to a base64-encoded PNG string."""
    # Make sure it's in a mode that PNG can handle
    if img.mode not in ("RGB", "RGBA", "L", "1"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok"}


# ── PDF info ───────────────────────────────────────────────────────────────────
@app.post("/pdf/info")
async def pdf_info(file: UploadFile = File(...)):
    try:
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
        pages_info = [
            {"index": i + 1, "width": doc[i].rect.width, "height": doc[i].rect.height}
            for i in range(len(doc))
        ]
        page_count = len(doc)
        doc.close()
        return {"filename": file.filename, "page_count": page_count, "pages": pages_info}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF: {e}")


# ── PDF preview ────────────────────────────────────────────────────────────────
@app.post("/pdf/preview")
async def pdf_preview(
    file:  UploadFile = File(...),
    page:  int        = Form(1),       # 1-based page number sent by the frontend
    scale: float      = Form(2.0),
):
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        doc = fitz.open(stream=content, filetype="pdf")
        total = len(doc)

        # Clamp to valid range instead of crashing
        page = max(1, min(page, total))
        page_obj = doc[page - 1]

        pix      = page_obj.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        img_data = pix.tobytes("png")

        width  = page_obj.rect.width
        height = page_obj.rect.height
        doc.close()

        return JSONResponse(content={
            "image":  base64.b64encode(img_data).decode("utf-8"),
            "width":  width,
            "height": height,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Preview failed: {e}")


# ── PDF convert ────────────────────────────────────────────────────────────────
@app.post("/pdf/convert")
async def pdf_convert(
    background_tasks: BackgroundTasks,
    files:   List[UploadFile] = File(...),
    options: str              = Form("{}"),
):
    job_dir = os.path.join(TEMP_DATA_DIR, str(uuid.uuid4()))
    os.makedirs(job_dir, exist_ok=True)

    try:
        opt = json.loads(options)

        include_geom     = opt.get("includeGeom", True)
        include_text     = opt.get("includeText", True)
        skip_curves      = opt.get("skipCurves", False)
        min_size         = float(opt.get("minSize", 0.0))
        process_all      = opt.get("processAllPages", True)
        page_from        = 1 if process_all else int(opt.get("pageFrom", 1))
        page_to          = 99999 if process_all else int(opt.get("pageTo", 99999))
        crop_rect        = opt.get("cropRect")

        output_files = []

        for upload in files:
            content    = await upload.read()
            input_path = os.path.join(job_dir, upload.filename)
            with open(input_path, "wb") as f:
                f.write(content)

            base_name   = os.path.splitext(upload.filename)[0]
            output_path = os.path.join(job_dir, f"{base_name}.dxf")

            doc          = fitz.open(input_path)
            total_pages  = len(doc)
            doc.close()

            p_from     = max(1, page_from)
            p_to       = min(total_pages, page_to)
            pages_list = list(range(p_from - 1, p_to))

            if pages_list:
                converter = PDF2DXFConverter(input_path)
                converter.convert(
                    output_path  = output_path,
                    pages        = pages_list,
                    crop_rect    = tuple(crop_rect) if crop_rect else None,
                    min_size     = min_size,
                    skip_curves  = skip_curves,
                    include_geom = include_geom,
                    include_text = include_text,
                )
                output_files.append(output_path)

        if not output_files:
            raise HTTPException(status_code=400, detail="No DXF files were generated.")

        if len(output_files) == 1:
            background_tasks.add_task(cleanup, job_dir)
            return FileResponse(
                output_files[0],
                filename   = os.path.basename(output_files[0]),
                media_type = "application/dxf",
            )

        zip_path = os.path.join(job_dir, "converted_files.zip")
        with zipfile.ZipFile(zip_path, "w") as zf:
            for fp in output_files:
                zf.write(fp, os.path.basename(fp))

        background_tasks.add_task(cleanup, job_dir)
        return FileResponse(zip_path, filename="converted_files.zip", media_type="application/zip")

    except HTTPException:
        raise
    except Exception as e:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Conversion failed: {e}\n{traceback.format_exc()}")


# ── Raster preview ─────────────────────────────────────────────────────────────
@app.post("/raster/preview")
async def raster_preview(
    file:      UploadFile = File(...),
    threshold: int        = Form(128),
    invert:    str        = Form("false"),   # comes as a string from FormData
):
    try:
        content      = await file.read()
        invert_bool  = invert.lower() in ("true", "1", "yes")

        # preprocess_image returns a PIL Image (mode "L")
        pil_img = preprocess_image(content, threshold=threshold, invert=invert_bool)

        return JSONResponse(content={"image": pil_to_base64_png(pil_img)})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Raster preview failed: {e}")


# ── Raster convert ─────────────────────────────────────────────────────────────
@app.post("/raster/convert")
async def raster_convert(
    background_tasks: BackgroundTasks,
    file:       UploadFile = File(...),
    threshold:  int        = Form(128),
    invert:     str        = Form("false"),
    layer_name: str        = Form("RASTER_VECTOR"),
):
    job_dir = os.path.join(TEMP_DATA_DIR, str(uuid.uuid4()))
    os.makedirs(job_dir, exist_ok=True)

    try:
        content     = await file.read()
        invert_bool = invert.lower() in ("true", "1", "yes")

        base_name   = os.path.splitext(file.filename)[0] or "raster_output"
        output_name = f"{base_name}.dxf"
        output_path = os.path.join(job_dir, output_name)

        converter = RasterToDXFConverter(content, input_name=file.filename)
        dxf_bytes = converter.convert_to_bytes(
            threshold  = threshold,
            invert     = invert_bool,
            layer_name = layer_name.strip() or "RASTER_VECTOR",
            output_name= output_name,
        )

        with open(output_path, "wb") as f:
            f.write(dxf_bytes)

        background_tasks.add_task(cleanup, job_dir)
        return FileResponse(output_path, filename=output_name, media_type="application/dxf")

    except Exception as e:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Raster conversion failed: {e}")


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)