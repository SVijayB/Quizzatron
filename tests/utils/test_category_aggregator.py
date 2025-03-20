"""Unit test for checking category aggregator"""

import json

import pytest
from api.utils.category_aggregator import get_categories


def test_get_categories_json_structure():
    """Test if get_categories returns a valid JSON-like structure with expected keys."""
    result = get_categories()

    # Ensure the result is a dictionary
    assert isinstance(result, dict), "Expected result to be a dictionary"

    # Ensure each entry has a valid key (name) and value (ID or collection name)
    for key, value in result.items():
        assert isinstance(key, str), f"Category name '{key}' should be a string"
        assert isinstance(
            value, (int, str)
        ), f"ID for '{key}' should be an int or a string"

    # Ensure the result is JSON serializable
    try:
        json.dumps(result)
    except TypeError:
        pytest.fail("Result is not JSON serializable")
