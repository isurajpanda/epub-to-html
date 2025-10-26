import os
import base64
import io
import numpy as np
from pathlib import Path
from urllib.parse import unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
import multiprocessing

# Try to add libvips bin directory to Python's DLL search path
# This ensures pyvips can find libvips-42.dll even if PATH is not set correctly
def _add_libvips_to_dll_path():
    """Add libvips bin directory to Python's DLL search path."""
    try:
        # Common libvips installation paths on Windows
        possible_paths = [
            r"C:\Program Files\vips\bin",
            r"C:\Program Files (x86)\vips\bin",
            r"C:\vips\bin",
            os.path.join(os.environ.get('PROGRAMFILES', ''), 'vips', 'bin'),
            os.path.join(os.environ.get('PROGRAMFILES(X86)', ''), 'vips', 'bin'),
        ]
        
        for dll_path in possible_paths:
            if os.path.exists(dll_path) and os.path.exists(os.path.join(dll_path, 'libvips-42.dll')):
                # Use add_dll_directory (Python 3.8+)
                if hasattr(os, 'add_dll_directory'):
                    os.add_dll_directory(dll_path)
                # Add to PATH for older Python versions
                else:
                    path_var = os.environ.get('PATH', '')
                    if dll_path not in path_var:
                        os.environ['PATH'] = f"{dll_path};{path_var}"
                return dll_path
    except Exception as e:
        # Silently fail
        pass
    return None

# Try to add libvips to DLL path on module load
_libvips_path = _add_libvips_to_dll_path()

# Initialize flags
HAS_PYVIPS = False

# Check for pyvips on module load
def _check_pyvips():
    """Check if pyvips is available and working."""
    global HAS_PYVIPS
    try:
        import pyvips
        # Test if pyvips can actually load the libvips library
        try:
            # Try to create a simple image to verify libvips is working
            test_img = pyvips.Image.black(1, 1)
            HAS_PYVIPS = True
            print("pyvips loaded - ultra-fast image processing enabled")
            return True
        except Exception as e:
            raise ImportError(f"pyvips installed but libvips library not available: {e}")
    except ImportError:
        raise ImportError("pyvips is not installed. Please install it with: pip install pyvips")

class ImageProcessor:
    def __init__(self):
        # Require pyvips - no fallback to Pillow
        _check_pyvips()  # Will raise ImportError if pyvips is not available
        
        # Determine optimal number of workers for parallel processing
        self.max_workers = min(multiprocessing.cpu_count(), 20)  # Cap at 8 to avoid memory issues
        
        if HAS_PYVIPS:
            import pyvips
            # Configure pyvips for optimal performance
            pyvips.cache_set_max(100)  # Cache up to 100 images
            pyvips.cache_set_max_mem(500 * 1024 * 1024)  # 500MB cache
    
    def find_images(self, extract_dir):
        """Find all image files in the EPUB"""
        image_files = []
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'}
        for root, _, files in os.walk(extract_dir):
            for file in files:
                if Path(file).suffix.lower() in image_extensions:
                    image_files.append(Path(root) / file)
        return image_files

    def _analyze_image_with_pyvips(self, img_path):
        """Analyze image using pyvips for complexity and B&W detection."""
        try:
            import pyvips
            # Load image with pyvips
            img = pyvips.Image.new_from_file(str(img_path))
            
            # Get basic info
            width, height = img.width, img.height
            
            # Resize for analysis (sample)
            sample_size = min(200, min(width, height) // 3)
            if width > sample_size or height > sample_size:
                scale = sample_size / min(width, height)
                sample_img = img.resize(scale)
            else:
                sample_img = img
            
            # Convert to RGB for analysis
            if sample_img.bands == 1:
                # Already grayscale
                is_bw = True
                complexity = 50  # Medium complexity for grayscale
            else:
                # Convert to RGB
                rgb_img = sample_img.colourspace('srgb')
                
                # Calculate standard deviation for complexity
                r_std = rgb_img[0].deviate()
                g_std = rgb_img[1].deviate()
                b_std = rgb_img[2].deviate()
                avg_std = (r_std + g_std + b_std) / 3
                
                # Determine complexity
                if avg_std > 60:
                    complexity = 85
                elif avg_std > 30:
                    complexity = 80
                else:
                    complexity = 75
                
                # Check if B&W by comparing channels
                rg_diff = rgb_img[0].subtract(rgb_img[1]).abs().avg()
                rb_diff = rgb_img[0].subtract(rgb_img[2]).abs().avg()
                gb_diff = rgb_img[1].subtract(rgb_img[2]).abs().avg()
                
                avg_diff = (rg_diff + rb_diff + gb_diff) / 3
                is_bw = avg_diff < 5  # Threshold for B&W detection
            
            return {
                'is_bw': is_bw,
                'complexity': complexity,
                'width': width,
                'height': height
            }
            
        except Exception as e:
            print(f"Warning: Could not analyze image {img_path} with pyvips: {e}")
            return {'is_bw': False, 'complexity': 80, 'width': 1080, 'height': 1080}

    def _process_single_image_pyvips(self, img_path, extract_dir):
        """Process a single image using pyvips for ultra-fast conversion."""
        try:
            import pyvips
            # Load image with pyvips
            img = pyvips.Image.new_from_file(str(img_path))
            
            # Resize if needed (maintain aspect ratio, max width 1080)
            if img.width > 1080:
                scale = 1080 / img.width
                img = img.resize(scale)
            
            # Analyze image
            analysis = self._analyze_image_with_pyvips(img_path)
            
            # Convert to WebP based on analysis
            if analysis['is_bw']:
                # Convert to grayscale
                gray_img = img.colourspace('b-w')
                
                # For simple B&W images, use lossless
                if analysis['complexity'] < 50:
                    webp_data = gray_img.write_to_buffer('.webp[lossless=true]')
                    compression_info = "lossless compression"
                else:
                    # For complex B&W, use aggressive compression
                    webp_data = gray_img.write_to_buffer('.webp[Q=35,effort=6]')
                    compression_info = "35% compression"
                
                print(f"Detected B&W image: {img_path.name}, using {compression_info}")
            else:
                # Color image - use adaptive quality
                quality = analysis['complexity']
                webp_data = img.write_to_buffer(f'.webp[Q={quality},effort=6]')
                
                complexity_level = "high" if quality == 85 else "medium" if quality == 80 else "low"
                print(f"Detected {complexity_level} complexity color image: {img_path.name}, using {quality}% compression")
            
            # Convert to base64
            data_uri = f"data:image/webp;base64,{base64.b64encode(webp_data).decode('utf-8')}"
            
            relative_original = unquote(str(img_path.relative_to(extract_dir).as_posix()))
            return {
                'relative_original': relative_original,
                'filename': unquote(img_path.name),
                'data_uri': data_uri
            }

        except Exception as e:
            print(f"Warning: Could not process image {img_path} with pyvips: {e}")
            return None

    def process_images_and_get_mapping(self, image_files, extract_dir):
        """Process images to WebP using pyvips."""
        path_mapping = {}
        
        if len(image_files) <= 4:  # For small numbers of images, process sequentially
            for img_path in image_files:
                result = self._process_single_image_pyvips(img_path, extract_dir)
                if result:
                    path_mapping[result['relative_original']] = result['data_uri']
                    path_mapping[result['filename']] = result['data_uri']
        else:  # For larger numbers of images, use parallel processing
            print(f"  Processing {len(image_files)} images in parallel using {self.max_workers} workers (pyvips)...")
            
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                # Submit all image processing tasks
                future_to_img = {
                    executor.submit(self._process_single_image_pyvips, img_path, extract_dir): img_path
                    for img_path in image_files
                }
                
                # Process completed tasks as they finish
                for future in as_completed(future_to_img):
                    img_path = future_to_img[future]
                    try:
                        result = future.result()
                        if result:
                            path_mapping[result['relative_original']] = result['data_uri']
                            path_mapping[result['filename']] = result['data_uri']
                    except Exception as e:
                        print(f"Error processing image {img_path}: {e}")

        return path_mapping
