
import os
import re
import shutil
import tempfile
import time
import sys
import cProfile
import pstats
from pathlib import Path
from urllib.parse import unquote
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
from .image_processor import ImageProcessor

class EPUBConverter:
    def __init__(self, epub_path, output_folder=None, custom_css_path=None, no_script=False):
        self.epub_path = Path(epub_path)
        self.output_folder = Path(output_folder) if output_folder else self.epub_path.parent
        self.custom_css_path = custom_css_path
        self.no_script = no_script
        self.temp_dir = None
        self.image_processor = ImageProcessor()
        
        template_path = Path(__file__).parent / "templates"
        self.jinja_env = Environment(loader=FileSystemLoader(template_path))
        
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

    def _process_content_file(self, content_file_info, extract_dir, path_mapping, metadata=None):
        """Process a single content file and return the processed content."""
        i, content_file_path = content_file_info
        try:
            with open(content_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            body_content = self.extract_body_content(content)

            def replace_img_src_in_chapter(match):
                tag_start = match.group(1)
                quote = match.group(2)
                src_val = match.group(3)
                src = unquote(src_val)
                
                if src.startswith('data:') or self.data_url_pattern.match(src):
                    return match.group(0)

                try:
                    content_dir = content_file_path.parent
                    abs_img_path = (content_dir / src).resolve()
                    
                    relative_to_extract_dir = abs_img_path.relative_to(extract_dir).as_posix()
                    
                    new_src = path_mapping.get(relative_to_extract_dir, src)
                except Exception:
                    new_src = path_mapping.get(Path(src).name, src)

                return f'{tag_start}{quote}{new_src}{quote}'

            def replace_img_tags(match):
                """Replace image src while preserving all alt attributes and adding appropriate loading"""
                full_img_tag = match.group(0)
                
                # Check if loading attribute already exists
                has_loading = 'loading=' in full_img_tag.lower()
                
                # Extract alt attribute if it exists
                alt_match = self.img_alt_pattern.search(full_img_tag)
                has_alt = alt_match is not None
                alt_text = alt_match.group(2) if alt_match else ''
                
                # Replace src attribute
                replaced_tag = self.img_src_pattern.sub(replace_img_src_in_chapter, full_img_tag)
                
                # If no alt attribute exists, add one with the filename
                if not has_alt:
                    src_match = self.img_src_extract_pattern.search(replaced_tag)
                    if src_match:
                        image_path = src_match.group(1)
                        image_name = Path(image_path).stem
                        # Insert alt attribute before the closing >
                        replaced_tag = self.img_close_pattern.sub(r'\1alt="' + image_name + r'"\2', replaced_tag, count=1)
                
                # Add appropriate loading attribute if not already present
                if not has_loading:
                    # Check if this is the cover image (first image in first chapter)
                    src_match = self.img_src_extract_pattern.search(replaced_tag)
                    if src_match:
                        image_path = src_match.group(1)
                        # Check if this is the cover image by comparing with cover_image_url
                        cover_image_url = metadata.get('cover_image_url')
                        if cover_image_url and image_path == cover_image_url:
                            # Cover image should be eager-loaded for LCP
                            replaced_tag = replaced_tag.replace('>', ' loading="eager" fetchpriority="high">', 1)
                        else:
                            # Other images should be lazy-loaded
                            replaced_tag = replaced_tag.replace('>', ' loading="lazy">', 1)
                    else:
                        # Fallback to lazy loading if we can't determine the image
                        replaced_tag = replaced_tag.replace('>', ' loading="lazy">', 1)
                
                return replaced_tag

            body_content = self.img_tag_pattern.sub(replace_img_tags, body_content)

            return f'''<div class="chapter" id="page{i:02d}">
{body_content}
</div>'''
        except Exception as e:
            print(f"    Warning: Could not read {content_file_path.name}: {e}")
            return None

    def combine_and_generate_html(self, content_files, extract_dir, metadata, path_mapping, custom_css=None):
        """Combine content files, embed images as base64, and generate the final HTML with UI using parallel processing."""
        print(f"  Combining {len(content_files)} content files in reading order:")
        
        if len(content_files) <= 3:  # For small numbers of files, process sequentially
            combined_body = []
            for i, (_, content_file_path) in enumerate(content_files, 1):
                print(f"    {i}. {content_file_path.name}")
                result = self._process_content_file((i, content_file_path), extract_dir, path_mapping, metadata)
                if result:
                    combined_body.append(result)
        else:  # For larger numbers of files, use parallel processing
            print(f"  Processing {len(content_files)} content files in parallel...")
            combined_body = []
            
            with ThreadPoolExecutor(max_workers=min(len(content_files), 8)) as executor:
                # Submit all content file processing tasks
                future_to_file = {
                    executor.submit(self._process_content_file, (i, content_file_path), extract_dir, path_mapping, metadata): (i, content_file_path)
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
                            print(f"    {i}. {content_file_path.name}")
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
        """Extract and clean body content from HTML/XHTML using fastest available parser."""
        if HAS_SELECTOLAX:
            return self._extract_body_content_selectolax(content)
        else:
            return self._extract_body_content_regex(content)

    def _extract_body_content_selectolax(self, content):
        """Extract body content using selectolax (fastest HTML parser)."""
        try:
            tree = HTMLParser(content)
            body_element = tree.css_first('body')
            if body_element:
                return body_element.html
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
        """Map TOC entries to correct chapter IDs based on content file mapping."""
        def process_toc_item(item):
            if 'href' in item:
                original_href = item['href']
                
                # Extract file path from href (remove any existing fragments)
                file_path = original_href.split('#')[0]
                
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
                    else:
                        # Try with stem (filename without extension)
                        stem = Path(file_path).stem
                        if stem in content_id_mapping:
                            chapter_id = content_id_mapping[stem]
                
                if chapter_id:
                    # Update href to use the mapped chapter ID
                    item['href'] = f"#{chapter_id}"
                    print(f"    Mapped TOC: {item['label']} -> {item['href']}")
                else:
                    # Fallback: try to find closest match by filename similarity
                    chapter_id = self._find_closest_chapter_match(file_path, content_id_mapping)
                    if chapter_id:
                        item['href'] = f"#{chapter_id}"
                        print(f"    Fallback mapped TOC: {item['label']} -> {item['href']}")
                    else:
                        print(f"    Warning: Could not map TOC entry: {item['label']} ({original_href})")
                        item['href'] = "#page01"  # Default to first page
                
                # Process children recursively
                if 'children' in item:
                    item['children'] = [process_toc_item(child) for child in item['children']]
            
            return item
        
        return [process_toc_item(item) for item in toc]

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
            css_content = self.css_comment_pattern.sub('', css_content)
            css_content = self.css_whitespace_pattern.sub(' ', css_content)
            return css_content.strip()

    def _minify_js(self, js_content):
        """Minify JavaScript using rjsmin library."""
        try:
            import rjsmin
            return rjsmin.jsmin(js_content)
        except ImportError:
            # Fallback to simple minification if rjsmin not available
            js_content = self.js_line_comment_pattern.sub('', js_content)
            js_content = self.js_block_comment_pattern.sub('', js_content)
            js_content = self.js_whitespace_pattern.sub(' ', js_content)
            return js_content.strip()

    def fix_links_and_images(self, html_content, content_id_mapping):
        """Fix all internal anchor href paths."""
        
        def replace_a_href(match):
            tag_start = match.group(1)
            quote = match.group(2)
            href_val = match.group(3)

            href = unquote(href_val)

            if self.data_url_pattern.match(href) or self.static_url_pattern.match(href):
                return match.group(0)

            file_part, fragment = (href.split('#', 1) + [''])[:2]

            new_href = '#'
            if not file_part and fragment:
                new_href = f'#{fragment}'
            elif file_part:
                if fragment:
                    new_href = f'#{fragment}'
                else:
                    mapped_chapter_id = content_id_mapping.get(file_part) or content_id_mapping.get(Path(file_part).name)
                    if mapped_chapter_id:
                        new_href = f'#{mapped_chapter_id}'
                    else:
                        print(f"Warning: Could not resolve internal link: {href}")
            else:
                print(f"Warning: Could not resolve internal link: {href}")

            return f'{tag_start}{quote}{new_href}{quote}'

        html_content = self.link_href_pattern.sub(replace_a_href, html_content)
        return html_content

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
            image_files = self.image_processor.find_images(extract_dir)

            # Detect cover image before processing
            actual_cover_file_path = None
            if metadata.get('cover_image_path'):
                potential_cover_abs_path = (extract_dir / Path(metadata['cover_image_path'])).resolve()
                if potential_cover_abs_path.exists():
                    actual_cover_file_path = potential_cover_abs_path

            if not actual_cover_file_path and content_files:
                first_content_file_path = content_files[0][1]
                try:
                    with open(first_content_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        first_page_content = f.read()
                    
                    img_match = re.search(r'<img[^>]+src=["\']([^"\\]+)["\\]', first_page_content, re.IGNORECASE)
                    if img_match:
                        img_src = img_match.group(1)
                        first_content_file_dir = first_content_file_path.parent
                        abs_img_path = (first_content_file_dir / unquote(img_src)).resolve()
                        
                        if abs_img_path.exists() and abs_img_path.is_file():
                            actual_cover_file_path = abs_img_path
                except Exception as e:
                    print(f"  Error reading first content file for cover image detection: {e}")

            # Process images with EPUB title and cover image path
            epub_title = metadata.get('title', 'Unknown')
            path_mapping = self.image_processor.process_images_and_get_mapping(
                image_files, extract_dir, epub_output_folder, epub_title, actual_cover_file_path
            )

            cover_image_url = None
            if actual_cover_file_path:
                try:
                    relative_to_extract_dir_path = actual_cover_file_path.relative_to(extract_dir).as_posix()
                    cover_image_url = path_mapping.get(relative_to_extract_dir_path)
                    if not cover_image_url:
                        cover_image_url = path_mapping.get(actual_cover_file_path.name)
                    # If still not found, use the new naming scheme (cover.avif)
                    if not cover_image_url:
                        cover_image_url = "cover.avif"
                except ValueError:
                    cover_image_url = "cover.avif"
            
            metadata['cover_image_url'] = cover_image_url
            metadata['epub_filename'] = epub_path.name

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

            combined_html = self.combine_and_generate_html(content_files, extract_dir, metadata, path_mapping, custom_css)
            final_html = self.fix_links_and_images(combined_html, content_id_mapping)
            
            output_html = epub_output_folder / "index.html"
            with open(output_html, 'w', encoding='utf-8') as f:
                f.write(final_html)

            # Handle static files based on --no-script flag
            static_folder = Path(__file__).parent / "static"
            output_static_folder = epub_output_folder / "static"
            
            # Remove existing static folder if it exists (clean up from previous runs)
            if output_static_folder.exists():
                shutil.rmtree(output_static_folder)
            
            # Copy static files unless --no-script flag is set
            if not self.no_script:
                output_static_folder.mkdir(exist_ok=True)
                
                # Copy and minify CSS file
                css_source = static_folder / "css" / "style.css"
                css_dest = output_static_folder / "style.css"
                if css_source.exists():
                    with open(css_source, 'r', encoding='utf-8') as f:
                        css_content = f.read()
                    minified_css = self._minify_css(css_content)
                    with open(css_dest, 'w', encoding='utf-8') as f:
                        f.write(minified_css)
                    print(f"  Minified CSS: {len(css_content)} -> {len(minified_css)} characters")
                
                # Copy and minify JS file
                js_source = static_folder / "js" / "script.js"
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
        if HAS_ORJSON:
            metadata_json = json.dumps(metadata).decode('utf-8')
        else:
            metadata_json = json.dumps(metadata)
        return template.render(
            title=title,
            body_content=body_content,
            metadata_json=metadata_json,
            metadata=metadata,
            custom_css=custom_css,
            no_script=self.no_script
        )
