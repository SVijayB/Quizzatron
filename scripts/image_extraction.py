from bing_image_downloader import downloader
import os
import shutil


def download_images(queries):
    for query in queries:
        downloader.download(
            query,
            limit=1,
            output_dir="temp",
            force_replace=False,
            timeout=5,
            verbose=False,
        )

        filename = f"{query.replace(' ', '_').lower()}.jpg"
        download_folder = os.path.join("temp", query)
        if not os.path.exists(download_folder):
            print(f"No images found for '{query}'")
            continue

        image_files = [
            file
            for file in os.listdir(download_folder)
            if file.endswith((".jpg", ".png", ".jpeg"))
        ]

        if image_files:
            first_image_path = os.path.join(download_folder, image_files[0])
            new_image_path = os.path.join("temp", filename)

            shutil.move(first_image_path, new_image_path)
            shutil.rmtree(download_folder)

            print(f"Image saved as {new_image_path}")
        else:
            print(f"No valid images found for '{query}'")

    return "All images downloaded to the temp folder."


def main():
    query = input("Enter the search query: ")
    print(download_images([query]))


if __name__ == "__main__":
    main()
