"""Content-source tests: images, documents, and trivia providers."""

from __future__ import annotations

import io

import pytest
import requests

from api.content import images, trivia
from api.content.documents import DocumentError, extract_pdf_text, summarise_source
from api.models.quiz import Difficulty, QuestionSource


class _Response:
    """Minimal stand-in for a ``requests`` response."""

    def __init__(self, payload: object, status: int = 200) -> None:
        self._payload = payload
        self.status_code = status

    def json(self) -> object:
        """Return the canned payload."""
        return self._payload

    def raise_for_status(self) -> None:
        """Mimic requests' status check."""
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}")


class TestImageQueryNormalisation:
    """Descriptor words send the search to the wrong article."""

    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("national flag of Japan", "national flag Japan"),
            ("Nikola Tesla portrait", "Nikola Tesla"),
            ("the Eiffel Tower photo", "Eiffel Tower"),
            ("a map of Rome", "map Rome"),
            ("official portrait of Marie Curie", "Marie Curie"),
        ],
    )
    def test_strips_descriptors(self, raw: str, expected: str) -> None:
        """Only the subject survives."""
        assert images._normalise_query(raw) == expected

    @pytest.mark.parametrize(
        "subject", ["map", "diagram", "emblem", "painting", "artwork", "sculpture"]
    )
    def test_keeps_words_that_are_real_subjects(self, subject: str) -> None:
        """These describe a subject, not a medium, so stripping them would change
        what the question asks about."""
        assert subject in images._normalise_query(f"{subject} of the Roman Empire")

    def test_never_strips_everything(self) -> None:
        """An all-descriptor query keeps its original text."""
        assert images._normalise_query("photo illustration") == "photo illustration"


class TestImageResolution:
    """Image lookup replaces v1's crawler, which wrote LLM-derived filenames to
    disk and called ``os.remove``/``os.rename`` on them (path traversal)."""

    def test_picks_best_title_match(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """The closest page title wins, not merely the first result."""
        payload = {
            "query": {
                "pages": [
                    {
                        "title": "List of flags of Asia",
                        "thumbnail": {"source": "https://x/list.jpg"},
                    },
                    {"title": "Flag of Japan", "original": {"source": "https://x/japan.svg"}},
                ]
            }
        }
        monkeypatch.setattr("requests.get", lambda *a, **k: _Response(payload))
        assert images.resolve_image("flag of Japan") == "https://x/japan.svg"

    def test_strips_tracking_params(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Analytics parameters are removed from the served URL."""
        payload = {
            "query": {
                "pages": [
                    {"title": "Mars", "original": {"source": "https://x/m.jpg?utm_source=wiki&w=9"}}
                ]
            }
        }
        monkeypatch.setattr("requests.get", lambda *a, **k: _Response(payload))
        assert images.resolve_image("Mars") == "https://x/m.jpg?w=9"

    def test_no_results_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """A miss is None, not an exception and not the string "False"."""
        monkeypatch.setattr("requests.get", lambda *a, **k: _Response({"query": {"pages": []}}))
        assert images.resolve_image("qwertyuiop nonsense") is None

    def test_network_failure_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """A provider outage costs an image, not the request."""

        def boom(*args: object, **kwargs: object):
            raise requests.RequestException("down")

        monkeypatch.setattr("requests.get", boom)
        assert images.resolve_image("Mars") is None

    @pytest.mark.parametrize("value", [None, "", "   "])
    def test_blank_query_short_circuits(self, value: object) -> None:
        """No query means no lookup, so no network call is attempted."""
        assert images.resolve_image(value) is None

    def test_resolve_images_preserves_order_and_gaps(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Order is preserved and Nones stay in place."""

        def fake(url: str, **kwargs: object):
            subject = kwargs.get("params", {}).get("gsrsearch", "")
            return _Response(
                {"query": {"pages": [{"title": subject, "original": {"source": f"u/{subject}"}}]}}
            )

        monkeypatch.setattr("requests.get", fake)
        result = images.resolve_images(["Mars", None, "Venus", ""])
        assert result[1] is None and result[3] is None
        assert result[0] == "u/Mars" and result[2] == "u/Venus"

    def test_results_are_cached(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Repeat queries do not re-hit the network."""
        calls = {"n": 0}

        def counting(*args: object, **kwargs: object):
            calls["n"] += 1
            return _Response({"query": {"pages": [{"title": "Mars", "original": {"source": "u"}}]}})

        monkeypatch.setattr("requests.get", counting)
        images.resolve_image("Mars")
        images.resolve_image("Mars")
        assert calls["n"] == 1


class TestDocuments:
    """PDF extraction."""

    def _pdf(self, pages: int = 1) -> bytes:
        from pypdf import PdfWriter

        writer = PdfWriter()
        for _ in range(pages):
            writer.add_blank_page(width=200, height=200)
        buffer = io.BytesIO()
        writer.write(buffer)
        return buffer.getvalue()

    def test_rejects_non_pdf_bytes(self) -> None:
        """Garbage in gives a clear error, not a raw exception."""
        with pytest.raises(DocumentError, match="could not be read"):
            extract_pdf_text(b"this is not a pdf at all")

    def test_blank_pdf_reports_no_text(self) -> None:
        """Scanned PDFs get an actionable message."""
        with pytest.raises(DocumentError, match="No text"):
            extract_pdf_text(self._pdf(2))

    def test_truncates_to_char_limit(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """v1 had no page or character cap at all."""
        from api.core import config

        monkeypatch.setenv("FLASK_ENV", "TEST")
        settings = config.get_settings()
        long_text = "word " * 20000

        class _Page:
            def extract_text(self) -> str:
                return long_text

        class _Reader:
            is_encrypted = False
            pages = [_Page() for _ in range(10)]

        monkeypatch.setattr("api.content.documents.PdfReader", lambda *a, **k: _Reader())
        text = extract_pdf_text(b"%PDF-fake")
        assert len(text) <= settings.max_pdf_chars

    def test_extract_text_called_once_per_page(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """v1 called ``extract_text()`` twice per page, doubling parse cost."""
        calls = {"n": 0}

        class _Page:
            def extract_text(self) -> str:
                calls["n"] += 1
                return "Some content."

        class _Reader:
            is_encrypted = False
            pages = [_Page() for _ in range(5)]

        monkeypatch.setattr("api.content.documents.PdfReader", lambda *a, **k: _Reader())
        extract_pdf_text(b"%PDF-fake")
        assert calls["n"] == 5

    def test_summarise_source(self) -> None:
        """A readable topic label is derived from the first line."""
        assert summarise_source("Roman History\n\nChapter 1") == "Roman History"
        assert summarise_source("") == "Uploaded document"
        assert summarise_source("x " * 200).endswith("...")


class TestOpenTdb:
    """OpenTDB question fetching."""

    def _payload(self, count: int = 2, code: int = 0) -> dict:
        return {
            "response_code": code,
            "results": [
                {
                    "question": f"Question {i}?",
                    "correct_answer": f"Right{i}",
                    "incorrect_answers": [f"Wrong{i}a", f"Wrong{i}b", f"Wrong{i}c"],
                    "difficulty": "easy",
                }
                for i in range(count)
            ],
        }

    @pytest.fixture
    def _categories(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            trivia,
            "_opentdb_categories",
            lambda: [trivia.Category("Science", QuestionSource.OPENTDB, "17")],
        )
        monkeypatch.setattr(trivia, "_mongo_categories", lambda: [])
        trivia.clear_category_cache()

    def test_fetches_and_normalises(self, monkeypatch: pytest.MonkeyPatch, _categories) -> None:
        """Questions arrive in the shared shape with the answer index resolved."""
        monkeypatch.setattr("requests.get", lambda *a, **k: _Response(self._payload()))
        questions = trivia.fetch_questions(
            category="Science", num_questions=2, difficulty=Difficulty.EASY
        )
        assert len(questions) == 2
        assert [q.index for q in questions] == [1, 2]
        for question in questions:
            assert len(question.options) == 4
            assert question.correct_option.startswith("Right")
            assert question.source is QuestionSource.OPENTDB

    @pytest.mark.parametrize(
        ("code", "fragment"),
        [(1, "Not enough questions"), (2, "not valid"), (4, "exhausted"), (5, "Too many")],
    )
    def test_response_codes_surface(
        self, monkeypatch: pytest.MonkeyPatch, _categories, code: int, fragment: str
    ) -> None:
        """v1 ignored ``response_code`` entirely, yielding silently empty quizzes."""
        monkeypatch.setattr("requests.get", lambda *a, **k: _Response(self._payload(0, code=code)))
        with pytest.raises(trivia.TriviaProviderError, match=fragment):
            trivia.fetch_questions(category="Science", num_questions=2, difficulty=Difficulty.EASY)

    def test_rate_limit_message(self, monkeypatch: pytest.MonkeyPatch, _categories) -> None:
        """A 429 says so rather than claiming the provider is unreachable."""
        monkeypatch.setattr("requests.get", lambda *a, **k: _Response({}, status=429))
        with pytest.raises(trivia.TriviaProviderError, match="rate-limiting"):
            trivia.fetch_questions(category="Science", num_questions=2, difficulty=Difficulty.EASY)

    def test_skips_malformed_results(self, monkeypatch: pytest.MonkeyPatch, _categories) -> None:
        """A result with the wrong number of wrong answers is dropped, not crashed on."""
        payload = self._payload(1)
        payload["results"].append(
            {
                "question": "Bad?",
                "correct_answer": "A",
                "incorrect_answers": ["B"],
                "difficulty": "easy",
            }
        )
        monkeypatch.setattr("requests.get", lambda *a, **k: _Response(payload))
        questions = trivia.fetch_questions(
            category="Science", num_questions=5, difficulty=Difficulty.EASY
        )
        assert len(questions) == 1

    def test_unknown_category(self, monkeypatch: pytest.MonkeyPatch, _categories) -> None:
        """An unrecognised category is an explicit error."""
        with pytest.raises(trivia.TriviaProviderError, match="Unknown category"):
            trivia.fetch_questions(category="Nope", num_questions=2, difficulty=Difficulty.EASY)


class TestMongoQuestions:
    """Document conversion, including the answer-key bug v1 shipped."""

    def _doc(self, **overrides: object) -> dict:
        doc: dict[str, object] = {
            "question": "Capital of France?",
            "options": ["Berlin", "Madrid", "Paris", "Rome"],
            "correct_answer": "Paris",
        }
        doc.update(overrides)
        return doc

    def test_resolves_answer_index(self) -> None:
        """The stored answer text is matched to its position."""
        question = trivia._question_from_mongo_doc(self._doc(), 1, Difficulty.EASY)
        assert question is not None
        assert question.correct_index == 2
        assert question.source is QuestionSource.MONGO

    def test_case_insensitive_answer_match(self) -> None:
        """Casing differences don't lose the answer."""
        question = trivia._question_from_mongo_doc(
            self._doc(correct_answer="paris"), 1, Difficulty.EASY
        )
        assert question is not None and question.correct_index == 2

    def test_unmatched_answer_is_skipped_not_defaulted_to_d(self) -> None:
        """v1's nested ternary fell through to "D", silently marking the wrong
        option correct whenever the stored answer matched nothing."""
        assert (
            trivia._question_from_mongo_doc(self._doc(correct_answer="Lisbon"), 1, Difficulty.EASY)
            is None
        )

    @pytest.mark.parametrize(
        "options", [["a", "b", "c"], ["a", "b", "c", "d", "e"], [], "notalist"]
    )
    def test_wrong_option_count_is_skipped(self, options: object) -> None:
        """v1 hard-indexed ``options[0..3]`` and raised IndexError."""
        assert (
            trivia._question_from_mongo_doc(
                self._doc(options=options, correct_answer="a"), 1, Difficulty.EASY
            )
            is None
        )

    def test_missing_fields_skipped(self) -> None:
        """Incomplete documents are dropped."""
        assert trivia._question_from_mongo_doc({}, 1, Difficulty.EASY) is None


class TestCategoryAggregation:
    """Category listing must never fail the request."""

    def test_degrades_when_both_sources_fail(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """v1 re-raised, producing a 500 and an empty UI list."""

        def boom(*args: object, **kwargs: object):
            raise requests.RequestException("down")

        monkeypatch.setattr("requests.get", boom)
        trivia.clear_category_cache()
        assert trivia.get_categories() == []

    def test_mongo_wins_name_collisions(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Local collections take precedence, matching v1's ordering."""
        monkeypatch.setattr(
            trivia,
            "_opentdb_categories",
            lambda: [trivia.Category("Science", QuestionSource.OPENTDB, "17")],
        )
        monkeypatch.setattr(
            trivia,
            "_mongo_categories",
            lambda: [trivia.Category("Science", QuestionSource.MONGO, "science")],
        )
        trivia.clear_category_cache()
        categories = trivia.get_categories()
        assert len(categories) == 1
        assert categories[0].source is QuestionSource.MONGO

    def test_caches_between_calls(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """v1 re-fetched OpenTDB *and* reconnected to Mongo on every call."""
        calls = {"n": 0}

        def counting() -> list:
            calls["n"] += 1
            return [trivia.Category("X", QuestionSource.OPENTDB, "1")]

        monkeypatch.setattr(trivia, "_opentdb_categories", counting)
        monkeypatch.setattr(trivia, "_mongo_categories", lambda: [])
        trivia.clear_category_cache()
        trivia.get_categories()
        trivia.get_categories()
        assert calls["n"] == 1

    def test_mongo_absent_is_not_an_error(self) -> None:
        """No URI configured simply means no Mongo."""
        assert trivia.get_mongo_client() is None
