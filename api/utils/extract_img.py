from icrawler.builtin import GoogleImageCrawler
from flask import request
import logging
import os
import glob

logging.getLogger("icrawler").setLevel(logging.CRITICAL)
logging.getLogger("feeder").setLevel(logging.CRITICAL)
logging.getLogger("parser").setLevel(logging.CRITICAL)
logging.getLogger("downloader").setLevel(logging.CRITICAL)

TEMP_FOLDER = "api/static/temp"
os.makedirs(TEMP_FOLDER, exist_ok=True)


def cleanup_temp_folder():
    """Remove all images from the temp folder."""
    for image_file in glob.glob(os.path.join(TEMP_FOLDER, "*")):
        os.remove(image_file)
    logging.info("🧹 Clean-up activity completed.")


def download_images(query):
    filters = {"size": "medium", "license": "noncommercial"}
    google_crawler = GoogleImageCrawler(storage={"root_dir": TEMP_FOLDER})
    google_crawler.crawl(keyword=query, max_num=1, filters=filters)

    downloaded_images = glob.glob(os.path.join(TEMP_FOLDER, "000001*"))
    if downloaded_images:
        original_image_path = downloaded_images[0]
        sanitized_query = query.replace(" ", "_") + ".jpg"
        new_image_path = os.path.join(TEMP_FOLDER, sanitized_query)

        if os.path.exists(new_image_path):
            os.remove(new_image_path)
        os.rename(original_image_path, new_image_path)

        logging.info(f"📸 {query} downloaded successfully.")
        base_url = request.host_url.rstrip("/")
        return f"{base_url}/static/temp/{sanitized_query}"
    else:
        logging.warning(f"No image found for query: {query}")
        return None
