from app.models.user import UserRole

BASE = "/api/v1/schedules"


def _event(production_id, attendees=(), start="2026-12-01T19:00:00-03:00", end="2026-12-01T22:00:00-03:00", **extra):
    return {"production_id": production_id, "title": "Ensaio do 1º ato", "type": "rehearsal",
            "start_time": start, "end_time": end, "location": "Sala 1", "attendee_ids": list(attendees), **extra}


def _cast(client, headers, production_id, user):
    client.post(f"/api/v1/productions/{production_id}/participants",
                json={"user_id": user.id, "role_title": "Elenco", "department": "cast"}, headers=headers)


def test_criar_listar_editar_evento(client, admin, make_user, production):
    _, headers = admin
    ator, _ = make_user(UserRole.ACTOR)
    res = client.post(BASE, json=_event(production["id"], [ator.id]), headers=headers)
    assert res.status_code == 201, res.text
    ev = res.json()
    assert ev["attendees"][0]["status"] == "invited"
    assert ev["production"]["title"] == "Hamlet"

    lista = client.get(BASE, params={"production_id": production["id"]}, headers=headers).json()
    assert len(lista) == 1

    res = client.patch(f"{BASE}/{ev['id']}", json={"type": "dress_rehearsal", "title": "Ensaio geral"}, headers=headers)
    assert res.status_code == 200 and res.json()["type"] == "dress_rehearsal"


def test_seis_tipos_de_evento(client, admin, production):
    _, headers = admin
    for i, kind in enumerate(["rehearsal", "performance", "meeting", "workshop", "tech_run", "dress_rehearsal"]):
        body = _event(production["id"], start=f"2026-12-0{i+1}T10:00:00-03:00", end=f"2026-12-0{i+1}T12:00:00-03:00", type=kind)
        assert client.post(BASE, json=body, headers=headers).status_code == 201


def test_termino_antes_do_inicio(client, admin, production):
    _, headers = admin
    body = _event(production["id"], start="2026-12-01T22:00:00-03:00", end="2026-12-01T19:00:00-03:00")
    assert client.post(BASE, json=body, headers=headers).status_code == 422


def test_conflito_de_horario_por_membro(client, admin, make_user, production):
    _, headers = admin
    ator, _ = make_user(UserRole.ACTOR)
    assert client.post(BASE, json=_event(production["id"], [ator.id]), headers=headers).status_code == 201

    sobreposto = _event(production["id"], [ator.id], start="2026-12-01T21:00:00-03:00", end="2026-12-01T23:00:00-03:00")
    res = client.post(BASE, json=sobreposto, headers=headers)
    assert res.status_code == 409
    assert res.json()["conflicts"][0]["user_id"] == ator.id

    # Consulta prévia
    q = client.get(f"{BASE}/conflicts", params={"start": "2026-12-01T21:00:00-03:00", "end": "2026-12-01T23:00:00-03:00",
                                                "user_ids": [ator.id]}, headers=headers)
    assert len(q.json()) == 1

    # Mantém mesmo assim
    assert client.post(f"{BASE}?allow_conflicts=true", json=sobreposto, headers=headers).status_code == 201

    # Encostado (termina quando o outro começa) não é conflito
    depois = _event(production["id"], [ator.id], start="2026-12-01T23:00:00-03:00", end="2026-12-02T00:30:00-03:00")
    assert client.post(BASE, json=depois, headers=headers).status_code == 201


def test_cancelamento_logico_e_reativacao(client, admin, make_user, production):
    _, headers = admin
    ator, _ = make_user(UserRole.ACTOR)
    ev = client.post(BASE, json=_event(production["id"], [ator.id]), headers=headers).json()
    res = client.post(f"{BASE}/{ev['id']}/cancel", json={"reason": "Chuva"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["is_cancelled"] is True and res.json()["cancel_reason"] == "Chuva"
    # Continua listado (histórico) e some com include_cancelled=false
    assert len(client.get(BASE, headers=headers).json()) == 1
    assert client.get(BASE, params={"include_cancelled": False}, headers=headers).json() == []
    # Cancelado não gera conflito
    assert client.post(BASE, json=_event(production["id"], [ator.id]), headers=headers).status_code == 201
    assert client.post(f"{BASE}/{ev['id']}/restore", headers=headers).json()["is_cancelled"] is False


def test_presenca(client, admin, make_user, production):
    _, headers = admin
    ator, ator_headers = make_user(UserRole.ACTOR)
    outro, _ = make_user(UserRole.ACTOR)
    _cast(client, headers, production["id"], ator)
    ev = client.post(BASE, json=_event(production["id"], [ator.id, outro.id]), headers=headers).json()

    # A própria pessoa confirma
    res = client.patch(f"{BASE}/{ev['id']}/attendance/{ator.id}", json={"status": "confirmed"}, headers=ator_headers)
    assert res.status_code == 200
    # mas não marca a presença de outra
    assert client.patch(f"{BASE}/{ev['id']}/attendance/{outro.id}", json={"status": "absent"},
                        headers=ator_headers).status_code == 403
    # Coordenação marca ausência
    res = client.patch(f"{BASE}/{ev['id']}/attendance/{outro.id}", json={"status": "absent"}, headers=headers)
    statuses = {a["user"]["id"]: a["status"] for a in res.json()["attendees"]}
    assert statuses == {ator.id: "confirmed", outro.id: "absent"}

    # Trocar convidados preserva o status de quem permanece
    res = client.patch(f"{BASE}/{ev['id']}", json={"attendee_ids": [ator.id]}, headers=headers)
    assert [(a["user"]["id"], a["status"]) for a in res.json()["attendees"]] == [(ator.id, "confirmed")]


def test_ator_ve_somente_agenda_das_suas_producoes(client, admin, make_user, production):
    _, headers = admin
    ator, ator_headers = make_user(UserRole.ACTOR)
    _cast(client, headers, production["id"], ator)
    outra = client.post("/api/v1/productions", json={"title": "Outra"}, headers=headers).json()
    client.post(BASE, json=_event(production["id"]), headers=headers)
    ev2 = client.post(BASE, json=_event(outra["id"], start="2026-12-05T10:00:00-03:00",
                                        end="2026-12-05T12:00:00-03:00"), headers=headers).json()
    assert len(client.get(BASE, headers=ator_headers).json()) == 1
    assert client.get(f"{BASE}/{ev2['id']}", headers=ator_headers).status_code == 403
    assert client.post(BASE, json=_event(production["id"]), headers=ator_headers).status_code == 403


def test_agenda_por_pessoa(client, admin, make_user, production):
    _, headers = admin
    ator, _ = make_user(UserRole.ACTOR)
    client.post(BASE, json=_event(production["id"], [ator.id]), headers=headers)
    client.post(BASE, json=_event(production["id"], start="2026-12-03T10:00:00-03:00",
                                  end="2026-12-03T11:00:00-03:00"), headers=headers)
    assert len(client.get(BASE, params={"user_id": ator.id}, headers=headers).json()) == 1
