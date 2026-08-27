"""HTTP contract tests."""

from __future__ import annotations

import io

import pytest

from api.multiplayer import engine


def _pdf(pages: int = 1, text: str = "Rome was founded in 753 BC.") -> bytes:
    """Build a tiny real PDF in memory."""
    from pypdf import PdfWriter

    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=200, height=200)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


class TestMeta:
    """Health and metadata."""

    def test_root(self, client) -> None:
        """Root advertises the API."""
        response = client.get("/api/")
        assert response.status_code == 200
        assert response.get_json()["version"] == 2

    def test_health_reports_dependencies(self, client) -> None:
        """Health names the available models and Mongo state."""
        body = client.get("/api/health").get_json()
        assert body["status"] == "ok"
        assert body["models"]["default"] == "offline"
        assert body["mongo"] is False

    def test_dev_info(self, client) -> None:
        """The team list is served."""
        body = client.get("/api/dev-info").get_json()
        assert len(body["team"]) == 4

    def test_unknown_route_is_json(self, client) -> None:
        """v1's 404 handler returned plain text: ``ERROR 404: CANNOT GET /x``."""
        response = client.get("/definitely-not-here")
        assert response.status_code == 404
        assert response.is_json
        assert "message" in response.get_json()["error"]


class TestModelsEndpoint:
    """Only usable models are advertised."""

    def test_lists_only_available(self, client) -> None:
        """v1 advertised every configured model regardless of credentials, so
        picking one produced an opaque 500."""
        body = client.get("/api/quiz/models").get_json()
        keys = [model["key"] for model in body["models"]]
        assert keys == ["offline"]
        assert all(model["available"] for model in body["models"])
        assert body["default"] == "offline"

    def test_reports_missing_key_env(self, client, monkeypatch: pytest.MonkeyPatch) -> None:
        """A configured provider shows up once its key exists."""
        monkeypatch.setenv("GOOGLE_API_KEY", "fake-key-for-listing")
        body = client.get("/api/quiz/models").get_json()
        keys = [model["key"] for model in body["models"]]
        assert "gemini-flash" in keys


class TestGenerate:
    """The generate endpoint's response shape and validation."""

    def test_returns_object_not_tuple_array(self, client) -> None:
        """v1 called ``jsonify(questions, 200)``, producing the array
        ``[[...], 200]`` and *not* setting the status -- a wart four separate
        consumers had to unwrap."""
        response = client.post(
            "/api/quiz/generate", json={"topic": "Volcanoes", "num_questions": 3}
        )
        assert response.status_code == 200
        body = response.get_json()
        assert isinstance(body, dict)
        assert set(body) == {"questions", "topic", "difficulty", "source", "model"}

    def test_question_shape(self, client) -> None:
        """Clean options plus an integer answer index."""
        body = client.post(
            "/api/quiz/generate", json={"topic": "Space", "num_questions": 2}
        ).get_json()
        question = body["questions"][0]
        assert set(question) == {
            "index",
            "question",
            "options",
            "correct_index",
            "difficulty",
            "source",
            "image_url",
            "explanation",
        }
        assert len(question["options"]) == 4
        assert 0 <= question["correct_index"] <= 3
        assert not any(
            option.startswith(("A)", "B)", "C)", "D)")) for option in question["options"]
        )

    def test_indices_are_sequential(self, client) -> None:
        """Questions are numbered from one."""
        body = client.post(
            "/api/quiz/generate", json={"topic": "Trees", "num_questions": 4}
        ).get_json()
        assert [q["index"] for q in body["questions"]] == [1, 2, 3, 4]

    def test_difficulty_case_insensitive(self, client) -> None:
        """ "Hard" is accepted and echoed lowercase."""
        body = client.post(
            "/api/quiz/generate", json={"topic": "x", "difficulty": "HARD"}
        ).get_json()
        assert body["difficulty"] == "hard"

    def test_num_questions_capped(self, client) -> None:
        """v1 accepted ``num_questions=500`` and sent it to the model."""
        body = client.post(
            "/api/quiz/generate", json={"topic": "x", "num_questions": 9999}
        ).get_json()
        assert len(body["questions"]) == 30

    @pytest.mark.parametrize(
        ("payload", "status"),
        [
            ({}, 400),
            ({"num_questions": 3}, 400),
            ({"topic": "  "}, 400),
            ({"topic": "x", "num_questions": 0}, 400),
            ({"topic": "x", "num_questions": -5}, 400),
            ({"topic": "x", "difficulty": "spicy"}, 400),
            ({"topic": "x", "model": "no-such-model"}, 400),
        ],
    )
    def test_validation_errors(self, client, payload: dict, status: int) -> None:
        """Bad input is a 400 with a message, never a silent default."""
        response = client.post("/api/quiz/generate", json=payload)
        assert response.status_code == status
        assert response.get_json()["error"]["message"]

    def test_mixed_difficulty_allowed(self, client) -> None:
        """ "mixed" means no preference."""
        response = client.post("/api/quiz/generate", json={"topic": "x", "difficulty": "mixed"})
        assert response.status_code == 200


class TestPdfUpload:
    """PDF handling."""

    def test_rejects_non_pdf_extension(self, client) -> None:
        """Extension is checked."""
        data = {"file": (io.BytesIO(b"hello"), "notes.txt"), "topic": "x"}
        response = client.post("/api/quiz/generate", data=data, content_type="multipart/form-data")
        assert response.status_code == 400
        assert "PDF" in response.get_json()["error"]["message"]

    def test_rejects_pdf_extension_with_wrong_content(self, client) -> None:
        """Content is checked too, not just the name."""
        data = {"file": (io.BytesIO(b"I am not a PDF"), "evil.pdf")}
        response = client.post("/api/quiz/generate", data=data, content_type="multipart/form-data")
        assert response.status_code == 400
        assert response.get_json()["error"]["code"] == "invalid_file"

    def test_rejects_empty_file(self, client) -> None:
        """An empty upload is rejected."""
        data = {"file": (io.BytesIO(b""), "empty.pdf")}
        response = client.post("/api/quiz/generate", data=data, content_type="multipart/form-data")
        assert response.status_code == 400

    def test_blank_pdf_reports_no_text(self, client) -> None:
        """A scanned/blank PDF gets an actionable message rather than a 500."""
        data = {"file": (io.BytesIO(_pdf()), "blank.pdf")}
        response = client.post("/api/quiz/generate", data=data, content_type="multipart/form-data")
        assert response.status_code == 400
        assert "extracted" in response.get_json()["error"]["message"].lower()

    def test_no_server_side_path_parameter(self, client) -> None:
        """v1's ``GET /generate?pdf=<server path>`` read an arbitrary local file,
        gated only by ``.endswith('.pdf')``. The GET route no longer exists."""
        assert client.get("/api/quiz/generate?pdf=/etc/passwd.pdf").status_code == 405
        response = client.post("/api/quiz/generate", json={"pdf": "/etc/passwd.pdf"})
        # `pdf` is not a recognised field, so this is just a missing topic.
        assert response.status_code == 400


class TestMultiplayerRoutes:
    """REST surface for lobbies."""

    def test_create_and_join_flow(self, client, broadcaster) -> None:
        """Create returns 201 with a code and the host's id."""
        created = client.post("/api/multiplayer/create", json={"hostName": "Ada"})
        assert created.status_code == 201
        body = created.get_json()
        code, host_id = body["lobbyCode"], body["playerId"]
        assert len(code) == 6

        joined = client.post("/api/multiplayer/join", json={"lobbyCode": code, "playerName": "Bob"})
        assert joined.status_code == 200
        assert joined.get_json()["playerId"] != host_id

        state = client.get(f"/api/multiplayer/lobby/{code}").get_json()
        assert len(state["players"]) == 2
        assert state["state"] == "lobby"

    def test_missing_fields_are_400(self, client, broadcaster) -> None:
        """Required fields are enforced."""
        assert client.post("/api/multiplayer/create", json={}).status_code == 400
        assert client.post("/api/multiplayer/join", json={"lobbyCode": "ABCDEF"}).status_code == 400

    def test_unknown_lobby_is_404(self, client, broadcaster) -> None:
        """A bad code is a 404."""
        assert client.get("/api/multiplayer/lobby/ZZZZZZ").status_code == 404

    def test_non_host_settings_is_403(self, client, broadcaster) -> None:
        """Ownership is enforced over HTTP too."""
        code = client.post("/api/multiplayer/create", json={"hostName": "Ada"}).get_json()[
            "lobbyCode"
        ]
        bob = client.post(
            "/api/multiplayer/join", json={"lobbyCode": code, "playerName": "Bob"}
        ).get_json()["playerId"]
        response = client.post(
            "/api/multiplayer/settings",
            json={"lobbyCode": code, "playerId": bob, "settings": {"numQuestions": 3}},
        )
        assert response.status_code == 403

    def test_bad_settings_is_400(self, client, broadcaster) -> None:
        """Out-of-range settings are a client error."""
        body = client.post("/api/multiplayer/create", json={"hostName": "Ada"}).get_json()
        response = client.post(
            "/api/multiplayer/settings",
            json={
                "lobbyCode": body["lobbyCode"],
                "playerId": body["playerId"],
                "settings": {"timePerQuestion": 1},
            },
        )
        assert response.status_code == 400

    def test_next_question_endpoint_is_gone(self, client, broadcaster) -> None:
        """The server advances rounds; clients no longer drive it."""
        assert client.post("/api/multiplayer/next-question", json={}).status_code == 404

    def test_full_game_over_http(self, client, broadcaster) -> None:
        """Create, join, ready, start, answer, and read results."""
        created = client.post("/api/multiplayer/create", json={"hostName": "Ada"}).get_json()
        code, host_id = created["lobbyCode"], created["playerId"]
        bob_id = client.post(
            "/api/multiplayer/join", json={"lobbyCode": code, "playerName": "Bob"}
        ).get_json()["playerId"]

        client.post(
            "/api/multiplayer/ready", json={"lobbyCode": code, "playerId": bob_id, "ready": True}
        )
        client.post(
            "/api/multiplayer/settings",
            json={
                "lobbyCode": code,
                "playerId": host_id,
                "settings": {"numQuestions": 1, "timePerQuestion": 5},
            },
        )
        for pid in (host_id, bob_id):
            engine.attach_session(code=code, player_id=pid, session_id=f"sid-{pid}")

        assert (
            client.post(
                "/api/multiplayer/start", json={"lobbyCode": code, "playerId": host_id}
            ).status_code
            == 200
        )

        game = client.get(f"/api/multiplayer/game/{code}").get_json()
        assert game["questionIndex"] == 0
        assert "correctIndex" not in game["question"], "answers must not leak"
        assert game["settings"]["timePerQuestion"] == 5

        answered = client.post(
            "/api/multiplayer/answer",
            json={"lobbyCode": code, "playerId": host_id, "questionIndex": 0, "selectedIndex": 0},
        )
        assert answered.status_code == 200
        assert "points" in answered.get_json()["answer"]

        assert broadcaster.wait_for(engine.EV_GAME_OVER, timeout=25)
        results = client.get(f"/api/multiplayer/results/{code}")
        assert results.status_code == 200
        assert len(results.get_json()["players"]) == 2

    def test_results_before_end_is_409(self, client, broadcaster) -> None:
        """Reading results early is a conflict, not a 400 forever like v1."""
        created = client.post("/api/multiplayer/create", json={"hostName": "Ada"}).get_json()
        response = client.get(f"/api/multiplayer/results/{created['lobbyCode']}")
        assert response.status_code == 409


class TestCategories:
    """Category listing degrades gracefully."""

    def test_returns_empty_list_when_providers_down(
        self, client, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """v1's aggregator ended its except with a bare ``raise`` and the route
        had no handler, so an OpenTDB outage produced a 500 and emptied the UI."""
        import requests

        def boom(*args: object, **kwargs: object):
            raise requests.RequestException("provider down")

        monkeypatch.setattr("requests.get", boom)
        from api.content import trivia

        trivia.clear_category_cache()

        response = client.get("/api/categories")
        assert response.status_code == 200
        assert response.get_json() == {"categories": [], "count": 0}
