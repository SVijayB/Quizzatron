from PyInquirer import prompt
import os
import requests
import json
from rich.console import Console
import time

if __name__ == "__main__":
    os.system("cls")
    console = Console()

    logo = open("../assets/logo.txt", "r")
    logo_output = "".join(logo.readlines())
    console.print(logo_output, style="white")
    console.print("\n" + "-" * 20, style="green")
    console.print("Quizzatron | v1.0.0", style="cyan")
    print("\n")
    time.sleep(1)

    questions = [
        {
            "type": "input",
            "name": "topic",
            "message": "Enter the topic you want to generate questions for: ",
        }
    ]
    topic = prompt(questions)
    topic = topic["topic"]

    questions = [
        {
            "type": "list",
            "name": "level",
            "message": "Select difficulty level: ",
            "choices": ["Easy", "Medium", "Hard"],
        }
    ]
    level = prompt(questions)
    level = level["level"]

    with console.status("[bold green]Generating questions...") as status:
        while True:
            url = "http://127.0.0.1:5000/api/core/generate-mcq"
            form_data = {
                "topic": topic,
                "game_mode": "Multiple Choice (4 options)",
                "level": level,
            }
            server = requests.post(url, data=form_data)
            output = json.loads(server.text)
            break

    score = 0
    os.system("cls")
    console.print(logo_output, style="white")
    console.print("\n" + "-" * 20, style="green")
    for element in output:
        questions = [
            {
                "type": "list",
                "name": "question",
                "message": element["question"],
                "choices": [
                    element["options"][0],
                    element["options"][1],
                    element["options"][2],
                    element["options"][3],
                ],
            }
        ]
        answers = prompt(questions)
        input_type = answers["question"]
        if input_type == element["answer"]:
            console.print("Correct!", style="bold green")
            score += 1
            print("\n")
        else:
            console.print("Wrong!", style="bold red")
            print("The correct answer is: " + element["answer"])
            print("\n")

    console.print("\n" + "-" * 20, style="bold red")
    console.print("Your score is: " + str(score), style="bold blue")
