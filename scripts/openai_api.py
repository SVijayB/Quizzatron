from pprint import pprint
import openai
from dotenv import load_dotenv
from os import getenv
import json

load_dotenv()
openai.api_key = getenv("OPENAI_API_KEY")
prompt_topic = "Marvel's MCU"
prompt_game_mode = "Multiple Choice (4 options)"
prompt_explanation = "True"
prompt_level = "Easy"
prompt_format = """[{"question":"", "options":["option1","option2","option3","option4"], "answer":"", "ID":""}]"""
complete_prompt = f"""Generate 10 unique questions about {prompt_topic} in the format of {prompt_game_mode}. Make these questions {prompt_level}.
Return the response as a JSON object with the following format: {prompt_format}
"""

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

data = response["choices"][0]["text"]
data = data.replace("\n", "").replace("\t", "")

questions = json.loads(data)
pprint(questions)
