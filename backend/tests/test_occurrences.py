from datetime import date

from app.engine import month_occurrences, occurrences


def test_one_time_in_month():
    assert month_occurrences("one_time", date(2026, 10, 5), "2026-10") == [date(2026, 10, 5)]


def test_one_time_other_month():
    assert month_occurrences("one_time", date(2026, 10, 5), "2026-11") == []


def test_weekly_multi_occurrence_month():
    occs = month_occurrences("weekly", date(2026, 10, 1), "2026-10")
    assert occs == [date(2026, 10, 1), date(2026, 10, 8), date(2026, 10, 15), date(2026, 10, 22), date(2026, 10, 29)]


def test_weekly_starts_mid_month_next_month():
    occs = month_occurrences("weekly", date(2026, 1, 29), "2026-02")
    assert occs == [date(2026, 2, 5), date(2026, 2, 12), date(2026, 2, 19), date(2026, 2, 26)]


def test_monthly_clamp_jan31_to_feb():
    assert month_occurrences("monthly", date(2026, 1, 31), "2026-02") == [date(2026, 2, 28)]


def test_monthly_clamp_leap_feb29():
    assert month_occurrences("monthly", date(2024, 1, 31), "2024-02") == [date(2024, 2, 29)]
    # non-leap year
    assert month_occurrences("monthly", date(2025, 1, 31), "2025-02") == [date(2025, 2, 28)]


def test_monthly_normal():
    assert month_occurrences("monthly", date(2025, 3, 15), "2025-04") == [date(2025, 4, 15)]


def test_monthly_before_start():
    assert month_occurrences("monthly", date(2025, 5, 10), "2025-04") == []


def test_yearly():
    assert month_occurrences("yearly", date(2020, 7, 4), "2026-07") == [date(2026, 7, 4)]
    assert month_occurrences("yearly", date(2020, 7, 4), "2026-08") == []
    assert month_occurrences("yearly", date(2024, 2, 29), "2025-02") == [date(2025, 2, 28)]


def test_open_ended_generator():
    occs = occurrences("monthly", date(2026, 1, 31), date(2026, 4, 30))
    assert occs == [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30)]
