from pypdf import PdfReader


def extract_text_from_pdf(pdf_path):
    """Extracts and prints text from a PDF using pypdf."""
    reader = PdfReader(pdf_path)
    text = "\n".join(
        [page.extract_text() for page in reader.pages if page.extract_text()]
    )
    return text


# Provide a PDF file path
pdf_path = "D:/My UW/Quarter 2/Data 515 Software Design/project/Quizzatron/assets/greek_myth.pdf"  # Change this to an actual file path


def extract_text_from_pdf(pdf_path):
    with open(pdf_path, "rb") as file:
        reader = PdfReader(file)
        text = "\n".join(
            [page.extract_text() for page in reader.pages if page.extract_text()]
        )
    return text if text else None


# Extract and print the PDF text
extracted_text = extract_text_from_pdf(pdf_path)
print("Extracted Text from PDF:\n")
print(extracted_text[:500])  # Print only first 500 characters
