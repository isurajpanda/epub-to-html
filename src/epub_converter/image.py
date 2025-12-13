import os
import hashlib
from pathlib import Path
from urllib.parse import unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
import multiprocessing

# CRC64 removed for performance - using sequential naming instead

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
        self.max_workers = min(multiprocessing.cpu_count(), 10)  # Cap at 8 to avoid memory issues
        
        if HAS_PYVIPS:
            import pyvips
            # Configure pyvips for optimal performance
            pyvips.cache_set_max(100)  # Cache up to 100 images
            pyvips.cache_set_max_mem(500 * 1024 * 1024)  # 500MB cache
    
    def find_images(self, extract_dir):
        """Find all image files in the EPUB"""
        image_files = []
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.avif', '.bmp'}
        for root, _, files in os.walk(extract_dir):
            for file in files:
                if Path(file).suffix.lower() in image_extensions:
                    image_files.append(Path(root) / file)
        return image_files
    
    def filter_images_by_content(self, image_files, content_files):
        """Filter images to only include those referenced by content files, in reading order."""
        if not content_files:
            return image_files
        
        # Create a map of filename/path to full path for quick lookup
        # We map both the filename and the relative path to the full path
        image_lookup = {}
        for img_path in image_files:
            image_lookup[img_path.name] = img_path
            # Also map absolute path string for direct lookups
            image_lookup[str(img_path.resolve())] = img_path
        
        ordered_images = []
        seen_images = set()
        
        for _, content_path in content_files:
            try:
                with open(content_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    # Find all image references in the content
                    import re
                    # Match img src="..." or src='...' patterns
                    for match in re.finditer(r'<img[^>]+src=["\']([^"\\]+)["\\]', content, re.IGNORECASE):
                        src = match.group(1)
                        if src.startswith('data:'):
                            continue
                            
                        # Try to resolve the image path
                        found_image = None
                        
                        # Method 1: Try to resolve relative path
                        try:
                            abs_path = (content_path.parent / unquote(src)).resolve()
                            if str(abs_path) in image_lookup:
                                found_image = image_lookup[str(abs_path)]
                        except Exception:
                            pass
                            
                        # Method 2: Try by filename
                        if not found_image:
                            img_name = Path(src).name
                            if img_name in image_lookup:
                                found_image = image_lookup[img_name]
                        
                        if found_image and found_image not in seen_images:
                            seen_images.add(found_image)
                            ordered_images.append(found_image)
            except Exception as e:
                print(f"Warning: Error processing content file {content_path}: {e}")
                pass
        
        return ordered_images

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
                try:
                    r_std = rgb_img[0].deviate()
                    g_std = rgb_img[1].deviate()
                    b_std = rgb_img[2].deviate()
                    # Check for NaN or invalid values
                    if not (isinstance(r_std, (int, float)) and isinstance(g_std, (int, float)) and isinstance(b_std, (int, float))):
                        raise ValueError("Invalid standard deviation values")
                    avg_std = (r_std + g_std + b_std) / 3
                except (ValueError, TypeError):
                    # Fallback values if calculation fails
                    avg_std = 60
                    print(f"Warning: Could not calculate std dev for {img_path.name}, using default complexity")
                
                # Determine complexity
                if avg_std > 60:
                    complexity = 85
                elif avg_std > 30:
                    complexity = 80
                else:
                    complexity = 75
                
                # Check if B&W by comparing channels
                try:
                    rg_diff = rgb_img[0].subtract(rgb_img[1]).abs().avg()
                    rb_diff = rgb_img[0].subtract(rgb_img[2]).abs().avg()
                    gb_diff = rgb_img[1].subtract(rgb_img[2]).abs().avg()
                    
                    # Validate values are not NaN or invalid
                    if not all(isinstance(x, (int, float)) and not (isinstance(x, float) and (x != x or x == float('inf'))) 
                               for x in [rg_diff, rb_diff, gb_diff]):
                        raise ValueError("Invalid difference values")
                    avg_diff = (rg_diff + rb_diff + gb_diff) / 3
                    is_bw = avg_diff < 5  # Threshold for B&W detection
                except (ValueError, TypeError):
                    # Assume color if we can't determine
                    is_bw = False
                    print(f"Warning: Could not determine B&W status for {img_path.name}, assuming color")
            
            return {
                'is_bw': is_bw,
                'complexity': complexity,
                'width': width,
                'height': height
            }
            
        except Exception as e:
            print(f"Warning: Could not analyze image {img_path} with pyvips: {e}")
            return {'is_bw': False, 'complexity': 80, 'width': 1080, 'height': 1080}

    def get_image_dimensions(self, img_path):
        """Get image dimensions efficiently."""
        try:
            if HAS_PYVIPS:
                import pyvips
                # new_from_file is lazy and should be fast for just reading headers
                img = pyvips.Image.new_from_file(str(img_path))
                return img.width, img.height
            else:
                # Fallback to Pillow if available
                try:
                    from PIL import Image
                    with Image.open(img_path) as img:
                        return img.width, img.height
                except ImportError:
                    pass
        except Exception as e:
            print(f"Warning: Could not get dimensions for {img_path}: {e}")
        
        return None, None

    def _process_single_image_pyvips(self, img_path, extract_dir, epub_output_folder, central_images_folder, epub_title=None, is_cover=False, image_index=0, is_directory_mode=False, compress_images=False):
        """Process a single image.
        If compress_images is True:
          - Do NOT copy original.
          - Generate AVIF and JXL from source.
          - Use AVIF as the primary html_path.
        If compress_images is False:
          - Copy original.
          - Do not generate others.
        """
        try:
            # Calculate CRC32 checksum of the original image file
            import zlib
            with open(img_path, 'rb') as f:
                file_content = f.read()
                crc32_value = zlib.crc32(file_content) & 0xffffffff
            
            base_name = f"{crc32_value:08x}-{image_index:02d}"
            
            # Determine output directory
            if is_directory_mode and central_images_folder:
                dest_dir = central_images_folder
                # html_path defined later
            else:
                dest_dir = epub_output_folder
                # html_path defined later
            
            output_path = None
            width = 0
            height = 0
            output_filename = ""
            html_path = ""
            
            import pyvips
            
            if compress_images:
                # COMPRESSION MODE
                # Do not copy original
                
                # Analyze image
                analysis = self._analyze_image_with_pyvips(img_path)
                width = analysis['width']
                height = analysis['height']
                
                img = pyvips.Image.new_from_file(str(img_path))
                
                # AVIF Generation
                avif_filename = f"{base_name}.avif"
                avif_path = dest_dir / avif_filename
                
                # JXL Generation
                jxl_filename = f"{base_name}.jxl"
                jxl_path = dest_dir / jxl_filename

                if analysis['is_bw']:
                    gray_img = img.colourspace('b-w')
                    if analysis['complexity'] < 50:
                        # Lossless
                        avif_data = gray_img.write_to_buffer('.avif[lossless=true]')
                        jxl_data = gray_img.write_to_buffer('.jxl[lossless=true]')
                        compression_info = "lossless compression"
                    else:
                        # Lossy (B&W Q=40)
                        avif_data = gray_img.write_to_buffer('.avif[Q=40,speed=6]')
                        jxl_data = gray_img.write_to_buffer('.jxl[Q=40,effort=6]') # effort 6 is balanced
                        compression_info = "40% compression"
                    print(f"Detected B&W image: {img_path.name}, using {compression_info} (AVIF+JXL)")
                else:
                    # Map complexity to new Q values
                    # Old logic: >60 -> 85, >30 -> 80, else 75
                    # New logic: >60 -> High(80), >30 -> Med(70), else Low(60)
                    
                    raw_complexity = analysis['complexity']
                    if raw_complexity == 85: # High
                        quality = 80
                    elif raw_complexity == 80: # Medium
                        quality = 70
                    else: # Low
                        quality = 60

                    avif_data = img.write_to_buffer(f'.avif[Q={quality},speed=6]') 
                    jxl_data = img.write_to_buffer(f'.jxl[Q={quality},effort=6]') # effort 6 is balanced
                    
                    complexity_level = "high" if quality == 80 else "medium" if quality == 70 else "low"
                    print(f"Detected {complexity_level} complexity color image: {img_path.name}, using {quality}% compression (AVIF+JXL)")
                
                # Save files
                with open(avif_path, 'wb') as f: f.write(avif_data)
                with open(jxl_path, 'wb') as f: f.write(jxl_data)
                
                # Generate JPG for cover image only (instead of WebP)
                if is_cover:
                    jpg_filename = f"{base_name}.jpg"
                    jpg_path = dest_dir / jpg_filename
                    # Use JPG Q=80
                    jpg_data = img.write_to_buffer('.jpg[Q=80]') 
                    with open(jpg_path, 'wb') as f: f.write(jpg_data)
                    print(f"Generated JPG for cover: {img_path.name}")
                
                # Set return values
                # Use JPG as the primary file for the <img> src (even if not generated for non-covers)
                # This ensures the <img src> points to a JPG for fallback/future compatibility
                output_filename = f"{base_name}.jpg"
                output_path = dest_dir / output_filename # Note: This file might not exist for non-covers yet
                html_path = f"/images/{output_filename}"

            else:
                # STANDARD MODE
                # Original extension
                extension = img_path.suffix.lower()
                if not extension:
                    extension = ".jpg"
                
                output_filename = f"{base_name}{extension}"
                output_path = dest_dir / output_filename
                html_path = f"/images/{output_filename}"
                
                # Copy original file (always)
                import shutil
                shutil.copy2(img_path, output_path)
                
                # Get dimensions using pyvips (fast)
                img = pyvips.Image.new_from_file(str(img_path))
                width = img.width
                height = img.height

            # Get relative original path for mapping
            relative_original = unquote(str(img_path.relative_to(extract_dir).as_posix()))
            
            return {
                'relative_original': relative_original,
                'filename': unquote(img_path.name),
                'output_filename': output_filename,
                'output_path': output_path,
                'html_path': html_path,
                'width': width,
                'height': height
            }

        except Exception as e:
            print(f"Warning: Could not process image {img_path}: {e}")
            return None

    def process_images_and_get_mapping(self, image_files, extract_dir, output_folder, epub_title=None, cover_image_path=None, central_images_folder=None, is_directory_mode=False, compress_images=False):
        """Process images using pyvips and save to disk."""
        path_mapping = {}
        image_metadata = {}
        
        # Identify cover image
        cover_image = None
        if cover_image_path:
            cover_image = Path(cover_image_path)
            # Check if cover image exists and is in the image files list
            if not cover_image.exists() or cover_image not in image_files:
                cover_image = None
        
        # Process images with proper naming
        if len(image_files) <= 4:  # For small numbers of images, process sequentially
            image_index = 1
            for img_path in image_files:
                # Check if this is the cover image
                is_cover = False
                if cover_image:
                    try:
                        is_cover = img_path.samefile(cover_image)
                    except (OSError, ValueError):
                        # Fallback: check if filenames match
                        is_cover = img_path.name.lower() == cover_image.name.lower()
                
                result = self._process_single_image_pyvips(
                    img_path, extract_dir, output_folder, central_images_folder or Path(), 
                    epub_title, is_cover, image_index, is_directory_mode, compress_images
                )
                if result:
                    # Add multiple path variations to the mapping for better lookup
                    path_mapping[result['relative_original']] = result['html_path']
                    path_mapping[result['filename']] = result['html_path']
                    
                    # Store metadata
                    image_metadata[result['html_path']] = {
                        'width': result['width'],
                        'height': result['height']
                    }
                    
                    # Also add variations like ../Images/filename
                    path_variation = result['relative_original']
                    if '/' in path_variation:
                        # Add parent directory variant
                        path_mapping[f"../{path_variation}"] = result['html_path']
                        path_mapping[f"{path_variation}"] = result['html_path']
                        path_mapping[f"./{path_variation}"] = result['html_path']
                    image_index += 1
        else:  # For larger numbers of images, use parallel processing
            print(f"  Processing {len(image_files)} images in parallel using {self.max_workers} workers (pyvips)...")
            
            # Create a list of image processing tasks with metadata
            image_tasks = []
            image_index = 1
            for img_path in image_files:
                # Check if this is the cover image
                is_cover = False
                if cover_image:
                    try:
                        is_cover = img_path.samefile(cover_image)
                    except (OSError, ValueError):
                        # Fallback: check if filenames match
                        is_cover = img_path.name.lower() == cover_image.name.lower()
                
                image_tasks.append((img_path, is_cover, image_index))
                image_index += 1
            
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                # Submit all image processing tasks
                future_to_task = {
                    executor.submit(
                        self._process_single_image_pyvips, 
                        task[0], extract_dir, output_folder, central_images_folder or Path(),
                        epub_title, task[1], task[2], is_directory_mode, compress_images
                    ): task
                    for task in image_tasks
                }
                
                # Process completed tasks as they finish
                for future in as_completed(future_to_task):
                    task = future_to_task[future]
                    img_path = task[0]
                    try:
                        result = future.result()
                        if result:
                            # Add multiple path variations to the mapping for better lookup
                            path_mapping[result['relative_original']] = result['html_path']
                            path_mapping[result['filename']] = result['html_path']
                            
                            # Store metadata
                            image_metadata[result['html_path']] = {
                                'width': result['width'],
                                'height': result['height']
                            }
                            
                            # Also add variations like ../Images/filename
                            path_variation = result['relative_original']
                            if '/' in path_variation:
                                # Add parent directory variant
                                path_mapping[f"../{path_variation}"] = result['html_path']
                                path_mapping[f"{path_variation}"] = result['html_path']
                                path_mapping[f"./{path_variation}"] = result['html_path']
                    except Exception as e:
                        print(f"Error processing image {img_path}: {e}")

        return path_mapping, image_metadata
