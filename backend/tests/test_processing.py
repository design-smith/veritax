from app import processing
from app.processing import chunk, extract_text, iter_chunks


def test_iter_chunks_streams_overlapping_windows_without_duplicate_tail():
    text = " ".join(f"w{i}" for i in range(10))

    chunks = list(iter_chunks(text, words_per_chunk=5, overlap=2))

    assert chunks == [
        "w0 w1 w2 w3 w4",
        "w3 w4 w5 w6 w7",
        "w6 w7 w8 w9",
    ]
    assert chunk(text, words_per_chunk=5, overlap=2) == chunks


def test_pdf_extraction_skips_ocr_when_text_layer_is_good(monkeypatch):
    monkeypatch.setattr(processing.settings, "ocr_enabled", True)
    monkeypatch.setattr(processing.settings, "ocr_min_text_chars", 20)
    monkeypatch.setattr(processing, "_pdf_text_layer", lambda _data: "native text " * 5)

    def fail_if_called(_data):
        raise AssertionError("OCR should not run for native-text PDFs")

    monkeypatch.setattr(processing, "_ocr_pdf", fail_if_called)

    assert extract_text("native.pdf", "application/pdf", b"%PDF") == "native text " * 5


def test_pdf_extraction_uses_ocr_when_text_layer_is_too_thin(monkeypatch):
    monkeypatch.setattr(processing.settings, "ocr_enabled", True)
    monkeypatch.setattr(processing.settings, "ocr_min_text_chars", 20)
    monkeypatch.setattr(processing, "_pdf_text_layer", lambda _data: "")
    monkeypatch.setattr(processing, "_ocr_pdf", lambda _data: "Starbucks OCR text " * 5)

    assert extract_text("scan.pdf", "application/pdf", b"%PDF") == "Starbucks OCR text " * 5


def test_pdf_extraction_falls_back_when_ocr_is_unavailable(monkeypatch):
    monkeypatch.setattr(processing.settings, "ocr_enabled", True)
    monkeypatch.setattr(processing.settings, "ocr_min_text_chars", 20)
    monkeypatch.setattr(processing, "_pdf_text_layer", lambda _data: "tiny")

    def missing_ocr(_data):
        raise RuntimeError("OCR command 'ocrmypdf' is not installed")

    monkeypatch.setattr(processing, "_ocr_pdf", missing_ocr)

    assert extract_text("scan.pdf", "application/pdf", b"%PDF") == "tiny"
