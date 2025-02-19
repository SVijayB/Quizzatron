from duckduckgo_search import DDGS


def get_image_urls(query):
    with DDGS() as ddgs:
        results = ddgs.images(query, max_results=1)
        image_url = [result["image"] for result in results]
    return image_url


def main():
    query = input("Enter the search query: ")
    print(get_image_urls(query))


if __name__ == "__main__":
    main()
