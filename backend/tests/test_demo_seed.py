"""Dados de demonstração: o script recusa bancos que não são de demonstração,
é idempotente (rodar duas vezes não duplica nada) e gera dados consistentes."""

import pytest

import demo
from app.core.config import settings
from app.models.production import Production
from app.models.user import User


def test_guard_refuses_without_demo_mode(monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", False)
    with pytest.raises(SystemExit) as exc:
        demo.guard()
    assert "DEMO_MODE" in str(exc.value)


def test_guard_refuses_non_demo_database(monkeypatch):
    # O banco de testes termina em "test", não em "_demo": deve ser recusado.
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    with pytest.raises(SystemExit) as exc:
        demo.guard()
    assert "não é de demonstração" in str(exc.value)


def test_seed_is_idempotent_and_consistent(db):
    first = demo.Seeder(db).run("Senha-de-teste-1")
    assert first["users"] == 42 and first["productions"] == 10
    assert demo.check(db) == []

    second = demo.Seeder(db).run("Senha-de-teste-1")
    assert sum(second.values()) == 0
    assert db.query(User).count() == 42
    assert db.query(Production).count() == 10
    assert demo.check(db) == []


def test_mode_hides_accounts_outside_demo(client):
    assert client.get("/api/v1/system/mode").json() == {"demo": False, "accounts": []}


def test_demo_accounts_can_log_in(client, db, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    demo.Seeder(db).run("Senha-de-teste-1")
    mode = client.get("/api/v1/system/mode").json()
    assert {a["role"] for a in mode["accounts"]} >= {"admin", "producer", "actor"}
    assert all("password" not in a for a in mode["accounts"])
    res = client.post("/api/v1/auth/login", json={
        "email": mode["accounts"][0]["email"], "password": "Senha-de-teste-1",
    })
    assert res.status_code == 200, res.text


def test_attendees_come_in_stable_alphabetical_order(client, db, monkeypatch):
    from app.core.security import create_access_token
    from app.models.schedule import Schedule

    demo.Seeder(db).run("Senha-de-teste-1")
    admin = db.query(User).filter(User.email == "admin@curtain.example").one()
    headers = {"Authorization": f"Bearer {create_access_token(admin.id)}"}
    ev = next(s for s in db.query(Schedule).all() if len(s.attendees) > 3 and not s.is_cancelled)
    names = [a["user"]["full_name"] for a in client.get(f"/api/v1/schedules/{ev.id}", headers=headers).json()["attendees"]]
    assert names == sorted(names, key=str.lower)
    first = ev.attendees[0]
    res = client.patch(f"/api/v1/schedules/{ev.id}/attendance/{first.user_id}", json={"status": "absent"}, headers=headers)
    assert [a["user"]["full_name"] for a in res.json()["attendees"]] == names


def test_docs_short_url_redirects_to_swagger(client):
    res = client.get("/docs", follow_redirects=False)
    assert res.status_code in (302, 307) and res.headers["location"] == "/api/docs"
    assert client.get("/api/docs").status_code == 200
