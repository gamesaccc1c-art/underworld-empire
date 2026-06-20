import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Building2, Crosshair, Swords, Map, ShoppingBag, Crown, ArrowRight, X, Sparkles } from 'lucide-react'

interface TutorialStep {
  id: string
  title: string
  description: string
  icon: React.ElementType
  color: string
  route: string
  action?: string
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Hosgeldiniz, Patron!',
    description: 'Karanlık şehrin derinliklerinde imparatorluğunuzu kurun. Size temel bilgileri gösterelim.',
    icon: Crown,
    color: 'text-gold',
    route: '/city',
  },
  {
    id: 'city',
    title: 'Sehrinizi Kurun',
    description: 'Binalar inşa edin ve yükseltin. Her bina farklı kaynaklar üretir ve güç kazandırır.',
    icon: Building2,
    color: 'text-amber-400',
    route: '/city',
    action: 'Bir bina yükseltin veya yeni bir bina kurun',
  },
  {
    id: 'missions',
    title: 'Gorevleri Tamamlayin',
    description: 'Görevler nakit, XP ve kaynak kazandırır. Dikkat: polis ısısını artırabilir!',
    icon: Crosshair,
    color: 'text-red-400',
    route: '/missions',
    action: 'Bir görev başlatın',
  },
  {
    id: 'enforcers',
    title: 'Enforcerlarinizi Guclenin',
    description: 'Enforcer karakterler görevlerde bonus sağlar ve savaşta güç katar.',
    icon: Swords,
    color: 'text-purple-400',
    route: '/enforcers',
    action: 'Enforcer koleksiyonunuza göz atın',
  },
  {
    id: 'map',
    title: 'Haritayi Kesfet',
    description: 'Bölgeleri ele geçirin, diğer oyuncularla savaşın ve imparatorluğunuzu genişletin.',
    icon: Map,
    color: 'text-blue-400',
    route: '/map',
  },
  {
    id: 'shop',
    title: 'Magaza ve VIP',
    description: 'Elmas ile özel paketler alın. VIP seviyenizi yükseltip ekstra avantajlar kazanın.',
    icon: ShoppingBag,
    color: 'text-green-400',
    route: '/shop',
  },
]

const STORAGE_KEY = 'uw-tutorial-state'

interface TutorialState {
  completed: boolean
  currentStep: number
  dismissed: boolean
}

function loadTutorialState(): TutorialState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return { completed: false, currentStep: 0, dismissed: false }
}

function saveTutorialState(state: TutorialState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function TutorialOverlay() {
  const [state, setState] = useState<TutorialState>(loadTutorialState)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    saveTutorialState(state)
  }, [state])

  if (state.completed || state.dismissed) return null

  const step = TUTORIAL_STEPS[state.currentStep]
  if (!step) {
    setState({ ...state, completed: true })
    return null
  }

  const isOnCorrectPage = location.pathname === step.route
  const isLastStep = state.currentStep === TUTORIAL_STEPS.length - 1
  const Icon = step.icon

  function nextStep() {
    if (isLastStep) {
      setState({ ...state, completed: true })
    } else {
      const next = state.currentStep + 1
      setState({ ...state, currentStep: next })
      navigate(TUTORIAL_STEPS[next].route)
    }
  }

  function dismiss() {
    setState({ ...state, dismissed: true })
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-3 pb-2 pointer-events-none">
      <div className="pointer-events-auto max-w-md mx-auto bg-card/95 backdrop-blur-lg border border-gold/30 rounded-2xl shadow-2xl shadow-gold/5 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Progress dots */}
        <div className="flex items-center gap-1 px-4 pt-3">
          {TUTORIAL_STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx < state.currentStep ? 'bg-gold' : idx === state.currentStep ? 'bg-gold/60' : 'bg-secondary/50'
              }`}
            />
          ))}
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-xl bg-secondary/50 border border-border/40 flex items-center justify-center shrink-0`}>
              <Icon className={`h-5 w-5 ${step.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-display">{step.title}</h3>
                <span className="text-[9px] text-muted-foreground">{state.currentStep + 1}/{TUTORIAL_STEPS.length}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{step.description}</p>
              {step.action && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gold/80">
                  <Sparkles className="h-3 w-3" />
                  <span>{step.action}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] text-muted-foreground"
              onClick={dismiss}
            >
              <X className="h-3 w-3 mr-0.5" /> Atla
            </Button>
            <div className="flex-1" />
            {!isOnCorrectPage && state.currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => navigate(step.route)}
              >
                Sayfaya Git
              </Button>
            )}
            <Button
              size="sm"
              className="h-7 text-[10px] gradient-gold text-primary-foreground"
              onClick={nextStep}
            >
              {isLastStep ? 'Tamamla' : 'Devam'}
              <ArrowRight className="h-3 w-3 ml-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function resetTutorial() {
  localStorage.removeItem(STORAGE_KEY)
}
