import os
import base64
import io
import numpy as np
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

    def is_black_and_white(self, img):
        """Detect if an image is black and white only (grayscale)."""
        try:
            # Convert to RGB if it's not already
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Convert PIL image to numpy array
            img_array = np.array(img)
            
            # Check if all RGB channels are approximately equal (grayscale)
            # Calculate the difference between channels
            r, g, b = img_array[:, :, 0], img_array[:, :, 1], img_array[:, :, 2]
            
            # Check if the difference between channels is small (within 5 pixel values)
            rg_diff = np.abs(r - g)
            rb_diff = np.abs(r - b)
            gb_diff = np.abs(g - b)
            
            # If more than 95% of pixels have small differences between channels, it's grayscale
            threshold = 5
            grayscale_pixels = np.sum((rg_diff <= threshold) & (rb_diff <= threshold) & (gb_diff <= threshold))
            total_pixels = img_array.shape[0] * img_array.shape[1]
            
            return (grayscale_pixels / total_pixels) > 0.95
            
        except Exception as e:
            print(f"Warning: Could not analyze image for black/white detection: {e}")
            return False

    def get_adaptive_quality_for_color(self, img):
        """Determine optimal quality for color images based on complexity."""
        try:
            # Convert to RGB if it's not already
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Convert PIL image to numpy array
            img_array = np.array(img)
            
            # Calculate standard deviation for each RGB channel
            r_std = np.std(img_array[:, :, 0])
            g_std = np.std(img_array[:, :, 1])
            b_std = np.std(img_array[:, :, 2])
            
            # Use average standard deviation as complexity measure
            avg_std = (r_std + g_std + b_std) / 3
            
            # Determine quality based on complexity (improved quality levels)
            if avg_std > 60:  # High complexity (detailed images)
                return 85
            elif avg_std > 30:  # Medium complexity
                return 80
            else:  # Low complexity (simple/flat images)
                return 75
                
        except Exception as e:
            print(f"Warning: Could not analyze image complexity: {e}")
            return 80  # Default to baseline quality

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

                    # Check if image is black and white
                    is_bw = self.is_black_and_white(img)
                    
                    if is_bw:
                        # Convert to grayscale for better compression
                        img = img.convert('L')
                        
                        # Count unique colors to determine compression strategy
                        unique_colors = len(set(img.getdata()))
                        
                        buffer = io.BytesIO()
                        if unique_colors <= 16:
                            # Simple B&W image (like text) - use lossless
                            img.save(buffer, format='WEBP', lossless=True)
                            print(f"Detected simple B&W image: {img_path.name} ({unique_colors} colors), using lossless compression")
                        else:
                            # Complex B&W image - use aggressive compression
                            img.save(buffer, format='WEBP', quality=35, method=6)
                            print(f"Detected complex B&W image: {img_path.name} ({unique_colors} colors), using 35% compression")
                        
                        img_data = buffer.getvalue()
                        data_uri = f"data:image/webp;base64,{base64.b64encode(img_data).decode('utf-8')}"
                    else:
                        # Color image - adaptive compression based on complexity
                        quality = self.get_adaptive_quality_for_color(img)
                        buffer = io.BytesIO()
                        img.save(buffer, format='WEBP', quality=quality, method=6)
                        img_data = buffer.getvalue()
                        data_uri = f"data:image/webp;base64,{base64.b64encode(img_data).decode('utf-8')}"
                        
                        # Determine complexity level for logging
                        if quality == 85:
                            complexity = "high"
                        elif quality == 80:
                            complexity = "medium"
                        else:
                            complexity = "low"
                        print(f"Detected {complexity} complexity color image: {img_path.name}, using {quality}% compression")

                    relative_original = unquote(str(img_path.relative_to(extract_dir).as_posix()))
                    path_mapping[relative_original] = data_uri
                    path_mapping[unquote(img_path.name)] = data_uri

            except Exception as e:
                print(f"Warning: Could not process image {img_path}: {e}")

        return path_mapping