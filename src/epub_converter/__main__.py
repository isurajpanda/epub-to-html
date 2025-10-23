import argparse
from .converter import EPUBConverter

def main():
    parser = argparse.ArgumentParser(description='Convert EPUB files to HTML.')
    parser.add_argument('epub_path', help='Path to an EPUB file or a directory containing EPUB files.')
    parser.add_argument('--output_dir', help='The directory to save the converted HTML files.')
    parser.add_argument('--css', help='Path to a custom CSS file.')
    args = parser.parse_args()

    converter = EPUBConverter(args.epub_path, args.output_dir, args.css)
    converter.convert()

if __name__ == "__main__":
    main()