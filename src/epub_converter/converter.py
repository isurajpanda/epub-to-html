
import os
import re
import shutil
import tempfile
import time
import sys
import cProfile
import pstats
from pathlib import Path
from urllib.parse import unquote, quote
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from jinja2 import Environment, FileSystemLoader

# Try to import orjson for faster JSON operations, fallback to stdlib json
try:
    import orjson as json
    HAS_ORJSON = True
except ImportError:
    import json
    HAS_ORJSON = False

# Try to import selectolax for faster HTML parsing
try:
    from selectolax.parser import HTMLParser
    HAS_SELECTOLAX = True
except ImportError:
    HAS_SELECTOLAX = False

from .parser import EPUBParser
from .image import ImageProcessor

class EPUBConverter:
    def __init__(self, epub_path, output_folder=None, custom_css_path=None, no_script=False, no_image=False):
        self.epub_path = Path(epub_path)
        self.output_folder = Path(output_folder) if output_folder else self.epub_path.parent
        self.custom_css_path = custom_css_path
        self.no_script = no_script
        self.no_image = no_image
        self.temp_dir = None
        self.image_processor = ImageProcessor()
        
        # Central images folder for directory conversions
        self.central_images_folder = None
        
        assets_path = Path(__file__).parent / "assets"
        self.jinja_env = Environment(loader=FileSystemLoader(assets_path))
        
        # Detect free-threading capabilities
        self.free_threading = self._detect_free_threading()
        
        # Performance profiling
        self.profile_enabled = os.environ.get('EPUB_PROFILE', '').lower() in ('1', 'true', 'yes')
        self.profiler = None
        
        # Pre-compile regex patterns for better performance
        self._compile_regex_patterns()

    def _detect_free_threading(self):
        """Detect if Python 3.13+ free-threading is available."""
        python_version = sys.version_info
        if python_version < (3, 13):
            return False
        
        # Check if GIL is disabled
        try:
            if hasattr(sys, '_is_gil_enabled'):
                return not sys._is_gil_enabled()
        except AttributeError:
            pass
        
        # Check environment variable
        import os
        return os.environ.get('PYTHON_GIL') == '0'

    def _start_profiling(self):
        """Start performance profiling if enabled."""
        if self.profile_enabled:
            self.profiler = cProfile.Profile()
            self.profiler.enable()
            print("🔍 Performance profiling enabled")

    def _stop_profiling(self):
        """Stop profiling and save results."""
        if self.profile_enabled and self.profiler:
            self.profiler.disable()
            
            # Save profile to file
            profile_file = f"epub_converter_profile_{int(time.time())}.prof"
            self.profiler.dump_stats(profile_file)
            
            # Print top functions
            stats = pstats.Stats(self.profiler)
            stats.sort_stats('cumulative')
            print(f"\n🔍 Performance Profile saved to: {profile_file}")
            print("Top 10 functions by cumulative time:")
            stats.print_stats(10)

    def _format_time(self, seconds):
        """Format time in a human-readable way."""
        if seconds < 60:
            return f"{seconds:.1f}s"
        elif seconds < 3600:
            minutes = seconds / 60
            return f"{minutes:.1f}m"
        else:
            hours = seconds / 3600
            return f"{hours:.1f}h"

    def _estimate_remaining_time(self, completed, total, start_time):
        """Estimate remaining time based on current progress."""
        if completed == 0:
            return "Unknown"
        
        elapsed = time.time() - start_time
        rate = completed / elapsed
        remaining = (total - completed) / rate
        return self._format_time(remaining)

    def _compile_regex_patterns(self):
        """Pre-compile all regex patterns for better performance."""
        # Body content extraction patterns
        self.body_pattern = re.compile(r'<body[^>]*>(.*?)</body>', re.DOTALL | re.IGNORECASE)
        self.html_pattern = re.compile(r'<html[^>]*>(.*?)</html>', re.DOTALL | re.IGNORECASE)
        self.head_pattern = re.compile(r'<head>.*?</head>', re.DOTALL | re.IGNORECASE)
        self.xml_declaration_pattern = re.compile(r'<?xml[^>]*?>')
        self.doctype_pattern = re.compile(r'<!DOCTYPE[^>]*>')
        
        # Image processing patterns
        self.img_tag_pattern = re.compile(r'<img\b[^>]+>', re.IGNORECASE | re.DOTALL)
        self.img_src_pattern = re.compile(r'(<img\b[^>]*\ssrc\s*=\s*)(["\'])(.*?)\2', re.IGNORECASE | re.DOTALL)
        self.img_alt_pattern = re.compile(r'\salt\s*=\s*(["\'])(.*?)\1', re.IGNORECASE)
        self.img_src_extract_pattern = re.compile(r'src\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)
        self.img_close_pattern = re.compile(r'(\s*)(>)', re.IGNORECASE)
        
        # Link processing patterns
        self.link_href_pattern = re.compile(r'(<a\b[^>]*\shref\s*=\s*)(["\'])(.*?)\2', re.IGNORECASE | re.DOTALL)
        
        # URL patterns
        self.data_url_pattern = re.compile(r'^(?:[a-z0-9.+-]+:|//)', re.IGNORECASE)
        self.static_url_pattern = re.compile(r'^./static')
        
        # CSS minification patterns
        self.css_comment_pattern = re.compile(r'/\*.*?\*/', re.DOTALL)
        self.css_whitespace_pattern = re.compile(r'\s+')
        
        # JS minification patterns
        self.js_line_comment_pattern = re.compile(r'(?<!:)//.*?$', re.MULTILINE)
        self.js_block_comment_pattern = re.compile(r'/\*.*?\*/', re.DOTALL)
        self.js_whitespace_pattern = re.compile(r'\s+')
        
        # SVG pattern for detecting and replacing SVG elements containing images
        self.svg_pattern = re.compile(r'<svg[^>]*>.*?</svg>', re.DOTALL | re.IGNORECASE)
        
        # H1 to H2 conversion patterns
        self.h1_open_pattern = re.compile(r'<h1\b', re.IGNORECASE)
        self.h1_close_pattern = re.compile(r'</h1>', re.IGNORECASE)

    def _fix_fake_anchors(self, content):
        """
        Convert <a> tags without href attribute to <span> tags.
        This fixes styling issues where anchors are styled but don't link anywhere.
        """
        # Optimized regex approach:
        # 1. Replace opening <a ...> that has no href with <span ...>
        # We look for <a followed by anything that doesn't contain "href=" or "href =" until the closing >
        # This is a bit complex to do perfectly with regex, but we can approximate safely.
        
        # Pattern: <a (attributes without href) >
        # We use a negative lookahead to ensure 'href' is not in the attributes
        
        # Note: If selectolax is used, this method might not be needed or called on already fixed content.
        # But we keep it for the regex fallback path.
        
        def replace_tag(match):
            tag = match.group(0)
            if 'href=' in tag.lower() or 'href =' in tag.lower():
                return tag
            return tag.replace('<a', '<span', 1).replace('<A', '<span', 1)
            
        # Replace opening tags
        content = re.sub(r'<a\b[^>]*>', replace_tag, content, flags=re.IGNORECASE)
        
        # For closing tags, we can't easily know which one matches a converted <span> vs a real <a>.
        # However, standard HTML parsers/browsers are lenient. 
        # If we have nested <a> tags (invalid), this is hard.
        # But for valid HTML, we can try to match pairs.
        
        # Actually, the previous token-based approach was robust but slow.
        # Let's stick to the token-based approach but optimize it slightly
        # or rely on selectolax which we enabled.
        
        # If we are here, it means we are likely using the regex extraction method.
        # Let's use a simplified regex replacement that assumes no nested anchors.
        
        # Find all <a> tags without href and replace them and their closing tags?
        # No, that's hard.
        
        # Let's keep the token approach but optimize the split/join
        # It's actually not that slow compared to parsing.
        
        # Tokenize by anchor tags
        tokens = re.split(r'(</?a\b[^>]*>)', content, flags=re.IGNORECASE)
        
        result = []
        stack = [] 
        
        for token in tokens:
            if not token: continue
            
            if token.lower().startswith('<a'):
                if 'href' in token.lower():
                    result.append(token)
                    stack.append(False)
                else:
                    result.append(token.replace('<a', '<span', 1).replace('<A', '<span', 1))
                    stack.append(True)
            elif token.lower().startswith('</a'):
                if stack:
                    if stack.pop():
                        result.append('</span>')
                    else:
                        result.append(token)
                else:
                    result.append(token)
            else:
                result.append(token)
                
        return "".join(result)

    def _process_content_file(self, content_file_info, extract_dir, path_mapping, metadata=None, image_metadata=None):
        """Process a single content file and return the processed content."""
        i, content_file_path = content_file_info
        try:
            with open(content_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            body_content = self.extract_body_content(content)
            
            # For the first page, replace any SVG elements with image references with the correct cover image
            # This ensures that incorrect SVG cover images are replaced with the proper <img> tag
            if i == 1:
                # Compile href pattern once
                href_pattern = re.compile(r'(href|xlink:href)\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)
                
                # Find the new cover image path from mapping
                cover_img_src = "./cover.avif" # Fallback
                if metadata and 'actual_cover_file_path' in metadata:
                    actual_cover = metadata['actual_cover_file_path']
                    if actual_cover:
                        try:
                            # Try to find the cover in path_mapping
                            # We need to look up by relative path or filename
                            # Since we don't have easy access to extract_dir here to calculate relative path exactly as in processor
                            # We'll try to find it by filename in the mapping values or keys
                            
                            # Better approach: The path_mapping keys are relative paths.
                            # We can try to match the filename.
                            cover_path = Path(actual_cover)
                            cover_name = cover_path.name
                            
                            # Look for the cover in the mapping
                            for key, value in path_mapping.items():
                                if Path(key).name == cover_name:
                                    cover_img_src = value
                                    break
                        except Exception as e:
                            print(f"    Warning: Error finding cover image in mapping: {e}")

                def replace_svg_with_cover(match):
                    svg_content = match.group(0)
                    # Only replace SVGs that contain an <image> element with a non-data URL reference
                    # This targets SVG cover images specifically
                    if '<image' in svg_content.lower():
                        # Check if there's an xlink:href or href with a non-data URL
                        has_non_data_image = False
                        matches = href_pattern.findall(svg_content)
                        for attr_name, href_value in matches:
                            if href_value and not href_value.startswith('data:'):
                                has_non_data_image = True
                                break
                        
                        if has_non_data_image:
                            return f'<img alt="Cover" class="CoverImage" id="CoverImage" src="{cover_img_src}" loading="eager" fetchpriority="high" decoding="async">'
                    
                    # If no image element or it's a data URL, return the original SVG
                    return svg_content
                
                body_content = self.svg_pattern.sub(replace_svg_with_cover, body_content)

            def replace_img_src_in_chapter(match):
                tag_start = match.group(1)
                quote = match.group(2)
                src_val = match.group(3)
                src = unquote(src_val)
                
                if src.startswith('data:') or self.data_url_pattern.match(src):
                    return match.group(0)

                # Check if this is the cover image - improved detection
                is_cover = False
                if metadata and 'actual_cover_file_path' in metadata:
                    actual_cover = metadata['actual_cover_file_path']
                    if actual_cover:
                        try:
                            cover_path = Path(actual_cover)
                            cover_name = cover_path.name
                            cover_stem = cover_path.stem
                            
                            # Multiple ways to match the cover image
                            src_path = Path(src)
                            src_name = src_path.name
                            src_stem = src_path.stem
                            
                            # Check various matching criteria
                            if (src.endswith(cover_name) or 
                                src == cover_name or 
                                cover_name in src or
                                src_name == cover_name or
                                src_stem == cover_stem or
                                'cover' in src.lower() and 'cover' in cover_name.lower()):
                                is_cover = True
                        except Exception as e:
                            print(f"    Warning: Error checking cover image match: {e}")

                # Try multiple methods to find the image in the mapping
                new_src = None
                
                # Method 1: Try with full path resolution
                try:
                    content_dir = content_file_path.parent
                    abs_img_path = (content_dir / src).resolve()
                    relative_to_extract_dir = abs_img_path.relative_to(extract_dir).as_posix()
                    new_src = path_mapping.get(relative_to_extract_dir)
                except Exception:
                    pass
                
                # Method 2: Try with the src as-is (for paths like ../Images/Cover.jpg)
                if not new_src:
                    new_src = path_mapping.get(src)
                
                # Method 3: Try with just the filename
                if not new_src:
                    new_src = path_mapping.get(Path(src).name)
                
                # Method 4: Try with normalized path (handle Windows/Unix differences)
                if not new_src:
                    normalized_src = src.replace('\\', '/').replace('..\\', '../').replace('..//', '../')
                    new_src = path_mapping.get(normalized_src)
                
                # Method 5: Try with just the stem (filename without extension)
                if not new_src:
                    new_src = path_mapping.get(Path(src).stem)
                
                # Method 6: Try case-insensitive matching
                if not new_src:
                    src_lower = src.lower()
                    for key, value in path_mapping.items():
                        if key.lower() == src_lower:
                            new_src = value
                            break
                
                # Method 7: Try partial matching for complex paths
                if not new_src:
                    src_parts = Path(src).parts
                    for key, value in path_mapping.items():
                        key_parts = Path(key).parts
                        if src_parts[-1] in key_parts:  # Last part matches
                            new_src = value
                            break
                
                # Use original src if still not found
                if not new_src:
                    print(f"    Warning: Could not find mapping for image: {src}, using original path")
                    new_src = src

                return f'{tag_start}{quote}{new_src}{quote}'

            def replace_img_tags(match):
                """Replace image src and set alt attribute to filename"""
                full_img_tag = match.group(0)
                    
                # Check if loading attribute already exists
                has_loading = 'loading=' in full_img_tag.lower()
                
                # Replace src attribute first
                replaced_tag = self.img_src_pattern.sub(replace_img_src_in_chapter, full_img_tag)
                
                # Extract the new image src to get filename for alt
                src_match = self.img_src_extract_pattern.search(replaced_tag)
                if src_match:
                    image_path = src_match.group(1)
                    image_name = Path(image_path).stem  # Get filename without extension
                    
                    # Remove existing alt attribute if present
                    alt_match = self.img_alt_pattern.search(replaced_tag)
                    if alt_match:
                        # Remove the existing alt attribute
                        replaced_tag = replaced_tag[:alt_match.start()] + replaced_tag[alt_match.end():]
                    
                    # Add new alt attribute with filename before the closing > or />
                    if replaced_tag.endswith('/>'):
                        replaced_tag = replaced_tag[:-2] + f' alt="{image_name}" />'
                    elif replaced_tag.endswith('>'):
                        replaced_tag = replaced_tag[:-1] + f' alt="{image_name}">'
                
                # Add appropriate loading attribute if not already present
                if not has_loading:
                    # Check if this is the cover image
                    src_match = self.img_src_extract_pattern.search(replaced_tag)
                    if src_match:
                        image_path = src_match.group(1)
                        is_cover_image = False
                        
                        # Check for explicit ID or class indicating cover
                        # The user reported id="coverimage"
                        if 'id="coverimage"' in full_img_tag.lower() or 'class="coverimage"' in full_img_tag.lower() or 'class="cover"' in full_img_tag.lower():
                            is_cover_image = True
                        
                        # Check if it matches the actual cover file path
                        if not is_cover_image and metadata and 'actual_cover_file_path' in metadata:
                            actual_cover = metadata['actual_cover_file_path']
                            if actual_cover:
                                try:
                                    cover_path = Path(actual_cover)
                                    cover_name = cover_path.name
                                    
                                    # Look for the cover image path in the mapping
                                    cover_mapped_path = None
                                    for key, value in path_mapping.items():
                                        if Path(key).name == cover_name:
                                            cover_mapped_path = value
                                            break
                                    
                                    if cover_mapped_path and (image_path == cover_mapped_path or image_path.endswith(cover_mapped_path)):
                                        is_cover_image = True
                                    
                                    # Fallback: check if 'cover' is in the name
                                    if not is_cover_image and ('cover' in image_path.lower() or 'cover' in cover_name.lower()):
                                        is_cover_image = True
                                        
                                except Exception as e:
                                    print(f"    Warning: Error in cover image replacement: {e}")
                        
                        if is_cover_image:
                            # Cover image should be eager-loaded for LCP
                            # Also ensure fetchpriority="high" is added
                            if replaced_tag.endswith('/>'):
                                replaced_tag = replaced_tag[:-2] + ' loading="eager" fetchpriority="high" decoding="async" />'
                            else:
                                replaced_tag = replaced_tag[:-1] + ' loading="eager" fetchpriority="high" decoding="async">'
                        else:
                            # Other images should be lazy-loaded
                            if replaced_tag.endswith('/>'):
                                replaced_tag = replaced_tag[:-2] + ' loading="lazy" decoding="async" />'
                            else:
                                replaced_tag = replaced_tag[:-1] + ' loading="lazy" decoding="async">'
                    else:
                        # Fallback to lazy loading if we can't determine the image
                        if replaced_tag.endswith('/>'):
                            replaced_tag = replaced_tag[:-2] + ' loading="lazy" decoding="async" />'
                        else:
                            replaced_tag = replaced_tag[:-1] + ' loading="lazy" decoding="async">'
                
                # Add width and height attributes if available in metadata
                # This helps prevent layout shifts (CLS)
                if image_metadata:
                    # Extract the new src to look up metadata
                    src_match = self.img_src_extract_pattern.search(replaced_tag)
                    if src_match:
                        new_src = src_match.group(1)
                        img_info = image_metadata.get(new_src)
                        
                        # If not found by exact path, try filename matching
                        if not img_info:
                            new_src_name = Path(new_src).name
                            for key, info in image_metadata.items():
                                if Path(key).name == new_src_name:
                                    img_info = info
                                    break
                        
                        if img_info and 'width' in img_info and 'height' in img_info:
                            width = img_info['width']
                            height = img_info['height']
                            
                            # Check if width/height already exist
                            has_width = 'width=' in replaced_tag.lower()
                            has_height = 'height=' in replaced_tag.lower()
                            
                            if not has_width and not has_height:
                                # Add dimensions
                                if replaced_tag.endswith('/>'):
                                    replaced_tag = replaced_tag[:-2] + f' width="{width}" height="{height}" />'
                                else:
                                    replaced_tag = replaced_tag[:-1] + f' width="{width}" height="{height}">'

                return replaced_tag

            # Always process images in content to fix paths (even if --no-image flag is set)
            # This ensures the HTML has the correct image references whether images are converted or not
            body_content = self.img_tag_pattern.sub(replace_img_tags, body_content)
            
            # Convert all h1 tags to h2 tags so the series title h1 in the template is the only h1
            body_content = self.h1_open_pattern.sub('<h2', body_content)
            body_content = self.h1_close_pattern.sub('</h2>', body_content)

            result = f'''<div class="chapter" id="page{i:02d}">
{body_content}
</div>'''
            
            # DEBUG: Check for malformed spans
            if '<span ' in result and 'xmlns=' not in result:
                # Check if it's actually malformed (has <span  followed by text without >)
                import re as debug_re
                malformed = debug_re.findall(r'<span\s+[^<>]{10,50}', result)
                if malformed:
                    print(f"DEBUG WARNING: Page {i} has {len(malformed)} potentially malformed spans")
                    print(f"Example: {malformed[0][:80]}")
            
            # Fix malformed spans where > is missing after <span
            # This handles cases like <span Text... -> <span>Text...
            # We look for <span followed by whitespace and then non-attribute text
            result = re.sub(r'<span\s+(?![a-zA-Z0-9_:-]+=)([^>]+?)', r'<span>\1', result)
            
            # Fix fake anchors (<a> without href) by converting them to <span>
            result = self._fix_fake_anchors(result)
            
            return result
        except Exception as e:
            print(f"    Warning: Could not read {content_file_path.name}: {e}")
            return None

    def combine_and_generate_html(self, content_files, extract_dir, metadata, path_mapping, custom_css=None, image_metadata=None):
        """Combine content files, embed images as base64, and generate the final HTML with UI using parallel processing."""
        print(f"  Combining {len(content_files)} content files in reading order:")
        
        if len(content_files) <= 3:  # For small numbers of files, process sequentially
            combined_body = []
            for i, (_, content_file_path) in enumerate(content_files, 1):
                print(f"    {i}. {content_file_path.name}")
                result = self._process_content_file((i, content_file_path), extract_dir, path_mapping, metadata, image_metadata)
                if result:
                    combined_body.append(result)
        else:  # For larger numbers of files, use parallel processing
            print(f"  Processing {len(content_files)} content files in parallel...")
            combined_body = []
            
            # Use a higher worker limit for content processing, scaling with CPU
            # Default to at least 32 workers, or 4x CPU count
            max_workers = max(32, (os.cpu_count() or 4) * 4)
            
            with ThreadPoolExecutor(max_workers=min(len(content_files), max_workers)) as executor:
                # Submit all content file processing tasks
                future_to_file = {
                    executor.submit(self._process_content_file, (i, content_file_path), extract_dir, path_mapping, metadata, image_metadata): (i, content_file_path)
                    for i, (_, content_file_path) in enumerate(content_files, 1)
                }
                
                # Process completed tasks as they finish
                results = {}
                for future in as_completed(future_to_file):
                    i, content_file_path = future_to_file[future]
                    try:
                        result = future.result()
                        if result:
                            results[i] = result
                            # print(f"    {i}. {content_file_path.name}") # Reduce spam
                    except Exception as e:
                        print(f"    Warning: Could not process {content_file_path.name}: {e}")
                
                # Sort results by chapter number to maintain order
                combined_body = [results[i] for i in sorted(results.keys())]

        final_html = self.get_html_template(
            title=metadata.get('title', 'EPUB Content'),
            body_content='\n<hr class="chapter-separator">\n'.join(combined_body),
            metadata=metadata,
            custom_css=custom_css
        )
        return final_html

    def extract_body_content(self, content):
        """Extract and clean body content from HTML/XHTML.
        
        Prioritizes Regex for robustness as selectolax can sometimes return empty/malformed 
        content for certain XHTML structures (e.g. namespaced tags).
        """
        # Try Regex first as it is most robust for preserving inner HTML content
        result = self._extract_body_content_regex(content)
        
        # If Regex returns empty but input is large, try Selectolax as fallback
        # Re-enabled Selectolax for performance
        if (not result or len(result) < 10) and len(content) > 100 and HAS_SELECTOLAX:
             # print("    Info: Regex extraction empty, trying selectolax fallback...")
             return self._extract_body_content_selectolax(content)
            
        return result

    def _extract_body_content_selectolax(self, content):
        """Extract body content using selectolax (fastest HTML parser)."""
        try:
            tree = HTMLParser(content)
            
            # Optimization: Fix fake anchors directly in the tree if we're using selectolax
            # This is much faster than regex or string manipulation later
            for node in tree.css('a:not([href])'):
                node.tag = 'span'
                
            body_element = tree.css_first('body')
            if body_element:
                # Use .html to preserve inner HTML including attributes
                result = body_element.html
                # Check if result is suspiciously empty (e.g. just <body></body>)
                if result and len(result) < 30 and len(content) > 100:
                    return self._extract_body_content_regex(content)
                
                # Strip the <body> tags themselves if included (selectolax .html usually includes the tag)
                if result.startswith('<body') or result.startswith('<BODY'):
                    # Find first >
                    idx = result.find('>')
                    if idx != -1:
                        result = result[idx+1:]
                    # Remove closing </body>
                    if result.endswith('</body>') or result.endswith('</BODY>'):
                        result = result[:-7]
                        
                return result
            else:
                # Fallback to html element
                html_element = tree.css_first('html')
                if html_element:
                    # Remove head element if present
                    head_element = html_element.css_first('head')
                    if head_element:
                        head_element.remove()
                    return html_element.html
                else:
                    return content
        except Exception as e:
            print(f"Warning: selectolax parsing failed, falling back to regex: {e}")
            return self._extract_body_content_regex(content)

    def _extract_body_content_regex(self, content):
        """Extract body content using regex patterns (fallback method)."""
        body_match = self.body_pattern.search(content)
        if body_match:
            body_content = body_match.group(1)
        else:
            html_match = self.html_pattern.search(content)
            if html_match:
                html_content = self.head_pattern.sub('', html_match.group(1))
                body_content = html_content
            else:
                body_content = content
        
        body_content = self.xml_declaration_pattern.sub('', body_content.strip())
        body_content = self.doctype_pattern.sub('', body_content)
        return body_content

    def _map_toc_to_chapters(self, toc, content_id_mapping):
        """Map TOC entries to correct chapter IDs based on content file mapping.
        Filtered TOC items (like Copyright, Yen Press) are removed from the TOC."""
        def process_toc_item(item):
            if 'href' in item:
                original_href = item['href']
                
                # Extract file path from href (remove any existing fragments)
                if '#' in original_href:
                    file_path, fragment = original_href.split('#', 1)
                else:
                    file_path = original_href
                    fragment = None
            
            # Try to find matching chapter ID
            chapter_id = None
            
            # Try exact match first
            if file_path in content_id_mapping:
                chapter_id = content_id_mapping[file_path]
            else:
                # Try with just filename
                filename = Path(file_path).name
                if filename in content_id_mapping:
                    chapter_id = content_id_mapping[filename]
                # Try with URL decoded path
                elif unquote(file_path) in content_id_mapping:
                    chapter_id = content_id_mapping[unquote(file_path)]
            
            # If still not found, try fuzzy matching
            if not chapter_id:
                chapter_id = self._find_closest_chapter_match(file_path, content_id_mapping)
            
            if chapter_id:
                # User requested to map strictly to #page{pagenumber} to ensure app navigation works
                # We ignore fragments (like #link_006) which might be broken or cause issues
                item['href'] = f"#{chapter_id}"
                if fragment:
                    print(f"    Mapped TOC (ignoring fragment #{fragment}): {item['label']} -> {item['href']}")
                else:
                    print(f"    Mapped TOC: {item['label']} -> {item['href']}")
                
                # Process children recursively
                if 'children' in item:
                    children = [process_toc_item(child) for child in item['children']]
                    # Filter out None values (filtered children)
                    item['children'] = [child for child in children if child is not None]
                
                return item
            else:
                # This TOC entry was filtered out (e.g., Copyright, Yen Press)
                # Return None to indicate it should be removed from TOC
                print(f"    Filtered TOC entry: {item['label']} ({original_href})")
                return None
        
        # Process all TOC items and filter out None values (filtered items)
        mapped_toc = [process_toc_item(item) for item in toc]
        return [item for item in mapped_toc if item is not None]

    def _find_closest_chapter_match(self, file_path, content_id_mapping):
        """Find the closest matching chapter for a file path."""
        filename = Path(file_path).name.lower()
        stem = Path(file_path).stem.lower()
        
        # Look for partial matches in the mapping keys
        for key, chapter_id in content_id_mapping.items():
            key_lower = key.lower()
            if (filename in key_lower or 
                stem in key_lower or 
                key_lower in filename or 
                key_lower in stem):
                return chapter_id
        
        return None

    def _minify_css(self, css_content):
        """Minify CSS using rcssmin library."""
        try:
            import rcssmin
            return rcssmin.cssmin(css_content)
        except ImportError:
            # Fallback to simple minification if rcssmin not available
            # Remove comments
            css_content = self.css_comment_pattern.sub('', css_content)
            # Remove whitespace around braces and colons
            css_content = re.sub(r'\s*([{}:;,])\s*', r'\1', css_content)
            # Remove remaining whitespace
            css_content = self.css_whitespace_pattern.sub(' ', css_content)
            return css_content.strip()

    def _minify_js(self, js_content):
        """Minify JavaScript using rjsmin library."""
        minified = ""
        try:
            import rjsmin
            minified = rjsmin.jsmin(js_content)
        except ImportError:
            # Fallback to simple minification if rjsmin not available
            # Remove line comments
            js_content = self.js_line_comment_pattern.sub('', js_content)
            # Remove block comments
            js_content = self.js_block_comment_pattern.sub('', js_content)
            # Remove whitespace around operators and punctuation
            js_content = re.sub(r'\s*([=+\-*/(){}\[\],;])\s*', r'\1', js_content)
            # Remove remaining whitespace
            minified = self.js_whitespace_pattern.sub(' ', js_content)

        # Ensure it is strictly one line regardless of method used
        return minified.replace('\n', ' ').replace('\r', ' ').strip()

    def fix_links_and_images(self, html_content, content_id_mapping):
        """Fix all internal anchor href paths and remove unwanted links."""
        
        def replace_a_href(match):
            tag_start = match.group(1)
            quote = match.group(2)
            href_val = match.group(3)

            href = unquote(href_val)

            # 1. Remove external links (http, https, mailto, ftp)
            if href.lower().startswith(('http:', 'https:', 'mailto:', 'ftp:')):
                # Strip the href attribute but keep the tag (as <a> without href)
                # This preserves other attributes and the closing </a>
                # tag_start ends with "href=", so we strip it
                cleaned_tag = tag_start.rsplit('href=', 1)[0].strip()
                return cleaned_tag

            if self.data_url_pattern.match(href) or self.static_url_pattern.match(href):
                return match.group(0)

            file_part, fragment = (href.split('#', 1) + [''])[:2]

            new_href = None
            
            # 2. Resolve internal links
            if not file_part and fragment:
                # Local fragment (same page)
                # We only keep it if it looks like a chapter link or if we decide to be lenient.
                # But user explicitly asked to remove things like #toc-appendix001.
                # Since we can't easily validate local fragments against the chapter list (which relies on filenames),
                # we will be aggressive and remove them unless we can verify them.
                # Actually, let's check if the fragment matches any of our mapped chapter IDs.
                # Our IDs are usually like 'page01', 'chapter01'.
                # If the fragment is in our values, keep it.
                if any(fragment == val for val in content_id_mapping.values()):
                     new_href = f'#{fragment}'
                else:
                     # Unverified local fragment - remove it
                     pass
            elif file_part:
                # Link to another file
                mapped_chapter_id = content_id_mapping.get(file_part) or content_id_mapping.get(Path(file_part).name)
                if mapped_chapter_id:
                    new_href = f'#{mapped_chapter_id}'
            
            if new_href:
                return f'{tag_start}{quote}{new_href}{quote}'
            else:
                # Remove link (strip href)
                cleaned_tag = tag_start.rsplit('href=', 1)[0].strip()
                return cleaned_tag

        html_content = self.link_href_pattern.sub(replace_a_href, html_content)
        
        # Cleanup: The above replaces <a href="..."> with <span ...>. 
        # But we still have closing </a> tags. We need to replace those with </span> 
        # WHERE we changed the opening tag. 
        # Since we can't easily track which ones we changed with a single regex pass over the whole file 
        # (nested tags etc), a safer approach for the "span conversion" might be needed.
        # 
        # Alternative: Just remove the href attribute but keep <a>. 
        # Browsers treat <a> without href as a placeholder/anchor, not a link.
        # This is safer for DOM structure.
        
        return html_content

    def _generate_expected_path_mapping(self, extract_dir, content_files, epub_output_folder, metadata=None):
        """Generate image path mapping without processing images, mirroring ImageProcessor naming.
        Ensures identical HTML paths in --no-image and normal modes.
        Also extracts image dimensions for layout stability.
        """
        # from .image import crc64  # REMOVED: crc64 is no longer used
        path_mapping = {}
        image_metadata = {}

        # Title-based sanitization for sequential naming
        epub_title = (metadata or {}).get('title', 'Unknown') or 'Unknown'
        sanitized_title = epub_title.lower().replace(' ', '').replace('-', '').replace('_', '')
        sanitized_title = ''.join(c for c in sanitized_title if c.isalnum())
        if len(sanitized_title) > 50:
            sanitized_title = sanitized_title[:50]
        if not sanitized_title:
            sanitized_title = "Image"

        # Build ordered, de-duplicated list of referenced images (reading order)
        ordered_images = []  # store tuples (relative_to_extract_dir, original_src, filename)
        seen = set()

        for _, content_path in content_files:
            try:
                with open(content_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                img_matches = self.img_src_extract_pattern.findall(content)
                for img_src in img_matches:
                    if img_src.startswith('data:') or self.data_url_pattern.match(img_src):
                        continue
                    try:
                        abs_img_path = (content_path.parent / unquote(img_src)).resolve()
                        rel = abs_img_path.relative_to(extract_dir).as_posix()
                    except Exception:
                        # Fallback: just use the src as-is
                        rel = img_src
                    if rel not in seen:
                        seen.add(rel)
                        ordered_images.append((rel, img_src, Path(img_src).name, abs_img_path))
            except Exception:
                continue

        # Determine cover image similar to normal path
        cover_rel = None
        # 1) From metadata
        cover_meta = (metadata or {}).get('cover_image_path')
        if cover_meta:
            try:
                abs_cover = (extract_dir / Path(cover_meta)).resolve()
                cover_rel = abs_cover.relative_to(extract_dir).as_posix()
            except Exception:
                cover_rel = None
        # 2) First actual image in the first content file
        if not cover_rel and content_files:
            try:
                first_content_path = content_files[0][1]
                with open(first_content_path, 'r', encoding='utf-8', errors='ignore') as f:
                    first_content = f.read()
                first_imgs = self.img_src_extract_pattern.findall(first_content)
                for img_src in first_imgs:
                    if img_src.startswith('data:') or self.data_url_pattern.match(img_src):
                        continue
                    abs_img_path = (first_content_path.parent / unquote(img_src)).resolve()
                    cover_rel = abs_img_path.relative_to(extract_dir).as_posix()
                    break
            except Exception:
                pass

        # Map images: cover -> {sanitized_novel_name}{index}.avif
        # IMPORTANT: Normal mode (ImageProcessor) does NOT special-case the cover filename.
        # It uses the same naming scheme for all images.
        # We must match that behavior here.
        
        epub_title = metadata.get('title')
        if epub_title:
            # Create sanitized EPUB title
            sanitized_title = epub_title.lower().replace(' ', '').replace('-', '').replace('_', '')
            sanitized_title = ''.join(c for c in sanitized_title if c.isalnum())
            if len(sanitized_title) > 50:
                sanitized_title = sanitized_title[:50]
        else:
            sanitized_title = "Image"
            
        image_index = 1

        for rel, original_src, filename, abs_path in ordered_images:
            # Determine if this is the cover image
            is_cover = False
            if cover_rel and rel == cover_rel:
                is_cover = True

            # Generate sequential filename: {sanitized_title}{index:02d}.avif
            output_filename = f"{sanitized_title}{image_index:02d}.avif"
            html_path = f"/images/{output_filename}"
            
            # If it's cover, store the filename for metadata update
            if is_cover:
                self._detected_cover_filename = output_filename

            path_mapping[rel] = html_path
            path_mapping[filename] = html_path
            path_mapping[original_src] = html_path
            if '/' in rel:
                path_mapping[f"../{rel}"] = html_path
                path_mapping[f"{rel}"] = html_path
            path_mapping[f"./{rel}"] = html_path
            
            # Extract dimensions
            try:
                width, height = self.image_processor.get_image_dimensions(abs_path)
                if width and height:
                    image_metadata[html_path] = {
                        'width': width,
                        'height': height
                    }
            except Exception as e:
                print(f"    Warning: Could not get dimensions for {filename}: {e}")
            
            image_index += 1

        return path_mapping, image_metadata

    def convert_single_epub(self, epub_path):
        """Convert a single EPUB file"""
        print(f"Converting {epub_path.name}...")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            self.temp_dir = Path(temp_dir)
            parser = EPUBParser(self.temp_dir)
            extract_dir = self.temp_dir / "extracted"
            extract_dir.mkdir()
            parser.extract_epub(epub_path, extract_dir)
            
            opf_file = parser.find_opf_file(extract_dir)
            
            # Always create output folder next to the EPUB file
            # Strip trailing spaces and other problematic characters
            epub_stem = epub_path.stem.strip()
            epub_output_folder = epub_path.parent / epub_stem
            
            epub_output_folder.mkdir(exist_ok=True)
            print(f"  Output will be saved to: {epub_output_folder}/")

            toc, metadata, filtered_hrefs = parser.find_and_parse_toc(opf_file, extract_dir)
            content_files = parser.find_content_files(opf_file, extract_dir, filtered_hrefs)
            
            # Skip image processing if --no-image flag is set
            if self.no_image:
                print(f"  Skipping image processing (--no-image mode)")
                # Generate expected path mapping without processing images
                self._detected_cover_filename = None # Reset
                path_mapping, image_metadata = self._generate_expected_path_mapping(extract_dir, content_files, epub_output_folder, metadata)
                
                # Set cover_image_url to the detected cover filename or default
                # In normal mode, the cover is also hashed (e.g. HASH_A.avif).
                # We want to match that.
                
                if getattr(self, '_detected_cover_filename', None):
                     metadata['cover_image_url'] = f"/images/{self._detected_cover_filename}"
                else:
                     metadata['cover_image_url'] = "" # No cover found

                metadata['actual_cover_file_path'] = None
            else:
                all_image_files = self.image_processor.find_images(extract_dir)
                # Filter images to only those from content files
                image_files = self.image_processor.filter_images_by_content(all_image_files, content_files)

                # Detect cover image before processing
                actual_cover_file_path = None
                
                # Method 1: Try metadata cover_image_path first
                if metadata.get('cover_image_path'):
                    potential_cover_abs_path = (extract_dir / Path(metadata['cover_image_path'])).resolve()
                    if potential_cover_abs_path.exists():
                        actual_cover_file_path = potential_cover_abs_path
                        print(f"  Found cover image from metadata: {actual_cover_file_path.name}")

                # Method 2: If no metadata cover, find first image in first content file
                if not actual_cover_file_path and content_files:
                    first_content_file_path = content_files[0][1]
                    try:
                        with open(first_content_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            first_page_content = f.read()
                        
                        # Find all images in the first content file
                        img_matches = re.findall(r'<img[^>]+src=["\']([^"\\]+)["\\]', first_page_content, re.IGNORECASE)
                        for img_src in img_matches:
                            if img_src.startswith('data:'):
                                continue
                            first_content_file_dir = first_content_file_path.parent
                            try:
                                abs_img_path = (first_content_file_dir / unquote(img_src)).resolve()
                                if abs_img_path.exists() and abs_img_path.is_file():
                                    actual_cover_file_path = abs_img_path
                                    print(f"  Found cover image from first content file: {actual_cover_file_path.name}")
                                    break
                            except Exception:
                                continue
                    except Exception as e:
                        print(f"  Error reading first content file for cover image detection: {e}")

                # Method 3: If still no cover found, use the first image from all images
                if not actual_cover_file_path and all_image_files:
                    # Sort images by path to ensure consistent ordering
                    sorted_images = sorted(all_image_files)
                    actual_cover_file_path = sorted_images[0]
                    print(f"  Using first available image as cover: {actual_cover_file_path.name}")

                # Process images with EPUB title and cover image path
                epub_title = metadata.get('title', 'Unknown')
                
                # Determine where to save images (central folder for directory mode, local images folder for single file)
                if self.central_images_folder:
                    images_output_folder = self.central_images_folder
                    is_directory_mode = True
                else:
                    # Create local images folder for single file mode
                    images_output_folder = epub_output_folder / "images"
                    images_output_folder.mkdir(exist_ok=True)
                    is_directory_mode = False
                
                path_mapping, image_metadata = self.image_processor.process_images_and_get_mapping(
                    image_files, extract_dir, epub_output_folder, epub_title, actual_cover_file_path,
                    central_images_folder=images_output_folder, is_directory_mode=is_directory_mode
                )

                # Determine cover image URL from mapping
                cover_image_url = "./cover.avif" # Default fallback
                if actual_cover_file_path:
                    try:
                        # Try to find the cover in the path mapping
                        # We need the relative path from extract_dir
                        rel_cover_path = actual_cover_file_path.relative_to(extract_dir).as_posix()
                        if rel_cover_path in path_mapping:
                            cover_image_url = path_mapping[rel_cover_path]
                        else:
                            # Try filename match
                            cover_name = actual_cover_file_path.name
                            if cover_name in path_mapping:
                                cover_image_url = path_mapping[cover_name]
                    except Exception as e:
                        print(f"  Warning: Error mapping cover image URL: {e}")
                
                metadata['cover_image_url'] = cover_image_url
                # Store the actual cover file path as a string to pass to image processing
                if actual_cover_file_path:
                    metadata['actual_cover_file_path'] = str(actual_cover_file_path)
            metadata['epub_filename'] = epub_path.name
            # Also provide the base filename (without extension) and a URL-safe variant for template use
            try:
                epub_base = epub_path.stem.strip()
            except Exception:
                epub_base = str(epub_path).rsplit('.', 1)[0].strip()
            metadata['epub_filename_base'] = epub_base
            metadata['epub_filename_base_url'] = quote(epub_base, safe='')
            # CDN covers translate apostrophes to underscores; handle both straight and curly apostrophes
            try:
                cdn_base = epub_base.replace("'", "_").replace("’", "_")
            except Exception:
                cdn_base = epub_base
            metadata['epub_filename_cdn_base_url'] = quote(cdn_base, safe='')

            if not toc:
                toc = parser.generate_basic_toc(content_files, extract_dir)
            
            metadata['toc'] = toc

            content_id_mapping = {}
            for i, (_, content_file) in enumerate(content_files, 1):
                chapter_id = f"page{i:02d}"
                relative_path = unquote(content_file.relative_to(extract_dir).as_posix())
                content_id_mapping[relative_path] = chapter_id
                content_id_mapping[content_file.name] = chapter_id
                # Also map common path variations
                content_id_mapping[content_file.stem] = chapter_id
                content_id_mapping[f"Text/{content_file.name}"] = chapter_id
                content_id_mapping[f"OEBPS/{content_file.name}"] = chapter_id
            
            # Process TOC entries to map them to correct chapter IDs
            if toc:
                toc = self._map_toc_to_chapters(toc, content_id_mapping)
                metadata['toc'] = toc
            
            metadata['content_id_mapping'] = content_id_mapping

            custom_css = None
            if self.custom_css_path:
                try:
                    with open(self.custom_css_path, 'r', encoding='utf-8') as f:
                        custom_css = f.read()
                except Exception as e:
                    print(f"  Warning: Could not read custom CSS file: {e}")

            combined_html = self.combine_and_generate_html(content_files, extract_dir, metadata, path_mapping, custom_css, image_metadata=locals().get('image_metadata'))
            final_html = self.fix_links_and_images(combined_html, content_id_mapping)
            
            output_html = epub_output_folder / "index.html"
            with open(output_html, 'w', encoding='utf-8') as f:
                f.write(final_html)

            # Handle static files based on --no-script flag and mode
            # Only create static folder if not in directory mode (where it's created at root)
            if hasattr(self, 'central_static_folder') and self.central_static_folder:
                # Directory mode: static files are at root, no need to copy
                print(f"  Using root-level static files at {self.central_static_folder}/")
            elif not self.no_script:
                # Single file mode: create local static folder
                assets_folder = Path(__file__).parent / "assets"
                output_static_folder = epub_output_folder / "static"
                
                # Remove existing static folder if it exists (clean up from previous runs)
                if output_static_folder.exists():
                    shutil.rmtree(output_static_folder)
                
                output_static_folder.mkdir(exist_ok=True)
                
                # Copy and minify CSS file
                css_source = assets_folder / "style.css"
                css_dest = output_static_folder / "style.css"
                if css_source.exists():
                    with open(css_source, 'r', encoding='utf-8') as f:
                        css_content = f.read()
                    minified_css = self._minify_css(css_content)
                    with open(css_dest, 'w', encoding='utf-8') as f:
                        f.write(minified_css)
                    print(f"  Minified CSS: {len(css_content)} -> {len(minified_css)} characters")
                
                # Copy and minify JS file
                js_source = assets_folder / "script.js"
                js_dest = output_static_folder / "script.js"
                if js_source.exists():
                    with open(js_source, 'r', encoding='utf-8') as f:
                        js_content = f.read()
                    minified_js = self._minify_js(js_content)
                    with open(js_dest, 'w', encoding='utf-8') as f:
                        f.write(minified_js)
                    print(f"  Minified JS: {len(js_content)} -> {len(minified_js)} characters")
            else:
                print(f"  Skipping static files (--no-script mode)")

            print(f"  Created: {output_html.resolve()}")

    def convert(self, max_workers=100):
        """Convert a single EPUB file or all EPUB files in a directory."""
        self._start_profiling()
        start_time = time.time()
        
        try:
            if self.epub_path.is_file():
                self.convert_single_epub(self.epub_path)
            elif self.epub_path.is_dir():
                epub_files = sorted(list(self.epub_path.rglob("*.epub")))
                if not epub_files:
                    print(f"No EPUB files found in {self.epub_path}")
                    return
                
                print(f"Found {len(epub_files)} EPUB files (searched recursively in all subdirectories)")
                
                # Show directory structure for better visibility
                epub_dirs = set(epub.parent for epub in epub_files)
                if len(epub_dirs) > 1:
                    print(f"  EPUBs found in {len(epub_dirs)} different directories:")
                    for epub_dir in sorted(epub_dirs):
                        count = sum(1 for epub in epub_files if epub.parent == epub_dir)
                        print(f"    {epub_dir}: {count} EPUB(s)")
                
                # Create central images folder for directory conversions
                if not self.no_image:
                    self.central_images_folder = self.epub_path / "images"
                    self.central_images_folder.mkdir(exist_ok=True)
                    print(f"  Using central images folder: {self.central_images_folder}/")
                
                # Create central static folder for directory conversions
                if not self.no_script:
                    self.central_static_folder = self.epub_path / "static"
                    self.central_static_folder.mkdir(exist_ok=True)
                    
                    # Copy static files only once at the root level
                    assets_folder = Path(__file__).parent / "assets"
                    
                    # Copy and minify CSS file (always overwrite to ensure freshness)
                    css_source = assets_folder / "style.css"
                    css_dest = self.central_static_folder / "style.css"
                    if css_source.exists():
                        with open(css_source, 'r', encoding='utf-8') as f:
                            css_content = f.read()
                        minified_css = self._minify_css(css_content)
                        with open(css_dest, 'w', encoding='utf-8') as f:
                            f.write(minified_css)
                        print(f"  Wrote root static CSS: {css_dest} ({len(css_content)} -> {len(minified_css)} chars)")
                    
                    # Copy and minify JS file (always overwrite to ensure freshness)
                    js_source = assets_folder / "script.js"
                    js_dest = self.central_static_folder / "script.js"
                    if js_source.exists():
                        with open(js_source, 'r', encoding='utf-8') as f:
                            js_content = f.read()
                        minified_js = self._minify_js(js_content)
                        with open(js_dest, 'w', encoding='utf-8') as f:
                            f.write(minified_js)
                        print(f"  Wrote root static JS: {js_dest} ({len(js_content)} -> {len(minified_js)} chars)")
                    print(f"  Using central static folder: {self.central_static_folder}/")
                
                # Use parallel processing for multiple EPUB files
                if len(epub_files) > 1:
                    self._convert_parallel(epub_files, max_workers)
                else:
                    # Single file, no need for parallel processing
                    try:
                        self.convert_single_epub(epub_files[0])
                    except Exception as e:
                        print(f"FATAL: Error converting {epub_files[0].name}: {e}")
                        import traceback
                        traceback.print_exc()
                
                total_time = time.time() - start_time
                print(f"\nConversion complete! Total time: {self._format_time(total_time)}")
                
                # Performance summary for large batches
                if len(epub_files) > 10:
                    avg_time = total_time / len(epub_files)
                    print(f"Performance Summary:")
                    print(f"   • Average time per EPUB: {self._format_time(avg_time)}")
                    print(f"   • Estimated time for 5000 EPUBs: {self._format_time(avg_time * 5000)}")
                    print(f"   • Throughput: {len(epub_files) / total_time:.1f} EPUBs/second")
                    
                    if self.free_threading:
                        print(f"   Free-threading enabled - optimal performance achieved!")
                    else:
                        print(f"   Upgrade to Python 3.13+ with free-threading for 5-10x better performance")
        finally:
            self._stop_profiling()

    def _convert_parallel(self, epub_files, max_workers):
        """Convert multiple EPUB files in parallel using optimal executor for threading mode."""
        executor_class = ThreadPoolExecutor if self.free_threading else ProcessPoolExecutor
        
        if self.free_threading:
            # With free-threading, we can use more threads efficiently
            optimal_workers = min(max_workers, len(epub_files), os.cpu_count() * 8)
            print(f"Using ThreadPoolExecutor with {optimal_workers} workers (free-threading enabled)")
        else:
            # With GIL, limit to CPU count to avoid overhead
            optimal_workers = min(max_workers, len(epub_files), os.cpu_count())
            print(f"Using ProcessPoolExecutor with {optimal_workers} workers (GIL-limited)")
        
        completed_count = 0
        failed_count = 0
        total_files = len(epub_files)
        start_time = time.time()
        
        with executor_class(max_workers=optimal_workers) as executor:
            # Submit all conversion tasks
            future_to_epub = {
                executor.submit(self._convert_single_with_error_handling, epub_file): epub_file 
                for epub_file in epub_files
            }
            
            # Process completed tasks as they finish
            for future in as_completed(future_to_epub):
                epub_file = future_to_epub[future]
                try:
                    result = future.result()
                    if result:
                        completed_count += 1
                        elapsed = time.time() - start_time
                        remaining_time = self._estimate_remaining_time(completed_count, total_files, start_time)
                        print(f"Completed ({completed_count}/{total_files}): {epub_file.name} | Elapsed: {self._format_time(elapsed)} | ETA: {remaining_time}")
                    else:
                        failed_count += 1
                        print(f"Failed ({failed_count} failures): {epub_file.name}")
                except Exception as e:
                    failed_count += 1
                    print(f"Failed ({failed_count} failures): {epub_file.name} - {e}")
        
        total_time = time.time() - start_time
        print(f"\nParallel conversion finished:")
        print(f"  Successfully converted: {completed_count}")
        print(f"  Failed conversions: {failed_count}")
        print(f"  Total files: {total_files}")
        print(f"  Total time: {self._format_time(total_time)}")
        print(f"  Average time per file: {self._format_time(total_time / total_files)}")
        
        if self.free_threading:
            print(f"  Free-threading performance: {completed_count / total_time:.1f} EPUBs/second")

    def _convert_single_with_error_handling(self, epub_file):
        """Convert a single EPUB file with proper error handling for parallel execution."""
        try:
            self.convert_single_epub(epub_file)
            return True
        except Exception as e:
            print(f"Error converting {epub_file.name}: {e}")
            import traceback
            traceback.print_exc()
            return False

    def get_html_template(self, title, body_content, metadata, custom_css=None):
        """Returns the complete HTML structure with embedded CSS and JS."""
        template = self.jinja_env.get_template("reader.html")
        
        # Sanitize metadata to remove sensitive information
        # Only include fields that are actually used by the frontend JavaScript
        sanitized_metadata = {
            'title': metadata.get('title'),
            'author': metadata.get('author'),
            'publisher': metadata.get('publisher'),
            'date': metadata.get('date'),
            'description': metadata.get('description'),
            'subject': metadata.get('subject', []),
            'language': metadata.get('language'),
            'cover_image_url': metadata.get('cover_image_url'),
            'epub_filename': metadata.get('epub_filename'),
            'epub_filename_base': metadata.get('epub_filename_base'),
            'epub_filename_base_url': metadata.get('epub_filename_base_url'),
            'epub_filename_cdn_base_url': metadata.get('epub_filename_cdn_base_url'),
            'toc': metadata.get('toc', []),
            # Note: content_id_mapping is removed as it's not needed by frontend
            # and contains EPUB internal structure (OEBPS paths, etc.)
        }
        
        if HAS_ORJSON:
            metadata_json = json.dumps(sanitized_metadata).decode('utf-8')
        else:
            metadata_json = json.dumps(sanitized_metadata)
        return template.render(
            title=title,
            body_content=body_content,
            metadata_json=metadata_json,
            metadata=metadata,
            custom_css=custom_css,
            no_script=self.no_script
        )
