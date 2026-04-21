import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'

const variants = {
  initial: { opacity: 0, y: 10 },
  enter:   { opacity: 1, y: 0,  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.18, ease: [0.45, 0, 0.55, 1] } },
}

export default function PageTransition({ children }) {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="initial"
        animate="enter"
        exit="exit"
        style={{ height: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
