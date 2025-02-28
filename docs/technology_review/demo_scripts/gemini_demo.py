from google import genai
import os
from dotenv import load_dotenv

# Load API key from .env file
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=GOOGLE_API_KEY)

# Define a prompt for generating a quiz question
prompt = """
Generate a single multiple-choice quiz question about Python programming.
The format should be:

Question:
A) Option 1
B) Option 2
C) Option 3
D) Option 4
Answer: Correct_Option
"""


response = client.models.generate_content(
            model="gemini-2.0-flash-lite", contents=prompt
        )
# Print the generated question
print("Generated Quiz Question:\n")
print(response.text.strip())
