import argparse
import sys
import os
from .converter import EPUBConverter

def detect_python_version_and_gil():
    """Detect Python version and GIL status for optimization recommendations."""
    python_version = sys.version_info
    is_python313_plus = python_version >= (3, 13)
    
    # Check if GIL is disabled (free-threaded mode)
    gil_enabled = True
    try:
        # This attribute exists in Python 3.13+ free-threaded builds
        if hasattr(sys, '_is_gil_enabled'):
            gil_enabled = sys._is_gil_enabled()
    except AttributeError:
        pass
    
    # Check environment variable
    if os.environ.get('PYTHON_GIL') == '0':
        gil_enabled = False
    
    return {
        'version': python_version,
        'is_313_plus': is_python313_plus,
        'gil_enabled': gil_enabled,
        'free_threading': is_python313_plus and not gil_enabled
    }

def main():
    parser = argparse.ArgumentParser(description='Convert EPUB files to HTML. Processes all EPUBs recursively in subdirectories.')
    parser.add_argument('epub_path', help='Path to an EPUB file or a directory containing EPUB files (searches recursively).')
    parser.add_argument('--output_dir', help='Output directory for single file conversion (ignored for directory processing - outputs are created next to each EPUB).')
    parser.add_argument('--css', help='Path to a custom CSS file.')
    parser.add_argument('--max_workers', type=int, default=100, 
                       help='Maximum number of parallel workers for directory conversion (default: 100).')
    args = parser.parse_args()

    # Detect Python version and threading capabilities
    python_info = detect_python_version_and_gil()
    
    # Show performance optimizations info
    print("Ultra-Fast EPUB Converter")
    print("   Python Version:", f"{python_info['version'].major}.{python_info['version'].minor}.{python_info['version'].micro}")
    
    if python_info['free_threading']:
        print("   FREE-THREADING ENABLED! (No GIL)")
        print("   True multi-threading for CPU-bound tasks")
        print("   Optimal performance for parallel EPUB processing")
    elif python_info['is_313_plus']:
        print("   Python 3.13+ detected but GIL is enabled")
        print("   For maximum performance, use free-threaded build:")
        print("      python3.13 --disable-gil")
    else:
        print("   Python < 3.13 detected")
        print("   For maximum performance, upgrade to Python 3.13+ with free-threading")
    
    print("   Optimizations enabled:")
    
    # Check for lxml
    try:
        import lxml
        print("   lxml (fast XML parsing)")
    except ImportError:
        print("   lxml not available (using slower ElementTree)")
    
    # Check for orjson
    try:
        import orjson
        print("   orjson (fast JSON serialization)")
    except ImportError:
        print("   orjson not available (using slower stdlib json)")
    
    # Check for pyvips
    try:
        import pyvips
        # Test if pyvips can actually work
        try:
            test_img = pyvips.Image.black(1, 1)
            print("   pyvips (ultra-fast image processing)")
        except Exception as e:
            print("   pyvips installed but libvips library not available")
            print(f"      Error: {e}")
            print("      Windows users: Download libvips binaries from:")
            print("         https://libvips.github.io/libvips/install.html")
            print("      Or uninstall pyvips to use Pillow fallback:")
            print("         pip uninstall pyvips")
    except ImportError:
        try:
            import PIL
            print("   pyvips not available (using Pillow)")
        except ImportError:
            print("   No image processing library available!")
            sys.exit(1)
    
    # Check for selectolax
    try:
        import selectolax
        print("   selectolax (fast HTML parsing)")
    except ImportError:
        print("   selectolax not available (using lxml for HTML)")
    
    # Check for zipfile-deflate64
    try:
        import zipfile_deflate64
        print("   zipfile-deflate64 (faster ZIP extraction)")
    except ImportError:
        print("   zipfile-deflate64 not available (using stdlib zipfile)")
    
    print("   Parallel processing (images & content files)")
    print("   Pre-compiled regex patterns")
    print("   Optimized image analysis with sampling")
    
    if python_info['free_threading']:
        print("   ThreadPoolExecutor optimized for no-GIL")
        # Increase default workers for free-threading
        if args.max_workers == 100:
            args.max_workers = min(200, os.cpu_count() * 8)
            print(f"   Auto-adjusted max_workers to {args.max_workers} for free-threading")
    else:
        print("   ProcessPoolExecutor (GIL-limited)")
    
    print()

    converter = EPUBConverter(args.epub_path, args.output_dir, args.css)
    converter.convert(max_workers=args.max_workers)

if __name__ == "__main__":
    main()