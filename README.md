# EPUB to HTML Converter

This project is a Python-based tool for converting EPUB files into standalone HTML files. It extracts the content from an EPUB file, including text and images, and combines it into a single, easy-to-read HTML file with a responsive design.

## Features

*   **EPUB to HTML Conversion**: Converts EPUB files into a single HTML file.
*   **Responsive Design**: The output HTML is designed to be readable on a variety of devices, from mobile phones to desktop computers.
*   **Table of Contents**: The converter generates a table of contents for easy navigation.
*   **Image Handling**: Images are extracted and embedded in the HTML file.
*   **Custom CSS**: Users can provide a custom CSS file to style the output HTML.

## Usage

1.  **Install Dependencies**: Install the necessary dependencies by running the following command:

    ```bash
    pip install -r requirements.txt
    ```

2.  **Run the Converter**: Run the converter from your terminal using the following command:

    ```bash
    python -m src.epub_converter <path_to_epub_file_or_directory> --output_dir <path_to_output_directory> --css <path_to_custom_css_file>
    ```

    **Arguments:**

    *   `epub_path`: (Required) The path to the EPUB file you want to convert, or a directory containing multiple EPUB files.
    *   `--output_dir`: (Optional) The directory where the converted HTML files will be saved. If not provided, the output will be saved in the same directory as the input EPUB file(s).
    *   `--css`: (Optional) The path to a custom CSS file to be used for styling the output HTML.

    **Examples:**

    *   **Convert a single EPUB file:**
        ```bash
        python -m src.epub_converter "C:\path\to\your\book.epub"
        ```

    *   **Convert all EPUB files in a directory:**
        ```bash
        python -m src.epub_converter "C:\path\to\your\epub_books"
        ```

    *   **Convert and save to a specific output directory:**
        ```bash
        python -m src.epub_converter "C:\path\to\your\book.epub" --output_dir "C:\path\to\output"
        ```

    *   **Use a custom CSS file:**
        ```bash
        python -m src.epub_converter "C:\path\to\your\book.epub" --css "C:\path\to\your\custom.css"
        ```
