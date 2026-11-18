import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Search, Download, Lightbulb, Info, X, BookOpen, LogIn, ShieldCheck, LayoutDashboard, Theater, Users,
  Landmark, CalendarDays, ListChecks, Shirt, Wallet, Ticket, Globe, BarChart3, Settings, Smartphone,
  FlaskConical, HelpCircle,
} from 'lucide-react'
import { Flourish } from '@/components/ui/Ornament'
import { MANUAL, MANUAL_VERSION } from './manual'
import styles from './Help.module.css'

const ICONS = {
  LogIn, ShieldCheck, LayoutDashboard, Theater, Users, Landmark, CalendarDays, ListChecks, Shirt,
  Wallet, Ticket, Globe, BarChart3, Settings, Smartphone, FlaskConical, HelpCircle,
}

const PDF_URL = '/manual/manual-curtain.pdf'

/** "texto com **negrito**" → nós React */
function Rich({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>
  )
}

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function blockText(b) {
  if (b.p || b.h || b.tip || b.note) return b.p || b.h || b.tip || b.note
  if (b.steps) return b.steps.join(' ')
  if (b.table) return [...b.table.head, ...b.table.rows.flat()].join(' ')
  if (b.caption) return b.caption
  return ''
}

const INDEX = MANUAL.map((t) => ({
  id: t.id,
  text: normalize([t.title, t.summary, ...t.blocks.map(blockText)].join(' ').replace(/\*\*/g, '')),
}))

function Block({ b }) {
  if (b.h) return <h3 className={styles.h3}><Rich text={b.h} /></h3>
  if (b.p) return <p className={styles.p}><Rich text={b.p} /></p>
  if (b.steps) {
    return (
      <ol className={styles.steps}>
        {b.steps.map((s, i) => <li key={i}><span className={styles.stepNum}>{i + 1}</span><span><Rich text={s} /></span></li>)}
      </ol>
    )
  }
  if (b.tip || b.note) {
    const Icon = b.tip ? Lightbulb : Info
    return (
      <aside className={`${styles.callout} ${b.tip ? styles.tip : styles.note}`}>
        <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
        <p><strong>{b.tip ? 'Dica' : 'Importante'}.</strong> <Rich text={b.tip || b.note} /></p>
      </aside>
    )
  }
  if (b.table) {
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>{b.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{b.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><Rich text={c} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  }
  if (b.img) {
    const src = `/manual/${b.img}.webp`
    return (
      <figure className={`${styles.figure} ${b.narrow ? styles.narrow : ''}`}>
        <a href={src} target="_blank" rel="noreferrer" title="Abrir a imagem em tamanho real">
          <img src={src} alt={b.caption} loading="lazy" />
        </a>
        <figcaption>{b.caption}</figcaption>
      </figure>
    )
  }
  return null
}

export default function Help() {
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(MANUAL[0].id)
  const refs = useRef({})
  const lockUntil = useRef(0) // após um clique, o menu não segue a rolagem por um instante

  const visible = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return MANUAL
    const words = q.split(/\s+/)
    const ids = new Set(INDEX.filter((t) => words.every((w) => t.text.includes(w))).map((t) => t.id))
    return MANUAL.filter((t) => ids.has(t.id))
  }, [query])

  const groups = useMemo(() => {
    const out = []
    visible.forEach((t) => {
      const g = out.find((x) => x.name === t.group)
      g ? g.items.push(t) : out.push({ name: t.group, items: [t] })
    })
    return out
  }, [visible])

  const goTo = (id) => {
    lockUntil.current = Date.now() + 1000
    setActive(id)
    navigate({ hash: id }, { replace: true })
    refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Abre direto no tópico do endereço (#bilheteria, por exemplo)
  useEffect(() => {
    const id = location.hash.slice(1)
    if (id && refs.current[id]) {
      setActive(id)
      setTimeout(() => refs.current[id]?.scrollIntoView({ block: 'start' }), 50)
    }
  }, [])

  // Destaca no menu o tópico que está na tela
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (hit && Date.now() > lockUntil.current) setActive(hit.target.id)
    }, { rootMargin: '0px 0px -70% 0px' })
    Object.values(refs.current).forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [visible])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className="overline">Ajuda</p>
          <h1 className={styles.title}>Manual do usuário</h1>
          <p className={styles.lead}>Guia passo a passo de tudo que o Curtain faz hoje. {MANUAL_VERSION}.</p>
          <Flourish width={200} className={styles.flourish} />
        </div>
        <a className={styles.pdfBtn} href={PDF_URL} download>
          <Download size={14} strokeWidth={1.75} /> Baixar em PDF
        </a>
      </header>

      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="Tópicos do manual">
          <label className={styles.search}>
            <Search size={14} strokeWidth={1.75} aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar no manual…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar no manual"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca"><X size={13} /></button>
            )}
          </label>
          {query && (
            <p className={styles.results} role="status">
              {visible.length ? `${visible.length} tópico(s) encontrado(s)` : 'Nada encontrado. Tente outra palavra.'}
            </p>
          )}

          <select className={styles.navSelect} value={active} onChange={(e) => goTo(e.target.value)} aria-label="Ir para o tópico">
            {visible.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>

          <div className={styles.navList}>
            {groups.map((g) => (
              <div key={g.name} className={styles.navGroup}>
                <p className={styles.navGroupName}>{g.name}</p>
                {g.items.map((t) => {
                  const Icon = ICONS[t.icon] ?? BookOpen
                  return (
                    <button key={t.id} type="button"
                      className={`${styles.navItem} ${active === t.id ? styles.navActive : ''}`}
                      onClick={() => goTo(t.id)}>
                      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                      {t.title}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </nav>

        <div className={styles.content}>
          {visible.map((t, i) => {
            const Icon = ICONS[t.icon] ?? BookOpen
            return (
              <section key={t.id} id={t.id} ref={(el) => { refs.current[t.id] = el }} className={styles.topic}>
                <div className={styles.topicHead}>
                  <span className={styles.topicIcon}><Icon size={18} strokeWidth={1.5} /></span>
                  <div>
                    <p className={styles.topicGroup}>{t.group}</p>
                    <h2 className={styles.h2}>{t.title}</h2>
                  </div>
                </div>
                <p className={styles.summary}>{t.summary}</p>
                {t.blocks.map((b, j) => <Block key={j} b={b} />)}
                {i < visible.length - 1 && <hr className={styles.sep} />}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
