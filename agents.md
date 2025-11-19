# Project: EPUB to HTML Converter

## Overview
This project is a high-performance EPUB to HTML converter designed for speed and efficiency. It leverages Python 3.13's free-threading capabilities and optimized libraries like `pyvips` and `selectolax` to process thousands of EPUB files rapidly.

## Key Features
- **Python 3.13 Free-Threading**: Utilizes true multi-threading to bypass the GIL.
- **High-Speed Processing**:
    - **Images**: Uses `pyvips` (10-20x faster than Pillow).
    - **Parsing**: Uses `selectolax` (2-3x faster than lxml).
    - **JSON**: Uses `orjson` for fast serialization.
- **Parallelism**: Multi-level parallel processing for maximum throughput.

## Project Structure
- **`src/`**: Contains the source code.
    - **`epub_converter/`**: The main package containing the converter logic.
- **`test/`**: Directory for test data (EPUB files) and output verification.
- **`requirements.txt`**: Python dependencies.
- **`README.md`**: Detailed documentation on installation, usage, and performance.
- **`WINDOWS_SETUP.md`**: Specific setup instructions for Windows users.

## Setup & Installation
1.  **Python**: Requires Python 3.13+ (Free-threaded build recommended).
2.  **Dependencies**: Install via `pip install -r requirements.txt`.
    - System dependencies like `libvips` may be required (see `README.md`).

## Usage
Run the converter module pointing to an EPUB file or directory:
```bash
python -m epub_converter /path/to/epubs --output_dir /path/to/output
```

For maximum performance on supported systems:
```bash
export PYTHON_GIL=0
python -m epub_converter /path/to/epubs --max_workers 200
```

## Development
- **Entry Point**: `src/epub_converter` is the main module.
- **Testing**: Use the `test` directory for placing sample EPUBs and running the converter to verify outputs.
