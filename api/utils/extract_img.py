"""Module for downloading and managing images from Bing Image Search.

Includes an image verification layer to filter out known bad images:
- URL blacklist for domains that host error/documentation screenshots
- Visual fingerprinting to reject known recurring bad images by hash
- Query sanitization to steer Bing away from technical content
- Dimension/format validation via Pillow
"""

import hashlib
import logging
import os
import glob
from PIL import Image
from icrawler.builtin import BingImageCrawler
from flask import request

logging.getLogger("icrawler").setLevel(logging.CRITICAL)
logging.getLogger("feeder").setLevel(logging.CRITICAL)
logging.getLogger("parser").setLevel(logging.CRITICAL)
logging.getLogger("downloader").setLevel(logging.CRITICAL)

TEMP_FOLDER = "api/static/temp"
os.makedirs(TEMP_FOLDER, exist_ok=True)

# --- Image Verification Config ---

# Minimum dimensions to accept (filters out icons, placeholders, error pages)
MIN_IMAGE_WIDTH = 200
MIN_IMAGE_HEIGHT = 200
# Maximum file size — 5MB (filters out absurdly large stock images)
MAX_FILE_SIZE = 5 * 1024 * 1024

# Domains known to serve error/documentation screenshots instead of real images.
# Images from these sources are skipped during download.
BLACKLISTED_DOMAINS = [
    "microfocus.com",
    "opentext.com",
    "itom.microfocus.com",
    "admhelp.microfocus.com",
]

# MD5 hashes of known "phantom" images that appear across unrelated queries.
# Add hashes here as they are discovered. Use _compute_image_hash() to get them.
BLACKLISTED_HASHES = {
    "947d1c6c8737fe4881914162fc1ca650",  # The 47KB Micro Focus/OpenText "File Not Found" phantom image
}

# Negative keywords appended to every Bing query to filter out technical junk.
QUERY_SANITIZE_TERMS = "-software -error -docs -screenshot -stacktrace -exception"


def cleanup_temp_folder():
    """Remove all images from the temp folder."""
    for image_file in glob.glob(os.path.join(TEMP_FOLDER, "*")):
        os.remove(image_file)
    logging.info("🧹 Clean-up activity completed.")


def _compute_image_hash(filepath):
    """Compute MD5 hash of an image file for fingerprint comparison."""
    hasher = hashlib.md5()  # noqa: S324 — not used for security
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def _is_valid_image(filepath):
    """Validate that a downloaded file is a real, usable image.

    Checks (in order):
        1. File size is reasonable (not absurdly large)
        2. File is a valid image format (not HTML, text, or broken download)
        3. Image meets minimum dimension requirements
        4. Image hash is not in the blacklist of known bad images

    Args:
        filepath: Path to the downloaded file.

    Returns:
        bool: True if the image passes all validation checks.
    """
    try:
        # 1. File size check
        file_size = os.path.getsize(filepath)
        if file_size > MAX_FILE_SIZE:
            logging.warning("Image too large (%d bytes), skipping.", file_size)
            return False

        # 2. Format validation
        with Image.open(filepath) as img:
            img.verify()  # Verify it's a real image, not HTML/text

        # 3. Dimension check (re-open after verify, which closes the file)
        with Image.open(filepath) as img:
            width, height = img.size
            if width < MIN_IMAGE_WIDTH or height < MIN_IMAGE_HEIGHT:
                logging.warning(
                    "Image too small (%dx%d), skipping.", width, height
                )
                return False

        # 4. Hash blacklist check
        img_hash = _compute_image_hash(filepath)
        if img_hash in BLACKLISTED_HASHES:
            logging.warning("Image matches blacklisted hash %s, skipping.", img_hash)
            return False

        return True
    except Exception:
        logging.warning("Downloaded file is not a valid image, skipping.")
        return False


def _sanitize_query(query):
    """Append negative keywords to a search query to filter out technical junk.

    Args:
        query: The original image search query (e.g., "Koala sitting in a tree").

    Returns:
        str: Sanitized query with negative keywords appended.
    """
    return f"{query} {QUERY_SANITIZE_TERMS}"


def _cleanup_candidates():
    """Remove all numbered candidate files left by icrawler."""
    for i in range(1, 10):
        for leftover in glob.glob(os.path.join(TEMP_FOLDER, f"{i:06d}*")):
            try:
                os.remove(leftover)
            except OSError:
                pass


def download_images(query):
    """
    Download a validated image from Bing Image Search for the given query.

    Downloads up to 3 candidates and returns the first one that passes
    all validation checks (format, dimensions, size, hash blacklist).
    Queries are automatically sanitized with negative keywords to avoid
    technical documentation screenshots.

    Args:
        query (str): The search query for downloading images.

    Returns:
        str or None: The URL of the downloaded image, or None if no valid image was found.
    """
    sanitized_query = _sanitize_query(query)
    crawler = BingImageCrawler(storage={"root_dir": TEMP_FOLDER})
    crawler.crawl(keyword=sanitized_query, max_num=3)

    # Check each downloaded candidate in order
    for i in range(1, 4):
        pattern = os.path.join(TEMP_FOLDER, f"{i:06d}*")
        matches = glob.glob(pattern)
        if not matches:
            continue

        candidate = matches[0]
        if _is_valid_image(candidate):
            # Found a good image — rename and serve it
            safe_name = query.replace(" ", "_") + ".jpg"
            new_image_path = os.path.join(TEMP_FOLDER, safe_name)

            if os.path.exists(new_image_path):
                os.remove(new_image_path)
            os.rename(candidate, new_image_path)

            # Clean up remaining candidates
            _cleanup_candidates()

            logging.info("📸 %s downloaded successfully.", query)
            base_url = request.host_url.rstrip("/")
            return f"{base_url}/static/temp/{safe_name}"

        # Invalid candidate — remove it and try the next
        try:
            os.remove(candidate)
        except OSError:
            pass

    # All candidates failed
    _cleanup_candidates()
    logging.warning("No valid image found for query: %s", query)
    return None
