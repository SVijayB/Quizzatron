# Functional Specification

## User Stories

## End User

#### Who

-   Students.
-   Professors.
-   General Audience.
-   Trivia Enthusiasts.

#### Wants

-   Multiple choice questions of any topic of desire.

#### Interaction methods

-   Web interface.
-   Uploading a document (Pdf/Docx/Txt).

#### Needs

-   A fun way to learn and test knowledge.
-   Play with friends and family.
-   Helps in preparing for exams.

#### Skills

-   No technical skills required.

## Developer leveraging the API

#### Wants

-   To integrate the API into their application.
-   To use the API to generate questions.

#### Interaction methods

-   API calls.

#### Needs

-   API Documentation.
-   API Key.

#### Skills

-   Basic understanding of API calls.
-   Technical skills to integrate API.

## Data Scientist

#### Wants

-   To work with and tweak the custom model for generating questions.

#### Interaction methods

-   Model training.
-   Tweaking and working with the model.

#### Needs

-   Data regarding the model.

#### Skills

-   Highly technical skills.
-   Understanding of machine learning models.
-   Working with multimodal data.

---

## Functional Design

## End users

#### Explicit use cases

-   User can upload a topic.
-   Take a Quiz.
-   Check leaderboard.
-   Show previous quiz results.

User: Students, Professors, General Audience, Trivia Enthusiasts.
User: Provides a document.
System: Asks difficulty level and gives sample questions to understand the level.
User: Chooses number of questions and picks a difficulty level.
System: Generates questions and asks user to play or export it.
User: Plays game or exports it.
System: Shows results plus an option to expore it as PDF/JSON data (in the end).

#### Implicit use cases

-   Document input (Uploading it).
-   Quiz generation.
-   Leaderboard generation.

## Developers

#### Explicit use cases

-   User can send an API key, and get a response.

#### Implicit use cases

-   User has an API key.
-   User has access to the API documentation.

## Data Scientists

#### Explicit use cases

-   User can tweak the model.
-   User can generate questions.

#### Implicit use cases

-   User has access to the model.
-   User has access to the data.
