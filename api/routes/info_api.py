"""Module for API route to team members information"""

from flask import jsonify, Blueprint, request

info_bp = Blueprint("info_api", __name__, url_prefix="/dev-info")


@info_bp.route("/", methods=["GET"])
def dev_info_route():
    """Get developer information."""
    base_url = request.host_url.rstrip("/") + "/static/dev_imgs"
    result = [
        {
            "name": "Vijay Balaji S",
            "desc": "Your average CS Engineer, commits at 3 AM and cries himself to sleep.",
            "email": "svijayb.dev@gmail.com",
            "linkedin": "https://www.linkedin.com/in/svijayb/",
            "image": f"{base_url}/vijay.jpeg",
        },
        {
            "name": "Aravindh Manavalan",
            "desc": "meow",
            "email": "aravindh1628@gmail.com",
            "linkedin": "https://www.linkedin.com/in/aravindh-manavalan/",
            "image": f"{base_url}/aravindh.jpeg",
        },
        {
            "name": "Akshay Ravi",
            "desc": "UwU 👉🏻👈🏻",
            "email": "akshayravi13@gmail.com",
            "linkedin": "https://www.linkedin.com/in/akshayravi13/",
            "image": f"{base_url}/akshay.jpeg",
        },
        {
            "name": "Hariharan sureshkumar",
            "desc": "slay 💅",
            "email": "harisureshkumar1910@gmail.com",
            "linkedin": "https://www.linkedin.com/in/hariharan-sureshkumar-4994a2254/",
            "image": f"{base_url}/hari.jpeg",
        },
    ]
    return jsonify(result)
