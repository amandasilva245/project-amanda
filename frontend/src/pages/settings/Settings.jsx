import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { User, Lock, Info, Save, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { getErrorMessage, passwordProblem } from '@/utils/helpers'
import styles from './Settings.module.css'

const SECTION_ITEMS = [
  { key: 'profile',  label: 'Perfil',   icon: User  },
  { key: 'security', label: 'Segurança', icon: Lock  },
  { key: 'about',    label: 'Sobre',     icon: Info  },
]

export default function Settings() {
  const { user, logout } = useAuthStore()

  const [activeSection, setSection] = useState('profile')
  const [sysInfo, setSysInfo] = useState(null)
  const [sysError, setSysError] = useState(false)

  // Informações do sistema vindas da API (TCC §4.2), carregadas ao abrir "Sobre"
  useEffect(() => {
    if (activeSection !== 'about') return
    setSysError(false)
    api.get('/api/v1/system/info')
      .then((res) => setSysInfo(res.data))
      .catch(() => { setSysInfo(null); setSysError(true) })
  }, [activeSection])

  // Profile form
  const [profile, setProfile] = useState({ full_name: '', phone: '', bio: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg]       = useState(null)

  // Password form
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' })
  const [showPwd, setShowPwd]     = useState({ current: false, newPass: false, confirm: false })
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg]       = useState(null)

  useEffect(() => {
    if (user) {
      setProfile({
        full_name: user.full_name ?? '',
        phone:     user.phone    ?? '',
        bio:       user.bio      ?? '',
      })
    }
  }, [user])

  const saveProfile = async (e) => {
    e.preventDefault()
    setProfileMsg(null)
    setProfileSaving(true)
    try {
      if (!profile.full_name.trim()) {
        setProfileMsg({ type: 'error', text: 'O nome não pode ficar vazio.' })
        return
      }
      const res = await api.patch('/api/v1/auth/me', {
        full_name: profile.full_name.trim(),
        phone:     profile.phone || undefined,
        bio:       profile.bio   || undefined,
      })
      // Atualiza o menu lateral e a barra superior sem precisar recarregar
      useAuthStore.getState().setUser(res.data)
      setProfileMsg({ type: 'success', text: 'Perfil atualizado com sucesso.' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: getErrorMessage(err, 'Erro ao salvar.') })
    } finally {
      setProfileSaving(false)
    }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    setPwdMsg(null)
    if (!passwords.current) { setPwdMsg({ type: 'error', text: 'Informe a senha atual.' }); return }
    const pwdErr = passwordProblem(passwords.newPass)
    if (pwdErr) { setPwdMsg({ type: 'error', text: pwdErr }); return }
    if (passwords.newPass !== passwords.confirm) { setPwdMsg({ type: 'error', text: 'As senhas não coincidem.' }); return }
    setPwdSaving(true)
    try {
      // Antes era um PATCH /auth/me com `password`, campo que a API ignorava:
      // a tela dizia "sucesso" mas a senha não mudava.
      await api.post('/api/v1/auth/me/password', {
        current_password: passwords.current,
        new_password:     passwords.newPass,
      })
      setPwdMsg({ type: 'success', text: 'Senha alterada com sucesso.' })
      setPasswords({ current: '', newPass: '', confirm: '' })
    } catch (err) {
      setPwdMsg({ type: 'error', text: getErrorMessage(err, 'Erro ao alterar senha.') })
    } finally {
      setPwdSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className="overline">Sistema</p>
          <h1 className={styles.title}>Configurações</h1>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Sidebar Nav */}
        <nav className={styles.sideNav}>
          <div className={styles.userSnippet}>
            <Avatar name={user?.full_name} src={user?.avatar_url} size="lg" />
            <div>
              <p className={styles.userName}>{user?.full_name}</p>
              <p className={styles.userEmail}>{user?.email}</p>
              <p className={styles.userRole}>{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>

          {SECTION_ITEMS.map((s) => (
            <button
              key={s.key}
              className={`${styles.navItem} ${activeSection === s.key ? styles.navActive : ''}`}
              onClick={() => setSection(s.key)}
            >
              <s.icon size={15} strokeWidth={1.75} />
              {s.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className={styles.content}>
          {/* ── Profile ── */}
          {activeSection === 'profile' && (
            <motion.div
              className={styles.section}
              key="profile"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Informações do Perfil</h2>
                <p className={styles.sectionDesc}>
                  Atualize seu nome, telefone e apresentação visível no sistema.
                </p>
              </div>

              <form onSubmit={saveProfile} className={styles.form}>
                <Input
                  label="Nome Completo"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Seu nome completo"
                />

                <div className={styles.formRow}>
                  <div className={styles.readonlyField}>
                    <label className={styles.readonlyLabel}>E-mail</label>
                    <p className={styles.readonlyValue}>{user?.email}</p>
                    <p className={styles.readonlyHint}>E-mail não pode ser alterado.</p>
                  </div>
                  <Input
                    label="Telefone"
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+55 11 99999-0000"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Bio</label>
                  <textarea
                    className={styles.textarea}
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="Breve descrição sobre você…"
                    rows={3}
                  />
                </div>

                {profileMsg && (
                  <p className={`${styles.msg} ${profileMsg.type === 'success' ? styles.msgSuccess : styles.msgError}`}>
                    {profileMsg.text}
                  </p>
                )}

                <div className={styles.formActions}>
                  <Button variant="primary" type="submit" loading={profileSaving} leftIcon={Save}>
                    Salvar Perfil
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ── Security ── */}
          {activeSection === 'security' && (
            <motion.div
              className={styles.section}
              key="security"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Segurança</h2>
                <p className={styles.sectionDesc}>
                  Altere sua senha de acesso ao sistema.
                </p>
              </div>

              <form onSubmit={savePassword} className={styles.form}>
                <Input
                  label="Senha Atual"
                  type={showPwd.current ? 'text' : 'password'}
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  placeholder="Sua senha atual"
                  rightElement={
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd((s) => ({ ...s, current: !s.current }))}>
                      {showPwd.current ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
                    </button>
                  }
                />

                <Input
                  label="Nova Senha"
                  type={showPwd.newPass ? 'text' : 'password'}
                  value={passwords.newPass}
                  onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  rightElement={
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd((s) => ({ ...s, newPass: !s.newPass }))}>
                      {showPwd.newPass ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
                    </button>
                  }
                />

                <Input
                  label="Confirmar Nova Senha"
                  type={showPwd.confirm ? 'text' : 'password'}
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  placeholder="Repita a nova senha"
                  rightElement={
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd((s) => ({ ...s, confirm: !s.confirm }))}>
                      {showPwd.confirm ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
                    </button>
                  }
                />

                {pwdMsg && (
                  <p className={`${styles.msg} ${pwdMsg.type === 'success' ? styles.msgSuccess : styles.msgError}`}>
                    {pwdMsg.text}
                  </p>
                )}

                <div className={styles.formActions}>
                  <Button variant="primary" type="submit" loading={pwdSaving} leftIcon={Lock}>
                    Alterar Senha
                  </Button>
                </div>
              </form>

              <div className={styles.dangerZone}>
                <p className={styles.dangerTitle}>Zona Perigosa</p>
                <div className={styles.dangerRow}>
                  <div>
                    <p className={styles.dangerLabel}>Encerrar sessão</p>
                    <p className={styles.dangerDesc}>Você será desconectado de todos os dispositivos.</p>
                  </div>
                  <Button variant="ghost" onClick={logout} className={styles.dangerBtn}>
                    Sair
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── About ── */}
          {activeSection === 'about' && (
            <motion.div
              className={styles.section}
              key="about"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Sobre o Sistema</h2>
                <p className={styles.sectionDesc}>Informações da plataforma Curtain.</p>
              </div>

              <div className={styles.aboutGrid}>
                {[
                  { label: 'Produto',   value: 'Curtain — Theatrical Operations Platform' },
                  { label: 'Versão',    value: sysInfo?.version ?? '—' },
                  { label: 'API',       value: sysError ? 'Indisponível' : sysInfo ? 'Operacional' : 'Verificando…' },
                  { label: 'Banco de dados', value: sysInfo ? (sysInfo.database === 'ok' ? 'Operacional' : 'Indisponível') : '—' },
                  ...(sysInfo?.environment ? [
                    { label: 'Ambiente', value: sysInfo.environment },
                    { label: 'Migração', value: sysInfo.migration ?? 'sem controle de versão' },
                    { label: 'Python', value: sysInfo.python },
                    { label: 'Documentação da API', value: sysInfo.docs_enabled ? `${window.location.origin}/api/docs` : 'Desligada em produção' },
                  ] : []),
                  { label: 'Horário do servidor', value: sysInfo ? new Date(sysInfo.server_time).toLocaleString('pt-BR') : '—' },
                  { label: 'Conta',     value: user?.email ?? '—' },
                  { label: 'Perfil',    value: user?.role?.replace('_', ' ') ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label} className={styles.aboutRow}>
                    <span className={styles.aboutLabel}>{label}</span>
                    <span className={styles.aboutValue}>{value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
