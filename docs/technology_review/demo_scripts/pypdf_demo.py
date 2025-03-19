"""Module for demonstrating PDF text extraction using pypdf."""

from pypdf import PdfReader

# Provide a PDF file path
PDF_PATH = "D:/My UW/Quarter 2/Data 515 Software Design/project/Quizzatron/assets/greek_myth.pdf"

def extract_text_from_pdf(file_path):
    """
    Extracts text from a PDF file.

    Args:
        file_path (str): Path to the PDF file.

    Returns:
        str: Extracted text from the PDF, or None if no text was extracted.
    """
    with open(file_path, "rb") as file:
        reader = PdfReader(file)
        text = "\n".join(
            [page.extract_text() for page in reader.pages if page.extract_text()]
        )
    return text if text else None

# Extract and print the PDF text
EXTRACTED_TEXT = extract_text_from_pdf(PDF_PATH)
print("Extracted Text from PDF:\n")
if EXTRACTED_TEXT:
    # pylint: disable=unsubscriptable-object
    print(EXTRACTED_TEXT[:500])  # Print only first 500 characters
else:
    print("No text could be extracted from the PDF.")
