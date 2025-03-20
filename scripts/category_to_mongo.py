"""
This script connects to the Quizzatron MongoDB database and inserts categories data
from the Open Trivia Database (opentdb) API into a MongoDB collection.
"""

import urllib.parse
import requests
import pymongo as pm

CATEGORIES_URL = "https://opentdb.com/api_category.php"
MONGO_URL = (
    "mongodb+srv://aravindh:"
    + urllib.parse.quote_plus("Jumpforce@1")
    + "@quizzatron.isdnz.mongodb.net/?retryWrites=true&w=majority&appName=Quizzatron"
)


def connect_to_mongo(mongo_url):
    """
    Connects to the MongoDB database.

    Args:
        mongo_url (str): The MongoDB connection string.

    Returns:
        pymongo.MongoClient: The MongoDB client instance.

    Raises:
        Exception: If the connection fails.
    """
    try:
        client = pm.MongoClient(mongo_url)
        client.admin.command(
            "ping"
        )  # The `ping` command checks if the server is reachable
        print("✅ Successfully connected to MongoDB!")
        return client
    except Exception as error:
        print("❌ Connection failed:", error)
        raise


def fetch_categories(api_url):
    """
    Fetches categories data from the opentdb API.

    Args:
        api_url (str): The API endpoint URL.

    Returns:
        dict: The JSON response from the API.

    Raises:
        requests.exceptions.RequestException: If the API request fails.
    """
    try:
        response = requests.get(api_url, timeout=5)  # Set timeout to 5 seconds
        response.raise_for_status()  # Raise an error for bad responses (4xx, 5xx)
        data = response.json()  # Convert to JSON
        print("✅ Data received:", data)
        return data
    except requests.exceptions.RequestException as error:
        print("❌ API Request Failed:", error)
        raise


def insert_categories_to_mongo(client, data):
    """
    Inserts categories data into the MongoDB collection.

    Args:
        client (pymongo.MongoClient): The MongoDB client instance.
        data (dict): The categories data to insert.

    Returns:
        pymongo.results.UpdateResult: The result of the upsert operation.
    """
    db = client["opent_db"]
    collection = db["categories"]

    document = collection.find_one()
    if document:
        print("✅ Found a document:", document)
    else:
        print("⚠️ No documents found in the collection.")

    # Insert or update the document in MongoDB
    result = collection.update_one(data, {"$setOnInsert": data}, upsert=True)
    print(f"Inserted document ID: {result.upserted_id}")
    return result


def main():
    """
    Main function to connect to MongoDB, fetch categories data from the API,
    and insert the data into the MongoDB collection.
    """
    client = connect_to_mongo(MONGO_URL)
    categories_data = fetch_categories(CATEGORIES_URL)
    insert_categories_to_mongo(client, categories_data)


if __name__ == "__main__":
    main()
