from icrawler.builtin import GoogleImageCrawler
import logging
import os
import glob

# Supressing all the icrawler logs
logging.getLogger("icrawler").setLevel(logging.CRITICAL)
logging.getLogger("feeder").setLevel(logging.CRITICAL)
logging.getLogger("parser").setLevel(logging.CRITICAL)
logging.getLogger("downloader").setLevel(logging.CRITICAL)


def cleanup_temp_folder():
    temp_folder = "temp"
    for image_file in glob.glob(os.path.join(temp_folder, "*")):
        os.remove(image_file)
    print("🧹 Clean-up activity completed.")


def download_images(query):
    filters = {
        "size": "medium",
        "license": "noncommercial",
    }
    google_crawler = GoogleImageCrawler(storage={"root_dir": "temp"})
    google_crawler.crawl(keyword=query, max_num=1, filters=filters)

    default_image_path = os.path.join("temp", "000001.jpg")
    query = query.replace(" ", "_")
    new_image_path = os.path.join("temp", f"{query}.jpg")
    os.rename(default_image_path, new_image_path)
    path = os.path.abspath(new_image_path)
    print(f"🖼️  {query} downloaded successfully.")
    return path
