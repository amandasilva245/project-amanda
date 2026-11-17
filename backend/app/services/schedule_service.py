"""Agenda de produções (RF15–RF17) e conflitos de horário (pesquisa de campo, §4.7)."""

from datetime import datetime, timezone
from typing import Iterable, List, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session, joinedload

from app.models.production import Production, ProductionParticipant
from app.models.schedule import AttendanceStatus, Schedule, ScheduleParticipant
from app.models.user import User


class ScheduleError(ValueError):
    pass


class ScheduleService:
    def __init__(self, db: Session):
        self.db = db

    # ── Consultas ──────────────────────────────────────────────────────────
    def _base_query(self):
        return self.db.query(Schedule).options(
            joinedload(Schedule.production),
            joinedload(Schedule.attendees).joinedload(ScheduleParticipant.user),
        )

    def get(self, schedule_id: str) -> Optional[Schedule]:
        return self._base_query().filter(Schedule.id == schedule_id).first()

    def list(
        self,
        production_id: Optional[str] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        user_id: Optional[str] = None,
        include_cancelled: bool = True,
        visible_to_participant: Optional[str] = None,
    ) -> List[Schedule]:
        q = self._base_query()
        if production_id:
            q = q.filter(Schedule.production_id == production_id)
        if start:
            q = q.filter(Schedule.end_time >= start)
        if end:
            q = q.filter(Schedule.start_time <= end)
        if user_id:
            q = q.filter(Schedule.attendees.any(ScheduleParticipant.user_id == user_id))
        if not include_cancelled:
            q = q.filter(Schedule.is_cancelled.is_(False))
        if visible_to_participant:
            # Atores e técnicos: eventos das produções de que participam
            q = q.filter(
                Schedule.production.has(
                    Production.participants.any(ProductionParticipant.user_id == visible_to_participant)
                )
            )
        return q.order_by(Schedule.start_time).all()

    def can_view(self, schedule: Schedule, user_id: str) -> bool:
        return any(p.user_id == user_id for p in schedule.production.participants)

    # ── Conflitos ──────────────────────────────────────────────────────────
    def find_conflicts(
        self, user_ids: Iterable[str], start: datetime, end: datetime, exclude_id: Optional[str] = None,
    ) -> List[dict]:
        user_ids = list(set(user_ids))
        if not user_ids:
            return []
        q = (
            self.db.query(ScheduleParticipant, Schedule)
            .join(Schedule, Schedule.id == ScheduleParticipant.schedule_id)
            .options(joinedload(ScheduleParticipant.user), joinedload(Schedule.production))
            .filter(
                ScheduleParticipant.user_id.in_(user_ids),
                Schedule.is_cancelled.is_(False),
                ScheduleParticipant.status != AttendanceStatus.ABSENT.value,
                and_(Schedule.start_time < end, Schedule.end_time > start),  # sobreposição
            )
        )
        if exclude_id:
            q = q.filter(Schedule.id != exclude_id)
        return [
            {
                "user_id": sp.user_id,
                "user_name": sp.user.full_name,
                "schedule_id": s.id,
                "schedule_title": s.title,
                "production_title": s.production.title,
                "start_time": s.start_time,
                "end_time": s.end_time,
            }
            for sp, s in q.order_by(Schedule.start_time).all()
        ]

    # ── Escrita ────────────────────────────────────────────────────────────
    def _validate_attendees(self, user_ids: List[str]) -> List[str]:
        user_ids = list(dict.fromkeys(user_ids))  # remove repetidos, mantém a ordem
        if not user_ids:
            return []
        found = {
            u.id for u in self.db.query(User.id).filter(User.id.in_(user_ids), User.is_active.is_(True)).all()
        }
        missing = [u for u in user_ids if u not in found]
        if missing:
            raise ScheduleError("Há participantes inexistentes ou inativos no convite.")
        return user_ids

    def create(self, data, allow_conflicts: bool = False):
        if not self.db.query(Production.id).filter(Production.id == data.production_id).first():
            raise LookupError("Produção não encontrada.")
        attendee_ids = self._validate_attendees(data.attendee_ids)
        conflicts = self.find_conflicts(attendee_ids, data.start_time, data.end_time)
        if conflicts and not allow_conflicts:
            return None, conflicts

        schedule = Schedule(**data.model_dump(exclude={"attendee_ids"}))
        schedule.attendees = [ScheduleParticipant(user_id=u) for u in attendee_ids]
        self.db.add(schedule)
        self.db.commit()
        return self.get(schedule.id), conflicts

    def update(self, schedule: Schedule, data, allow_conflicts: bool = False):
        if schedule.is_cancelled:
            raise ScheduleError("Evento cancelado não pode ser editado. Reative-o antes.")
        changes = data.model_dump(exclude_unset=True, exclude={"attendee_ids"})
        for key in ("title", "type", "start_time", "end_time"):
            if key in changes and changes[key] is None:
                changes.pop(key)
        start = changes.get("start_time", schedule.start_time)
        end = changes.get("end_time", schedule.end_time)
        if end <= start:
            raise ScheduleError("O término deve ser depois do início.")

        if data.attendee_ids is not None:
            attendee_ids = self._validate_attendees(data.attendee_ids)
        else:
            attendee_ids = [a.user_id for a in schedule.attendees]

        conflicts = self.find_conflicts(attendee_ids, start, end, exclude_id=schedule.id)
        if conflicts and not allow_conflicts:
            return None, conflicts

        for key, value in changes.items():
            setattr(schedule, key, value)

        if data.attendee_ids is not None:
            # Preserva o status de quem continua convidado
            current = {a.user_id: a for a in schedule.attendees}
            schedule.attendees = [current.get(u) or ScheduleParticipant(user_id=u) for u in attendee_ids]

        self.db.commit()
        return self.get(schedule.id), conflicts

    def cancel(self, schedule: Schedule, reason: Optional[str]) -> Schedule:
        if not schedule.is_cancelled:
            schedule.is_cancelled = True
            schedule.cancelled_at = datetime.now(timezone.utc)
            schedule.cancel_reason = reason
            self.db.commit()
        return self.get(schedule.id)

    def restore(self, schedule: Schedule) -> Schedule:
        schedule.is_cancelled = False
        schedule.cancelled_at = None
        schedule.cancel_reason = None
        self.db.commit()
        return self.get(schedule.id)

    def set_attendance(self, schedule: Schedule, user_id: str, status, notes=None) -> Schedule:
        entry = next((a for a in schedule.attendees if a.user_id == user_id), None)
        if not entry:
            raise LookupError("Essa pessoa não foi convidada para o evento.")
        entry.status = status.value if hasattr(status, "value") else status
        if notes is not None:
            entry.notes = notes
        self.db.commit()
        return self.get(schedule.id)
