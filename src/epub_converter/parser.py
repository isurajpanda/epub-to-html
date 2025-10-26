import os
import re
import zipfile
from pathlib import Path
from urllib.parse import unquote, urljoin

# Try to import lxml for faster XML parsing, fallback to ElementTree
try:
    from lxml import etree as ET
    HAS_LXML = True
except ImportError:
    from xml.etree import ElementTree as ET
    HAS_LXML = False

# Try to import selectolax for faster HTML parsing
try:
    from selectolax.parser import HTMLParser
    HAS_SELECTOLAX = True
except ImportError:
    HAS_SELECTOLAX = False

# Try to import zipfile-deflate64 for faster ZIP extraction
try:
    import zipfile_deflate64
    HAS_ZIPFILE_DEFLATE64 = True
except ImportError:
    HAS_ZIPFILE_DEFLATE64 = False

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
        
        # Define patterns for unwanted content (more specific to avoid false positives)
        self.unwanted_patterns = [
            'newsletter signup', 'newsletter sign-up', 'newsletter subscription',
            'copyright page', 'credits and copyright', 'legal notice',
            'yen newsletter', 'j-novel club newsletter', 'about j-novel club',
            'about yen press', 'about publisher', 'publisher information',
            'legal information', 'terms of service', 'privacy policy',
            'contact us', 'support page', 'help page', 'advertisement',
            'promo page', 'promotion page', 'subscribe now', 'subscription page',
            'sign up page', 'signup page', 'back matter', 'end matter',
            'colophon', 'imprint', 'newsletter', 'copyright', 'Other Series'
        ]
        
        # Pre-compile regex patterns for better performance
        self._compile_regex_patterns()

    def _compile_regex_patterns(self):
        """Pre-compile all regex patterns for better performance."""
        # Volume number extraction patterns
        self.volume_patterns = [
            re.compile(r'Vol\.?\s*(\d+)', re.IGNORECASE),
            re.compile(r'Volume\s*(\d+)', re.IGNORECASE),
            re.compile(r'v(\d+)', re.IGNORECASE),
            re.compile(r'V(\d+)', re.IGNORECASE),
            re.compile(r'(\d+)', re.IGNORECASE)
        ]
        
        # Chapter title patterns for basic TOC generation
        self.chapter_patterns = [
            re.compile(r'Chapter\s+\d+[:\s]*(.*?)(?:\n|$)', re.IGNORECASE),
            re.compile(r'Chapter\s+[IVX]+[:\s]*(.*?)(?:\n|$)', re.IGNORECASE),
            re.compile(r'Part\s+\d+[:\s]*(.*?)(?:\n|$)', re.IGNORECASE),
            re.compile(r'Section\s+\d+[:\s]*(.*?)(?:\n|$)', re.IGNORECASE),
            re.compile(r'^\s*(\d+\.?\s+.*?)(?:\n|$)', re.MULTILINE | re.IGNORECASE),
            re.compile(r'^\s*([IVX]+\.?\s+.*?)(?:\n|$)', re.MULTILINE | re.IGNORECASE)
        ]
        
        # Heading patterns
        self.heading_patterns = [
            re.compile(r'<h1[^>]*>(.*?)</h1>', re.DOTALL | re.IGNORECASE),
            re.compile(r'<h2[^>]*>(.*?)</h2>', re.DOTALL | re.IGNORECASE),
            re.compile(r'<h3[^>]*>(.*?)</h3>', re.DOTALL | re.IGNORECASE),
            re.compile(r'<xhtml:h1[^>]*>(.*?)</xhtml:h1>', re.DOTALL | re.IGNORECASE),
            re.compile(r'<xhtml:h2[^>]*>(.*?)</xhtml:h2>', re.DOTALL | re.IGNORECASE),
            re.compile(r'<xhtml:h3[^>]*>(.*?)</xhtml:h3>', re.DOTALL | re.IGNORECASE)
        ]
        
        # Title tag pattern
        self.title_pattern = re.compile(r'<title[^>]*>(.*?)</title>', re.DOTALL | re.IGNORECASE)
        
        # HTML tag removal pattern
        self.html_tag_pattern = re.compile(r'<[^>]+>')
        
        # Whitespace cleanup pattern
        self.whitespace_pattern = re.compile(r'\s+')
        
        # Filename cleanup patterns
        self.filename_underscore_pattern = re.compile(r'[_-]')
        self.filename_digit_pattern = re.compile(r'\d+')
        
        # Navigation parsing patterns
        self.link_pattern = re.compile(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.DOTALL | re.IGNORECASE)
        self.navpoint_pattern = re.compile(r'<navPoint[^>]*>.*?<navLabel>.*?<text>(.*?)</text>.*?</navLabel>.*?<content[^>]*src=["\']([^"\']+)["\'][^>]*>.*?</content>.*?</navPoint>', re.DOTALL | re.IGNORECASE)

    def _get_ns_tag(self, tag, ns_key='opf'):
        """Helper to get a namespace-prefixed tag."""
        return f'{{{self.ns[ns_key]}}}{tag}'

    def _should_filter_content(self, label, href=None):
        """Check if content should be filtered based on label and href."""
        if not label:
            return False
            
        label_lower = label.lower().strip()
        
        # Define specific patterns that should be filtered (avoid false positives)
        filter_patterns = [
            # Exact matches for common unwanted content
            'copyright', 'newsletter', 'about j-novel club', 'about yen press',
            'yen newsletter', 'j-novel club newsletter', 'newsletter signup',
            'newsletter sign-up', 'newsletter subscription', 'subscribe now',
            'subscription page', 'sign up page', 'signup page', 'contact us',
            'support page', 'help page', 'advertisement', 'promo page',
            'promotion page', 'legal notice', 'legal information',
            'terms of service', 'privacy policy', 'back matter', 'end matter',
            'colophon', 'imprint', 'publisher information', 'about publisher',
            'credits and copyright', 'copyright page', 'other series'
        ]
        
        # Check for exact matches or very specific patterns
        for pattern in filter_patterns:
            pattern_lower = pattern.lower()
            
            # Exact match
            if pattern_lower == label_lower:
                return True
            
            # Check if it's a standalone word/phrase (not part of a longer title)
            if (pattern_lower in label_lower and 
                (label_lower.startswith(pattern_lower + ' ') or
                 label_lower.endswith(' ' + pattern_lower) or
                 f' {pattern_lower} ' in label_lower)):
                return True
        
        # Additional checks for href-based filtering
        if href:
            href_lower = href.lower()
            # Check for common unwanted file patterns (more specific)
            unwanted_files = [
                'newsletter', 'signup', 'copyright', 'legal', 'about',
                'contact', 'support', 'help', 'ad', 'promo', 'subscribe'
            ]
            for unwanted_file in unwanted_files:
                if unwanted_file in href_lower:
                    return True
        
        return False

    def _should_filter_content_file(self, href, filtered_hrefs):
        """Check if a content file should be filtered based on filtered TOC entries."""
        if not href or not filtered_hrefs:
            return False
            
        href_normalized = href.lower().strip()
        
        # Check if this href matches any filtered TOC entry
        for filtered_href in filtered_hrefs:
            filtered_normalized = filtered_href.lower().strip()
            
            # Direct match
            if href_normalized == filtered_normalized:
                return True
                
            # Check if the filename matches (without path)
            href_filename = Path(href).name.lower()
            filtered_filename = Path(filtered_href).name.lower()
            if href_filename == filtered_filename:
                return True
                
            # Check if the stem matches (filename without extension)
            href_stem = Path(href).stem.lower()
            filtered_stem = Path(filtered_href).stem.lower()
            if href_stem == filtered_stem:
                return True
        
        return False

    def extract_volume_number(self, filename):
        """Extract volume number from filename"""
        for pattern in self.volume_patterns:
            match = pattern.search(filename)
            if match:
                return int(match.group(1))
        return 1

    def extract_epub(self, epub_path, extract_dir):
        """Extract EPUB file to directory using fastest available method."""
        if HAS_ZIPFILE_DEFLATE64:
            # Use faster ZIP extraction
            with zipfile.ZipFile(epub_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
        else:
            # Fallback to standard zipfile
            with zipfile.ZipFile(epub_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)

    def extract_file_from_epub(self, epub_path, file_path):
        """Stream a single file from EPUB without full extraction."""
        try:
            with zipfile.ZipFile(epub_path, 'r') as zip_ref:
                return zip_ref.read(file_path)
        except KeyError:
            return None

    def find_opf_file(self, extract_dir):
        """Find the .opf file in the extracted EPUB."""
        for root, _, files in os.walk(extract_dir):
            for file in files:
                if file.endswith('.opf'):
                    return Path(root) / file
        return None

    def find_content_files(self, opf_file, opf_root, filtered_hrefs=None):
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
                        # Check if this file should be filtered based on TOC filtering
                        if filtered_hrefs and self._should_filter_content_file(href, filtered_hrefs):
                            print(f"🔴 Filtered out content file: {Path(href).name}")
                            continue
                            
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
            parts = self.filename_digit_pattern.split(path.name.lower())
            return [int(part) if part.isdigit() else part for part in parts]

        return [(None, f) for f in sorted(all_content_files, key=natural_sort_key)]

    def find_and_parse_toc(self, opf_file, opf_root):
        """Find and parse the ToC file (nav.xhtml or toc.ncx) with robust fallbacks."""
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
                'cover_image_path': None,
                'description': None,
                'publisher': None,
                'date': None,
                'subject': [],
                'language': None
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

            # Try to get description
            description_elem = metadata.find('.//dc:description', self.ns)
            if description_elem is not None and description_elem.text:
                book_meta['description'] = description_elem.text.strip()

            # Try to get publisher
            publisher_elem = metadata.find('.//dc:publisher', self.ns)
            if publisher_elem is not None and publisher_elem.text:
                book_meta['publisher'] = publisher_elem.text.strip()

            # Try to get date
            date_elem = metadata.find('.//dc:date', self.ns)
            if date_elem is not None and date_elem.text:
                book_meta['date'] = date_elem.text.strip()

            # Try to get subjects
            subject_elems = metadata.findall('.//dc:subject', self.ns)
            if subject_elems:
                book_meta['subject'] = [elem.text.strip() for elem in subject_elems if elem.text]

            # Try to get language
            language_elem = metadata.find('.//dc:language', self.ns)
            if language_elem is not None and language_elem.text:
                book_meta['language'] = language_elem.text.strip()

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

            # --- Enhanced ToC Detection with Multiple Strategies ---
            toc, filtered_hrefs = self._find_toc_robust(manifest, opf_dir, opf_root, root)
            if toc:
                print(f"  Successfully parsed {len(toc)} ToC entries")
                return toc, book_meta, filtered_hrefs
            
            print("  No ToC found, will generate basic chapter list")
            return [], book_meta, []
            
        except Exception as e:
            print(f"Warning: Could not find or parse ToC file: {e}")
            import traceback
            traceback.print_exc()
            return [], {}, []

    def _find_toc_robust(self, manifest, opf_dir, opf_root, root):
        """Robust ToC detection using multiple strategies."""
        toc = []
        filtered_hrefs = []
        
        # Strategy 1: EPUB3 nav document with properties="nav"
        nav_item = manifest.find('.//opf:item[@properties="nav"]', self.ns)
        if nav_item is not None:
            nav_file = opf_dir / unquote(nav_item.get('href'))
            print(f"  Strategy 1: Parsing EPUB3 ToC: {nav_file.name}")
            if nav_file.exists():
                toc, filtered_hrefs = self.parse_nav_xhtml(nav_file, opf_dir)
                if toc:
                    print(f"  Successfully parsed {len(toc)} ToC entries from EPUB3 nav")
                    return toc, filtered_hrefs
                else:
                    print(f"  Warning: EPUB3 nav file found but no ToC entries extracted")
            else:
                print(f"  Warning: EPUB3 nav file not found: {nav_file}")

        # Strategy 2: EPUB2 NCX file from spine toc attribute
        spine = root.find(self._get_ns_tag('spine'))
        if spine is not None:
            ncx_id = spine.get('toc')
            if ncx_id:
                ncx_item = manifest.find(f'.//opf:item[@id="{ncx_id}"]', self.ns)
                if ncx_item is not None:
                    ncx_file = opf_dir / unquote(ncx_item.get('href'))
                    print(f"  Strategy 2: Parsing EPUB2 ToC: {ncx_file.name}")
                    if ncx_file.exists():
                        toc, filtered_hrefs = self.parse_ncx_toc(ncx_file, opf_dir)
                        if toc:
                            print(f"  Successfully parsed {len(toc)} ToC entries from EPUB2 NCX")
                            return toc, filtered_hrefs
                        else:
                            print(f"  Warning: EPUB2 NCX file found but no ToC entries extracted")
                    else:
                        print(f"  Warning: EPUB2 NCX file not found: {ncx_file}")

        # Strategy 3: Look for nav files by common names and patterns
        print("  Strategy 3: Searching for nav files by name patterns...")
        nav_files = self._find_nav_files_by_name(opf_root)
        for nav_file in nav_files:
            print(f"  Found potential nav file: {nav_file.name}")
            if nav_file.suffix.lower() == '.ncx':
                toc, filtered_hrefs = self.parse_ncx_toc(nav_file, opf_dir)
            else:
                toc, filtered_hrefs = self.parse_nav_xhtml(nav_file, opf_dir)
            if toc:
                print(f"  Successfully parsed {len(toc)} ToC entries from {nav_file.name}")
                return toc, filtered_hrefs

        # Strategy 4: Look for any XHTML files that might contain navigation
        print("  Strategy 4: Searching for navigation in XHTML files...")
        toc, filtered_hrefs = self._extract_toc_from_xhtml_files(opf_root, opf_dir)
        if toc:
            print(f"  Successfully extracted {len(toc)} ToC entries from XHTML files")
            return toc, filtered_hrefs

        # Strategy 5: Try to extract TOC from manifest items with specific media types
        print("  Strategy 5: Checking manifest for navigation items...")
        toc, filtered_hrefs = self._extract_toc_from_manifest_items(manifest, opf_dir)
        if toc:
            print(f"  Successfully extracted {len(toc)} ToC entries from manifest items")
            return toc, filtered_hrefs

        return [], []

    def _find_nav_files_by_name(self, opf_root):
        """Find navigation files by common naming patterns."""
        nav_files = []
        nav_patterns = [
            'nav.xhtml', 'navigation.xhtml', 'toc.xhtml', 'table-of-contents.xhtml',
            'toc.ncx', 'navigation.ncx', 'table-of-contents.ncx',
            'nav.html', 'toc.html', 'navigation.html'
        ]
        
        for root_dir, _, files in os.walk(opf_root):
            for file in files:
                if file.lower() in nav_patterns:
                    nav_files.append(Path(root_dir) / file)
        
        return nav_files

    def _extract_toc_from_xhtml_files(self, opf_root, opf_dir):
        """Extract TOC from any XHTML files that might contain navigation."""
        for root_dir, _, files in os.walk(opf_root):
            for file in files:
                if file.lower().endswith(('.xhtml', '.html')):
                    xhtml_file = Path(root_dir) / file
                    # Skip files that are likely not navigation
                    if any(skip in file.lower() for skip in ['cover', 'titlepage', 'copyright']):
                        continue
                    
                    try:
                        with open(xhtml_file, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                        
                        # Look for navigation patterns in the content
                        if any(pattern in content.lower() for pattern in [
                            '<nav', 'table of contents', 'toc', 'navigation',
                            'epub:type="toc"', 'id="toc"', 'class="toc"'
                        ]):
                            print(f"    Checking {xhtml_file.name} for navigation...")
                            toc, filtered_hrefs = self.parse_nav_xhtml(xhtml_file, opf_dir)
                            if toc:
                                return toc, filtered_hrefs
                    except Exception as e:
                        print(f"    Warning: Could not read {xhtml_file.name}: {e}")
                        continue
        
        return [], []

    def _extract_toc_from_manifest_items(self, manifest, opf_dir):
        """Extract TOC from manifest items that might be navigation files."""
        if manifest is None:
            return [], []
        
        for item in manifest.findall('.//opf:item', self.ns):
            href = item.get('href')
            media_type = item.get('media-type', '')
            properties = item.get('properties', '')
            
            # Check if this looks like a navigation file
            if (('nav' in properties.lower() or 
                 'toc' in properties.lower() or
                 'navigation' in media_type.lower() or
                 'nav' in href.lower() or
                 'toc' in href.lower()) and 
                href and href.lower().endswith(('.xhtml', '.html', '.ncx'))):
                
                nav_file = opf_dir / unquote(href)
                if nav_file.exists():
                    print(f"    Found navigation item: {nav_file.name}")
                    if nav_file.suffix.lower() == '.ncx':
                        toc, filtered_hrefs = self.parse_ncx_toc(nav_file, opf_dir)
                    else:
                        toc, filtered_hrefs = self.parse_nav_xhtml(nav_file, opf_dir)
                    if toc:
                        return toc, filtered_hrefs
        
        return [], []

    def _clean_toc_href(self, href):
        """Clean TOC href by removing problematic anchor fragments and normalizing paths."""
        if not href:
            return href
        
        # Split into file path and fragment
        if '#' in href:
            file_part, fragment = href.split('#', 1)
        else:
            file_part, fragment = href, ''
        
        # Clean up the file path
        file_part = file_part.strip()
        
        # Remove common problematic anchor fragments that don't exist in combined HTML
        problematic_fragments = [
            'auto_bookmark_toc_top',
            'toc_top', 
            'bookmark_toc_top',
            'auto_bookmark',
            'bookmark',
            'top'
        ]
        
        # If fragment is problematic, remove it
        if fragment and fragment.lower() in problematic_fragments:
            print(f"    Removed problematic anchor fragment: #{fragment}")
            return file_part
        
        # If fragment exists and is not problematic, keep it
        if fragment:
            return f"{file_part}#{fragment}"
        
        return file_part

    def parse_nav_xhtml(self, nav_file, base_dir):
        """Parse a `nav.xhtml` file to extract ToC structure with enhanced robustness."""
        if not nav_file.exists(): 
            print(f"    Nav file does not exist: {nav_file}")
            return [], []
        
        def parse_ol(ol_element):
            toc = []
            filtered_hrefs = []
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
                    
                    # Clean up the href by removing problematic anchor fragments
                    cleaned_href = self._clean_toc_href(full_href)
                    
                    item = {'label': label, 'href': unquote(cleaned_href)}
                    
                    # Check if this content should be filtered
                    if self._should_filter_content(label, item['href']):
                        print(f"🔴 Filtered out TOC entry: {label}")
                        filtered_hrefs.append(item['href'])
                        continue
                    
                    print(f"    ToC entry: {label} -> {item['href']}")
                    
                    # Check for nested list
                    nested_ol = li.find('xhtml:ol', self.ns)
                    if nested_ol is not None:
                        item['children'], nested_filtered = parse_ol(nested_ol)
                        filtered_hrefs.extend(nested_filtered)
                    toc.append(item)
            return toc, filtered_hrefs

        def parse_ol_no_ns(ol_element):
            """Parse ol element without namespace assumptions."""
            toc = []
            filtered_hrefs = []
            for li in ol_element.findall('.//li'):
                a = li.find('a')
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
                    
                    # Clean up the href by removing problematic anchor fragments
                    cleaned_href = self._clean_toc_href(full_href)
                    
                    item = {'label': label, 'href': unquote(cleaned_href)}
                    
                    # Check if this content should be filtered
                    if self._should_filter_content(label, item['href']):
                        print(f"🔴 Filtered out TOC entry: {label}")
                        filtered_hrefs.append(item['href'])
                        continue
                    
                    print(f"    ToC entry: {label} -> {item['href']}")
                    
                    # Check for nested list
                    nested_ol = li.find('ol')
                    if nested_ol is not None:
                        item['children'], nested_filtered = parse_ol_no_ns(nested_ol)
                        filtered_hrefs.extend(nested_filtered)
                    toc.append(item)
            return toc, filtered_hrefs

        # Try multiple parsing strategies
        strategies = [
            self._parse_nav_with_namespaces,
            self._parse_nav_without_namespaces,
            self._parse_nav_regex_fallback
        ]
        
        for strategy in strategies:
            try:
                toc, filtered_hrefs = strategy(nav_file, base_dir, parse_ol, parse_ol_no_ns)
                if toc:
                    return toc, filtered_hrefs
            except Exception as e:
                print(f"    Strategy failed: {e}")
                continue
        
        print(f"    No navigation structure found in {nav_file.name}")
        return [], []

    def _parse_nav_with_namespaces(self, nav_file, base_dir, parse_ol, parse_ol_no_ns):
        """Parse nav file using proper namespaces."""
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
        
        return [], []

    def _parse_nav_without_namespaces(self, nav_file, base_dir, parse_ol, parse_ol_no_ns):
        """Parse nav file without namespace assumptions."""
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
        
        # Try without any namespace prefixes
        nav_element = root.find('.//nav')
        if nav_element is not None:
            ol = nav_element.find('ol')
            if ol is not None:
                return parse_ol_no_ns(ol)
        
        ol_element = root.find('.//ol')
        if ol_element is not None:
            return parse_ol_no_ns(ol_element)
        
        return []

    def _parse_nav_regex_fallback(self, nav_file, base_dir, parse_ol, parse_ol_no_ns):
        """Parse nav file using regex as a last resort."""
        try:
            with open(nav_file, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # Look for navigation patterns using pre-compiled regex
            # Find all links that might be TOC entries
            matches = self.link_pattern.findall(content)
            
            toc = []
            for href, label_html in matches:
                # Clean up the label
                label = self.html_tag_pattern.sub('', label_html).strip()
                if not label:
                    continue
                
                # Resolve relative path
                full_href = urljoin(str(base_dir.as_posix()) + '/', href)
                # Remove temp directory prefix if present
                if hasattr(self, 'temp_dir') and self.temp_dir:
                    full_href = full_href.replace(str(self.temp_dir.as_posix()) + '/', '')
                
                item = {'label': label, 'href': unquote(full_href)}
                print(f"    ToC entry (regex): {label} -> {item['href']}")
                toc.append(item)
            
            if toc:
                print(f"    Found {len(toc)} TOC entries using regex fallback")
                return toc
            
        except Exception as e:
            print(f"    Regex fallback failed: {e}")
        
        return []

    def parse_ncx_toc(self, ncx_file, base_dir):
        """Parse a `toc.ncx` file to extract ToC structure with enhanced robustness."""
        if not ncx_file.exists(): 
            print(f"    NCX file does not exist: {ncx_file}")
            return [], []
        
        def parse_navpoint(navpoint):
            items = []
            filtered_hrefs = []
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
                    
                    # Clean up the href by removing problematic anchor fragments
                    cleaned_src = self._clean_toc_href(full_src)
                    
                    item = {'label': label, 'href': unquote(cleaned_src)}
                    
                    # Check if this content should be filtered
                    if self._should_filter_content(label, item['href']):
                        print(f"🔴 Filtered out TOC entry: {label}")
                        filtered_hrefs.append(item['href'])
                        continue
                    
                    print(f"    ToC entry: {label} -> {item['href']}")
                    
                    # Check for nested navPoints
                    nested_points = point.findall('ncx:navPoint', self.ns)
                    if nested_points:
                        item['children'], nested_filtered = parse_navpoint(point)
                        filtered_hrefs.extend(nested_filtered)
                    
                    items.append(item)
                    
                except Exception as e:
                    print(f"    Error parsing navPoint: {e}")
                    continue
            return items, filtered_hrefs

        def parse_navpoint_no_ns(navpoint):
            """Parse navPoint without namespace assumptions."""
            items = []
            filtered_hrefs = []
            for point in navpoint.findall('.//navPoint'):
                try:
                    label_elem = point.find('.//text')
                    if label_elem is None or not label_elem.text:
                        print(f"    Warning: Empty or missing label in navPoint")
                        continue
                    
                    label = label_elem.text.strip()
                    
                    content_elem = point.find('.//content')
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
                    
                    # Clean up the href by removing problematic anchor fragments
                    cleaned_src = self._clean_toc_href(full_src)
                    
                    item = {'label': label, 'href': unquote(cleaned_src)}
                    
                    # Check if this content should be filtered
                    if self._should_filter_content(label, item['href']):
                        print(f"🔴 Filtered out TOC entry: {label}")
                        filtered_hrefs.append(item['href'])
                        continue
                    
                    print(f"    ToC entry (no-ns): {label} -> {item['href']}")
                    
                    # Check for nested navPoints
                    nested_points = point.findall('.//navPoint')
                    if nested_points:
                        item['children'], nested_filtered = parse_navpoint_no_ns(point)
                        filtered_hrefs.extend(nested_filtered)
                    
                    items.append(item)
                    
                except Exception as e:
                    print(f"    Error parsing navPoint (no-ns): {e}")
                    continue
            return items, filtered_hrefs

        # Try multiple parsing strategies
        strategies = [
            self._parse_ncx_with_namespaces,
            self._parse_ncx_without_namespaces,
            self._parse_ncx_regex_fallback
        ]
        
        for strategy in strategies:
            try:
                toc, filtered_hrefs = strategy(ncx_file, base_dir, parse_navpoint, parse_navpoint_no_ns)
                if toc:
                    return toc, filtered_hrefs
            except Exception as e:
                print(f"    NCX strategy failed: {e}")
                continue
        
        print(f"    No navigation structure found in {ncx_file.name}")
        return [], []

    def _parse_ncx_with_namespaces(self, ncx_file, base_dir, parse_navpoint, parse_navpoint_no_ns):
        """Parse NCX file using proper namespaces."""
        tree = ET.parse(ncx_file)
        root = tree.getroot()
        
        navmap = root.find('ncx:navMap', self.ns)
        if navmap is not None:
            return parse_navpoint(navmap)
        else:
            print(f"    No navMap found in {ncx_file.name}")
            return [], []

    def _parse_ncx_without_namespaces(self, ncx_file, base_dir, parse_navpoint, parse_navpoint_no_ns):
        """Parse NCX file without namespace assumptions."""
        tree = ET.parse(ncx_file)
        root = tree.getroot()
        
        # Try with explicit namespace URIs
        navmap = root.find('.//{http://www.daisy.org/z3986/2005/ncx/}navMap')
        if navmap is not None:
            return parse_navpoint(navmap)
        
        # Try without any namespace prefixes
        navmap = root.find('.//navMap')
        if navmap is not None:
            return parse_navpoint_no_ns(navmap)
        
        return [], []

    def _parse_ncx_regex_fallback(self, ncx_file, base_dir, parse_navpoint, parse_navpoint_no_ns):
        """Parse NCX file using regex as a last resort."""
        try:
            with open(ncx_file, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # Look for navigation patterns using pre-compiled regex
            # Find all navPoint entries
            matches = self.navpoint_pattern.findall(content)
            
            toc = []
            filtered_hrefs = []
            for label, src in matches:
                # Clean up the label
                label = self.html_tag_pattern.sub('', label).strip()
                if not label:
                    continue
                
                # Resolve relative path
                full_src = urljoin(str(base_dir.as_posix()) + '/', src)
                # Remove temp directory prefix if present
                if hasattr(self, 'temp_dir') and self.temp_dir:
                    full_src = full_src.replace(str(self.temp_dir.as_posix()) + '/', '')
                
                item = {'label': label, 'href': unquote(full_src)}
                
                # Check if this content should be filtered
                if self._should_filter_content(label, item['href']):
                    print(f"🔴 Filtered out TOC entry: {label}")
                    filtered_hrefs.append(item['href'])
                    continue
                
                print(f"    ToC entry (regex): {label} -> {item['href']}")
                toc.append(item)
            
            if toc:
                print(f"    Found {len(toc)} TOC entries using regex fallback")
                return toc, filtered_hrefs
            
        except Exception as e:
            print(f"    NCX regex fallback failed: {e}")
        
        return [], []

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
                
                # Look for h1, h2, h3 tags with pre-compiled patterns
                for pattern in self.heading_patterns:
                    match = pattern.search(content)
                    if match:
                        title = self.html_tag_pattern.sub('', match.group(1)).strip()
                        break
                
                # If no heading found, try to extract from title tag
                if not title:
                    title_match = self.title_pattern.search(content)
                    if title_match:
                        title = self.html_tag_pattern.sub('', title_match.group(1)).strip()
                
                # Try to find any text that might be a chapter title
                if not title:
                    for pattern in self.chapter_patterns:
                        match = pattern.search(content)
                        if match:
                            title = match.group(1).strip()
                            title = self.html_tag_pattern.sub('', title).strip()
                            if title and len(title) > 3:  # Avoid very short matches
                                break
                
                # If still no title, use filename
                if not title:
                    title = content_file_path.stem
                    # Clean up filename-based title
                    title = self.filename_underscore_pattern.sub(' ', title)
                    title = self.filename_digit_pattern.sub('', title).strip()
                    if not title:
                        title = f"Chapter {i}"
                
                # Clean up title
                title = self.whitespace_pattern.sub(' ', title).strip()
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