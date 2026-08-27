"""Category listing.

v1's ``/categories/get`` returned a flat ``dict[str, int | str]`` where the value
type doubled as the source discriminator (an ``int`` meant OpenTDB, the string
``"trivia-qa"`` meant MongoDB). It also had no error handling around an
aggregator that ended its ``except`` with a bare ``raise``, so a provider outage
produced a 500 and emptied the UI's category list.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from api.content.trivia import get_categories

categories_bp = Blueprint("categories", __name__, url_prefix="/categories")


@categories_bp.get("")
@categories_bp.get("/")
def list_categories():
    """Return every available category.

    Degrades rather than failing: a provider that is down contributes nothing.
    """
    refresh = str(request.args.get("refresh", "")).strip().lower() in {"1", "true", "yes"}
    categories = get_categories(force_refresh=refresh)
    return jsonify(
        {
            "categories": [category.as_dict() for category in categories],
            "count": len(categories),
        }
    )
