import os
import openai
from dotenv import load_dotenv
from os import getenv

load_dotenv()
openai.api_key = getenv("OPENAI_API_KEY")
prompt_topic = "Class 10 CBSE Questions"

response = openai.Completion.create(
    model="text-davinci-003",
    prompt=f"Generate a unique multiple choice question about {prompt_topic} that has not been asked before in this session.",
    temperature=0,
    max_tokens=60,
    top_p=1,
    frequency_penalty=0,
    presence_penalty=0,
)

print(response)
