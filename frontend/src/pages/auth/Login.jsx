import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Crest, Flourish } from '@/components/ui/Ornament'
import styles from './Login.module.css'

export default function Login() {
  const navigate = useNavigate()
  const { login, loading, error: authError } = useAuthStore()

  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [fieldErrors, setErrors]  = useState({})

  const validate = () => {
    const errs = {}
    if (!email) errs.email = 'Email is required'
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Enter a valid email'
    if (!password) errs.password = 'Password is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    const ok = await login(email.trim(), password)
    if (ok) navigate('/')
  }

  return (
    <div className={styles.page}>
      {/* Ambient background */}
      <div className={styles.ambient} aria-hidden="true">
        <div className={styles.ambientBlob1} />
        <div className={styles.ambientBlob2} />
      </div>

      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.brandMark}><Crest size={52} /></div>
          <div>
            <h1 className={styles.brandName}>Curtain</h1>
            <p className={styles.brandTagline}>Theatrical Operations Platform</p>
          </div>
        </div>

        <div className={styles.divider}><Flourish width={200} /></div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Welcome back</h2>
            <p className={styles.formSubtitle}>Sign in to your workspace</p>
          </div>

          <div className={styles.fields}>
            <Input
              label="Email address"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={Mail}
              error={fieldErrors.email}
              autoComplete="email"
              autoFocus
            />

            <Input
              label="Password"
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={Lock}
              error={fieldErrors.password}
              autoComplete="current-password"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className={styles.eyeBtn}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass
                    ? <EyeOff size={14} strokeWidth={1.75} />
                    : <Eye    size={14} strokeWidth={1.75} />
                  }
                </button>
              }
            />
          </div>

          {authError && (
            <motion.p
              className={styles.authError}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {authError}
            </motion.p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className={styles.submitBtn}
          >
            Sign in
          </Button>
        </form>

        <p className={styles.footer}>
          © {new Date().getFullYear()} Curtain — All rights reserved
        </p>
      </motion.div>
    </div>
  )
}
