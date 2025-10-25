
import os
import re
import shutil
import tempfile
import json
from pathlib import Path
from urllib.parse import unquote
from jinja2 import Environment, FileSystemLoader

from .parser import EPUBParser
from .image_processor import ImageProcessor

class EPUBConverter:
    def __init__(self, epub_path, output_folder=None, custom_css_path=None):
        self.epub_path = Path(epub_path)
        self.output_folder = Path(output_folder) if output_folder else self.epub_path.parent
        self.custom_css_path = custom_css_path
        self.temp_dir = None
        self.image_processor = ImageProcessor()
        
        template_path = Path(__file__).parent / "templates"
        self.jinja_env = Environment(loader=FileSystemLoader(template_path))

    def combine_and_generate_html(self, content_files, extract_dir, metadata, path_mapping, custom_css=None):
        """Combine content files, embed images as base64, and generate the final HTML with UI."""
        combined_body = []
        print(f"  Combining {len(content_files)} content files in reading order:")
        for i, (_, content_file_path) in enumerate(content_files, 1):
            try:
                print(f"    {i}. {content_file_path.name}")
                with open(content_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                body_content = self.extract_body_content(content)

                def replace_img_src_in_chapter(match):
                    tag_start = match.group(1)
                    quote = match.group(2)
                    src_val = match.group(3)
                    src = unquote(src_val)
                    
                    if src.startswith('data:') or re.match(r'^(?:[a-z0-9.+-]+:|//)', src, re.IGNORECASE):
                        return match.group(0)

                    try:
                        content_dir = content_file_path.parent
                        abs_img_path = (content_dir / src).resolve()
                        
                        relative_to_extract_dir = abs_img_path.relative_to(extract_dir).as_posix()
                        
                        new_src = path_mapping.get(relative_to_extract_dir, src)
                    except Exception:
                        new_src = path_mapping.get(Path(src).name, src)

                    return f'{tag_start}{quote}{new_src}{quote}'

                body_content = re.sub(r'(<img\b[^>]*\ssrc\s*=\s*)(["\'])(.*?)\2', replace_img_src_in_chapter, body_content, flags=re.IGNORECASE | re.DOTALL)

                combined_body.append(f'''<div class="chapter" id="page{i:02d}">
{body_content}
</div>''')
            except Exception as e:
                print(f"    Warning: Could not read {content_file_path.name}: {e}")

        final_html = self.get_html_template(
            title=metadata.get('title', 'EPUB Content'),
            body_content='\n<hr class="chapter-separator">\n'.join(combined_body),
            metadata=metadata,
            custom_css=custom_css
        )
        return final_html

    def extract_body_content(self, content):
        """Extract and clean body content from HTML/XHTML"""
        body_match = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL | re.IGNORECASE)
        if body_match:
            body_content = body_match.group(1)
        else:
            html_match = re.search(r'<html[^>]*>(.*?)</html>', content, re.DOTALL | re.IGNORECASE)
            if html_match:
                html_content = re.sub(r'<head>.*?</head>', '', html_match.group(1), flags=re.DOTALL | re.IGNORECASE)
                body_content = html_content
            else:
                body_content = content
        
        body_content = re.sub(r'<?xml[^>]*?>', '', body_content.strip())
        body_content = re.sub(r'<!DOCTYPE[^>]*>', '', body_content)
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
            css_content = re.sub(r'/\*.*?\*/', '', css_content, flags=re.DOTALL)
            css_content = re.sub(r'\s+', ' ', css_content)
            return css_content.strip()

    def _minify_js(self, js_content):
        """Minify JavaScript using rjsmin library."""
        try:
            import rjsmin
            return rjsmin.jsmin(js_content)
        except ImportError:
            # Fallback to simple minification if rjsmin not available
            js_content = re.sub(r'(?<!:)//.*?$', '', js_content, flags=re.MULTILINE)
            js_content = re.sub(r'/\*.*?\*/', '', js_content, flags=re.DOTALL)
            js_content = re.sub(r'\s+', ' ', js_content)
            return js_content.strip()

    def fix_links_and_images(self, html_content, content_id_mapping):
        """Fix all internal anchor href paths."""
        
        def replace_a_href(match):
            tag_start = match.group(1)
            quote = match.group(2)
            href_val = match.group(3)

            href = unquote(href_val)

            if re.match(r'^(?:[a-z0-9.+-]+:|//)', href, re.IGNORECASE) or href.startswith('./static'):
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

        html_content = re.sub(r'(<a\b[^>]*\shref\s*=\s*)(["\'])(.*?)\2', replace_a_href, html_content, flags=re.IGNORECASE | re.DOTALL)
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
            
            epub_output_folder = self.output_folder / epub_path.stem
            epub_output_folder.mkdir(exist_ok=True)
            print(f"  Output will be saved to: {epub_output_folder}/")

            content_files = parser.find_content_files(opf_file, extract_dir)
            image_files = self.image_processor.find_images(extract_dir)
            toc, metadata = parser.find_and_parse_toc(opf_file, extract_dir)

            path_mapping = self.image_processor.process_images_and_get_mapping(image_files, extract_dir)

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

            cover_image_url = None
            if actual_cover_file_path:
                try:
                    relative_to_extract_dir_path = actual_cover_file_path.relative_to(extract_dir).as_posix()
                    cover_image_url = path_mapping.get(relative_to_extract_dir_path)
                    if not cover_image_url:
                        cover_image_url = path_mapping.get(actual_cover_file_path.name)
                except ValueError:
                    pass
            
            metadata['cover_image_url'] = cover_image_url

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

            # Copy static files directly to static folder (flatten structure)
            static_folder = Path(__file__).parent / "static"
            output_static_folder = epub_output_folder / "static"
            
            # Remove existing static folder to clean up old structure
            if output_static_folder.exists():
                shutil.rmtree(output_static_folder)
            
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

            print(f"  Created: {output_html.resolve()}")

    def convert(self):
        """Convert a single EPUB file or all EPUB files in a directory."""
        if self.epub_path.is_file():
            self.convert_single_epub(self.epub_path)
        elif self.epub_path.is_dir():
            self.output_folder.mkdir(exist_ok=True)
            epub_files = sorted(list(self.epub_path.glob("*.epub")))
            if not epub_files:
                print(f"No EPUB files found in {self.epub_path}")
                return
            
            print(f"Found {len(epub_files)} EPUB files")
            for epub_file in epub_files:
                try:
                    self.convert_single_epub(epub_file)
                except Exception as e:
                    print(f"FATAL: Error converting {epub_file.name}: {e}")
                    import traceback
                    traceback.print_exc()
            
            print("Conversion complete!")

    def get_html_template(self, title, body_content, metadata, custom_css=None):
        """Returns the complete HTML structure with embedded CSS and JS."""
        template = self.jinja_env.get_template("reader.html")
        metadata_json = json.dumps(metadata)
        return template.render(
            title=title,
            body_content=body_content,
            metadata_json=metadata_json,
            custom_css=custom_css
        )
