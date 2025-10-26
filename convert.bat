@echo off
REM Add vips to PATH and run the converter
set PATH=%PATH%;C:\Program Files\vips\bin
python -m src.epub_converter %*
