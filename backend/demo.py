#!/usr/bin/env python3
"""Ambiente de demonstração do Curtain (banca do TCC).

Todos os dados criados aqui são FICTÍCIOS: pessoas, companhias, teatros,
espetáculos, valores e compradores. E-mails usam o domínio reservado
".example" (RFC 2606), que não pertence a ninguém.

Uso (sempre com DEMO_MODE=true e um banco cujo nome termina em "_demo"):

    python demo.py seed    # cria o que falta; rodar de novo não duplica nada
    python demo.py reset   # esvazia o banco de demonstração e recria do zero
    python demo.py check   # confere a consistência dos dados

As datas são relativas ao dia em que o seed roda: ensaios passados aparecem
como concluídos e os próximos como programados. Para "renovar" as datas antes
de uma apresentação, use `reset`.

Senha das contas: variável DEMO_PASSWORD. Sem ela, uma senha forte é gerada e
gravada em DEMO_PASSWORD_FILE (padrão .demo-password, permissão 0600); ela
nunca é impressa no terminal nem em log.
"""

import hashlib
import os
import random
import secrets
import stat
import sys
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func, text
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.company import Company, ProductionResource, ResourceStatus, ResourceType
from app.models.financial import FinancialTransaction, TransactionCategory, TransactionType
from app.models.order import OrderStatus, TicketOrder
from app.models.production import Department, Production, ProductionGenre, ProductionParticipant, ProductionStatus
from app.models.schedule import AttendanceStatus, Schedule, ScheduleParticipant, ScheduleType
from app.models.task import ProductionTask, TaskPriority, TaskStatus
from app.models.ticket import Ticket, TicketBatch, TicketBatchStatus, TicketStatus
from app.models.user import User, UserRole
from app.services.ticket_service import CODE_ALPHABET, CODE_LENGTH

NS = uuid.UUID("7c1d2e3f-0a4b-4c5d-8e6f-112233445566")  # IDs determinísticos da demo
TZ = ZoneInfo("America/Sao_Paulo")
DOMAIN = "curtain.example"
D = Decimal


# ── Proteções ─────────────────────────────────────────────────────────────────
def guard() -> None:
    db_name = make_url(settings.DATABASE_URL).database or ""
    if not settings.DEMO_MODE:
        sys.exit("Recusado: defina DEMO_MODE=true para usar o ambiente de demonstração.")
    if not db_name.endswith("_demo"):
        sys.exit(f"Recusado: o banco '{db_name}' não é de demonstração (o nome deve terminar em '_demo').")
    if settings.ENVIRONMENT == "production":
        sys.exit("Recusado: ENVIRONMENT=production.")


def demo_password() -> str:
    pwd = os.environ.get("DEMO_PASSWORD", "").strip()
    if pwd:
        return pwd
    path = os.environ.get("DEMO_PASSWORD_FILE", ".demo-password")
    if os.path.exists(path):
        with open(path) as fh:
            return fh.read().strip()
    pwd = "Demo-" + secrets.token_urlsafe(9)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, stat.S_IRUSR | stat.S_IWUSR)
    with os.fdopen(fd, "w") as fh:
        fh.write(pwd + "\n")
    print(f"• Senha das contas de demonstração gravada em {path} (não é exibida aqui).")
    return pwd


# ── Utilidades ────────────────────────────────────────────────────────────────
def uid(*parts) -> str:
    return str(uuid.uuid5(NS, ":".join(str(p) for p in parts)))


def code_for(*parts) -> str:
    digest = hashlib.sha256(":".join(str(p) for p in parts).encode()).digest()
    return "".join(CODE_ALPHABET[b % len(CODE_ALPHABET)] for b in digest[:CODE_LENGTH])


def at(day: date, hh: int, mm: int = 0) -> datetime:
    return datetime.combine(day, time(hh, mm), tzinfo=TZ)


class Seeder:
    def __init__(self, db):
        self.db = db
        self.today = datetime.now(TZ).date()
        self.now = datetime.now(timezone.utc)
        self.rng = random.Random(2026)
        self.created = {}
        self.users = {}

    # Cria só se o ID ainda não existir (idempotente)
    def ensure(self, model, key, **fields):
        obj_id = uid(model.__tablename__, key)
        obj = self.db.get(model, obj_id)
        if obj is None:
            obj = model(id=obj_id, **fields)
            self.db.add(obj)
            self.created[model.__tablename__] = self.created.get(model.__tablename__, 0) + 1
        return obj

    def T(self, days: int) -> date:
        return self.today + timedelta(days=days)

    # ── Pessoas ────────────────────────────────────────────────────────────
    PEOPLE = [
        # chave, nome, papel no sistema, e-mail (contas da banca têm e-mail fixo), bio
        ("admin", "Beatriz Valença", UserRole.ADMIN, "admin", "Administradora do sistema na Cia. Lanterna Mágica."),
        ("otavio", "Otávio Rangel", UserRole.PRODUCER, "producao", "Produtor executivo com 15 anos de circulação nacional."),
        ("lucia", "Lúcia Fontoura", UserRole.FINANCIAL_MANAGER, "financeiro", "Gestora financeira e de editais."),
        ("helena", "Helena Prado", UserRole.DIRECTOR, "direcao", "Diretora artística da Cia. Lanterna Mágica."),
        ("rafaela", "Rafaela Couto", UserRole.TECHNICIAN, "tecnica", "Diretora técnica e iluminadora."),
        ("caio", "Caio Albuquerque", UserRole.ACTOR, "elenco", "Ator formado pela escola livre de teatro."),
        ("joaquim", "Joaquim Bezerra", UserRole.DIRECTOR, None, "Diretor do Grupo Maré Alta, pesquisa teatro popular."),
        ("marina", "Marina Quintela", UserRole.DIRECTOR, None, "Diretora do Coletivo Ateliê do Gesto, teatro físico."),
        ("tereza", "Tereza Almada", UserRole.DIRECTOR, None, "Diretora musical e preparadora vocal."),
        ("sonia", "Sônia Guerreiro", UserRole.PRODUCER, None, "Produtora do Grupo Maré Alta."),
        ("felipe", "Felipe Arantes", UserRole.PRODUCER, None, "Produtor de temporadas e turnês."),
        ("davi", "Davi Montenegro", UserRole.TECHNICIAN, None, "Cenógrafo e cenotécnico."),
        ("iara", "Iara Medeiros", UserRole.TECHNICIAN, None, "Figurinista."),
        ("bruno", "Bruno Siqueira", UserRole.TECHNICIAN, None, "Sonoplasta e operador de som."),
        ("nina", "Nina Castanheira", UserRole.TECHNICIAN, None, "Visagista e maquiadora."),
        ("gustavo", "Gustavo Ferraz", UserRole.TECHNICIAN, None, "Iluminador."),
        ("paula", "Paula Seixas", UserRole.TECHNICIAN, None, "Contrarregra e assistente de palco."),
        ("renan", "Renan Vilela", UserRole.TECHNICIAN, None, "Operador de luz."),
        ("tais", "Taís Brandão", UserRole.TECHNICIAN, None, "Aderecista."),
        ("murilo", "Murilo Pacheco", UserRole.TECHNICIAN, None, "Cenotécnico e maquinista."),
        ("clarice", "Clarice Mendonça", UserRole.ACTOR, None, "Atriz e cantora."),
        ("vitor", "Vítor Lacerda", UserRole.ACTOR, None, "Ator e palhaço."),
        ("aurora", "Aurora Nogueira", UserRole.ACTOR, None, "Atriz com trajetória em teatro de grupo."),
        ("henrique", "Henrique Barreto", UserRole.ACTOR, None, "Ator e dramaturgo."),
        ("luana", "Luana Ribeiro", UserRole.ACTOR, None, "Atriz e bailarina."),
        ("samuel", "Samuel Coutinho", UserRole.ACTOR, None, "Ator e músico."),
        ("isadora", "Isadora Prates", UserRole.ACTOR, None, "Atriz."),
        ("mateus", "Mateus Carvalhal", UserRole.ACTOR, None, "Ator."),
        ("julia", "Júlia Assunção", UserRole.ACTOR, None, "Atriz e preparadora corporal."),
        ("ernesto", "Ernesto Galvão", UserRole.ACTOR, None, "Ator veterano, 40 anos de palco."),
        ("bianca", "Bianca Torres", UserRole.ACTOR, None, "Atriz e cantora lírica."),
        ("leandro", "Leandro Sampaio", UserRole.ACTOR, None, "Ator e acrobata."),
        ("yara", "Yara Fontes", UserRole.ACTOR, None, "Atriz e passista de frevo."),
        ("otto", "Otto Damasceno", UserRole.ACTOR, None, "Ator e percussionista."),
        ("celina", "Celina Moura", UserRole.ACTOR, None, "Atriz."),
        ("rodrigo", "Rodrigo Esteves", UserRole.ACTOR, None, "Ator e bonequeiro."),
        ("flora", "Flora Bittencourt", UserRole.ACTOR, None, "Atriz e bailarina contemporânea."),
        ("ramon", "Ramon Teixeira", UserRole.ACTOR, None, "Barítono."),
        ("lia", "Lia Saldanha", UserRole.ACTOR, None, "Atriz e palhaça."),
        ("tomas", "Tomás Arruda", UserRole.ACTOR, None, "Ator."),
        ("gabriela", "Gabriela Lins", UserRole.ACTOR, None, "Atriz."),
        ("neusa", "Neusa Carvalho", UserRole.ACTOR, None, "Atriz e mezzo-soprano."),
    ]

    def people(self, password_hash: str):
        for i, (key, name, role, login, bio) in enumerate(self.PEOPLE):
            local = login or ".".join(name.lower().split()[:: len(name.split()) - 1])
            local = (local.replace("á", "a").replace("ã", "a").replace("â", "a").replace("é", "e")
                     .replace("ê", "e").replace("í", "i").replace("ó", "o").replace("ô", "o")
                     .replace("ú", "u").replace("ç", "c"))
            self.users[key] = self.ensure(
                User, key, email=f"{local}@{DOMAIN}", hashed_password=password_hash, full_name=name,
                role=role, bio=bio, phone=f"(11) 9{4000 + i:04d}-{1000 + i * 7:04d}", is_active=True,
            )
        self.db.flush()

    # ── Companhias ────────────────────────────────────────────────────────
    def companies(self):
        data = [
            ("lanterna", "Cia. Lanterna Mágica", "Companhia de teatro contemporâneo que revisita clássicos e "
             "cria dramaturgia própria sobre memória e cidade. Mantém repertório com três montagens em circulação.",
             "Helena Prado", "São Paulo – SP", 2009, "contato@lanternamagica.example", "(11) 3200-1009",
             "https://lanternamagica.example"),
            ("mare", "Grupo Maré Alta de Teatro", "Grupo de teatro popular e musical, com pesquisa em frevo, "
             "maracatu e teatro de rua. Atua em temporadas e festivais do Nordeste.",
             "Joaquim Bezerra", "Recife – PE", 2014, "producao@marealta.example", "(81) 3400-2014",
             "https://marealta.example"),
            ("atelie", "Coletivo Ateliê do Gesto", "Coletivo de teatro físico, bonecos e dança-teatro, com forte "
             "atuação em espetáculos para a infância e em processos colaborativos.",
             "Marina Quintela", "Belo Horizonte – MG", 2017, "ola@ateliedogesto.example", "(31) 3500-2017",
             "https://ateliedogesto.example"),
        ]
        self.comp = {}
        for key, name, desc, resp, city, year, email, phone, site in data:
            self.comp[key] = self.ensure(Company, key, name=name, description=desc, responsible_name=resp,
                                         city=city, founded_year=year, email=email, phone=phone, website=site)
        self.db.flush()

    # ── Produções ─────────────────────────────────────────────────────────
    def productions(self):
        T = self.T
        P = ProductionStatus
        G = ProductionGenre
        self.prods = {}
        rows = [
            # chave, título, subtítulo, autor, gênero, status, companhia, início, estreia, fim,
            # teatro, capacidade, orçamento, duração, cor, pública, sinopse
            ("relojoeiro", "O Relojoeiro de Vila Serena", "uma fábula sobre o tempo que não volta", "Henrique Barreto",
             G.DRAMA, P.PERFORMANCE, "lanterna", T(-120), T(-21), T(28), "Teatro Aurora – Sala Principal", 120,
             D("185000"), 105, "#A9874A", True,
             "Numa cidade onde todos os relógios pararam no mesmo minuto, um velho relojoeiro recebe a visita da "
             "filha que partiu há vinte anos. Entre engrenagens e cartas nunca enviadas, os dois tentam consertar "
             "aquilo que nenhum ponteiro mede."),
            ("cartas", "Cartas para Ninguém", "drama epistolar em três tempos", "Aurora Nogueira", G.DRAMA, P.REHEARSAL, "lanterna",
             T(-45), T(18), T(80), "Espaço Cênico Lanterna", 80, D("92000"), 80, "#7A2E37", False,
             "Três mulheres de gerações diferentes escrevem cartas a destinatários que já não existem. "
             "O espetáculo cruza as vozes em um único apartamento, ao longo de cinquenta anos."),
            ("hotel", "Hotel Saudade, Quarto 7", "comédia em um ato e muitas portas", "Henrique Barreto",
             G.COMEDY, P.REHEARSAL, "lanterna", T(-30), T(35), T(95), "Teatro Aurora – Sala Principal", 120,
             D("118000"), 95, "#C9A86A", False,
             "Um hotel decadente, um quarto reservado duas vezes e cinco hóspedes que não deveriam se encontrar. "
             "Uma comédia de portas sobre solidão, engano e café requentado."),
            ("frevo", "Frevo das Almas", "musical pernambucano", "Joaquim Bezerra", G.MUSICAL, P.PERFORMANCE, "mare",
             T(-150), T(-12), T(30), "Teatro do Cais", 150, D("260000"), 130, "#B5543C", True,
             "Na quarta-feira de cinzas, os foliões que morreram no carnaval voltam para um último desfile. "
             "Um musical com orquestra ao vivo, passistas e bonecos gigantes sobre memória e festa."),
            ("farol", "Lamento do Farol", "ópera de câmara em dois atos", "Tereza Almada", G.OPERA,
             P.PRE_PRODUCTION, "mare", T(-20), T(70), T(100), "Teatro do Cais", 150, D("210000"), 110, "#3E5C6B",
             False,
             "O faroleiro de uma ilha esquecida recusa-se a apagar a luz depois que o porto é desativado. "
             "Ópera de câmara para quatro cantores e sexteto de cordas."),
            ("mare_marco", "Maré de Março", "drama da vila de pescadores", "Joaquim Bezerra", G.DRAMA, P.ARCHIVED, "mare",
             T(-260), T(-200), T(-150), "Teatro do Cais", 150, D("70000"), 85, "#5E6B4E", False,
             "Pescadores enfrentam a chegada de um grande empreendimento à vila. Montagem encerrada após "
             "temporada de sucesso e circulação por quatro cidades."),
            ("riso", "Riso de Segunda-Feira", "stand-up teatral", "Vítor Lacerda", G.COMEDY, P.ARCHIVED, "mare",
             T(-130), T(-100), T(-55), "Teatro do Cais", 150, D("45000"), 70, "#D9A441", False,
             "Um palhaço desempregado abre um curso de humor para quem perdeu a graça. "
             "Temporada encerrada com casa cheia nos últimos fins de semana."),
            ("circo", "O Circo que Perdeu a Lona", "espetáculo para a infância", "Marina Quintela", G.CHILDREN,
             P.PERFORMANCE, "atelie", T(-90), T(-28), T(42), "Centro Cultural Ipê Amarelo", 90, D("48000"), 55,
             "#E0A33A", True,
             "Um vendaval leva a lona de um circo pequenino. Para não cancelar a estreia, a trupe decide "
             "procurar a lona pelo mundo — e descobre que o picadeiro pode ser em qualquer lugar."),
            ("ceia", "A Última Ceia dos Bonecos", "teatro de animação para adultos", "Rodrigo Esteves", G.EXPERIMENTAL, P.PRE_PRODUCTION,
             "atelie", T(-15), T(60), T(90), "Galpão Ateliê", 60, D("64000"), 75, "#6B3E5C", False,
             "Bonecos de um teatro de marionetes fechado se reúnem para um último jantar antes da demolição. "
             "Teatro de animação para adultos, com manipulação à vista."),
            ("quintal", "Quintal de Vento", "dança-teatro", "Flora Bittencourt", G.DANCE, P.DEVELOPMENT, "atelie",
             T(20), T(150), T(190), "Galpão Ateliê", 60, D("38000"), 50, "#7D9D8C", False,
             "Pesquisa de movimento a partir das brincadeiras de quintal da infância de quatro intérpretes. "
             "Projeto em desenvolvimento para edital de circulação."),
        ]
        for (key, title, sub, author, genre, status, comp, start, first, end, venue, cap, budget, dur, color,
             public, synopsis) in rows:
            self.prods[key] = self.ensure(
                Production, key, title=title, slug=f"demo-{key}", subtitle=sub, synopsis=synopsis,
                playwright=author, status=status, genre=genre, start_date=start, first_performance_date=first,
                end_date=end, venue=venue, venue_capacity=cap, budget_total=budget, duration_minutes=dur,
                color_accent=color, is_public=public, company_id=self.comp[comp].id,
                created_by_id=self.users["admin"].id,
            )
        self.db.flush()

    # ── Elenco e equipe ───────────────────────────────────────────────────
    CREW = {
        # produção: [(pessoa, função, departamento, personagem, principal, cachê)]
        "relojoeiro": [
            ("helena", "Direção geral", Department.DIRECTION, None, True, 18000),
            ("otavio", "Produção executiva", Department.PRODUCTION, None, False, 12000),
            ("ernesto", "Ator", Department.CAST, "Anselmo, o relojoeiro", True, 9000),
            ("aurora", "Atriz", Department.CAST, "Marta, a filha", True, 9000),
            ("caio", "Ator", Department.CAST, "Tito, o aprendiz", False, 6000),
            ("isadora", "Atriz", Department.CAST, "Dona Celeste", False, 6000),
            ("rafaela", "Iluminação e direção técnica", Department.TECHNICAL, None, False, 7500),
            ("davi", "Cenografia", Department.TECHNICAL, None, False, 8000),
            ("iara", "Figurino", Department.TECHNICAL, None, False, 6500),
            ("bruno", "Trilha e sonoplastia", Department.TECHNICAL, None, False, 5000),
            ("paula", "Contrarregragem", Department.TECHNICAL, None, False, 3500),
        ],
        "cartas": [
            ("helena", "Direção", Department.DIRECTION, None, True, 12000),
            ("felipe", "Produção", Department.PRODUCTION, None, False, 7000),
            ("aurora", "Atriz", Department.CAST, "Odete (1974)", True, 6000),
            ("julia", "Atriz", Department.CAST, "Regina (1999)", True, 6000),
            ("gabriela", "Atriz", Department.CAST, "Lívia (2024)", True, 6000),
            ("rafaela", "Iluminação", Department.TECHNICAL, None, False, 5000),
            ("tais", "Adereços", Department.TECHNICAL, None, False, 3000),
            ("caio", "Ator convidado", Department.CAST, "O carteiro", False, 2500),
        ],
        "hotel": [
            ("helena", "Direção", Department.DIRECTION, None, True, 14000),
            ("otavio", "Produção", Department.PRODUCTION, None, False, 8000),
            ("vitor", "Ator", Department.CAST, "Seu Amâncio, o gerente", True, 7000),
            ("celina", "Atriz", Department.CAST, "Glória", False, 5500),
            ("mateus", "Ator", Department.CAST, "Rubens", False, 5500),
            ("lia", "Atriz", Department.CAST, "Camareira Zezé", False, 5500),
            ("tomas", "Ator", Department.CAST, "O hóspede do 7", False, 5500),
            ("murilo", "Cenotecnia", Department.TECHNICAL, None, False, 6000),
            ("iara", "Figurino", Department.TECHNICAL, None, False, 5000),
            ("renan", "Operação de luz", Department.TECHNICAL, None, False, 3500),
        ],
        "frevo": [
            ("joaquim", "Direção geral", Department.DIRECTION, None, True, 20000),
            ("tereza", "Direção musical", Department.DIRECTION, None, False, 15000),
            ("sonia", "Produção executiva", Department.PRODUCTION, None, False, 12000),
            ("yara", "Atriz e passista", Department.CAST, "Rosa do Passo", True, 8000),
            ("otto", "Ator e percussionista", Department.CAST, "Mestre Zé Batuque", True, 8000),
            ("clarice", "Atriz e cantora", Department.CAST, "Dona Saudade", True, 8000),
            ("samuel", "Ator e músico", Department.CAST, "Folião Sem Nome", False, 6000),
            ("leandro", "Ator e acrobata", Department.CAST, "Pierrô", False, 6000),
            ("luana", "Atriz e bailarina", Department.CAST, "Colombina", False, 6000),
            ("gustavo", "Iluminação", Department.TECHNICAL, None, False, 7000),
            ("bruno", "Desenho de som", Department.TECHNICAL, None, False, 7000),
            ("nina", "Visagismo", Department.TECHNICAL, None, False, 4500),
            ("tais", "Bonecos gigantes", Department.TECHNICAL, None, False, 9000),
        ],
        "farol": [
            ("tereza", "Direção musical e cênica", Department.DIRECTION, None, True, 16000),
            ("sonia", "Produção", Department.PRODUCTION, None, False, 9000),
            ("ramon", "Barítono", Department.CAST, "O faroleiro", True, 9000),
            ("bianca", "Soprano", Department.CAST, "Inês", True, 9000),
            ("neusa", "Mezzo-soprano", Department.CAST, "A mãe", False, 7000),
            ("davi", "Cenografia", Department.TECHNICAL, None, False, 9000),
        ],
        "mare_marco": [
            ("joaquim", "Direção", Department.DIRECTION, None, True, 10000),
            ("sonia", "Produção", Department.PRODUCTION, None, False, 6000),
            ("otto", "Ator", Department.CAST, "Seu Benedito", True, 4500),
            ("yara", "Atriz", Department.CAST, "Cida", True, 4500),
            ("ernesto", "Ator", Department.CAST, "O engenheiro", False, 4000),
            ("gustavo", "Iluminação", Department.TECHNICAL, None, False, 3500),
        ],
        "riso": [
            ("joaquim", "Direção", Department.DIRECTION, None, True, 6000),
            ("felipe", "Produção", Department.PRODUCTION, None, False, 4000),
            ("vitor", "Ator", Department.CAST, "Pipoca, o palhaço", True, 6000),
            ("renan", "Luz e som", Department.TECHNICAL, None, False, 2500),
        ],
        "circo": [
            ("marina", "Direção", Department.DIRECTION, None, True, 9000),
            ("felipe", "Produção", Department.PRODUCTION, None, False, 5000),
            ("lia", "Atriz e palhaça", Department.CAST, "Palhaça Fubá", True, 4000),
            ("leandro", "Ator e acrobata", Department.CAST, "Trapezista Tonico", True, 4000),
            ("rodrigo", "Ator e bonequeiro", Department.CAST, "Mestre de pista", False, 4000),
            ("luana", "Atriz", Department.CAST, "Bailarina do arame", False, 4000),
            ("tais", "Adereços e bonecos", Department.TECHNICAL, None, False, 3500),
            ("renan", "Luz", Department.TECHNICAL, None, False, 2500),
            ("paula", "Contrarregragem", Department.TECHNICAL, None, False, 2000),
        ],
        "ceia": [
            ("marina", "Direção", Department.DIRECTION, None, True, 10000),
            ("felipe", "Produção", Department.PRODUCTION, None, False, 5000),
            ("rodrigo", "Manipulador e dramaturgo", Department.CAST, "O Mestre-Cuca", True, 5000),
            ("flora", "Manipuladora", Department.CAST, "A Rainha de Pano", False, 4500),
            ("tomas", "Manipulador", Department.CAST, "O Soldado de Chumbo", False, 4500),
            ("tais", "Construção de bonecos", Department.TECHNICAL, None, False, 8000),
            ("gustavo", "Iluminação", Department.TECHNICAL, None, False, 4000),
        ],
        "quintal": [
            ("marina", "Orientação artística", Department.DIRECTION, None, True, 4000),
            ("flora", "Intérprete-criadora", Department.CAST, None, True, 3000),
            ("luana", "Intérprete-criadora", Department.CAST, None, False, 3000),
            ("julia", "Intérprete-criadora", Department.CAST, None, False, 3000),
        ],
    }

    def crew(self):
        for pkey, rows in self.CREW.items():
            prod = self.prods[pkey]
            archived = prod.status == ProductionStatus.ARCHIVED
            for person, role, dept, char, lead, fee in rows:
                paid = fee if archived else (fee * D("0.5") if prod.status == ProductionStatus.PERFORMANCE
                                             else (fee * D("0.3") if prod.status == ProductionStatus.REHEARSAL else 0))
                self.ensure(
                    ProductionParticipant, f"{pkey}:{person}:{role}", production_id=prod.id,
                    user_id=self.users[person].id, role_title=role, department=dept, character_name=char,
                    fee=D(fee), fee_paid=D(paid).quantize(D("0.01")), start_date=prod.start_date,
                    end_date=prod.end_date, is_lead=lead, is_confirmed=True,
                    notes=self.note(self.CREW_NOTES, f"{pkey}:{person}:{role}"),
                )
        self.db.flush()

    # Observações fictícias: escolhidas de forma estável pela chave (o seed é repetível)
    @staticmethod
    def note(options, key, chance=0.5):
        r = random.Random(f"nota:{key}")
        return r.choice(options) if r.random() < chance else None

    CREW_NOTES = [
        "Cachê pago em duas parcelas: metade na estreia e o restante no fim da temporada.",
        "Indisponível às segundas-feiras (aulas na universidade).",
        "Contrato assinado; aguardando nota fiscal da primeira parcela.",
        "Pode cobrir ensaios extras aos sábados pela manhã.",
        "Pediu dispensa no ensaio do dia 12 por consulta médica; já reposto.",
        "Responsável também pela preparação vocal do elenco.",
        "Mora fora da cidade: produção cobre o transporte nos dias de ensaio.",
    ]
    REHEARSAL_NOTES = [
        "Trazer o figurino de ensaio e o texto marcado.",
        "Chegar 30 minutos antes para aquecimento vocal.",
        "Repassar as cenas 4 e 5 com a nova marcação.",
        "Fotógrafo da divulgação acompanha a última hora.",
        "Sala reservada até as 18h; desocupar no horário.",
    ]
    TECH_NOTES = "Afinação de luz a partir das 13h. Equipe técnica completa; elenco só às 15h."
    DRESS_NOTES = "Ensaio corrido com figurino, luz e som de estreia. Sem interrupções."
    MEETING_NOTES = "Pauta: cronograma da temporada, revisão do orçamento e divulgação."

    def members(self, pkey):
        return [person for person, *_ in self.CREW[pkey]]

    # ── Agenda (ensaios, técnicas, reuniões, apresentações) ───────────────
    def schedules(self):
        S = ScheduleType
        plans = {
            # produção: (dias relativos de ensaio, local de ensaio)
            "relojoeiro": (range(-40, -21, 3), "Sala de ensaio Lanterna"),
            "cartas": (list(range(-24, 0, 3)) + list(range(1, 17, 3)), "Espaço Cênico Lanterna"),
            "hotel": (list(range(-18, 0, 4)) + list(range(2, 33, 4)), "Sala de ensaio Lanterna"),
            "frevo": (range(-45, -12, 4), "Galpão do Cais"),
            "farol": (list(range(-10, 0, 5)) + list(range(4, 40, 6)), "Sala de música Maré Alta"),
            "circo": (range(-50, -28, 4), "Galpão Ateliê"),
            "ceia": (list(range(-8, 0, 4)) + list(range(3, 50, 7)), "Galpão Ateliê"),
        }
        for pkey, (days, place) in plans.items():
            prod = self.prods[pkey]
            people = self.members(pkey)
            for d in days:
                day = self.T(d)
                kind = S.REHEARSAL
                title = "Ensaio de cenas"
                if d == max(days) and d < 0:
                    kind, title = S.DRESS_REHEARSAL, "Ensaio geral"
                elif d % 5 == 0:
                    kind, title = S.TECH_RUN, "Ensaio técnico de luz e som"
                start, end = at(day, 14), at(day, 18)
                sched = self.ensure(Schedule, f"{pkey}:{d}", production_id=prod.id, title=title, type=kind,
                                    description=f"{title} — {prod.title}", start_time=start, end_time=end,
                                    location=place,
                                    notes=self.DRESS_NOTES if kind == S.DRESS_REHEARSAL else
                                    self.TECH_NOTES if kind == S.TECH_RUN else
                                    self.note(self.REHEARSAL_NOTES, f"{pkey}:{d}", 0.6))
                for person in people:
                    if d < 0:
                        status = AttendanceStatus.ABSENT if self.rng.random() < 0.07 else AttendanceStatus.CONFIRMED
                    else:
                        status = AttendanceStatus.CONFIRMED if self.rng.random() < 0.6 else AttendanceStatus.INVITED
                    self.ensure(ScheduleParticipant, f"{pkey}:{d}:{person}", schedule_id=sched.id,
                                user_id=self.users[person].id, status=status.value)
            # Reunião de produção na próxima semana
            meet = self.ensure(Schedule, f"{pkey}:reuniao", production_id=prod.id, title="Reunião de produção",
                               type=S.MEETING, description="Cronograma, orçamento e pendências da semana.",
                               start_time=at(self.T(5), 10), end_time=at(self.T(5), 11, 30),
                               location="Escritório da companhia", notes=self.MEETING_NOTES)
            for person in people[:3]:
                self.ensure(ScheduleParticipant, f"{pkey}:reuniao:{person}", schedule_id=meet.id,
                            user_id=self.users[person].id, status=AttendanceStatus.INVITED.value)
        # Um ensaio cancelado, para mostrar o cancelamento lógico
        canc = self.ensure(Schedule, "hotel:cancelado", production_id=self.prods["hotel"].id,
                           title="Ensaio de marcação", type=S.REHEARSAL, start_time=at(self.T(9), 19),
                           end_time=at(self.T(9), 22), location="Sala de ensaio Lanterna",
                           description="Marcação do segundo quadro.",
                           notes="Remarcar assim que a sala for liberada.")
        if not canc.is_cancelled:
            canc.is_cancelled = True
            canc.cancelled_at = self.now
            canc.cancel_reason = "Sala interditada para manutenção do ar-condicionado."
        self.db.flush()

    # ── Ingressos: sessões, vendas, reservas, check-ins e pedidos online ──
    BUYER_FIRST = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Giovana", "Hugo", "Inês", "João",
                   "Karina", "Lucas", "Mariana", "Nelson", "Olívia", "Pedro", "Quésia", "Raul", "Sabrina",
                   "Thiago", "Úrsula", "Valter", "Wesley", "Xênia", "Yuri", "Zilda"]
    BUYER_LAST = ["Andrade", "Barros", "Campos", "Duarte", "Esteves", "Freitas", "Gomes", "Holanda", "Leite",
                  "Macedo", "Nunes", "Pinheiro", "Queiroz", "Rocha", "Tavares", "Vasconcelos"]

    def buyer(self, seed):
        r = random.Random(seed)
        first, last = r.choice(self.BUYER_FIRST), r.choice(self.BUYER_LAST)
        plain = (f"{first}.{last}".lower().replace("á", "a").replace("é", "e").replace("ê", "e")
                 .replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ú", "u").replace("ê", "e")
                 .replace("ü", "u").replace("ú", "u").replace("Ú", "u"))
        return f"{first} {last}", f"{plain}@email.example"

    @staticmethod
    def fake_phone(seed):
        # 8 dígitos começando por 9: formato que não existe para celular no Brasil, logo não é de ninguém
        return f"(11) 9555-{random.Random(f'tel:{seed}').randint(0, 9999):04d}"

    @staticmethod
    def batch_description(sessions, d):
        days = [s[0] for s in sessions]
        if d == min(days):
            return "Sessão de estreia"
        if d == max(days):
            return "Última sessão da temporada"
        if days.index(d) == 2:
            return "Sessão com bate-papo com o elenco após o espetáculo"
        if days.index(d) == 3:
            return "Sessão com meia-entrada para estudantes da rede pública"
        return None

    def tickets(self):
        plans = {
            # produção: lista de (dia relativo, hora, ocupação alvo)
            "relojoeiro": [(-21, 21, .97), (-20, 21, .92), (-14, 21, .88), (-13, 21, .95), (-7, 21, .90),
                           (-6, 21, .99), (2, 21, .62), (3, 21, .48), (9, 21, .30), (10, 21, .22), (16, 21, .08)],
            "frevo": [(-12, 20, 1.0), (-11, 20, .96), (-5, 20, .93), (-4, 20, .98), (2, 20, .71), (3, 20, .55),
                      (9, 20, .34), (10, 20, .27), (23, 20, .05)],
            "circo": [(-28, 16, .85), (-27, 11, .78), (-21, 16, .91), (-14, 16, .82), (-7, 16, .94),
                      (4, 16, .58), (11, 16, .33), (18, 16, .12)],
            "mare_marco": [(-200, 20, .74), (-199, 20, .81), (-193, 20, .88), (-186, 20, .92), (-179, 20, .97)],
            "riso": [(-100, 21, .55), (-93, 21, .68), (-86, 21, .79), (-72, 21, .93), (-58, 21, 1.0)],
            "cartas": [(18, 21, .40), (19, 21, .26), (25, 21, .12)],
        }
        staff = self.users["rafaela"].id
        for pkey, sessions in plans.items():
            prod = self.prods[pkey]
            cap = prod.venue_capacity
            price = {"relojoeiro": D("80"), "frevo": D("120"), "circo": D("40"), "mare_marco": D("50"),
                     "riso": D("40"), "cartas": D("70")}[pkey]
            premium = price * 2 if pkey in ("relojoeiro", "frevo", "cartas") else None
            for d, hh, occ in sessions:
                when = at(self.T(d), hh)
                past = d < 0
                b = self.ensure(
                    TicketBatch, f"{pkey}:{d}", production_id=prod.id, performance_date=when,
                    venue_section="Plateia única" if pkey != "frevo" else "Plateia e balcão",
                    total_seats=cap, price=price, price_premium=premium, tickets_sold=0,
                    status=TicketBatchStatus.COMPLETED if prod.status == ProductionStatus.ARCHIVED or past
                    else TicketBatchStatus.ON_SALE,
                    sale_start=at(self.T(d - 40), 10), sale_end=when,
                    description=self.batch_description(sessions, d),
                )
                self.db.flush()
                # Apresentação também aparece na agenda
                self.ensure(Schedule, f"sessao:{pkey}:{d}", production_id=prod.id, title="Apresentação",
                            type=ScheduleType.PERFORMANCE, start_time=when,
                            end_time=when + timedelta(minutes=prod.duration_minutes or 90),
                            location=prod.venue, description=f"Sessão de {prod.title}",
                            notes="Elenco no teatro 2 horas antes. Abertura da casa 30 minutos antes.")
                target = min(cap, int(round(cap * occ)))
                sold = 0
                group = 0
                while sold < target:
                    group += 1
                    qty = min(target - sold, random.Random(f"{pkey}{d}{group}").choice([1, 2, 2, 2, 3, 4]))
                    name, email = self.buyer(f"{pkey}{d}{group}")
                    is_prem = premium is not None and random.Random(f"p{pkey}{d}{group}").random() < 0.15
                    for n in range(qty):
                        key = f"{pkey}:{d}:{group}:{n}"
                        r = random.Random(key).random()
                        if past:
                            status = TicketStatus.USED if r < 0.93 else TicketStatus.CONFIRMED  # faltosos
                        else:
                            status = TicketStatus.RESERVED if r < 0.08 else TicketStatus.CONFIRMED
                        self.ensure(
                            Ticket, key, batch_id=b.id, code=code_for(key), buyer_name=name, buyer_email=email,
                            is_premium=is_prem, price_paid=(premium if is_prem else price), status=status,
                            purchase_date=when - timedelta(days=random.Random(key + "d").randint(1, 35)),
                            used_at=when - timedelta(minutes=random.Random(key + "m").randint(2, 40))
                            if status == TicketStatus.USED else None,
                            checked_in_by_id=staff if status == TicketStatus.USED else None,
                            notes="Venda no balcão" if group % 3 else "Venda por telefone",
                            buyer_phone=self.fake_phone(f"{pkey}{d}{group}") if group % 3 == 0 or group % 4 == 1 else None,
                            seat_number=f"{chr(65 + (sold + n) // 12)}{(sold + n) % 12 + 1}",
                        )
                    sold += qty
                # Alguns cancelamentos (não ocupam lugar)
                for n in range(2 if not past else 1):
                    key = f"{pkey}:{d}:cancel:{n}"
                    name, email = self.buyer(key)
                    self.ensure(Ticket, key, batch_id=b.id, code=code_for(key), buyer_name=name, buyer_email=email,
                                price_paid=price, status=TicketStatus.CANCELLED, cancelled_at=when - timedelta(days=3),
                                purchase_date=when - timedelta(days=10), notes="Cancelado a pedido do comprador")
        self.db.flush()
        self.online_orders()
        self.db.flush()
        self.recount_batches()

    def online_orders(self):
        """Pedidos online fictícios (provedor 'demonstração', nenhum pagamento real)."""
        cases = [
            ("relojoeiro", 2, "paid", 2), ("relojoeiro", 3, "paid", 3), ("frevo", 2, "paid", 4),
            ("circo", 4, "paid", 3), ("frevo", 3, "pending", 2), ("relojoeiro", 9, "expired", 2),
            ("circo", 11, "paid", 2),
        ]
        for i, (pkey, d, status, qty) in enumerate(cases):
            batch = self.db.get(TicketBatch, uid("ticket_batches", f"{pkey}:{d}"))
            name, email = self.buyer(f"online{i}")
            created = self.now - timedelta(days=6 - i % 5, hours=i)
            st = {"paid": OrderStatus.PAID, "pending": OrderStatus.PENDING, "expired": OrderStatus.EXPIRED}[status]
            order = self.ensure(
                TicketOrder, f"online:{i}", public_token=f"demo-{uid('token', i)}", batch_id=batch.id,
                buyer_name=name, buyer_email=email, accepted_terms_at=created, quantity=qty, is_premium=False,
                unit_price=batch.price, total_amount=batch.price * qty, status=st, provider="demonstracao",
                provider_payment_id=f"DEMO-{1000 + i}" if st == OrderStatus.PAID else None,
                provider_status="approved" if st == OrderStatus.PAID else ("expired" if st == OrderStatus.EXPIRED else "pending"),
                checkout_url=None,
                # pedido pendente: lugares guardados por mais 25 minutos a partir do seed
                expires_at=self.now + timedelta(minutes=25) if st == OrderStatus.PENDING else created + timedelta(minutes=30),
                paid_at=created + timedelta(minutes=4) if st == OrderStatus.PAID else None,
                created_at=created,
            )
            tstatus = {OrderStatus.PAID: TicketStatus.CONFIRMED, OrderStatus.PENDING: TicketStatus.RESERVED,
                       OrderStatus.EXPIRED: TicketStatus.CANCELLED}[st]
            for n in range(qty):
                key = f"online:{i}:{n}"
                self.ensure(Ticket, key, batch_id=batch.id, order_id=order.id, code=code_for(key), buyer_name=name,
                            buyer_email=email, price_paid=batch.price, status=tstatus, purchase_date=created,
                            cancelled_at=created + timedelta(minutes=30) if tstatus == TicketStatus.CANCELLED else None,
                            notes="Venda online (demonstração)")

    def recount_batches(self):
        """tickets_sold = ingressos que ocupam lugar; nunca acima da capacidade."""
        occupying = (TicketStatus.RESERVED, TicketStatus.CONFIRMED, TicketStatus.USED)
        counts = dict(self.db.query(Ticket.batch_id, func.count(Ticket.id))
                      .filter(Ticket.status.in_(occupying)).group_by(Ticket.batch_id).all())
        for b in self.db.query(TicketBatch).filter(TicketBatch.id.in_([p.id for p in self._demo_batches()])).all():
            b.tickets_sold = counts.get(b.id, 0)
            if b.tickets_sold > b.total_seats:
                raise RuntimeError(f"Lotação excedida no lote {b.id}")
            if b.status in (TicketBatchStatus.ON_SALE, TicketBatchStatus.SOLD_OUT):
                b.status = TicketBatchStatus.SOLD_OUT if b.tickets_sold >= b.total_seats else TicketBatchStatus.ON_SALE

    def _demo_batches(self):
        return self.db.query(TicketBatch.id).filter(TicketBatch.production_id.in_([p.id for p in self.prods.values()])).all()

    # ── Recursos teatrais ─────────────────────────────────────────────────
    def resources(self):
        R, S = ResourceType, ResourceStatus
        items = {
            "relojoeiro": [
                ("Oficina do relojoeiro (cenário giratório)", R.SET, S.IN_USE, 1, 24000, "Davi Montenegro Cenografia", "Palco", "davi"),
                ("Parede de 140 relógios de parede", R.SET, S.IN_USE, 1, 6800, "Antiquário Tic-Tac", "Palco", "davi"),
                ("Sobretudo de lã do relojoeiro", R.COSTUME, S.IN_USE, 2, 1250, "Ateliê Iara Medeiros", "Camarim 1", "iara"),
                ("Vestido de viagem de Marta", R.COSTUME, S.IN_USE, 2, 980, "Ateliê Iara Medeiros", "Camarim 2", "iara"),
                ("Refletores elipsoidais 750 W", R.EQUIPMENT, S.IN_USE, 18, 420, "Locadora Luz & Cena", "Vara 2", "rafaela"),
                ("Máquina de fumaça", R.EQUIPMENT, S.MAINTENANCE, 1, 2600, "Locadora Luz & Cena", "Depósito técnico", "rafaela"),
                ("Caixa de cartas nunca enviadas", R.PROP, S.IN_USE, 1, 180, "Taís Brandão Adereços", "Coxia esquerda", "paula"),
                ("Relógio de bolso com corrente", R.PROP, S.IN_USE, 3, 95, "Antiquário Tic-Tac", "Coxia direita", "paula"),
            ],
            "cartas": [
                ("Apartamento em três épocas (praticáveis)", R.SET, S.IN_PROGRESS, 1, 15500, "Marcenaria Cais", "Galpão", "rafaela"),
                ("Figurino de época 1974", R.COSTUME, S.AVAILABLE, 1, 1400, "Brechó Memória", "Arara A", None),
                ("Figurino anos 1990", R.COSTUME, S.IN_PROGRESS, 1, 900, "Brechó Memória", "Arara A", None),
                ("Máquina de escrever Olivetti", R.PROP, S.AVAILABLE, 1, 650, "Antiquário Tic-Tac", "Depósito", "tais"),
                ("Projetor 6.000 lumens", R.EQUIPMENT, S.PLANNED, 1, 3200, "Locadora Imagem Viva", None, "rafaela"),
            ],
            "hotel": [
                ("Recepção com 5 portas funcionais", R.SET, S.IN_PROGRESS, 1, 19800, "Murilo Pacheco Cenotecnia", "Galpão", "murilo"),
                ("Uniforme de camareira", R.COSTUME, S.AVAILABLE, 2, 380, "Ateliê Iara Medeiros", "Arara B", "iara"),
                ("Terno do gerente (anos 70)", R.COSTUME, S.IN_PROGRESS, 1, 1100, "Ateliê Iara Medeiros", "Arara B", "iara"),
                ("Campainha de balcão", R.PROP, S.AVAILABLE, 2, 60, "Feira de antiguidades", "Depósito", None),
                ("Mesa de luz digital 24 canais", R.EQUIPMENT, S.PLANNED, 1, 5400, "Locadora Luz & Cena", None, "renan"),
            ],
            "frevo": [
                ("Bonecos gigantes (4 unidades)", R.PROP, S.IN_USE, 4, 4800, "Taís Brandão Adereços", "Palco", "tais"),
                ("Fantasias de frevo (corpo de baile)", R.COSTUME, S.IN_USE, 12, 690, "Ateliê Maré Alta", "Camarim coletivo", None),
                ("Sombrinhas de frevo", R.PROP, S.IN_USE, 20, 45, "Mercado de São José", "Coxia", None),
                ("Ladeira de Olinda (cenário em rampa)", R.SET, S.IN_USE, 1, 31000, "Davi Montenegro Cenografia", "Palco", "davi"),
                ("Microfones headset sem fio", R.EQUIPMENT, S.IN_USE, 10, 1800, "Som do Recife Locações", "Cabine de som", "bruno"),
                ("Mesa de som digital 32 canais", R.EQUIPMENT, S.IN_USE, 1, 9500, "Som do Recife Locações", "Cabine de som", "bruno"),
                ("Moving heads", R.EQUIPMENT, S.IN_USE, 8, 1300, "Locadora Luz & Cena", "Vara 3", "gustavo"),
            ],
            "farol": [
                ("Farol cenográfico com luz giratória", R.SET, S.PLANNED, 1, 27000, "Davi Montenegro Cenografia", None, "davi"),
                ("Figurinos de pescadores", R.COSTUME, S.PLANNED, 4, 850, "Ateliê Maré Alta", None, None),
                ("Estantes de partitura com luz", R.EQUIPMENT, S.AVAILABLE, 6, 220, "Acervo do grupo", "Sala de música", None),
            ],
            "mare_marco": [
                ("Barco de pesca em tamanho real", R.SET, S.AVAILABLE, 1, 9800, "Marcenaria Cais", "Depósito do grupo", None),
                ("Redes de pesca", R.PROP, S.AVAILABLE, 6, 120, "Colônia de pescadores", "Depósito do grupo", None),
            ],
            "riso": [
                ("Nariz e figurino do palhaço Pipoca", R.COSTUME, S.AVAILABLE, 1, 700, "Ateliê Maré Alta", "Arara do grupo", None),
            ],
            "circo": [
                ("Picadeiro desmontável", R.SET, S.IN_USE, 1, 8200, "Coletivo Ateliê do Gesto", "Palco", "tais"),
                ("Lona de retalhos (cortina final)", R.SET, S.IN_USE, 1, 2400, "Costureiras do bairro", "Vara 1", "tais"),
                ("Figurinos de circo coloridos", R.COSTUME, S.IN_USE, 4, 560, "Ateliê do Gesto", "Camarim", None),
                ("Bonecos de vara (animais)", R.PROP, S.IN_USE, 5, 380, "Taís Brandão Adereços", "Coxia", "tais"),
                ("Caixa de som portátil", R.EQUIPMENT, S.IN_USE, 2, 1400, "Acervo do coletivo", "Palco", "renan"),
            ],
            "ceia": [
                ("Marionetes de fio (12 personagens)", R.PROP, S.IN_PROGRESS, 12, 950, "Taís Brandão Adereços", "Oficina", "tais"),
                ("Mesa de banquete com alçapões", R.SET, S.PLANNED, 1, 7300, "Murilo Pacheco Cenotecnia", None, None),
                ("Figurinos pretos de manipulação", R.COSTUME, S.AVAILABLE, 3, 260, "Ateliê do Gesto", "Arara", None),
            ],
            "quintal": [
                ("Linóleo de dança 8 x 8 m", R.EQUIPMENT, S.PLANNED, 1, 4200, None, None, None),
            ],
        }
        for pkey, rows in items.items():
            for i, (name, rtype, status, qty, cost, supplier, place, resp) in enumerate(rows):
                self.ensure(ProductionResource, f"{pkey}:{i}", production_id=self.prods[pkey].id, name=name, type=rtype,
                            status=status, quantity=qty, unit_cost=D(cost), supplier=supplier, location=place,
                            responsible_id=self.users[resp].id if resp else None,
                            notes=self.RESOURCE_NOTES.get(status) if random.Random(f"rec:{pkey}:{i}").random() < 0.7 else None)
        self.db.flush()

    RESOURCE_NOTES = {
        ResourceStatus.PLANNED: "Orçamento aprovado; aguardando confirmação do fornecedor.",
        ResourceStatus.IN_PROGRESS: "Prova marcada para a próxima semana. Conferir medidas antes da entrega.",
        ResourceStatus.AVAILABLE: "Conferido e guardado. Retirar com a produção.",
        ResourceStatus.IN_USE: "Conferir antes de cada sessão e devolver ao lugar depois.",
        ResourceStatus.MAINTENANCE: "Na locadora para revisão; previsão de retorno em 5 dias.",
    }

    # ── Tarefas ───────────────────────────────────────────────────────────
    def tasks(self):
        S, Pr = TaskStatus, TaskPriority
        items = {
            "relojoeiro": [
                ("Trocar lâmpada queimada da vara 2", "rafaela", 1, S.TODO, Pr.HIGH),
                ("Revisar máquina de fumaça na locadora", "rafaela", -2, S.IN_PROGRESS, Pr.MEDIUM),
                ("Enviar release da última semana de temporada", "otavio", 3, S.TODO, Pr.MEDIUM),
                ("Lavar e passar figurinos para a sessão de sexta", "iara", 2, S.TODO, Pr.MEDIUM),
                ("Prestação de contas parcial do patrocínio", "lucia", -5, S.DONE, Pr.HIGH),
                ("Ensaio de reposição com o ator substituto", "helena", 6, S.TODO, Pr.LOW),
            ],
            "cartas": [
                ("Fechar orçamento do projetor", "rafaela", -1, S.IN_PROGRESS, Pr.HIGH),
                ("Finalizar figurino dos anos 1990", "iara", 9, S.TODO, Pr.MEDIUM),
                ("Abrir venda de ingressos da estreia", "felipe", -3, S.DONE, Pr.HIGH),
                ("Ensaio aberto para a imprensa", "helena", 12, S.TODO, Pr.MEDIUM),
                ("Definir trilha da cena final", "helena", 4, S.IN_PROGRESS, Pr.LOW),
            ],
            "hotel": [
                ("Testar as cinco portas da recepção", "murilo", 7, S.IN_PROGRESS, Pr.HIGH),
                ("Comprar campainhas extras", "otavio", -4, S.TODO, Pr.LOW),
                ("Marcar sessão de fotos de divulgação", "otavio", 10, S.TODO, Pr.MEDIUM),
                ("Decorar texto do 2º quadro", "vitor", 5, S.IN_PROGRESS, Pr.MEDIUM),
            ],
            "frevo": [
                ("Manutenção dos bonecos gigantes", "tais", 1, S.IN_PROGRESS, Pr.HIGH),
                ("Repor 3 sombrinhas danificadas", "tais", -1, S.TODO, Pr.MEDIUM),
                ("Negociar transmissão com TV pública", "sonia", 8, S.TODO, Pr.MEDIUM),
                ("Ensaiar nova coreografia do bloco final", "yara", 4, S.TODO, Pr.MEDIUM),
                ("Recolher notas fiscais da locação de som", "lucia", -6, S.DONE, Pr.HIGH),
            ],
            "farol": [
                ("Contratar quarteto de cordas complementar", "sonia", 14, S.TODO, Pr.HIGH),
                ("Aprovar maquete do farol", "tereza", 6, S.IN_PROGRESS, Pr.HIGH),
                ("Inscrever projeto no edital de ópera", "lucia", -8, S.DONE, Pr.HIGH),
            ],
            "circo": [
                ("Agendar sessões para escolas", "felipe", 5, S.IN_PROGRESS, Pr.MEDIUM),
                ("Costurar remendos da lona final", "tais", -2, S.TODO, Pr.MEDIUM),
                ("Preparar material educativo para professores", "marina", 12, S.TODO, Pr.LOW),
            ],
            "ceia": [
                ("Concluir as 12 marionetes", "tais", 30, S.IN_PROGRESS, Pr.HIGH),
                ("Fechar texto final", "rodrigo", 15, S.IN_PROGRESS, Pr.MEDIUM),
                ("Reservar Galpão Ateliê para a temporada", "felipe", -10, S.DONE, Pr.MEDIUM),
            ],
            "quintal": [
                ("Escrever projeto para edital de circulação", "marina", 25, S.TODO, Pr.MEDIUM),
                ("Registrar em vídeo a pesquisa de movimento", "flora", 18, S.TODO, Pr.LOW),
            ],
        }
        for pkey, rows in items.items():
            for i, (title, person, due, status, prio) in enumerate(rows):
                self.ensure(ProductionTask, f"{pkey}:{i}", production_id=self.prods[pkey].id, title=title,
                            description=self.TASK_DESC.get(title),
                            assignee_id=self.users[person].id, due_date=self.T(due), status=status, priority=prio,
                            completed_at=self.now - timedelta(days=1) if status == S.DONE else None)
        self.db.flush()

    TASK_DESC = {
        "Trocar lâmpada queimada da vara 2": "A lâmpada do refletor 7 queimou na última sessão. Há reposição no depósito técnico.",
        "Revisar máquina de fumaça na locadora": "Está falhando no 3º ato. Confirmar com a locadora se há uma reserva.",
        "Enviar release da última semana de temporada": "Mandar para a lista de imprensa com fotos novas e o link da bilheteria.",
        "Lavar e passar figurinos para a sessão de sexta": "Atenção ao sobretudo de lã: só lavagem a seco.",
        "Prestação de contas parcial do patrocínio": "Juntar as notas fiscais e o relatório de público até agora.",
        "Ensaio de reposição com o ator substituto": "Repassar as marcações do 2º ato e as entradas de luz.",
        "Fechar orçamento do projetor": "Comparar três locadoras; o limite previsto é R$ 3.200.",
        "Finalizar figurino dos anos 1990": "Faltam os acessórios e a barra da calça.",
        "Abrir venda de ingressos da estreia": "Criar os lotes das três primeiras sessões e divulgar o link.",
        "Ensaio aberto para a imprensa": "Convidar jornalistas e críticos; reservar 20 lugares.",
        "Definir trilha da cena final": "Duas opções em teste com a direção musical.",
        "Testar as cinco portas da recepção": "Abrir e fechar cada porta 50 vezes e anotar as que travam.",
        "Comprar campainhas extras": "Três campainhas de balcão iguais à de cena, para reposição.",
        "Marcar sessão de fotos de divulgação": "Com figurino e cenário montados; elenco completo.",
        "Decorar texto do 2º quadro": "Passagem de texto com a assistente de direção na quinta.",
        "Manutenção dos bonecos gigantes": "Reforçar as armações e trocar as alças de dois bonecos.",
        "Repor 3 sombrinhas danificadas": "Mesmo modelo e cores das originais.",
        "Negociar transmissão com TV pública": "Enviar proposta com as datas das duas últimas semanas.",
        "Ensaiar nova coreografia do bloco final": "Entra a partir da sessão de sábado.",
        "Recolher notas fiscais da locação de som": "Necessárias para a prestação de contas do edital.",
        "Contratar quarteto de cordas complementar": "Quatro músicos para as récitas; pedir currículo e cachê.",
        "Aprovar maquete do farol": "Reunião com a cenógrafa para validar escala e materiais.",
        "Inscrever projeto no edital de ópera": "Inscrição feita; protocolo arquivado no drive da companhia.",
        "Agendar sessões para escolas": "Prioridade para escolas da rede pública do bairro.",
        "Costurar remendos da lona final": "Usar o tecido listrado que sobrou da confecção.",
        "Preparar material educativo para professores": "Guia de duas páginas com atividades antes e depois do espetáculo.",
        "Concluir as 12 marionetes": "Faltam o acabamento de quatro e os figurinos de duas.",
        "Fechar texto final": "Versão para leitura de mesa com o elenco.",
        "Reservar Galpão Ateliê para a temporada": "Reserva confirmada por e-mail para todo o período.",
        "Escrever projeto para edital de circulação": "Prazo do edital no fim do mês; incluir vídeo da pesquisa.",
        "Registrar em vídeo a pesquisa de movimento": "Gravar os quatro intérpretes no Galpão Ateliê.",
    }

    # ── Financeiro ────────────────────────────────────────────────────────
    TX_NOTES = [
        "Comprovante arquivado na pasta do financeiro.",
        "Pago por transferência bancária.",
        "Valor conferido com o contrato.",
        "Incluído na prestação de contas do edital.",
    ]

    def finance(self):
        C = TransactionCategory
        by = self.users["lucia"].id
        items = {
            # (dia, tipo, categoria, valor, descrição, referência, conciliado)
            "relojoeiro": [
                (-110, "income", C.GRANT, 90000, "Edital municipal de fomento ao teatro (fictício) – 1ª parcela", "EDT-2026-031", True),
                (-60, "income", C.SPONSORSHIP, 40000, "Patrocínio Livraria Ponteiro (fictícia)", "PAT-0412", True),
                (-100, "expense", C.SETS, 30800, "Construção da oficina giratória e parede de relógios", "NF 1182", True),
                (-80, "expense", C.COSTUMES, 4460, "Confecção de figurinos", "NF 2210", True),
                (-30, "expense", C.EQUIPMENT, 10160, "Locação de refletores e máquina de fumaça (temporada)", "NF 3307", True),
                (-25, "expense", C.VENUE, 24000, "Aluguel do Teatro Aurora – 6 semanas", "CT-AUR-07", True),
                (-24, "expense", C.MARKETING, 6200, "Impressão de cartazes e impulsionamento", "NF 4419", True),
                (-10, "expense", C.PERSONNEL, 43750, "Cachês – 1ª metade da temporada", "FOL-03", True),
                (-2, "expense", C.ADMINISTRATION, 1850, "Contabilidade e taxas bancárias", "NF 5501", False),
            ],
            "cartas": [
                (-40, "income", C.SPONSORSHIP, 25000, "Apoio Café Memória (fictício)", "PAT-0433", True),
                (-35, "expense", C.SETS, 9000, "Adiantamento dos praticáveis", "NF 1201", True),
                (-20, "expense", C.COSTUMES, 1400, "Figurino 1974 (brechó)", "NF 2231", True),
                (-15, "expense", C.PERSONNEL, 14550, "Adiantamento de cachês (30%)", "FOL-C1", True),
                (-3, "expense", C.MARKETING, 2800, "Sessão de fotos e design do cartaz", "NF 4460", False),
            ],
            "hotel": [
                (-25, "income", C.GRANT, 60000, "Prêmio estadual de montagem (fictício)", "PRM-2026-09", True),
                (-20, "expense", C.SETS, 12000, "Estrutura da recepção (sinal)", "NF 1240", True),
                (-12, "expense", C.PERSONNEL, 17400, "Adiantamento de cachês (30%)", "FOL-H1", True),
                (-4, "expense", C.COSTUMES, 1860, "Tecidos e aviamentos", "NF 2260", False),
            ],
            "frevo": [
                (-140, "income", C.GRANT, 120000, "Lei de incentivo à cultura – captação (fictícia)", "LIC-PE-551", True),
                (-70, "income", C.SPONSORSHIP, 55000, "Patrocínio Cervejaria Ladeira (fictícia)", "PAT-0390", True),
                (-11, "income", C.MERCHANDISE, 3840, "Venda de camisetas e programas", "CX-FRV-01", True),
                (-120, "expense", C.SETS, 31000, "Cenário da ladeira", "NF 1150", True),
                (-100, "expense", C.COSTUMES, 8280, "Fantasias do corpo de baile", "NF 2190", True),
                (-90, "expense", C.SETS, 19200, "Construção dos bonecos gigantes", "NF 1160", True),
                (-20, "expense", C.EQUIPMENT, 37900, "Locação de som e luz (temporada)", "NF 3290", True),
                (-18, "expense", C.VENUE, 36000, "Pauta do Teatro do Cais", "CT-CAIS-12", True),
                (-15, "expense", C.MARKETING, 9500, "Campanha de rádio e redes", "NF 4401", True),
                (-8, "expense", C.PERSONNEL, 60500, "Cachês – 1ª metade da temporada", "FOL-F1", True),
            ],
            "farol": [
                (-18, "income", C.GRANT, 80000, "Edital de ópera de câmara (fictício) – 1ª parcela", "EDT-OP-07", True),
                (-10, "expense", C.SETS, 6000, "Maquete e projeto cenográfico", "NF 1300", True),
                (-6, "expense", C.PERSONNEL, 9000, "Preparação vocal", "FOL-L1", False),
            ],
            "mare_marco": [
                (-240, "income", C.GRANT, 50000, "Edital de circulação (fictício)", "EDT-2025-112", True),
                (-230, "expense", C.SETS, 9800, "Barco cenográfico", "NF 0981", True),
                (-205, "expense", C.VENUE, 18000, "Pauta do Teatro do Cais", "CT-CAIS-03", True),
                (-160, "expense", C.PERSONNEL, 32500, "Cachês da temporada", "FOL-M1", True),
                (-155, "expense", C.ADMINISTRATION, 3200, "Prestação de contas e contabilidade", "NF 0999", True),
            ],
            "riso": [
                (-110, "income", C.DONATION, 4000, "Apoio de associação de bairro (fictícia)", "DOA-021", True),
                (-98, "expense", C.VENUE, 12000, "Pauta das segundas-feiras", "CT-CAIS-08", True),
                (-60, "expense", C.PERSONNEL, 18500, "Cachês da temporada", "FOL-R1", True),
                (-62, "expense", C.MARKETING, 2100, "Divulgação", "NF 4300", True),
            ],
            "circo": [
                (-85, "income", C.GRANT, 30000, "Edital de teatro para a infância (fictício)", "EDT-INF-04", True),
                (-70, "expense", C.SETS, 10600, "Picadeiro e lona de retalhos", "NF 1110", True),
                (-60, "expense", C.COSTUMES, 2240, "Figurinos de circo", "NF 2140", True),
                (-30, "expense", C.VENUE, 9000, "Pauta Centro Cultural Ipê Amarelo", "CT-IPE-02", True),
                (-9, "expense", C.PERSONNEL, 16500, "Cachês – 1ª metade da temporada", "FOL-CI1", True),
            ],
            "ceia": [
                (-14, "income", C.SPONSORSHIP, 20000, "Apoio Papelaria Fio de Linha (fictícia)", "PAT-0450", True),
                (-10, "expense", C.PROP if hasattr(C, "PROP") else C.SETS, 5700, "Materiais para marionetes", "NF 1320", False),
            ],
            "quintal": [
                (3, "expense", C.OTHER, 450, "Inscrição em edital de circulação", "INS-0098", False),
            ],
        }
        for pkey, rows in items.items():
            for i, (d, kind, cat, amount, desc, ref, rec) in enumerate(rows):
                self.ensure(FinancialTransaction, f"{pkey}:{i}", production_id=self.prods[pkey].id, created_by_id=by,
                            type=TransactionType(kind), category=cat, amount=D(amount), description=desc,
                            reference_code=ref, date=self.T(d), is_reconciled=rec,
                            notes="Aguardando conferência no extrato." if not rec else
                            self.note(self.TX_NOTES, f"{pkey}:{i}", 0.6))
        self.db.flush()
        # Repasse da bilheteria = soma exata dos ingressos pagos de cada produção
        for pkey, prod in self.prods.items():
            total = (self.db.query(func.coalesce(func.sum(Ticket.price_paid), 0))
                     .join(TicketBatch, TicketBatch.id == Ticket.batch_id)
                     .filter(TicketBatch.production_id == prod.id,
                             Ticket.status.in_([TicketStatus.CONFIRMED, TicketStatus.USED])).scalar())
            if not total:
                continue
            tx = self.ensure(FinancialTransaction, f"{pkey}:bilheteria", production_id=prod.id, created_by_id=by,
                             type=TransactionType.INCOME, category=C.TICKET_SALES, amount=D(total),
                             description="Bilheteria – repasse consolidado dos ingressos pagos",
                             reference_code=f"BIL-{pkey[:4].upper()}", date=min(self.today, prod.end_date or self.today),
                             is_reconciled=prod.status == ProductionStatus.ARCHIVED)
            tx.amount = D(total)  # mantém igual aos ingressos mesmo se o seed rodar de novo
        self.db.flush()

    # ── Execução ──────────────────────────────────────────────────────────
    def run(self, password: str):
        self.people(hash_password(password))
        self.companies()
        self.productions()
        self.crew()
        self.schedules()
        self.tickets()
        self.resources()
        self.tasks()
        self.finance()
        self.db.commit()
        return self.created


def check(db) -> list:
    """Confere relacionamentos e totais; devolve a lista de problemas encontrados."""
    problems = []
    occupying = (TicketStatus.RESERVED, TicketStatus.CONFIRMED, TicketStatus.USED)
    for b in db.query(TicketBatch).all():
        n = db.query(func.count(Ticket.id)).filter(Ticket.batch_id == b.id, Ticket.status.in_(occupying)).scalar()
        if n != b.tickets_sold:
            problems.append(f"Lote {b.id}: tickets_sold={b.tickets_sold}, ingressos ocupando={n}")
        if b.tickets_sold > b.total_seats:
            problems.append(f"Lote {b.id}: vendido acima da capacidade")
    for t in db.query(Ticket).filter(Ticket.status == TicketStatus.USED, Ticket.used_at.is_(None)).all():
        problems.append(f"Ingresso {t.code} utilizado sem horário de entrada")
    for o in db.query(TicketOrder).filter(TicketOrder.status == OrderStatus.PAID).all():
        if sum(1 for t in o.tickets if t.status in (TicketStatus.CONFIRMED, TicketStatus.USED)) != o.quantity:
            problems.append(f"Pedido {o.id}: ingressos confirmados não batem com a quantidade")
    for p in db.query(Production).all():
        paid = (db.query(func.coalesce(func.sum(Ticket.price_paid), 0)).join(TicketBatch)
                .filter(TicketBatch.production_id == p.id, Ticket.status.in_([TicketStatus.CONFIRMED, TicketStatus.USED]))
                .scalar())
        booked = (db.query(func.coalesce(func.sum(FinancialTransaction.amount), 0))
                  .filter(FinancialTransaction.production_id == p.id,
                          FinancialTransaction.category == TransactionCategory.TICKET_SALES).scalar())
        if D(paid) != D(booked):
            problems.append(f"{p.title}: bilheteria R$ {paid} ≠ lançado no financeiro R$ {booked} (normal depois de vendas feitas durante a apresentação; 'python demo.py reset' restaura)")
    orphans = db.execute(text(
        "SELECT count(*) FROM production_participants pp LEFT JOIN users u ON u.id = pp.user_id WHERE u.id IS NULL"
    )).scalar()
    if orphans:
        problems.append(f"{orphans} participações sem pessoa")
    return problems


def reset(db) -> None:
    tables = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
    db.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    db.commit()


def main(argv) -> int:
    cmd = argv[1] if len(argv) > 1 else "seed"
    if cmd not in ("seed", "reset", "check"):
        print(__doc__)
        return 2
    guard()
    from migrate import migrate

    migrate()
    db = SessionLocal()
    try:
        if cmd == "check":
            problems = check(db)
            for p in problems:
                print("✗", p)
            print("✓ Dados consistentes." if not problems else f"{len(problems)} problema(s).")
            return 1 if problems else 0
        if cmd == "reset":
            reset(db)
            print("• Banco de demonstração esvaziado.")
        created = Seeder(db).run(demo_password())
        total = sum(created.values())
        print(f"✓ Demonstração pronta: {total} registro(s) novo(s)." if total
              else "✓ Nada a criar: a demonstração já estava completa.")
        for table, n in sorted(created.items()):
            print(f"   {table}: {n}")
        problems = check(db)
        for p in problems:
            print("✗", p)
        return 1 if problems else 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main(sys.argv))
