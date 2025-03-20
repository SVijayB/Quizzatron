"""
Initialize MongoDB database and upload trivia data from JSON files to MongoDB Atlas.
"""

import os
import json
from typing import Tuple, Optional
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, ConfigurationError

def initialize_database(conn_string: str, db_name: str = "trivia-qa") -> Optional[str]:
    """
    Initialize MongoDB database on MongoDB Atlas.

    Args:
        conn_string (str): MongoDB connection string
        db_name (str): Name of the MongoDB database

    Returns:
        Optional[str]: Name of the initialized database or None on error
    """
    try:
        # Connect to MongoDB Atlas
        with MongoClient(conn_string) as client:
            # Test connection
            client.admin.command("ping")
            print("Successfully connected to MongoDB Atlas!")

            # Get database
            client[db_name]
            return db_name

    except ConnectionFailure as e:
        print(f"Connection error: {e}")
    except ConfigurationError as e:
        print(f"Configuration error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
    
    return None

def upload_trivia_data(conn_string: str, json_dir: str, db_name: str = "trivia-qa") -> None:
    """
    Upload all JSON files from a directory to MongoDB Atlas, creating separate collections for each file.

    Args:
        conn_string (str): MongoDB connection string
        json_dir (str): Path to directory containing JSON files
        db_name (str): Name of the MongoDB database
    """
    # Initialize database connection
    with MongoClient(conn_string) as client:
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
                collection_name = " ".join(word.capitalize() for word in collection_name.split("-"))
                print(f"Processing {file_path} into collection '{collection_name}'...")

                try:
                    # Load JSON file
                    with open(file_path, "r", encoding="utf-8") as f:
                        questions = json.load(f)

                    # Get collection object and insert data
                    collection = db[collection_name]
                    if questions:
                        result = collection.insert_many(questions)
                        print(f"Inserted {len(result.inserted_ids)} documents into '{collection_name}' collection.")
                        total_documents += len(result.inserted_ids)
                    else:
                        print(f"No questions found in {json_file}")

                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON in {json_file}: {str(e)}")
                except IOError as e:
                    print(f"Error reading file {json_file}: {str(e)}")

            print(f"\nUpload complete! Added {total_documents} questions across all collections in '{db_name}'.")

        except Exception as e:
            print(f"Unexpected error during upload: {str(e)}")

if __name__ == "__main__":
    load_dotenv()
    mongo_conn_string = os.getenv("MONGO_CONNECTION_STRING")
    if not mongo_conn_string:
        print("Error: MONGO_CONNECTION_STRING not found in environment variables.")
    else:
        initialized_db = initialize_database(mongo_conn_string, db_name="trivia-qa")
        if initialized_db:
            print(f"Initialized database '{initialized_db}'.")
            upload_trivia_data(
                mongo_conn_string,
                r"D:\UW\Courses\Data515 - SoftwareDesign\OpenTriviaQA\json_files",
                db_name="trivia-qa",
            )
        else:
            print("Failed to initialize database.")
