import os
import openai
from dotenv import load_dotenv
from os import getenv

load_dotenv()
openai.api_key = getenv("OPENAI_API_KEY")
prompt_topic = "Class 10 CBSE Chemistry"
prompt_game_mode = "MCQ"
prompt_explanation = "True"
prompt_level = "Medium"
complete_prompt = f"""If it is appropriate, generate 10 unique questions about {prompt_topic} in the format {prompt_game_mode}.  
Return the answer with only the option, like "Answer: B)". Make these questions {prompt_level}.
If it is inappropriate, return only "no"."""

response = openai.Completion.create(
    model="text-davinci-003",
    prompt=complete_prompt,
    temperature=0.9,
    max_tokens=3516,
    top_p=1,
    frequency_penalty=0,
    presence_penalty=0.6,
    stop=[" Human:", " AI:"],
)

print(response)
