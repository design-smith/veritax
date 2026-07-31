from app.processing import chunk, iter_chunks


def test_iter_chunks_streams_overlapping_windows_without_duplicate_tail():
    text = " ".join(f"w{i}" for i in range(10))

    chunks = list(iter_chunks(text, words_per_chunk=5, overlap=2))

    assert chunks == [
        "w0 w1 w2 w3 w4",
        "w3 w4 w5 w6 w7",
        "w6 w7 w8 w9",
    ]
    assert chunk(text, words_per_chunk=5, overlap=2) == chunks
