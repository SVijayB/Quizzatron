# Functional Specification - Quizzatron

## 1. Background  
Quizzatron is designed to provide an **AI-powered quiz generation and retrieval system**. Users can either **generate a quiz** based on any topic or **retrieve a pre-existing quiz** from a categorized collection. The system allows users to:  
- Input a **topic or PDF** to generate a quiz using **LLMs (Gemini/DeepSeek)**.  
- Choose the **difficulty level** and whether to include **images** in the quiz.  
- Retrieve quizzes from **MongoDB** or an **external Quiz API**.  
- Play an **interactive quiz game**, answering multiple-choice questions within a time limit.  
- Access the **Flask API** to programmatically generate quizzes for external applications.  

This system addresses the need for **automated quiz generation**, making **learning and assessment** more engaging and dynamic.  

---

## 2. User Profile  
### 🎯 **Primary Users:**  
1. **Students & Learners** – Want to generate quizzes to test their knowledge on various topics.  
2. **Educators & Trainers** – Need a tool to create quizzes quickly for teaching purposes.  
3. **Casual Users** – Interested in playing quizzes for fun.  
4. **Programmers & Developers** – Want to **integrate quiz generation** into their own applications using the **Flask API**.

### 💡 **Technical Knowledge Assumptions:**  
- **Students, Educators, and Casual Users:**  
  - Can **browse the web** and **interact with UI elements**.  
  - No programming experience is required.  
  - Should be able to **upload PDFs** and **select quiz settings** easily.  
- **Programmers & Developers:**  
  - Can make API requests using **HTTP clients (Postman, cURL, Python requests, etc.)**.  
  - Understand JSON responses and backend integration.  

---

## 3. Data Sources  
### 📂 **Data Used in Quizzatron**  
- **User Input Data:**  
  - Topics entered via **search bar**.  
  - PDFs uploaded for **quiz generation**.  
  - User selections: **difficulty level, model choice, image-based or text-only quiz**.  
- **Pre-Stored Quiz Data:**  
  - **MongoDB** stores **curated quizzes** for predefined categories.  
  - **External Quiz API** provides quizzes from its **own database**.  
- **Generated Quiz Data:**  
  - **Gemini/DeepSeek LLMs** generate questions based on user input.  
  - **IWebCrawler** fetches images for **image-based quizzes**.  

📌 **Structure of Data:**  
- **Quiz Format (JSON)**

This is the JSON formatted quiz structure for a quiz - either retrieved from the MongoDB pre-stored quiz categories, from the quiz API, or using the LLM quiz generation.
  ```json
    {
        "questions": [
            {
                "index": 1,
                "question": "Which country does this national flag belong to?",
                "options": ["A) India", "B) Japan", "C) Germany", "D) France"],
                "correct_answer": "B",
                "difficulty": "medium",
                "image": "National flag of Japan"
            },
            {
                "index": 2,
                "question": "Which company does this logo represent?",
                "options": ["A) Apple", "B) Tesla", "C) Microsoft", "D) Amazon"],
                "correct_answer": "C",
                "difficulty": "medium",
                "image": "Microsoft logo"
            }
        ]
    }

```

## 4. Use Cases  

### **Use Case 1: Generating a Quiz on a User-Entered Topic**
📌 **Objective:** The user wants to generate a **custom AI-powered quiz** on a topic of choice.  

🔄 **User-System Interaction:**  
1. **User enters a topic** (e.g., "Machine Learning") or **uploads a PDF**.  
2. **User selects quiz settings** (difficulty, model, image-based or not).  
3. **The system processes the request**:  
   - Sends the topic to **Gemini/DeepSeek** for question generation.  
   - If images are needed, it uses **IWebCrawler** to fetch relevant images.  
4. **The generated quiz is displayed** in a **game format**:  
   - One question appears at a time with **four answer choices**.  
   - A **10-second countdown timer** starts.  
   - User selects an answer (faster answers get higher points).  
5. **At the end of the quiz**, the system shows:  
   - **Total score**  
   - **Correct and incorrect answers**  

---

### **Use Case 2: Playing a Pre-Stored Quiz from a Category**
📌 **Objective:** The user wants to **play a quiz from an existing category** instead of generating one.  

🔄 **User-System Interaction:**  
1. **User selects the "Pre-Stored Quiz" option**.  
2. **User browses quiz categories** (e.g., Science, History, Technology).  
3. **The system retrieves quizzes** from **MongoDB** or the **external Quiz API**.  
4. **The selected quiz is displayed** in the **same interactive format**:  
   - One question at a time, **four answer options**, and a **10-second timer**.  
   - User selects answers; score updates dynamically.  
5. **At the end of the quiz**, the system shows:  
   - **Total score**  
   - **Correct and incorrect answers**  

---

### **Use Case 3: Using the API for Quiz Generation (Developers)**
📌 **Objective:** A developer wants to **integrate Quizzatron's quiz generation** into their own application.  

🔄 **User-System Interaction:**  
1. **Developer sends a GET request** to the API with the following JSON payload:  (Example)
```plaintext
http://127.0.0.1:5000/api/quiz/generate?model=gemini&topic=science&difficulty=medium&num_questions=5&image=true
```

2. The Flask API processes the request and forwards it to the appropriate LLM (DeepSeek/Gemini).
3. The system generates the quiz and returns a JSON response with quiz questions.
4. The developer integrates the response into their own application.

## 5. User Stories  

### **User Story 1: Student Uploading a PDF for Quiz Generation**  
#### **Scenario:** A student wants to test their knowledge on **lecture notes** from a PDF.  

**User:** Uploads a **PDF file** and selects **medium difficulty**.  
**System:** Extracts text from the PDF and sends it to the **LLM for quiz generation**.  
**System:** Returns a **set of multiple-choice questions** based on the content.  
**User:** Starts playing the **quiz game** with a **10-second timer** per question.  
**User:** Completes the quiz and views the **final score & correct answers**.  

Hence, the student learns about the chapter in the PDF by playing the quiz

---
### **User Story 2: Programmer Integrating the API into an E-Learning App**  
#### **Scenario:** A developer is building an e-learning platform and wants to add **AI-generated quizzes**.  

**User (Developer):** Sends a **GET request** to Quizzatron’s Flask API using query parameters:  (Example)

```plaintext
http://127.0.0.1:5000/api/quiz/generate?model=gemini&topic=science&difficulty=medium&num_questions=5&image=true
```

**System**: Processes the request and forwards it to the appropriate LLM (Gemini/DeepSeek).

**System**: Returns a structured JSON response containing quiz questions.

**User (Programmer)**: Parses the JSON response and integrates the quiz into their application.

---

