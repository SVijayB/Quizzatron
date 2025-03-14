from icrawler.builtin import GoogleImageCrawler


def fetch_images(query, max_num=3):
    """Downloads images based on a search query."""
    crawler = GoogleImageCrawler(storage={"root_dir": "downloaded_images"})
    crawler.crawl(keyword=query, max_num=max_num)


# Example: Search for "Python programming logo"
fetch_images("Python programming logo")
print("✅ Images downloaded successfully! Check the 'downloaded_images' folder.")
