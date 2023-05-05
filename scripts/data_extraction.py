from pprint import pprint

text = """
\n\n1) In a balanced redox reaction, the number  of electrons lost by the reducing agent is equal to the \nnumber of electrons gained by the oxidising agent. This statement is called:\nA) Oxidation-Reduction Law\nB) Conservation of Mass\nC) Neutralization Theory\nD) Mass Action Law\nAnswer: A) Oxidation-Reduction Law\n\n2) What type of reaction does balancing of a redox reaction involve?\nA) Decomposition Reaction\nB) Combination Reaction\nC) Single Displacement Reaction\nD) Double Displacement Reaction\nAnswer: B) Combination Reaction\n\n3) The atom that undergoes oxidation in a redox reaction is called a\nA) Reductant\nB) Oxidant\nC) Catalyst\nD) Reactant\nAnswer: B) Oxidant\n\n4) Which of the following elements undergoes reduction during electrolysis of sodium chloride solution?\nA) Sodium\nB) Oxygen\nC) Chlorine\nD) Hydrogen\nAnswer: C) Chlorine\n\n5) What type of reaction is exhibited when a metal reacts with oxygen to form an oxide?\nA) Combustion Reaction\nB) Single Displacement Reaction\nC) Double Displacement Reaction\nD) Redox Reaction\nAnswer: D) Redox Reaction\n\n6) Which of the following is a fundamental law of redox reactions?\nA) Activation Energy\nB) Conservation of Mass\nC) Neutralization Theory\nD) Law of Multiple Proportions\nAnswer: B) Conservation of Mass\n\n7) What is the product when sodium metal reacts with chlorine gas to form sodium chloride?\nA) Sodium Oxide\nB) Sodium Hydroxide\nC) Sodium Chloride\nD) Sodium Carbonate\nAnswer: C) Sodium Chloride\n\n8) What is the oxidising agent in the reaction below?\n2H2 + O2 \u2192 2H2O\nA) Hydrogen\nB) Oxygen\nC) Water\nD) None of the above\nAnswer: B) Oxygen\n\n9) What is the reducing agent in the reaction below?\n2Fe + 3O2 \u2192 2Fe2O3\nA) Iron\nB) Oxygen\nC) Iron Oxide\nD) None of the above\nAnswer: A) Iron\n\n10) What type of reaction occurs when sulfur dioxide and oxygen react to form sulfur trioxide?\nA) Combination Reaction\nB) Decomposition Reaction\nC Redox Reaction\nD) Single Displacement Reaction\nAnswer: C Redox Reaction

n\n1) Which out of the following reactions is an example of inter-conversion of energy? \nA) Combustion \nB) Photosynthesis\nC) Respiration\nD) Electrolysis\nAnswer: B) Photosynthesis\n\n2) Which gas is liberated during the electrolysis of water?\nA) Nitrogen\nB) Oxygen\nC) Helium\nD) Hydrogen\nAnswer: D) Hydrogen\n\n3) What is the catalyst in the Haber process?\nA) Nickel \nB) Iron\nC) Copper\nD) Platinum\nAnswer: D) Platinum\n\n4) Which among these is not an acid?\nA) Benzoic Acid \nB) Acetic Acid\nC) Hydrochloric Acid\nD) Sodium Hydroxide\nAnswer: D) Sodium Hydroxide\n\n5) What is the reaction between hydrochloric acid and sodium hydroxide called?\nA) Neutralization \nB) Oxidation\nC) Reduction\nD) Hydrolysis\nAnswer: A) Neutralization\n\n6) What type of reaction is the oxidation of magnesium?\nA) Oxidation-reduction \nB) Double displacement\nC) Combustion\nD) Single displacement\nAnswer: A) Oxidation-reduction\n\n7) What are the products of the reaction between sodium and chlorine?\nA) Sodium chloride and water \nB) Sodium oxide and chlorine\nC) Sodium chloride and sodium oxide\nD) Sodium oxide and oxygen\nAnswer: A) Sodium chloride and water\n\n8) What are hydrocarbons?\nA) Compounds containing only hydrogen and carbon \nB) Compounds containing both hydrogen and oxygen\nC) Compounds containing only oxygen and nitrogen\nD) Compounds containing only nitrogen and carbon\nAnswer: A) Compounds containing only hydrogen and carbon\n\n9) What type of chemical reaction is burning?\nA) Oxidation \nB) Combustion\nC) Reduction\nD) Neutralization\nAnswer: B) Combustion\n\n10) What is the name of the compound formed by the reaction between ethanol and ethanoic acid?\nA) Ethyl hydrochloride \nB) Ethyl ethanoate\nC) Ethanol acetate\nD) Acetic acid ester\nAnswer: B) Ethyl ethanoate
"""
data = []

questions = text.split("\n\n")
ID = -1
for q in questions:
    # split the question into question statement and options
    q_parts = q.split("\n")
    question = q_parts[0][3:-1]  # extract the question statement

    # extract the options and answer
    options = [part[3:] for part in q_parts[1:-1]]
    answer = q_parts[-1][8:]
    answer = answer[3:]

    # create a dictionary for the question and append it to the data list
    q_dict = {"question": question, "options": options, "answer": answer, "ID": ID}
    data.append(q_dict)
    ID += 1

data = data[2:-1]
pprint(data)
