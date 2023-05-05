from pprint import pprint

text = """
\n\nQ1. Who is the primary villain in the first Iron Man movie?\nA. Mandarin\nB. Aldrich Killian\nC. Obadiah Stane\nD. Justin Hammer\n\nAnswer: C. Obadiah Stane\n\nQ2. What is the primary weapon of Captain America?\nA. Mjolnir\nB. Shield of Vibranium\nC. Infinity Gauntlet\nD. Repulsor Gauntlets\n\nAnswer: B. Shield of Vibranium\n\nQ3. What is the name of the Asgardian Goddess of Death?\nA. Hela\nB. Sif\nC. Odin\nD. Heimdall\n\nAnswer: A. Hela\n\nQ4. Which Marvel Superhero has red and gold armor?\nA. Doctor Strange\nB. Iron Man\nC. The Winter Soldier\nD. Star-lord\n\nAnswer: B. Iron Man\n\nQ5. When did Captain America fight alongside the Avengers for the first time?\nA. Age of Ultron\nB. Civil War\nC. Infinity War\nD. The First Avenger\n\nAnswer: A. Age of Ultron\n\nQ6. What is the name of Thor's hammer?\nA. Stormbreaker\nB. Shield of Vibranium\nC. Mjolnir\nD. Infinity Gauntlet\n\nAnswer: C. Mjolnir\n\nQ7. In what year was the first Iron Man movie released?\nA. 2010\nB. 2008\nC. 2012\nD. 2014\n\nAnswer: B. 2008\n\nQ8. What color is Thanos' armor?\nA. Blue\nB. Red\nC. Yellow\nD. Purple\n\nAnswer: D. Purple\n\nQ9. Who is the antagonist in the movie Black Panther?\nA. Helmut Zemo\nB. Ultron\nC. Erik Killmonger\nD. Obadiah Stane\n\nAnswer: C. Erik Killmonger\n\nQ10. What is Loki's brother's name?\nA. Vision\nB. Thor\nC. Odin\nD. Heimdall\n\nAnswer: B. Thor
"""
data = []

questions = text.split("\n\n")
ID = -1
# Remove any empty strings from the list
questions = list(filter(None, questions))

for q in questions:
    # Extract question and answer
    q_split = q.split("\nAnswer: ")
    question = q_split[0].replace("\n", " ")
    answer = q_split[1]

    # Extract options
    options_start = question.find("A. ")
    options_end = question.find("\n", options_start)
    options = question[options_start:options_end].split("\n")
    options = [o.strip() for o in options]

    # Remove options from question
    question = question[:options_start]

    # Append to data list
    data.append({"question": question, "options": options, "answer": answer, "ID": ID})
    ID += 1

data = data[2:-1]
pprint(data)
