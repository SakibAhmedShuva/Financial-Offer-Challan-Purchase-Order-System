# PDF Page Merger with Width Normalization
# Install required libraries: pip install PyPDF2 reportlab PyMuPDF

import PyPDF2
import os
import fitz  # PyMuPDF
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from io import BytesIO

def generate_pdf_thumbnail(pdf_path, output_dir):
    """
    Generates a PNG thumbnail for the first page of a PDF.

    Args:
        pdf_path (str): Path to the input PDF file.
        output_dir (str): Directory to save the thumbnail.

    Returns:
        str: The path to the generated thumbnail, or None on failure.
    """
    thumb_path = None
    try:
        # Create a thumbnail filename from the PDF filename
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        thumb_name = f"{base_name}.png"
        thumb_path = os.path.join(output_dir, thumb_name)

        # If thumbnail already exists, skip generation
        if os.path.exists(thumb_path):
            print(f"Thumbnail already exists: {thumb_path}")
            return thumb_path

        # Open the PDF with PyMuPDF
        doc = fitz.open(pdf_path)
        
        # Ensure there is at least one page
        if len(doc) > 0:
            first_page = doc.load_page(0)

            # Render page to a pixmap (image)
            pix = first_page.get_pixmap()

            # Save the pixmap as a PNG
            pix.save(thumb_path)
            
            print(f"Successfully generated thumbnail: {thumb_path}")
        else:
            print(f"Warning: PDF has no pages - {pdf_path}")
            thumb_path = None
        
        doc.close()

    except Exception as e:
        print(f"Error generating thumbnail for {pdf_path}: {str(e)}")
        return None
        
    return thumb_path


def get_pdf_page_dimensions(pdf_path):
    """
    Get dimensions of all pages in a PDF
    
    Args:
        pdf_path (str): Path to the PDF file
        
    Returns:
        list: List of tuples (width, height) for each page
    """
    dimensions = []
    
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                # Get page dimensions in points
                width = float(page.mediabox.width)
                height = float(page.mediabox.height)
                dimensions.append((width, height))
                
    except Exception as e:
        print(f"Error reading dimensions from {pdf_path}: {str(e)}")
        
    return dimensions

def find_minimum_width(pdf_files):
    """
    Find the minimum width across all pages in all PDFs
    
    Args:
        pdf_files (list): List of PDF file paths
        
    Returns:
        float: Minimum width found
    """
    min_width = float('inf')
    
    for pdf_file in pdf_files:
        if os.path.exists(pdf_file):
            dimensions = get_pdf_page_dimensions(pdf_file)
            for width, height in dimensions:
                min_width = min(min_width, width)
        else:
            print(f"Warning: File not found - {pdf_file}")
    
    return min_width if min_width != float('inf') else 612  # Default to letter width

def resize_pdf_pages(input_pdf, output_pdf, target_width):
    """
    Resize all pages in a PDF to match target width while maintaining aspect ratio
    
    Args:
        input_pdf (str): Path to input PDF
        output_pdf (str): Path to output PDF
        target_width (float): Target width in points
    """
    try:
        with open(input_pdf, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            pdf_writer = PyPDF2.PdfWriter()
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                
                # Get current dimensions
                current_width = float(page.mediabox.width)
                current_height = float(page.mediabox.height)
                
                # Calculate scale factor to match target width
                scale_factor = target_width / current_width
                
                # Calculate new height maintaining aspect ratio
                new_height = current_height * scale_factor
                
                # Scale the page
                page.scale(scale_factor, scale_factor)
                
                # Update mediabox to new dimensions
                page.mediabox.lower_left = (0, 0)
                page.mediabox.upper_right = (target_width, new_height)
                
                pdf_writer.add_page(page)
                
                print(f"Page {page_num + 1}: {current_width:.1f}x{current_height:.1f} -> {target_width:.1f}x{new_height:.1f}")
            
            # Write the resized PDF
            with open(output_pdf, 'wb') as output_file:
                pdf_writer.write(output_file)
                
        print(f"Successfully resized {input_pdf} -> {output_pdf}")
        
    except Exception as e:
        print(f"Error resizing {input_pdf}: {str(e)}")

def merge_pdfs_with_resize(pdf_list, output_filename):
    """
    Merge multiple PDF files after resizing them to the smallest width
    
    Args:
        pdf_list (list): List of PDF file paths to merge
        output_filename (str): Name of the output merged PDF file
    """
    if not pdf_list:
        print("No PDF files provided")
        return
    
    # Find minimum width across all PDFs
    print("=== Analyzing PDF dimensions ===")
    min_width = find_minimum_width(pdf_list)
    print(f"Minimum width found: {min_width:.1f} points")
    
    # Create temporary resized PDFs
    temp_pdfs = []
    temp_dir = "temp_resized"
    os.makedirs(temp_dir, exist_ok=True)
    
    print("\n=== Resizing PDFs ===")
    for i, pdf_file in enumerate(pdf_list):
        if os.path.exists(pdf_file):
            temp_pdf = os.path.join(temp_dir, f"temp_resized_{i}.pdf")
            resize_pdf_pages(pdf_file, temp_pdf, min_width)
            temp_pdfs.append(temp_pdf)
        else:
            print(f"Warning: File not found - {pdf_file}")
    
    # Merge the resized PDFs
    print("\n=== Merging resized PDFs ===")
    pdf_merger = PyPDF2.PdfMerger()
    
    try:
        for temp_pdf in temp_pdfs:
            print(f"Adding: {temp_pdf}")
            pdf_merger.append(temp_pdf)
        
        # Write the merged PDF
        with open(output_filename, 'wb') as output_file:
            pdf_merger.write(output_file)
        
        print(f"Successfully merged {len(temp_pdfs)} resized PDFs into '{output_filename}'")
        
    except Exception as e:
        print(f"Error merging PDFs: {str(e)}")
    
    finally:
        pdf_merger.close()
        
        # Clean up temporary files
        print("\n=== Cleaning up temporary files ===")
        for temp_pdf in temp_pdfs:
            try:
                os.remove(temp_pdf)
                print(f"Removed: {temp_pdf}")
            except Exception as e:
                print(f"Error removing {temp_pdf}: {str(e)}")
        
        try:
            os.rmdir(temp_dir)
            print(f"Removed directory: {temp_dir}")
        except Exception as e:
            print(f"Error removing directory {temp_dir}: {str(e)}")

def analyze_pdf_dimensions(pdf_files):
    """
    Analyze and display dimensions of all pages in the PDF files
    
    Args:
        pdf_files (list): List of PDF file paths
    """
    print("=== PDF Dimension Analysis ===")
    
    for pdf_file in pdf_files:
        if os.path.exists(pdf_file):
            print(f"\nFile: {pdf_file}")
            dimensions = get_pdf_page_dimensions(pdf_file)
            
            for i, (width, height) in enumerate(dimensions):
                print(f"  Page {i+1}: {width:.1f} x {height:.1f} points ({width/72:.1f}\" x {height/72:.1f}\")")
        else:
            print(f"Warning: File not found - {pdf_file}")

# Example usage
if __name__ == "__main__":
    # Your PDF files
    pdf_files = [
        r"f:\OneDrive - Green Energy\Desktop\FO.pdf", 
        r"f:\OneDrive - Green Energy\Desktop\Challan_1004.pdf",
    ]
    
    # First, analyze the dimensions
    analyze_pdf_dimensions(pdf_files)
    
    # Then merge with resizing
    merge_pdfs_with_resize(pdf_files, "merged_normalized_width.pdf")
    
    # Example for thumbnail generation
    if len(pdf_files) > 0:
        os.makedirs("thumbnails", exist_ok=True)
        generate_pdf_thumbnail(pdf_files[0], "thumbnails")

    print("\n=== Process Complete ===")
    print("All PDFs have been resized to match the smallest width and merged!")