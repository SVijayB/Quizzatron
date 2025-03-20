def get_mongodb_data(client, topic, num_questions=5, difficulty="hard"):
    # Access the database (the database name is 'trivia-qa' as per the screenshot)
    db = client["trivia-qa"]

    # Access the collection dynamically using 'topic'
    if topic in db.list_collection_names():  # Check if the collection exists
        collection = db[topic]

        # Use $sample to fetch `num_questions` random documents
        random_documents = collection.aggregate(
            [{"$sample": {"size": int(num_questions)}}]
        )

        # Convert the cursor to a list and transform documents into the desired format
        formatted_questions = {"questions": []}
        for idx, doc in enumerate(random_documents, start=1):
            options = [
                f"A) {doc['options'][0]}",
                f"B) {doc['options'][1]}",
                f"C) {doc['options'][2]}",
                f"D) {doc['options'][3]}",
            ]

            correct_answer = (
                "A"
                if doc["correct_answer"] == doc["options"][0]
                else (
                    "B"
                    if doc["correct_answer"] == doc["options"][1]
                    else "C" if doc["correct_answer"] == doc["options"][2] else "D"
                )
            )

            formatted_question = {
                "index": idx,
                "question": doc["question"],
                "options": options,
                "correct_answer": correct_answer,
                "difficulty": difficulty,  # Use the provided difficulty parameter
                "image": False,  # Assuming no images are present
            }
            formatted_questions["questions"].append(formatted_question)
        return formatted_questions
    else:
        return None
