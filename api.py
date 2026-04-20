import os
import sys
import tempfile
import shutil
import uuid
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import fitz
from PIL import Image
import io
import base64

# Add source directory to path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(BASE_DIR, "pdfextract", "src")
sys.path.append(SRC_DIR)

try:
    from converter import PDF2DXFConverter
    from raster_to_dxf import RasterToDXFConverter, preprocess_image
except ImportError as e:
    print(f"Error importing modules: {e}")
    print(f"SRC_DIR: {SRC_DIR}")
    # Fallback or exit? For now, we'll assume they exist if setup is correct.

app = FastAPI(title="CAD AI API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DATA_DIR = os.path.join(BASE_DIR, "temp_data")
os.makedirs(TEMP_DATA_DIR, exist_ok=True)

def cleanup_temp_file(path: str):
    if os.path.exists(path):
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/pdf/info")
async def pdf_info(file: UploadFile = File(...)):
    try:
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
        page_count = len(doc)
        
        pages_info = []
        for i in range(page_count):
            page = doc[i]
            pages_info.append({
                "index": i + 1,
                "width": page.rect.width,
                "height": page.rect.height
            })
            
        doc.close()
        return {"filename": file.filename, "page_count": page_count, "pages": pages_info}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF: {e}")

@app.post("/pdf/preview")
async def pdf_preview(
    file: UploadFile = File(...), 
    page_num: int = Form(1), 
    scale: float = Form(2.0)
):
    try:
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
        if page_num < 1 or page_num > len(doc):
            raise HTTPException(status_code=400, detail="Page number out of range")
            
        page = doc[page_num - 1]
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        img_data = pix.tobytes("png")
        doc.close()
        
        return JSONResponse(content={
            "image": base64.b64encode(img_data).decode("utf-8"),
            "width": page.rect.width,
            "height": page.rect.height
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Preview failed: {e}")

@app.post("/pdf/convert")
async def pdf_convert(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    include_geom: bool = Form(True),
    include_text: bool = Form(True),
    skip_curves: bool = Form(False),
    min_size: float = Form(0.0),
    page_from: int = Form(1),
    page_to: int = Form(99999),
    crop_rect: Optional[str] = Form(None) # JSON string: "[left, top, right, bottom]"
):
    job_id = str(uuid.uuid4())
    job_dir = os.path.join(TEMP_DATA_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)
    
    try:
        parsed_crop = None
        if crop_rect:
            import json
            parsed_crop = tuple(json.loads(crop_rect))

        output_files = []
        for file in files:
            input_path = os.path.join(job_dir, file.filename)
            with open(input_path, "wb") as f:
                f.write(await file.read())
            
            base_name = os.path.splitext(file.filename)[0]
            output_path = os.path.join(job_dir, f"{base_name}.dxf")
            
            converter = PDF2DXFConverter(input_path)
            
            # Determine pages
            doc = fitz.open(input_path)
            total_pages = len(doc)
            doc.close()
            
            p_from = max(1, page_from)
            p_to = min(total_pages, page_to)
            pages_list = list(range(p_from - 1, p_to))
            
            if pages_list:
                converter.convert(
                    output_path=output_path,
                    pages=pages_list,
                    crop_rect=parsed_crop,
                    min_size=min_size,
                    skip_curves=skip_curves,
                    include_geom=include_geom,
                    include_text=include_text
                )
                output_files.append(output_path)

        if not output_files:
            raise HTTPException(status_code=400, detail="No files generated")

        if len(output_files) == 1:
            final_path = output_files[0]
            background_tasks.add_task(cleanup_temp_file, job_dir)
            return FileResponse(final_path, filename=os.path.basename(final_path), media_type="application/dxf")
        else:
            zip_path = os.path.join(job_dir, "converted_files.zip")
            import zipfile
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for f in output_files:
                    zipf.write(f, os.path.basename(f))
            
            background_tasks.add_task(cleanup_temp_file, job_dir)
            return FileResponse(zip_path, filename="converted_files.zip", media_type="application/zip")
            
    except Exception as e:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Conversion failed: {e}")

@app.post("/raster/preview")
async def raster_preview(
    file: UploadFile = File(...),
    threshold: int = Form(128),
    invert: bool = Form(False)
):
    try:
        content = await file.read()
        img = preprocess_image(content, threshold=threshold, invert=invert)
        
        # img is a numpy array (0 or 1 usually from preprocess_image)
        # Convert to PNG bytes
        from PIL import Image
        import numpy as np
        
        # If preprocess_image returns a binarized array, convert to 0-255
        if img.dtype == bool:
            img = (img.astype(np.uint8) * 255)
        elif img.max() <= 1:
            img = (img * 255).astype(np.uint8)
            
        pil_img = Image.fromarray(img)
        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")
        img_data = buf.getvalue()
        
        return JSONResponse(content={
            "image": base64.b64encode(img_data).decode("utf-8")
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Raster preview failed: {e}")

@app.post("/raster/convert")
async def raster_convert(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    threshold: int = Form(128),
    invert: bool = Form(False),
    layer_name: str = Form("RASTER_VECTOR")
):
    job_id = str(uuid.uuid4())
    job_dir = os.path.join(TEMP_DATA_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)
    
    try:
        content = await file.read()
        converter = RasterToDXFConverter(content, input_name=file.filename)
        base_name = os.path.splitext(file.filename)[0] or "raster_output"
        output_name = f"{base_name}.dxf"
        output_path = os.path.join(job_dir, output_name)
        
        dxf_bytes = converter.convert_to_bytes(
            threshold=threshold,
            invert=invert,
            layer_name=layer_name,
            output_name=output_name
        )
        
        with open(output_path, "wb") as f:
            f.write(dxf_bytes)
            
        background_tasks.add_task(cleanup_temp_file, job_dir)
        return FileResponse(output_path, filename=output_name, media_type="application/dxf")
    except Exception as e:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Raster conversion failed: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
