from api.services.quiz_gen_service import generate_quiz


def test_generate_quiz_with_all_parameters():
    print(
        generate_quiz(
            topic="animals",
            pdf=None,
            model="gemini",
            difficulty="medium",
            num_questions=5,
            image="true",
        )
    )


test_generate_quiz_with_all_parameters()
