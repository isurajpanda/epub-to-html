import os
import base64
import io
from pathlib import Path
from urllib.parse import unquote
from PIL import Image

class ImageProcessor:
    def find_images(self, extract_dir):
        """Find all image files in the EPUB"""
        image_files = []
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'}
        for root, _, files in os.walk(extract_dir):
            for file in files:
                if Path(file).suffix.lower() in image_extensions:
                    image_files.append(Path(root) / file)
        return image_files

    def process_images_and_get_mapping(self, image_files, extract_dir):
        """Process images to WebP, resize, and return base64 data URI mapping."""
        path_mapping = {}

        for img_path in image_files:
            try:
                with Image.open(img_path) as img:
                    # Resize image to a width of 1080px, maintaining aspect ratio
                    width, height = img.size
                    if width > 1080:
                        new_height = int(1080 * height / width)
                        img = img.resize((1080, new_height), Image.LANCZOS)

                    # Convert to WebP and save to a buffer
                    buffer = io.BytesIO()
                    img.save(buffer, format='WEBP', quality=80)
                    img_data = buffer.getvalue()

                    # Encode as base64
                    base64_data = base64.b64encode(img_data).decode('utf-8')
                    data_uri = f"data:image/webp;base64,{base64_data}"

                    relative_original = unquote(str(img_path.relative_to(extract_dir).as_posix()))
                    path_mapping[relative_original] = data_uri
                    path_mapping[unquote(img_path.name)] = data_uri

            except Exception as e:
                print(f"Warning: Could not process image {img_path}: {e}")

        return path_mapping