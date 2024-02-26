from project.twig import log

from pathlib import Path

from django.conf import settings
from django.shortcuts import render

from markdown import markdown


def _get_content(filename: str):
    md_file_path = Path(settings.BASE_DIR) / "app" / "content" / filename

    try:
        with md_file_path.open('r') as file:
            return markdown(file.read(), extensions=['toc'])
    except FileNotFoundError:
        return "<p>Markdown file not found.</p>"


def index(request):
    # url = request.build_absolute_uri().replace("http:", "https:")

    context = {
        'title': "counter-resistance.org",
        'html_content': _get_content("index.md"),
    }

    return render(request, 'app/basic.html', context=context)
