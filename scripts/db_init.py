"""
Initialize MongoDB database and upload trivia data from JSON files to MongoDB Atlas.
"""

import os
import json
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ConfigurationError


def initialize_database(connection_string, db_name="trivia-qa"):
    """
    Initialize MongoDB database and collection on MongoDB Atlas.

    Args:
        connection_string (str): MongoDB connection string
        db_name (str): Name of the MongoDB database
        collection_name (str): Name of the collection to create

    Returns:
        tuple: (client, database, collection) objects or (None, None, None) on error
    """
    try:
        # Connect to MongoDB Atlas
        client = MongoClient(connection_string)

        # Test connection
        client.admin.command("ping")
        print("Successfully connected to MongoDB Atlas!")

        # Get database and collection
        db = client[db_name]

        client.close()
        return db_name

    except ConnectionFailure as e:
        print(f"Connection error: {e}")
        return None, None, None
    except ConfigurationError as e:
        print(f"Configuration error: {e}")
        return None, None, None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None, None, None


def upload_trivia_data(connection_string, json_dir, db_name="trivia-qa"):
    """
    Upload all JSON files from a directory to MongoDB Atlas, creating separate collections for each file.

    Args:
        connection_string (str): MongoDB connection string
        json_dir (str): Path to directory containing JSON files
        db_name (str): Name of the MongoDB database
    """
    # Initialize database connection
    client = MongoClient(connection_string)
    if not client:
        print("Failed to initialize database connection.")
        return

    try:
        # Get database object
        db = client[db_name]

        # Check if directory exists
        if not os.path.isdir(json_dir):
            print(f"Error: The directory '{json_dir}' does not exist.")
            return

        # Get all JSON files
        json_files = [f for f in os.listdir(json_dir) if f.endswith(".json")]

        if not json_files:
            print(f"No JSON files found in {json_dir}")
            return

        total_documents = 0

        # Process each JSON file and create a separate collection
        for json_file in json_files:
            file_path = os.path.join(json_dir, json_file)
            collection_name = os.path.splitext(json_file)[0]  # Remove .json extension
            print(f"Processing {file_path} into collection '{collection_name}'...")

            try:
                # Load JSON file
                with open(file_path, "r", encoding="utf-8") as f:
                    questions = json.load(f)

                # Get collection object and insert data
                collection = db[collection_name]
                if questions:
                    result = collection.insert_many(questions)
                    print(
                        f"Inserted {len(result.inserted_ids)} documents into '{collection_name}' collection."
                    )
                    total_documents += len(result.inserted_ids)
                else:
                    print(f"No questions found in {json_file}")

            except Exception as e:
                print(f"Error processing {json_file}: {str(e)}")

        print(
            f"\nUpload complete! Added {total_documents} questions across all collections in '{db_name}'."
        )

    finally:
        # Close connection
        client.close()
        print("Database connection closed")


if __name__ == "__main__":
    load_dotenv()
    connection_string = os.getenv("MONGO_CONNECTION_STRING")
    db = initialize_database(connection_string, db_name="trivia-qa")
    print(f"Initialized database '{db}'.")
    upload_trivia_data(
        connection_string,
        r"PATH_TO_JSON_FILES(CONVERTED_FROM_https://github.com/uberspot/OpenTriviaQA)",
        db_name="trivia-qa",
    )
