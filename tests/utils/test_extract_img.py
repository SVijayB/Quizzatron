"""Tests for image downloading and cleanup utilities."""

import pytest
from api.utils.extract_img import cleanup_temp_folder, download_images


@pytest.fixture(name="mock_glob")
def fixture_mock_glob(mocker):
    """Mock glob to return test image files."""
    mocked_glob = mocker.patch("glob.glob")
    return mocked_glob


@pytest.fixture(name="mock_os_remove")
def fixture_mock_os_remove(mocker):
    """Mock os.remove to prevent actual file deletions."""
    return mocker.patch("os.remove")


@pytest.fixture(name="mock_os_rename")
def fixture_mock_os_rename(mocker):
    """Mock os.rename to prevent actual renaming."""
    return mocker.patch("os.rename")


@pytest.fixture(name="mock_google_crawler")
def fixture_mock_google_crawler(mocker):
    """Mock the GoogleImageCrawler."""
    mocked_crawler = mocker.patch("api.utils.extract_img.GoogleImageCrawler")
    mock_instance = mocked_crawler.return_value
    mock_instance.crawl.return_value = None
    return mock_instance


def test_cleanup_temp_folder(mock_glob, mock_os_remove):
    """Test cleanup_temp_folder to ensure files are deleted."""
    mock_glob.return_value = ["file1.jpg", "file2.png"]

    cleanup_temp_folder()

    mock_os_remove.assert_any_call("file1.jpg")
    mock_os_remove.assert_any_call("file2.png")
    assert mock_os_remove.call_count == 2


def test_download_images_no_results(mock_glob):
    """Test download_images when no images are found."""
    mock_glob.return_value = []

    result = download_images("nonexistent query")
    assert result is None
