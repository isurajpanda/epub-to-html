import os
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from urllib.parse import unquote, urljoin

class EPUBParser:
    def __init__(self, temp_dir):
        self.temp_dir = temp_dir
        self.ns = {
            'opf': 'http://www.idpf.org/2007/opf',
            'dc': 'http://purl.org/dc/elements/1.1/',
            'ncx': 'http://www.daisy.org/z3986/2005/ncx/',
            'xhtml': 'http://www.w3.org/1999/xhtml',
            'epub': 'http://www.idpf.org/2007/ops'
        }

    def _get_ns_tag(self, tag, ns_key='opf'):
        """Helper to get a namespace-prefixed tag."""
        return f'{{{self.ns[ns_key]}}}{tag}'

    def extract_volume_number(self, filename):
        """Extract volume number from filename"""
        patterns = [r'Vol\.?\s*(\d+)', r'Volume\s*(\d+)', r'v(\d+)', r'V(\d+)', r'(\d+)']
        for pattern in patterns:
            match = re.search(pattern, filename, re.IGNORECASE)
            if match:
                return int(match.group(1))
        return 1

    def extract_epub(self, epub_path, extract_dir):
        """Extract EPUB file to directory"""
        with zipfile.ZipFile(epub_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)

    def find_opf_file(self, extract_dir):
        """Find the .opf file in the extracted EPUB."""
        for root, _, files in os.walk(extract_dir):
            for file in files:
                if file.endswith('.opf'):
                    return Path(root) / file
        return None

    def find_content_files(self, opf_file, opf_root):
        """Find all XHTML/HTML content files in the EPUB in proper reading order"""
        if not opf_file:
            return self.find_content_files_fallback(opf_root)

        try:
            tree = ET.parse(opf_file)
            root = tree.getroot()

            # Create id -> href mapping from manifest
            manifest_items = root.find(self._get_ns_tag('manifest'))
            id_to_href = {
                item.get('id'): (unquote(item.get('href')), item.get('media-type'))
                for item in manifest_items
                if item.get('id') and item.get('href')
            }

            # Get files in spine order (reading order)
            spine = root.find(self._get_ns_tag('spine'))
            content_files = []
            opf_dir = opf_file.parent

            for itemref in spine:
                idref = itemref.get('idref')
                if idref in id_to_href:
                    href, media_type = id_to_href[idref]
                    if 'xhtml' in media_type or 'html' in media_type or href.lower().endswith(('.xhtml', '.html', '.htm')):
                        full_path = (opf_dir / href).resolve()
                        if full_path.exists():
                            content_files.append((idref, full_path))
                        else:
                            print(f"    Warning: Spine item not found: {full_path}")

            print(f"  Spine order: {len(content_files)} content files found")
            return content_files
        except Exception as e:
            print(f"Warning: Could not parse OPF spine properly: {e}. Using fallback.")
            return self.find_content_files_fallback(opf_root)

    def find_content_files_fallback(self, extract_dir):
        """Fallback method to find content files if OPF parsing fails."""
        print("  Using fallback method to find content files")
        all_content_files = []
        for root, _, files in os.walk(extract_dir):
            for file in files:
                if file.lower().endswith(('.xhtml', '.html', '.htm')):
                    lower_file = file.lower()
                    if not any(skip in lower_file for skip in ['nav', 'toc', 'cover', 'titlepage']):
                        all_content_files.append(Path(root) / file)

        def natural_sort_key(path):
            parts = re.split(r'(\d+)', path.name.lower())
            return [int(part) if part.isdigit() else part for part in parts]

        return [(None, f) for f in sorted(all_content_files, key=natural_sort_key)]

    def find_and_parse_toc(self, opf_file, opf_root):
        """Find and parse the ToC file (nav.xhtml or toc.ncx)."""
        if not opf_file:
            print("  Warning: No OPF file found, cannot extract ToC")
            return [], {}

        try:
            tree = ET.parse(opf_file)
            root = tree.getroot()
            manifest = root.find(self._get_ns_tag('manifest'))
            metadata = root.find(self._get_ns_tag('metadata'))
            opf_dir = opf_file.parent

            # Extract basic metadata
            book_meta = {
                'title': 'Untitled',
                'author': 'Unknown Author',
                'cover_image_path': None
            }
            
            # Try to get title
            title_elem = metadata.find('.//dc:title', self.ns)
            if title_elem is not None and title_elem.text:
                book_meta['title'] = title_elem.text.strip()
                print(f"  Extracted Title: {book_meta['title']}")
            else:
                print(f"  Warning: Could not extract Title. Defaulting to '{book_meta['title']}'")

            # Try to get author
            author_elem = metadata.find('.//dc:creator', self.ns)
            if author_elem is not None and author_elem.text:
                book_meta['author'] = author_elem.text.strip()
                print(f"  Extracted Author: {book_meta['author']}")
            else:
                print(f"  Warning: Could not extract Author. Defaulting to '{book_meta['author']}'")

            # Find cover image
            cover_id = (metadata.find('.//opf:meta[@name="cover"]', self.ns) or ET.Element('meta')).get('content')
            print(f"  Detected cover_id from metadata: {cover_id}")

            if cover_id:
                cover_item = manifest.find(f".//opf:item[@id='{cover_id}']", self.ns)
                if cover_item is not None:
                    cover_href = cover_item.get('href')
                    print(f"  Cover item found in manifest. href: {cover_href}")
                    if cover_href:
                        # Resolve full path relative to opf_root
                        abs_cover_path = (opf_dir / unquote(cover_href)).resolve()
                        
                        # Ensure the path is relative to the extract_dir for mapping later
                        try:
                            relative_cover_path = abs_cover_path.relative_to(opf_root).as_posix()
                            book_meta['cover_image_path'] = relative_cover_path
                            print(f"  Resolved Cover Image Path: {book_meta['cover_image_path']}")
                        except ValueError:
                            print(f"  Warning: Cover image path {abs_cover_path} is not relative to opf_root {opf_root}")
                            book_meta['cover_image_path'] = abs_cover_path.name # Fallback to just filename
                else:
                    print(f"  Warning: Cover item with id='{cover_id}' not found in manifest.")
            else:
                print("  No 'cover' meta tag found in OPF metadata.")

            # --- Find and parse ToC ---
            # Try EPUB3 nav document first
            nav_item = manifest.find('.//opf:item[@properties="nav"]', self.ns)
            if nav_item is not None:
                nav_file = opf_dir / unquote(nav_item.get('href'))
                print(f"  Parsing EPUB3 ToC: {nav_file.name}")
                if nav_file.exists():
                    toc = self.parse_nav_xhtml(nav_file, opf_dir)
                    if toc:
                        print(f"  Successfully parsed {len(toc)} ToC entries from EPUB3 nav")
                        return toc, book_meta
                    else:
                        print(f"  Warning: EPUB3 nav file found but no ToC entries extracted")
                else:
                    print(f"  Warning: EPUB3 nav file not found: {nav_file}")

            # Fallback to EPUB2 NCX file
            spine = root.find(self._get_ns_tag('spine'))
            if spine is not None:
                ncx_id = spine.get('toc')
                if ncx_id:
                    ncx_item = manifest.find(f'.//opf:item[@id="{ncx_id}"]', self.ns)
                    if ncx_item is not None:
                        ncx_file = opf_dir / unquote(ncx_item.get('href'))
                        print(f"  Parsing EPUB2 ToC: {ncx_file.name}")
                        if ncx_file.exists():
                            toc = self.parse_ncx_toc(ncx_file, opf_dir)
                            if toc:
                                print(f"  Successfully parsed {len(toc)} ToC entries from EPUB2 NCX")
                                return toc, book_meta
                            else:
                                print(f"  Warning: EPUB2 NCX file found but no ToC entries extracted")
                        else:
                            print(f"  Warning: EPUB2 NCX file not found: {ncx_file}")
            
            # Final fallback: try to find any nav or toc files
            print("  Trying fallback ToC detection...")
            for root_dir, _, files in os.walk(opf_root):
                for file in files:
                    if file.lower() in ['nav.xhtml', 'toc.ncx', 'navigation.xhtml']:
                        toc_file = Path(root_dir) / file
                        print(f"  Found potential ToC file: {toc_file.name}")
                        if file.endswith('.ncx'):
                            toc = self.parse_ncx_toc(toc_file, opf_dir)
                        else:
                            toc = self.parse_nav_xhtml(toc_file, opf_dir)
                        if toc:
                            print(f"  Successfully parsed {len(toc)} ToC entries from fallback file")
                            return toc, book_meta
            
            print("  No ToC found, will generate basic chapter list")
            return [], book_meta
            
        except Exception as e:
            print(f"Warning: Could not find or parse ToC file: {e}")
            import traceback
            traceback.print_exc()
            return [], {}

    def parse_nav_xhtml(self, nav_file, base_dir):
        """Parse a `nav.xhtml` file to extract ToC structure."""
        if not nav_file.exists(): 
            print(f"    Nav file does not exist: {nav_file}")
            return []
        
        def parse_ol(ol_element):
            toc = []
            for li in ol_element.findall('./xhtml:li', self.ns):
                a = li.find('xhtml:a', self.ns)
                if a is not None:
                    href = a.get('href', '')
                    label = ''.join(a.itertext()).strip()
                    
                    if not label:
                        print(f"    Warning: Empty label found in nav link: {href}")
                        continue
                    
                    # Resolve relative path
                    full_href = urljoin(str(base_dir.as_posix()) + '/', href)
                    # Remove temp directory prefix if present
                    if hasattr(self, 'temp_dir') and self.temp_dir:
                        full_href = full_href.replace(str(self.temp_dir.as_posix()) + '/', '')
                    
                    item = {'label': label, 'href': unquote(full_href)}
                    print(f"    ToC entry: {label} -> {item['href']}")
                    
                    # Check for nested list
                    nested_ol = li.find('xhtml:ol', self.ns)
                    if nested_ol is not None:
                        item['children'] = parse_ol(nested_ol)
                    toc.append(item)
            return toc

        try:
            tree = ET.parse(nav_file)
            root = tree.getroot()
            
            # Try multiple approaches to find the TOC navigation
            nav_element = None
            
            # Method 1: Look for nav with epub:type="toc"
            nav_element = root.find('.//xhtml:nav[@epub:type="toc"]', self.ns)
            if nav_element is not None:
                print(f"    Found nav with epub:type='toc'")
            
            # Method 2: Look for nav with id="toc"
            if nav_element is None:
                nav_element = root.find('.//xhtml:nav[@id="toc"]', self.ns)
                if nav_element is not None:
                    print(f"    Found nav with id='toc'")
            
            # Method 3: Look for any nav element
            if nav_element is None:
                nav_element = root.find('.//xhtml:nav', self.ns)
                if nav_element is not None:
                    print(f"    Found generic nav element")
            
            # Method 4: Look for any ol element (fallback)
            if nav_element is None:
                ol_element = root.find('.//xhtml:ol', self.ns)
                if ol_element is not None:
                    print(f"    Found ol element directly")
                    return parse_ol(ol_element)
            
            if nav_element is not None:
                ol = nav_element.find('xhtml:ol', self.ns)
                if ol is not None:
                    return parse_ol(ol)
                else:
                    print(f"    Warning: No ol element found in nav")
            
            print(f"    No navigation structure found in {nav_file.name}")
            return []
            
        except Exception as e:
            print(f"    Error parsing nav.xhtml: {e}")
            # Try without namespaces for broken files
            try:
                tree = ET.parse(nav_file)
                root = tree.getroot()
                
                # Try various namespace-free approaches
                nav_element = root.find('.//{http://www.w3.org/1999/xhtml}nav')
                if nav_element is not None:
                    ol = nav_element.find('{http://www.w3.org/1999/xhtml}ol')
                    if ol is not None:
                        return parse_ol(ol)
                
                # Try finding any ol element
                ol_element = root.find('.//{http://www.w3.org/1999/xhtml}ol')
                if ol_element is not None:
                    return parse_ol(ol_element)
                    
            except Exception as e2:
                print(f"    Failed fallback parsing: {e2}")
            
            return []

    def parse_ncx_toc(self, ncx_file, base_dir):
        """Parse a `toc.ncx` file to extract ToC structure."""
        if not ncx_file.exists(): 
            print(f"    NCX file does not exist: {ncx_file}")
            return []
        
        def parse_navpoint(navpoint):
            items = []
            for point in navpoint.findall('ncx:navPoint', self.ns):
                try:
                    label_elem = point.find('ncx:navLabel/ncx:text', self.ns)
                    if label_elem is None or not label_elem.text:
                        print(f"    Warning: Empty or missing label in navPoint")
                        continue
                    
                    label = label_elem.text.strip()
                    
                    content_elem = point.find('ncx:content', self.ns)
                    if content_elem is None:
                        print(f"    Warning: No content element found for label: {label}")
                        continue
                    
                    src = content_elem.get('src')
                    if not src:
                        print(f"    Warning: No src attribute found for label: {label}")
                        continue
                    
                    # Resolve relative path
                    full_src = urljoin(str(base_dir.as_posix()) + '/', src)
                    # Remove temp directory prefix if present
                    if hasattr(self, 'temp_dir') and self.temp_dir:
                        full_src = full_src.replace(str(self.temp_dir.as_posix()) + '/', '')
                    
                    item = {'label': label, 'href': unquote(full_src)}
                    print(f"    ToC entry: {label} -> {item['href']}")
                    
                    # Check for nested navPoints
                    nested_points = point.findall('ncx:navPoint', self.ns)
                    if nested_points:
                        item['children'] = parse_navpoint(point)
                    
                    items.append(item)
                    
                except Exception as e:
                    print(f"    Error parsing navPoint: {e}")
                    continue
            return items

        try:
            tree = ET.parse(ncx_file)
            root = tree.getroot()
            
            navmap = root.find('ncx:navMap', self.ns)
            if navmap is not None:
                return parse_navpoint(navmap)
            else:
                print(f"    No navMap found in {ncx_file.name}")
                return []
                
        except Exception as e:
            print(f"    Error parsing NCX file: {e}")
            return []

    def generate_basic_toc(self, content_files, extract_dir):
        """Generate a basic TOC from chapter headings when no TOC is found."""
        toc = []
        print("  Generating basic TOC from chapter headings...")
        
        for i, (_, content_file_path) in enumerate(content_files, 1):
            try:
                with open(content_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Try to find chapter title from headings
                title = None
                
                # Look for h1, h2, h3 tags
                for tag in ['h1', 'h2', 'h3']:
                    match = re.search(f'<{tag}[^>]*>(.*?)</{tag}>', content, re.DOTALL | re.IGNORECASE)
                    if match:
                        title = re.sub(r'<[^>]+>', '', match.group(1)).strip()
                        break
                
                # If no heading found, try to extract from title tag
                if not title:
                    title_match = re.search(r'<title[^>]*>(.*?)</title>', content, re.DOTALL | re.IGNORECASE)
                    if title_match:
                        title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip()
                
                # If still no title, use filename
                if not title:
                    title = content_file_path.stem
                
                # Clean up title
                title = re.sub(r'\s+', ' ', title).strip()
                if len(title) > 50:
                    title = title[:47] + "..."
                
                chapter_id = f"page{i:02d}"
                toc.append({
                    'label': f"Chapter {i}: {title}",
                    'href': f"#{chapter_id}"
                })
                print(f"    Generated ToC entry: Chapter {i}: {title}")
                
            except Exception as e:
                print(f"    Warning: Could not process {content_file_path.name} for basic TOC: {e}")
                # Add a fallback entry
                toc.append({
                    'label': f"Chapter {i}",
                    'href': f"#page{i:02d}"
                })
        
        return toc