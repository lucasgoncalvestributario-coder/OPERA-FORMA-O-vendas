import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  User, Users, MapPin, GraduationCap, DollarSign, Settings, List, 
  LayoutGrid, Plus, Trash2, Search, RefreshCcw, LogOut, History, CheckSquare, AlertTriangle, ExternalLink, Link2,
  Download, Camera, CheckCircle2, AlertCircle, FileDown, Briefcase, BedDouble, Pencil, X, MessageCircle, TableProperties, Mail,
  TrendingUp, Target, BarChart3, PieChart, LogIn, Calendar, UserMinus, FileText, Printer, FileCheck2, FileWarning, FilePlus, Edit3,
  Mic, Trash, Smartphone, ChevronDown, Save, ClipboardCheck, Bell, Send, CreditCard, Volume2, Eye, PlusCircle, Wifi, WifiOff, UserPlus, Sparkles, Inbox, Code, Copy, Percent, RotateCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { auth, db } from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithCustomToken,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  getDocs,
  getDocFromServer,
  collectionGroup,
  writeBatch
} from 'firebase/firestore';
import { handleFirestoreError } from './lib/errorHandler';
import { OperationType } from './types';

// --- CONFIGURAÇÕES PADRÃO ---
const GESTOR_EMAILS = [
  'goncalvesopera@gmail.com',
  'operaformacao@gmail.com', 
  'operaformacar@gmail.com',
  'valiandroopera@gmail.com',
  'lucasgoncalvestributario@gmail.com',
  'valiandrobock@gmail.com',
  'valiandro@gmail.com',
  'lucas@opera.com',
  'opera@goncalves.com',
  'oepra@goncalves.com',
  'opera@gerente.com'
];

const CITIES_LIST = [
  'Toledo',
  'Balneário',
  'Porto Alegre',
  'Itajaí',
  'Sorocaba',
  'Curitiba',
  'Maringá',
  'Passo Fundo',
  'Londrina',
  'Diadema',
  'Palhoça',
  'Goiânia',
  'Caxias do Sul'
];

const DEFAULT_SETTINGS = {
  baseSalary: 1600,
  commissionValue: 150,
  commissionThreshold: 10,
  bonusEAD15: 500,
  bonusGeneral25: 1000,
  bonusGeneral35: 1500,
  tripValue: 400,
  studentRateLow: 100,
  studentRateMedium: 150,
  studentRateHigh: 200,
  monthlyGoal: 30, // Meta padrão de 30 alunos
  yearlyGoal: 360, // Meta padrão de 360 alunos
  extraBonuses: [] as { id: number, label: string, value: number }[],
  overrides: {
    ead: 0,
    presencial: 0,
    dropout: 0
  }
};

const DEFAULT_CALIBRATION = {
  photoX: 62,
  photoY: 200,
  photoW: 198,
  photoH: 263,
  photoZoom: 1.0,
  photoOffsetX: 0,
  photoOffsetY: 0,

  nameX: 310,
  nameY: 245,
  nameSize: 22,
  nameAlign: 'left' as 'left' | 'center' | 'right',
  nameColor: '#111827',

  cpfX: 310,
  cpfY: 312,
  cpfSize: 18,
  cpfColor: '#111827',

  birthX: 310,
  birthY: 430,
  birthSize: 18,
  birthColor: '#111827',

  machinesX: 310,
  machinesY: 375,
  machinesW: 600,
  machinesSize: 15,
  machinesSpacing: 21,
  machinesColor: '#111827',

  validityX: 310,
  validityY: 485,
  validitySize: 18,
  validityColor: '#111827',

  globalScale: 1.0,
  globalMargin: 0,
};

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  if (!base64String || typeof base64String !== 'string') {
    return new Uint8Array();
  }
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const isCurrentMonthSale = (createdAt: any) => {
  if (!createdAt) return true; // Keep pending local sales
  const d = new Date(createdAt);
  const cutoff = new Date('2026-07-01T00:00:00Z');
  return d >= cutoff;
};

const adjustSalesForVendor = (salesList: any[], email: string, name?: string, uid?: string) => {
  return salesList;
};

export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStepText, setLoadingStepText] = useState("Iniciando...");
  const appStartTime = useMemo(() => new Date().toISOString(), []);
  
  // --- MÉTRICAS DE PRODUÇÃO E ROBUSTEZ ---
  const [metrics, setMetrics] = useState({
    startupTimeMs: 0,
    apiSuccessCount: 0,
    apiFailureCount: 0,
    latencies: [] as number[],
    errorLogs: [] as string[]
  });

  const initialDataLoadedTimeRef = useRef<{ [key: string]: number }>({});

  const trackSnapshotLoad = useCallback((key: string) => {
    if (!initialDataLoadedTimeRef.current[key]) {
      const duration = Math.round(performance.now());
      initialDataLoadedTimeRef.current[key] = duration;
      setMetrics(prev => ({
        ...prev,
        apiSuccessCount: prev.apiSuccessCount + 1,
        latencies: [...prev.latencies, duration]
      }));
    }
  }, []);

  useEffect(() => {
    // Carregar falhas passadas capturadas pelo ErrorBoundary se houver devidos crash logs
    try {
      const stored = localStorage.getItem('opera_crash_logs');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) {
          const msgs = parsed.map((c: any) => `Crash: ${c.message} (${new Date(c.timestamp).toLocaleTimeString()})`);
          setMetrics(prev => ({
            ...prev,
            errorLogs: [...msgs, ...prev.errorLogs].slice(0, 30),
            apiFailureCount: prev.apiFailureCount + parsed.length
          }));
        }
      }
    } catch {}

    const startup = Math.round(performance.now());
    setMetrics(prev => ({ ...prev, startupTimeMs: startup }));

    // Listeners Globais para Robustez e Diagnóstico em Produção
    const handleError = (event: ErrorEvent) => {
      const errorMsg = event.message || (event.error && event.error.message) || String(event);
      setMetrics(prev => ({
        ...prev,
        apiFailureCount: prev.apiFailureCount + 1,
        errorLogs: [`Erro: ${errorMsg} (${new Date().toLocaleTimeString()})`, ...prev.errorLogs].slice(0, 30)
      }));
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const errorMsg = event.reason instanceof Error ? event.reason.message : String(event.reason);
      setMetrics(prev => ({
        ...prev,
        apiFailureCount: prev.apiFailureCount + 1,
        errorLogs: [`Rejeição: ${errorMsg} (${new Date().toLocaleTimeString()})`, ...prev.errorLogs].slice(0, 30)
      }));
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  const isVendorSale = useCallback((sale: any, vendedor: any) => {
    if (!vendedor) return false;

    // Fast-path name and email check
    const vNameLower = (vendedor.name || vendedor.displayName || '').toLowerCase();
    const vEmailLower = (vendedor.email || vendedor.userEmail || '').toLowerCase();
    
    const isRenataSouza = vNameLower.includes('souza') && vNameLower.includes('renata');
    const isRenataPoa = vNameLower.includes('poa') || vEmailLower.includes('poa') || vendedor.id === 'ext_renata';

    // 1. Specific safety rules for Renata Souza vs Renata POA / Fulano
    if (isRenataSouza) {
      const clientName = (sale.name || sale.studentName || '').toLowerCase();
      // Exclude everything written "Fulano"
      if (clientName.includes('fulano')) {
        return false;
      }
      // Renata Souza must never match Renata POA sales
      if (sale.vendorId === 'ext_renata') return false;
      if ((sale.vendorEmail || '').toLowerCase().includes('poa')) return false;
      if ((sale.vendorName || '').toLowerCase().includes('poa')) return false;
      if ((sale.consultant || '').toLowerCase().includes('poa')) return false;
    }

    if (isRenataPoa) {
      // Renata POA is restricted only to its own sales, never match "Renata Souza"
      const saleVendorLower = (sale.vendorName || '').toLowerCase();
      const saleConsultantLower = (sale.consultant || '').toLowerCase();
      if (saleVendorLower.includes('souza') || saleConsultantLower.includes('souza')) {
        return false;
      }
    }

    // 1. Match by exact UID
    if (sale.vendorId && vendedor.id && sale.vendorId === vendedor.id) return true;
    if (sale.vendorId && vendedor.id && sale.vendorId !== vendedor.id) return false;
    
    // 2. Match by email
    const saleEmailClean = (sale.vendorEmail || '').trim().toLowerCase();
    const vEmail = vendedor.email || vendedor.userEmail;
    const vendedorEmailClean = (vEmail || '').trim().toLowerCase();
    if (saleEmailClean && vendedorEmailClean && saleEmailClean === vendedorEmailClean) return true;

    // Helpers for normalization and word extraction
    const normalize = (str: string) => {
      return (str || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-z0-9]/g, ''); // remove spaces and symbols
    };

    const getWords = (str: string) => {
      return (str || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter(w => w.length >= 3);
    };

    // Check direct overlap of normalized names
    const normSaleVendorName = normalize(sale.vendorName);
    const normSaleConsultant = normalize(sale.consultant);
    const normVendedorName = normalize(vendedor.name);
    const normVendedorDisplayName = normalize(vendedor.displayName);

    const saleIdentifiers = [normSaleVendorName, normSaleConsultant].filter(id => id.length >= 2);
    const vendorIdentifiers = [normVendedorName, normVendedorDisplayName].filter(id => id.length >= 2);

    for (const vId of vendorIdentifiers) {
      for (const sId of saleIdentifiers) {
        if (sId === vId || sId.includes(vId) || vId.includes(sId)) {
          return true;
        }
      }
    }

    // Check word-by-word overlap helper
    const vWords = [
      ...getWords(vendedor.name),
      ...getWords(vendedor.displayName),
      ...getWords(vEmail ? vEmail.split('@')[0] : '')
    ];
    const sWords = [
      ...getWords(sale.vendorName),
      ...getWords(sale.consultant)
    ];

    for (const vWord of vWords) {
      for (const sWord of sWords) {
        if (sWord === vWord || sWord.includes(vWord) || vWord.includes(sWord)) {
          return true;
        }
      }
    }

    return false;
  }, []);

  const isUserSale = useCallback((sale: any) => {
    if (!user) return false;
    return isVendorSale(sale, {
      id: user.uid,
      email: user.email,
      name: userProfile?.name,
      displayName: user.displayName
    });
  }, [user, userProfile, isVendorSale]);

  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [postProgress, setPostProgress] = useState(0);
  const [pinInput, setPinInput] = useState('');
  const [isPinVerified, setIsPinVerified] = useState(() => {
    try {
      return localStorage.getItem('isPinVerified') === 'true';
    } catch {
      return false;
    }
  });
  const [authView, setAuthView] = useState<'login' | 'pin-create' | 'pin-verify'>('login');
  const [managerCode, setManagerCode] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);

  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);

  // Detectar PWA Install Prompt e Status
  useEffect(() => {
    const checkPWA = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      setIsPWAInstalled(isStandalone);
    };
    checkPWA();

    const handlePrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallGuideOpen(false);
      }
    } else {
      setIsInstallGuideOpen(true);
    }
  };
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isGlobalView, setIsGlobalView] = useState(false);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [secretarySubTab, setSecretarySubTab] = useState<'historico' | 'checklist'>('historico');
  const [contractSubTab, setContractSubTab] = useState<'novo' | 'lista'>('novo');

  const MANAGER_ACCOUNTS: Record<string, string> = {
    'manager': 'operaformacao@gmail.com',
    'valiandro': 'valiandroopera@gmail.com'
  };
  
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const emailLower = u.email?.toLowerCase() || '';
        if ((emailLower.includes('karol') && emailLower !== 'karol@opera.com') || emailLower.includes('michel')) {
          await signOut(auth);
          alert("Seu acesso foi revogado pelo administrador.");
          setUser(null);
          setAuthView('login');
          setIsPinVerified(false);
          setUserProfile(null);
          setLoading(false);
          return;
        }
      }
      setUser(u);
      if (!u) {
        setAuthView('login');
        setIsPinVerified(false);
        setUserProfile(null);
        setLoading(false);
      }
    });

    const isDevUrl = typeof window !== 'undefined' && (
      window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('127.0.0.1') ||
      window.location.hostname.includes('ais-dev') ||
      window.location.hostname.includes('ais-pre')
    );

    if (isDevUrl && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
          console.log('[Dev SafeMode] Service Worker desregistrado para evitar caches em desenvolvimento.');
        }
      }).catch(err => console.log('Erro ao limpar SW em dev:', err));
      if ('caches' in window) {
        caches.keys().then(names => {
          for (let name of names) {
            caches.delete(name);
            console.log('[Dev SafeMode] Cache deletado:', name);
          }
        }).catch(err => console.log('Erro ao limpar caches em dev:', err));
      }
    }

    // Registra Service Worker para PWA e Notificações Mobile (apenas fora de ambiente dev)
    if (!isDevUrl && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('SW registrado!');
        
        // Forçar verificação de atualização imediata ao abrir o app
        reg.update();

        // Lógica de Atualização Automática Silenciosa
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('Nova versão detectada.');
                // window.location.reload(); // Removido para evitar loop em preview
              }
            };
          }
        };
      }).catch(err => console.log('Erro ao registrar SW:', err));

      // Listener para mensagens do SW (ex: focar tab específica ou falar som)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data) {
          if (event.data.type === 'SET_TAB') {
            setActiveTab(event.data.tab);
          }
          if (event.data.type === 'PUSH_RECEIVED' && event.data.pushType) {
            // Removida a voz que falava "TAXA" conforme pedido do usuário
          }
        }
      });
    }

    let progressInterval: NodeJS.Timeout;
    const startProgressTime = Date.now();
    const duration = 1800; // 1.8 seconds
    
    const steps = [
      { max: 15, text: "Iniciando conexões seguras..." },
      { max: 35, text: "Autenticando sessão..." },
      { max: 60, text: "Sincronizando bancos de dados..." },
      { max: 80, text: "Preparando módulos de automação..." },
      { max: 95, text: "Sincronizando Leads e Vendas..." },
      { max: 100, text: "Tudo pronto!" }
    ];

    progressInterval = setInterval(() => {
      const elapsed = Date.now() - startProgressTime;
      const calculatedProgress = Math.min(Math.round((elapsed / duration) * 100), 100);
      setLoadingProgress(calculatedProgress);

      const currentStep = steps.find(s => calculatedProgress <= s.max) || steps[steps.length - 1];
      setLoadingStepText(currentStep.text);

      if (calculatedProgress >= 100) {
        clearInterval(progressInterval);
        setIsAppReady(true);
      }
    }, 40);

    // Timeout de segurança para o estado de loading (evita tela branca infinita) - reduzido para abertura super rápida
    const loadingTimeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn("Loading timeout: Forçando visibilidade do app.");
          return false;
        }
        return false;
      });
    }, 2500);

    return () => {
      unsubscribe();
      clearInterval(progressInterval);
      clearTimeout(loadingTimeout);
    };
  }, []);

  // Auto-login de Vivinara ou qualquer usuário via link direto (Email e Pass na URL)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get('email');
      const urlPass = params.get('pass');
      if (urlEmail && urlPass) {
        const decodedEmail = urlEmail.toLowerCase().trim();
        setEmailInput(decodedEmail);
        setPasswordInput(urlPass);
        
        // Pequeno timeout para garantir que o Firebase Auth está pronto e não está carregado com outro user
        const t = setTimeout(async () => {
          setIsLoggingIn(true);
          try {
            await signInWithEmailAndPassword(auth, decodedEmail, urlPass);
          } catch (err) {
            console.error("Auto login error via URL:", err);
          } finally {
            setIsLoggingIn(false);
          }
        }, 1000);
        return () => clearTimeout(t);
      }
    }
  }, [auth]);

  // Monitoramento em tempo real do perfil para logout forçado
  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const unsubProfile = onSnapshot(userRef, async (snap) => {
        const emailLower = user.email?.toLowerCase().trim() || '';
        
        // Verificação imediata se o e-mail ou uid foi revogado
        try {
          const emailRevokedRef = doc(db, 'revoked_users', emailLower);
          const uidRevokedRef = doc(db, 'revoked_users', user.uid);
          const [emailRevokedSnap, uidRevokedSnap] = await Promise.all([
            getDoc(emailRevokedRef),
            getDoc(uidRevokedRef)
          ]);
          
          if (emailRevokedSnap.exists() || uidRevokedSnap.exists()) {
            signOut(auth);
            try {
              localStorage.removeItem('isPinVerified');
            } catch {}
            alert("Seu acesso foi totalmente revogado pelo administrador (Vendedor desligado).");
            setUser(null);
            setUserProfile(null);
            setAuthView('login');
            setIsPinVerified(false);
            return;
          }
        } catch (e) {
          console.error("Erro ao checar revogação:", e);
        }

        if (!snap.exists()) {
          // Se o perfil não existe no banco
          const isActuallySecretaria = 
            ['emily@opera.com', 'emilyopera@gmail.com'].includes(emailLower || '') ||
            (emailLower && (emailLower.includes('emily') || emailLower.includes('secretaria')));

          if (emailLower && ((emailLower.includes('karol') && emailLower !== 'karol@opera.com') || emailLower.includes('michel'))) {
            signOut(auth);
            alert("Seu acesso foi revogado pelo administrador.");
            return;
          }

          if (userProfile && userProfile.role !== 'gerente' && !isActuallySecretaria) {
            // Se ele TINHA um perfil e agora não tem mais (foi deletado), desloga
            signOut(auth);
            try {
              localStorage.removeItem('isPinVerified');
            } catch {}
            alert("Sua conta foi desativada pelo administrador.");
          } else {
            // Novo usuário ou usuário sem perfil ainda, manda para criação
            setAuthView('pin-create');
          }
        } else {
          const profile = snap.data();
          
          // Auto-update role for Emily/Karol if needed
          const emailLower = user.email?.toLowerCase();
          if (emailLower && ((emailLower.includes('karol') && emailLower !== 'karol@opera.com') || emailLower.includes('michel'))) {
            signOut(auth);
            alert("Seu acesso foi revogado pelo administrador.");
            return;
          }
          const isActuallySecretaria = 
            ['emily@opera.com', 'emilyopera@gmail.com'].includes(emailLower || '') ||
            (emailLower && (emailLower.includes('emily') || emailLower.includes('secretaria')));
          const isActuallyGerente = emailLower && GESTOR_EMAILS.includes(emailLower);
          const isActuallyLucas = emailLower && [
            'lucasgoncalvestributario@gmail.com',
            'goncalvesopera@gmail.com',
            'operaformacao@gmail.com',
            'operaformacar@gmail.com',
            'lucas@opera.com'
          ].includes(emailLower);

          if (isActuallyLucas && (profile.role !== 'gerente' || profile.name !== 'Lucas Gonçalves')) {
            updateDoc(userRef, { role: 'gerente', name: 'Lucas Gonçalves' }).catch(console.error);
            profile.role = 'gerente';
            profile.name = 'Lucas Gonçalves';
          }

          if (isActuallySecretaria && profile.role !== 'secretaria') {
            updateDoc(userRef, { role: 'secretaria' }).catch(console.error);
            profile.role = 'secretaria';
          }

          if (isActuallyGerente && profile.role !== 'gerente') {
            updateDoc(userRef, { role: 'gerente' }).catch(console.error);
            profile.role = 'gerente';
          } else if (!isActuallyGerente && !isActuallySecretaria && profile.role === 'gerente') {
            // Se era gerente mas não está mais na lista (caso do Lucas Gonçalves atual), vira vendedor
            updateDoc(userRef, { role: 'vendedor' }).catch(console.error);
            profile.role = 'vendedor';
          } else if (!isActuallyGerente && !isActuallySecretaria && profile.role !== 'vendedor' && profile.role !== 'secretaria') {
            // Garante que novos sem cargo definido entrem como vendedor
            updateDoc(userRef, { role: 'vendedor' }).catch(console.error);
            profile.role = 'vendedor';
          }

          setUserProfile(profile);
          if (profile.name) setNewNameInput(profile.name);
          if (profile.wascriptToken) setWascriptTokenInput(profile.wascriptToken);
          
          // Auto-substituir para Push se permitido
          if (notificationPermission === 'granted') {
            subscribeToPush(profile);
          }

          const isVivinara = profile.email?.toLowerCase() === 'vivinara@opera.com';
          if (isVivinara) {
            setIsPinVerified(true);
            try {
              localStorage.setItem('isPinVerified', 'true');
            } catch {}
          }

          if (!isPinVerified && !isVivinara) {
            if (profile.pin) {
              setAuthView('pin-verify');
            } else {
              setAuthView('pin-create');
            }
          }
        }
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        setLoading(false);
      });
      return () => unsubProfile();
    } else {
      setLoading(false);
    }
  }, [user, isPinVerified, isAppReady]);

  const handleCreatePin = async () => {
    if (!user || pinInput.length < 4) {
      alert("Crie um PIN de pelo menos 4 dígitos!");
      return;
    }
    
    // Check if email or UID is revoked before allowing profile creation
    const emailLower = user.email?.toLowerCase().trim() || '';
    try {
      const emailRevokedRef = doc(db, 'revoked_users', emailLower);
      const uidRevokedRef = doc(db, 'revoked_users', user.uid);
      const [emailRevokedSnap, uidRevokedSnap] = await Promise.all([
        getDoc(emailRevokedRef),
        getDoc(uidRevokedRef)
      ]);

      if (emailRevokedSnap.exists() || uidRevokedSnap.exists()) {
        alert("Acesso revogado pelo administrador (Vendedor desligado).");
        signOut(auth);
        return;
      }
    } catch (e) {
      console.error("Erro ao verificar revogação no cadastro:", e);
    }
    
    // Senha master solicitada pelo usuário: 010125
    if (emailLower && ((emailLower.includes('karol') && emailLower !== 'karol@opera.com') || emailLower.includes('michel'))) {
      alert("Acesso revogado.");
      signOut(auth);
      return;
    }
    const isGerente = managerCode === "010125" || (emailLower && GESTOR_EMAILS.includes(emailLower)); 
    const isSecretaria = ['emily@opera.com', 'emilyopera@gmail.com', 'karol@opera.com'].includes(emailLower || '');
    
    let finalName = user.displayName || (isGerente ? 'Gerente' : (isSecretaria ? 'Secretaria' : 'Vendedor'));
    if (user.email && [
      'lucasgoncalvestributario@gmail.com',
      'goncalvesopera@gmail.com',
      'operaformacao@gmail.com',
      'operaformacar@gmail.com',
      'lucas@opera.com'
    ].includes(user.email.toLowerCase().trim())) {
      finalName = 'Lucas Gonçalves';
    } else if (user.email === 'emily@opera.com' || user.email === 'emilyopera@gmail.com') {
      finalName = 'Emily';
    } else if (user.email === 'karol@opera.com') {
      finalName = 'Karol';
    } else if (user.email === 'valiandrobock@gmail.com') {
      finalName = 'Valiandro Bock';
    } else if (user.email === 'valiandro@gmail.com') {
      finalName = 'Valiandro';
    } else if (user.email === 'amandaopera@gmail.com') {
      finalName = 'Amanda';
    }

    const profileData = {
      uid: user.uid,
      email: user.email,
      name: finalName,
      role: isGerente ? 'gerente' : (isSecretaria ? 'secretaria' : 'vendedor'),
      pin: pinInput,
      cities: CITIES_LIST,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });
      setUserProfile(prev => ({ ...prev, ...profileData }));
      setIsPinVerified(true);
      localStorage.setItem('isPinVerified', 'true');
      setPinInput('');
      
      if (notificationPermission === 'granted') {
        subscribeToPush({ ...userProfile, ...profileData });
      }
    } catch (err) {
      console.error("Erro ao criar perfil:", err);
    }
  };

  const handleVerifyPin = async () => {
    const isOpera = user?.email?.toLowerCase().trim() === 'operaformacao@gmail.com' || user?.email?.toLowerCase().trim() === 'operaformacar@gmail.com' || user?.email?.toLowerCase().trim() === 'opera@goncalves.com' || user?.email?.toLowerCase().trim() === 'opera@gerente.com';
    const isPinCorrect = pinInput === userProfile?.pin || (isOpera && pinInput === '123456');

    if (userProfile && isPinCorrect) {
      setIsPinVerified(true);
      try {
        localStorage.setItem('isPinVerified', 'true');
      } catch {}
      
      // Se for o e-mail operaformacao@gmail.com e utilizou o PIN 123456, atualiza no Firestore para garantir persistência
      if (isOpera && userProfile.pin !== '123456' && user) {
        try {
          await updateDoc(doc(db, 'users', user.uid), { pin: '123456' });
          userProfile.pin = '123456';
        } catch (err) {
          console.error("Erro ao redefinir PIN no Firestore para operaformacao:", err);
        }
      }
      
      setPinInput('');
    } else {
      alert("PIN incorreto!");
      setPinInput('');
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      setLoginError(null);
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Erro Google Login:", error);
      if (error.code !== 'auth/popup-closed-by-user') {
        setLoginError("Erro ao entrar com Google: " + error.message);
      }
    }
  };

  const handleResetPassword = async () => {
    if (!emailInput) {
      alert("Por favor, digite seu e-mail no campo 'E-mail Corporativo' primeiro!");
      return;
    }
    const email = emailInput.toLowerCase().trim();
    setIsResettingPassword(true);
    setLoginError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Sucesso! Um link de redefinição de senha foi enviado para ${email}. Acesse seu e-mail para cadastrar uma nova senha e entrar no seu acesso!`);
    } catch (err: any) {
      console.error("Erro ao enviar redefinição:", err);
      if (err.code === "auth/user-not-found" || err.message?.includes("user-not-found")) {
        setLoginError("E-mail não cadastrado no sistema.");
      } else {
        setLoginError("Erro ao enviar link de redefinição: " + (err.message || err));
      }
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleAuth = async () => {
    if (!emailInput || !passwordInput) return alert("Preencha e-mail e senha.");
    if (passwordInput.length < 6) return alert("A senha deve ter pelo menos 6 caracteres.");

    setIsLoggingIn(true);
    setLoginError(null);

    const email = emailInput.toLowerCase().trim();

    if ((email.includes('karol') && email !== 'karol@opera.com') || email.includes('michel')) {
      alert("Acesso revogado.");
      setIsLoggingIn(false);
      return;
    }

    // Se o email pertencer à lista de GESTORES autorizados e a senha digitada for a master (010125),
    // geramos um token customizado de bypass administrativo que funciona sempre de forma determinística,
    // mesmo se as credenciais originais estiverem desalinhadas ou com erro no Firebase Auth original.
    let bypassSuccess = false;
    const isNewManager = email === 'opera@goncalves.com' || email === 'oepra@goncalves.com' || email === 'opera@gerente.com';
    const isValidManagerPassword = passwordInput === "010125" || (isNewManager && passwordInput === "123456");
    if (GESTOR_EMAILS.map(e => e.toLowerCase()).includes(email) && isValidManagerPassword && !isRegistering) {
      try {
        console.log(`[Auth Bypass] Gerando token de acesso para gestor ${email}.`);
        const bypassResponse = await fetch("/api/auth/gestor-bypass", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password: passwordInput })
        });
        
        if (bypassResponse.ok) {
          const resData = await bypassResponse.json();
          if (resData.success && resData.token) {
            console.log("[Auth Bypass] Token gerado com sucesso! Efetuando login via token...");
            await signInWithCustomToken(auth, resData.token);
            bypassSuccess = true;
            console.log("[Auth Bypass] Gestor logado via token com sucesso!");
          }
        } else {
          const errData = await bypassResponse.json().catch(() => ({}));
          console.warn("[Auth Bypass Warning] Falha no alinhamento administrativo:", errData.error || bypassResponse.statusText);
        }
      } catch (bypassErr) {
        console.error("[Auth Bypass Error] Falha ao comunicar com API de bypass:", bypassErr);
      }
    }

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, passwordInput);
      } else if (!bypassSuccess) {
        await signInWithEmailAndPassword(auth, email, passwordInput);
      }
    } catch (error: any) {
      const errorCode = error.code || "";
      const errorMessage = error.message || "";
      const isExpectedAuthError = 
        errorCode.includes('email-already-in-use') ||
        errorCode.includes('user-not-found') ||
        errorCode.includes('wrong-password') ||
        errorCode.includes('invalid-credential') ||
        errorMessage.includes('invalid-credential');

      if (isExpectedAuthError) {
        console.warn("Aviso de autenticação (esperado):", errorMessage || error);
      } else {
        console.error("Erro na autenticação:", error);
      }

      if (errorCode.includes('user-not-found')) {
        setLoginError("Usuário não encontrado. Se for seu primeiro acesso, clique em 'Primeiro Acesso'.");
      } else if (errorCode.includes('wrong-password') || errorCode.includes('invalid-credential') || errorMessage.includes('invalid-credential')) {
        setLoginError("E-mail ou senha incorretos. Verifique suas credenciais.");
      } else if (errorCode.includes('email-already-in-use')) {
        setLoginError("Este e-mail já está sendo usado. Tente fazer login.");
      } else if (errorCode.includes('operation-not-allowed')) {
        setLoginError("O login por e-mail ainda não foi habilitado no painel do Firebase.");
      } else {
        setLoginError("Erro ao acessar: " + (error.message || "Entre em contato com o suporte."));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      // Limpar inscrição de push do banco para evitar "fantasmas" em dispositivos compartilhados
      // Mas não limpar se for o Valiandro ou Gonçalves, garantindo que eles continuem a receber notificações escritas em tempo real mesmo deslogados!
      if (user) {
        const emailLower = user.email?.toLowerCase();
        const isManagerEmail = emailLower && [
          'valiandroopera@gmail.com',
          'valiandrobock@gmail.com',
          'valiandro@gmail.com',
          'goncalvesopera@gmail.com',
          'operaformacao@gmail.com',
          'operaformacar@gmail.com',
          'lucasgoncalvestributario@gmail.com'
        ].includes(emailLower);

        if (!isManagerEmail) {
          try {
            const deviceId = btoa(navigator.userAgent).substring(0, 50);
            await deleteDoc(doc(db, 'users', user.uid, 'push_tokens', deviceId));
          } catch (e) {
            console.error("Erro ao remover inscrição de push no logout:", e);
          }
        }
      }
    } catch (err) {
      console.error("Erro durante ações do banco no logout:", err);
    }

    try {
      await signOut(auth);
    } catch (err) {
      console.error("Erro ao deslogar do Firebase:", err);
    }

    // Resetar todos os estados de sessão imediatamente para garantir retorno instantâneo à tela de login
    setUser(null);
    setUserProfile(null);
    setIsPinVerified(false);
    try {
      localStorage.removeItem('isPinVerified');
    } catch {}
    setAuthView('login');
  };

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') || 'resumo';
    }
    return 'resumo';
  });
  const [isSendingFees, setIsSendingFees] = useState(false);
  const [showFeeReportModal, setShowFeeReportModal] = useState(false);
  const [showPDFPeriodModal, setShowPDFPeriodModal] = useState(false);
  const [pdfEcoMode, setPdfEcoMode] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Carteirinha Preview States
  const [carteirinhaClientName, setCarteirinhaClientName] = useState('');
  const [carteirinhaCpf, setCarteirinhaCpf] = useState('');
  const [carteirinhaBirthDate, setCarteirinhaBirthDate] = useState('');
  const [carteirinhaMachines, setCarteirinhaMachines] = useState('');
  const [carteirinhaValidity, setCarteirinhaValidity] = useState('');
  const [carteirinhaPhone, setCarteirinhaPhone] = useState('');
  const [carteirinhaPhotoUrl, setCarteirinhaPhotoUrl] = useState('');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isSavingCalibration, setIsSavingCalibration] = useState(false);
  const [calibration, setCalibration] = useState(() => DEFAULT_CALIBRATION);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Helper to format CPF (000.000.000-00)
  const formatCPF = (value: string): string => {
    const clean = value.replace(/\D/g, '').slice(0, 11);
    let formatted = '';
    if (clean.length > 0) {
      formatted += clean.slice(0, 3);
    }
    if (clean.length > 3) {
      formatted += '.' + clean.slice(3, 6);
    }
    if (clean.length > 6) {
      formatted += '.' + clean.slice(6, 9);
    }
    if (clean.length > 9) {
      formatted += '-' + clean.slice(9, 11);
    }
    return formatted;
  };

  // Helper to format Birth Date (DD/MM/AAAA)
  const formatBirthDate = (value: string): string => {
    const clean = value.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (clean.length > 0) {
      formatted += clean.slice(0, 2);
    }
    if (clean.length > 2) {
      formatted += '/' + clean.slice(2, 4);
    }
    if (clean.length > 4) {
      formatted += '/' + clean.slice(4, 8);
    }
    return formatted;
  };

  const handleCpfChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 11);
    setCarteirinhaCpf(formatCPF(clean));
  };

  const handleBirthDateChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 8);
    
    // Validate day of birth
    if (clean.length >= 2) {
      const dayStr = clean.slice(0, 2);
      const day = parseInt(dayStr, 10);
      if (dayStr !== '00' && (day < 1 || day > 31)) {
        return; // reject invalid day (like 32, 40)
      }
    }
    
    if (clean.length >= 4) {
      const day = parseInt(clean.slice(0, 2), 10);
      const monthStr = clean.slice(2, 4);
      const month = parseInt(monthStr, 10);
      if (monthStr !== '00' && (month < 1 || month > 12)) {
        return; // reject invalid month (like 13, 20)
      }
      // Check day/month combination
      if (monthStr !== '00') {
        if (month === 2 && day > 29) return;
        if ([4, 6, 9, 11].includes(month) && day > 30) return;
      }
    }

    setCarteirinhaBirthDate(formatBirthDate(clean));
  };

  // Crop Editor States
  const [isCropping, setIsCropping] = useState(false);
  const [rawPhotoUrl, setRawPhotoUrl] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1.0);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropRotation, setCropRotation] = useState(0);

  // Load global calibration on mount
  useEffect(() => {
    const loadCalibration = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'carteirinha_calibration'));
        if (snap.exists()) {
          setCalibration({ ...DEFAULT_CALIBRATION, ...snap.data() });
        } else {
          setCalibration(DEFAULT_CALIBRATION);
        }
      } catch (err) {
        console.error("Erro ao carregar calibragem:", err);
        setCalibration(DEFAULT_CALIBRATION);
      }
    };
    loadCalibration();
  }, []);

  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [clientPhotoImg, setClientPhotoImg] = useState<HTMLImageElement | null>(null);

  // Preload background image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "https://i.postimg.cc/xdT43byn/Whats-App-Image-2026-07-01-at-17-37-38-(1).jpg";
    img.onload = () => {
      setBgImage(img);
      setBgLoaded(true);
    };
    img.onerror = (e) => {
      console.error("Erro ao carregar imagem base:", e);
    };
  }, []);

  // Preload client photo when URL changes
  useEffect(() => {
    if (!carteirinhaPhotoUrl) {
      setClientPhotoImg(null);
      return;
    }
    const img = new Image();
    img.src = carteirinhaPhotoUrl;
    img.onload = () => {
      setClientPhotoImg(img);
    };
    img.onerror = () => {
      console.error("Erro ao carregar foto do cliente");
    };
  }, [carteirinhaPhotoUrl]);

  // Draw loop
  useEffect(() => {
    if (!bgLoaded || !bgImage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Normalizing canvas dimensions to 1000px width and keeping aspect ratio
    const normalizedWidth = 1000;
    const normalizedHeight = Math.round(1000 * (bgImage.naturalHeight / bgImage.naturalWidth)) || 630;
    
    if (canvas.width !== normalizedWidth || canvas.height !== normalizedHeight) {
      canvas.width = normalizedWidth;
      canvas.height = normalizedHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

    // Draw client photo
    if (clientPhotoImg) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(calibration.photoX, calibration.photoY, calibration.photoW, calibration.photoH);
      ctx.clip();

      const imgRatio = clientPhotoImg.width / clientPhotoImg.height;
      const targetRatio = calibration.photoW / calibration.photoH;
      let sWidth, sHeight, sx, sy;

      if (imgRatio > targetRatio) {
        sHeight = clientPhotoImg.height;
        sWidth = clientPhotoImg.height * targetRatio;
        sx = (clientPhotoImg.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = clientPhotoImg.width;
        sHeight = clientPhotoImg.width / targetRatio;
        sx = 0;
        sy = (clientPhotoImg.height - sHeight) / 2;
      }

      const zoom = calibration.photoZoom || 1.0;
      const zoomedWidth = sWidth / zoom;
      const zoomedHeight = sHeight / zoom;
      const zoomOffsetX = sx + (sWidth - zoomedWidth) / 2 + (calibration.photoOffsetX || 0);
      const zoomOffsetY = sy + (sHeight - zoomedHeight) / 2 + (calibration.photoOffsetY || 0);

      ctx.drawImage(
        clientPhotoImg,
        zoomOffsetX,
        zoomOffsetY,
        zoomedWidth,
        zoomedHeight,
        calibration.photoX,
        calibration.photoY,
        calibration.photoW,
        calibration.photoH
      );
      ctx.restore();
    } else if (isCalibrating) {
      ctx.save();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(calibration.photoX, calibration.photoY, calibration.photoW, calibration.photoH);
      ctx.fillStyle = 'rgba(234, 179, 8, 0.15)';
      ctx.fillRect(calibration.photoX, calibration.photoY, calibration.photoW, calibration.photoH);
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ÁREA DA FOTO', calibration.photoX + calibration.photoW / 2, calibration.photoY + calibration.photoH / 2);
      ctx.restore();
    }

    // Draw Nome do Cliente (all caps centered)
    const textPanelW = calibration.machinesW || 600;

    ctx.fillStyle = calibration.nameColor || '#111827';
    ctx.font = `bold ${calibration.nameSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(
      (carteirinhaClientName || 'NOME COMPLETO').toUpperCase(),
      calibration.nameX + textPanelW / 2,
      calibration.nameY
    );

    // Draw CPF (centered)
    ctx.fillStyle = calibration.cpfColor || '#111827';
    ctx.font = `bold ${calibration.cpfSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(
      carteirinhaCpf || '000.000.000-00',
      calibration.cpfX + textPanelW / 2,
      calibration.cpfY
    );

    // Draw Data de Nascimento (centered)
    ctx.fillStyle = calibration.birthColor || '#111827';
    ctx.font = `bold ${calibration.birthSize ?? 18}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(
      carteirinhaBirthDate || '00/00/0000',
      (calibration.birthX ?? calibration.cpfX) + textPanelW / 2,
      calibration.birthY ?? (calibration.cpfY + 50)
    );

    // Draw Máquinas (centered)
    ctx.fillStyle = calibration.machinesColor || '#111827';
    ctx.font = `bold ${calibration.machinesSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';

    const machinesList = (carteirinhaMachines || 'ESCAVADEIRA HIDRÁULICA\nRETROESCAVADEIRA')
      .split('\n')
      .filter(Boolean);

    let currentY = calibration.machinesY;
    machinesList.forEach(line => {
      ctx.fillText(line.toUpperCase(), calibration.machinesX + textPanelW / 2, currentY);
      currentY += calibration.machinesSpacing;
    });

    // Draw Validade (centered)
    ctx.fillStyle = calibration.validityColor || '#111827';
    ctx.font = `bold ${calibration.validitySize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(
      carteirinhaValidity || '00/00/0000',
      calibration.validityX + textPanelW / 2,
      calibration.validityY
    );

    // --- MARCA D'ÁGUA DE SEGURANÇA (EXCLUSIVO PARA A PRÉVIA) ---
    // A faixa atravessa toda a carteirinha na diagonal (do canto inferior esquerdo para o superior direito)
    // na cor vermelha intensa com opacidade de 90%, com texto repetido e centralizado.
    const diagonalLength = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
    const bandWidth = 110; // largura da faixa para ocupar boa parte da altura
    const angle = Math.atan2(-canvas.height, canvas.width); // inclinação ~-32° a -45° (diagonal perfeita)

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angle);

    // Faixa Vermelha (#D50000 com opacidade 90%)
    ctx.fillStyle = 'rgba(213, 0, 0, 0.90)';
    ctx.fillRect(-diagonalLength / 2 - 100, -bandWidth / 2, diagonalLength + 200, bandWidth);

    // Texto em Caixa Alta, Negrito, Branco, Excelente legibilidade
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Gerar repetição do texto continuamente sem deixar espaços vazios
    const textPattern = "EXEMPLAR • ";
    let repeatedText = "";
    while (ctx.measureText(repeatedText).width < diagonalLength) {
      repeatedText += textPattern;
    }
    if (repeatedText.endsWith(" • ")) {
      repeatedText = repeatedText.slice(0, -3);
    }
    ctx.fillText(repeatedText, 0, 0);
    ctx.restore();
    // ----------------------------------------------------------

    // Draw guides in calibration mode
    if (isCalibrating) {
      ctx.save();
      // Name
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(calibration.nameX - 5, calibration.nameY - calibration.nameSize, textPanelW + 10, calibration.nameSize + 8);
      // CPF
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
      ctx.strokeRect(calibration.cpfX - 5, calibration.cpfY - calibration.cpfSize, textPanelW + 10, calibration.cpfSize + 8);
      // Birth Date
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
      ctx.strokeRect((calibration.birthX ?? calibration.cpfX) - 5, (calibration.birthY ?? (calibration.cpfY + 50)) - (calibration.birthSize ?? 18), textPanelW + 10, (calibration.birthSize ?? 18) + 8);
      // Machines
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.7)';
      const totalMachinesH = (machinesList.length || 1) * calibration.machinesSpacing;
      ctx.strokeRect(calibration.machinesX - 5, calibration.machinesY - calibration.machinesSize, textPanelW + 10, totalMachinesH + 6);
      // Validity
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.strokeRect(calibration.validityX - 5, calibration.validityY - calibration.validitySize, textPanelW + 10, calibration.validitySize + 8);
      ctx.restore();
    }
  }, [
    bgLoaded,
    bgImage,
    clientPhotoImg,
    carteirinhaClientName,
    carteirinhaCpf,
    carteirinhaBirthDate,
    carteirinhaMachines,
    carteirinhaValidity,
    calibration,
    isCalibrating
  ]);

  // Karol Administration States
  const [selectedKarolReport, setSelectedKarolReport] = useState<any | null>(null);
  const [karolActiveReportTab, setKarolActiveReportTab] = useState<'active' | 'archived'>('active');
  const [karolSearchQuery, setKarolSearchQuery] = useState('');
  const [automationSelectedVendor, setAutomationSelectedVendor] = useState('');
  const [automationDateFilter, setAutomationDateFilter] = useState<'week' | 'month' | 'all'>('all');
  const [feeReports, setFeeReports] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('opera_cached_feereports') || '[]');
    } catch {
      return [];
    }
  });
  const [contractsHistory, setContractsHistory] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('opera_cached_contractshistory') || '[]');
    } catch {
      return [];
    }
  });
  const [notifications, setNotifications] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('opera_cached_notifications') || '[]');
    } catch {
      return [];
    }
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [contractToasts, setContractToasts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('opera_cached_sales') || '[]');
    } catch {
      return [];
    }
  });
  const [contracts, setContracts] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('opera_cached_contracts') || '[]');
    } catch {
      return [];
    }
  }); 

  const uniqueClients = useMemo(() => {
    const map = new Map<string, { name: string; cpf: string; phone: string; course: string; birthDate: string }>();

    // Parse contracts
    (contracts || []).forEach(c => {
      if (c.clientName) {
        const key = c.clientName.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: c.clientName,
            cpf: c.clientCpf || '',
            phone: c.clientPhone || '',
            course: c.courseType || c.courseName || '',
            birthDate: c.clientBirthDate || c.birthDate || c.dataNascimento || ''
          });
        }
      }
    });

    // Parse sales
    (sales || []).forEach(s => {
      if (s.studentName || s.name) {
        const name = s.studentName || s.name;
        const key = name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: name,
            cpf: s.cpf || s.clientCpf || '',
            phone: s.phone || s.clientPhone || '',
            course: s.course || s.courseName || '',
            birthDate: s.birthDate || s.clientBirthDate || s.dataNascimento || ''
          });
        } else {
          const existing = map.get(key)!;
          if (!existing.cpf && (s.cpf || s.clientCpf)) {
            existing.cpf = s.cpf || s.clientCpf;
          }
          if (!existing.phone && (s.phone || s.clientPhone)) {
            existing.phone = s.phone || s.clientPhone;
          }
          if (!existing.birthDate && (s.birthDate || s.clientBirthDate || s.dataNascimento)) {
            existing.birthDate = s.birthDate || s.clientBirthDate || s.dataNascimento;
          }
        }
      }
    });

    return Array.from(map.values());
  }, [contracts, sales]);

  const [spreadsheets, setSpreadsheets] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('opera_cached_spreadsheets') || '[]');
    } catch {
      return [];
    }
  });
   const [isAddingSpreadsheet, setIsAddingSpreadsheet] = useState(false);
  const [newSpreadsheetForm, setNewSpreadsheetForm] = useState({ name: '', url: '', description: '', category: 'Vendas', webhookUrl: '' });
  const [spreadsheetSearch, setSpreadsheetSearch] = useState('');
  const [selectedSpreadsheetCategory, setSelectedSpreadsheetCategory] = useState('Todas');
  const [editingSpreadsheetId, setEditingSpreadsheetId] = useState<string | null>(null);
  const [editingSpreadsheetForm, setEditingSpreadsheetForm] = useState({ name: '', url: '', description: '', category: 'Vendas', webhookUrl: '' });

  // Estados para exportação de dados de contrato para planilhas (requisição da Emily)
  const [exportingContract, setExportingContract] = useState<any | null>(null);
  const [selectedExportSpreadsheetId, setSelectedExportSpreadsheetId] = useState<string>('');
  const [selectedDestinoTurma, setSelectedDestinoTurma] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'warn' | 'error'>('idle');
  const [exportMessage, setExportMessage] = useState<string>('');
  const [isLinkingGoogle, setIsLinkingGoogle] = useState<boolean>(false);

  useEffect(() => {
    if (exportingContract) {
      setExportStatus('idle');
      setExportMessage('');
      setSelectedDestinoTurma(exportingContract.destinoTurma || '');
    }
  }, [exportingContract]);

  useEffect(() => {
    try {
      localStorage.setItem('opera_cached_spreadsheets', JSON.stringify(spreadsheets));
    } catch {}
  }, [spreadsheets]);

  // MODO OFFLINE PROFISSIONAL COESIVO
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncQueue, setSyncQueue] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('opera_offline_sync_queue') || '[]');
    } catch {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');

  const [travelCount, setTravelCount] = useState(0);
  const [classBonuses, setClassBonuses] = useState<boolean[]>([false, false, false, false]);
  const [showSimulator, setShowSimulator] = useState(false);
  const [config, setConfig] = useState<any>(DEFAULT_SETTINGS);

  // Salvar fila no localStorage sempre que alterada
  useEffect(() => {
    try {
      localStorage.setItem('opera_offline_sync_queue', JSON.stringify(syncQueue));
    } catch {}
  }, [syncQueue]);

  // Rotina de processamento da fila ao reconectar
  const processSyncQueue = async () => {
    if (syncQueue.length === 0 || isSyncing || !navigator.onLine) return;
    setIsSyncing(true);
    setSyncStatus('Sincronizando dados pendentes...');

    const queueCopy = [...syncQueue];
    const failedItems: any[] = [];

    for (const item of queueCopy) {
      try {
        if (item.type === 'add_sale') {
          // Salvar venda real no firestore
          await addDoc(collection(db, 'sales'), item.data);
          if (!isGlobalManager) {
            try {
              pushNotification('all', 'Nova Venda!', `🔥 ${item.data.vendorName} confirmou uma venda em ${item.data.city} (Modo Offline)!`, 'sale');
            } catch (e) {
              console.warn("Fila Offline: pushNotification falhou:", e);
            }
          }
        } 
        else if (item.type === 'delete_sale') {
          await deleteDoc(doc(db, 'sales', item.saleId));
        }
        else if (item.type === 'add_contract') {
          await addDoc(collection(db, 'contracts'), item.data);
          if (isGlobalManager) {
            try {
              pushNotification('all', 'Contrato Gerado (Offline)', `📄 Contrato de ${item.data.clientName} em ${item.data.courseCity} sincronizado!`, 'contract');
            } catch (e) {
              console.warn("Fila Offline: pushNotification falhou:", e);
            }
          }
        }
        else if (item.type === 'submit_receipt') {
          await addDoc(collection(db, 'receipt_submissions'), item.data);
        }
        else if (item.type === 'update_leads') {
          await updateDoc(doc(db, 'users', item.sellerId), { leadsCount: item.leads });
        }
      } catch (err: any) {
        console.error("Erro ao sincronizar item offline individual:", item, err);
        // Se for erro de rede/conexao indisponivel, guardamos para tentar depois
        const errMsg = err?.message || '';
        if (errMsg.includes('network') || errMsg.includes('fetch') || errMsg.includes('unavailable') || !navigator.onLine) {
          failedItems.push(item);
        }
      }
    }

    setSyncQueue(failedItems);
    setIsSyncing(false);
    if (failedItems.length === 0) {
      setSyncStatus('Sincronização offline concluída com sucesso!');
      setTimeout(() => setSyncStatus(''), 4000);
    } else {
      setSyncStatus(`${failedItems.length} registros salvos localmente.`);
    }
  };

  // Monitorar mudanças na rede
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setTimeout(() => {
        processSyncQueue();
      }, 1500);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Tenta processar na inicialização caso já esteja online
    if (navigator.onLine && syncQueue.length > 0) {
      processSyncQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);



  // Bloqueio de scroll do body quando o simulador estiver aberto
  useEffect(() => {
    if (showSimulator) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showSimulator]);

  // Estado do Simulador
  const [simSales, setSimSales] = useState(20);
  const [simEadSales, setSimEadSales] = useState(0);
  const [simStudents, setSimStudents] = useState({ Curitiba: 0, Londrina: 0, Maringá: 0, Toledo: 0 });
  const [simTrips, setSimTrips] = useState(0);
  const [simClassBonuses, setSimClassBonuses] = useState<boolean[]>([false, false, false, false]);

  // Estados de formulário
  const [searchTerm, setSearchTerm] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [isPostingReceipt, setIsPostingReceipt] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const generateId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [receiptSubmissions, setReceiptSubmissions] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('opera_cached_receiptsubmissions') || '[]');
    } catch {
      return [];
    }
  });
  const [selectedReceiptForPrint, setSelectedReceiptForPrint] = useState<any>(null);
  
  // -- ESTADO DOS RECIBOS (EXCLUSIVO KAROL) --
  // Lista de objetos { id, name, cpf, value }
  const [receiptsList, setReceiptsList] = useState([
    { id: generateId(), name: '', cpf: '', value: '' }
  ]);
  
  const [newSale, setNewSale] = useState(() => {
    try {
      const cached = localStorage.getItem('opera_cached_newsale_form');
      if (cached) return JSON.parse(cached);
    } catch {}
    return { name: '', city: 'Curitiba', status: 'confirmado', price: 1799, needsAccommodation: false };
  });
  const [extraBonusForm, setExtraBonusForm] = useState({ label: '', value: 0 });

  // Estado do Gerador de Contrato
  const [contractForm, setContractForm] = useState(() => {
    try {
      const cached = localStorage.getItem('opera_cached_contract_form');
      if (cached) return JSON.parse(cached);
    } catch {}
    return {
      id: '',
      title: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS',
      consultant: '',
      mainModality: 'Presencial',
      clientName: '',
      clientCpf: '',
      clientRg: '',
      clientBirthDate: '',
      clientPhone: '',
      recado1Phone: '', recado1Nome: '', recado1Grau: '',
      recado2Phone: '', recado2Nome: '', recado2Grau: '',
      rua: '', cidade: '', estado: '', cep: '',
      courseType: 'Máquinas Pesadas',
      courseModality: 'Presencial',
      courseCity: '',
      certificateType: 'Tradicional',
      courseDate: '',
      matriculaValue: '',
      remainderValue: '',
      needsLodging: 'NÃO',
      observations: '',
      destinoTurma: '',
      saleId: '',
      vendorId: '',
      vendorName: '',
      numero: '',
      bairro: '',
      email: '',
      profissao: '',
      estadoCivil: '',
      nacionalidade: ''
    };
  });

  // Persistir inputs temporários no localStorage para evitar perdas acidentais de digitação
  useEffect(() => {
    try {
      localStorage.setItem('opera_cached_newsale_form', JSON.stringify(newSale));
    } catch {}
  }, [newSale]);

  useEffect(() => {
    try {
      localStorage.setItem('opera_cached_contract_form', JSON.stringify(contractForm));
    } catch {}
  }, [contractForm]);

  const [showContractPreview, setShowContractPreview] = useState(false);
  const [showContractValidation, setShowContractValidation] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [voiceProgress, setVoiceProgress] = useState<number | null>(null);
  const [voiceTranscriptText, setVoiceTranscriptText] = useState<string>('');
  const voiceAccumulatedRef = useRef<string>('');
  const voiceShouldRestartRef = useRef<boolean>(false);
  const voiceLatestFullTextRef = useRef<string>('');
  const [selectedAlertSound, setSelectedAlertSound] = useState<string>(() => {
    try {
      return localStorage.getItem('sales_alert_sound') || 'double-beep';
    } catch {
      return 'double-beep';
    }
  });

  // Estado de Edição (CRUD: Update)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>(null);
  
  // Estados de Gerência
  const [showExternalSaleModal, setShowExternalSaleModal] = useState(false);
  const [externalSaleForm, setExternalSaleForm] = useState({
    vendorType: 'existing', // 'existing' | 'new'
    existingVendorId: '',
    newVendorName: '',
    studentName: '',
    city: 'Curitiba',
    price: '1799',
    needsAccommodation: false
  });
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [selectedCityForContracts, setSelectedCityForContracts] = useState<string | null>(null); // Novo estado
  const [expandedCityStats, setExpandedCityStats] = useState<string | null>(null);
  const [localLeadsInput, setLocalLeadsInput] = useState<number | ''>('');
  const [isSavingLeads, setIsSavingLeads] = useState(false);
  const [newExtName, setNewExtName] = useState('');
  const [newExtEmail, setNewExtEmail] = useState('');
  const [isAddingExt, setIsAddingExt] = useState(false);
  const [localTravelCount, setLocalTravelCount] = useState<number>(0);
  const [simCardValue, setSimCardValue] = useState<string>('100');
  const [simCardFeePayer, setSimCardFeePayer] = useState<'student' | 'seller'>('student');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [wascriptTokenInput, setWascriptTokenInput] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [isUpdatingWascriptToken, setIsUpdatingWascriptToken] = useState(false);
  const [reportMonth, setReportMonth] = useState<number>(() => new Date().getMonth());
  const [reportYear, setReportYear] = useState<number>(() => new Date().getFullYear());

  // --- IA CHATBOT (CONSULTOR IA) STATES & PERSISTENCE ---
  const [iaMode, setIaMode] = useState<'chat' | 'training' | 'simulator' | 'generator' | 'objections'>('chat');
  const [iaActiveSubTab, setIaActiveSubTab] = useState<'treinar' | 'simular' | 'mensagem' | 'historico'>('treinar');
  const [iaMessages, setIaMessages] = useState<any[]>(() => {
    return [{
      id: 'welcome',
      role: 'assistant',
      content: "Olá! Sou o seu Treinador de Vendas IA. Estou aqui para te ensinar a dominar o script de atendimento humano da Opera Formação, quebrar objeções e dominar os fechamentos e ligações de sucesso! Como posso te ajudar hoje?",
      timestamp: new Date().toISOString()
    }];
  });
  const [iaInput, setIaInput] = useState('');
  const [iaIsLoading, setIaIsLoading] = useState(false);
  const [iaLoadingText, setIaLoadingText] = useState('Pensando...');
  const [iaSelectedProfile, setIaSelectedProfile] = useState('Cliente sem dinheiro');
  const [iaSelectedObjection, setIaSelectedObjection] = useState('Está caro');
  const [iaGeneratorSituation, setIaGeneratorSituation] = useState('');
  const [iaGeneratorObjective, setIaGeneratorObjective] = useState('Agendar conversa');
  const [iaGeneratorTone, setIaGeneratorTone] = useState('Profissional');
  const [iaPerformanceScores, setIaPerformanceScores] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('opera_ia_scores') || '[]');
    } catch {
      return [];
    }
  });
  const [iaHistoryList, setIaHistoryList] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('opera_ia_history') || '[]');
    } catch {
      return [];
    }
  });
  const [iaLogsList, setIaLogsList] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('opera_ia_logs') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('opera_ia_scores', JSON.stringify(iaPerformanceScores));
    } catch {}
  }, [iaPerformanceScores]);

  useEffect(() => {
    try {
      localStorage.setItem('opera_ia_history', JSON.stringify(iaHistoryList));
    } catch {}
  }, [iaHistoryList]);

  useEffect(() => {
    try {
      localStorage.setItem('opera_ia_logs', JSON.stringify(iaLogsList));
    } catch {}
  }, [iaLogsList]);

  // Efeito para rotacionar o status de carregamento e tratar demora superior a 10 segundos
  useEffect(() => {
    if (!iaIsLoading) {
      setIaLoadingText('Pensando...');
      return;
    }

    const phases = ['Pensando...', 'Analisando situação...', 'Preparando resposta...'];
    let currentPhase = 0;
    setIaLoadingText(phases[0]);

    // Rotacionar texto a cada 3 segundos (REGRA 6 — CARREGAMENTO)
    const intervalId = setInterval(() => {
      currentPhase = (currentPhase + 1) % phases.length;
      setIaLoadingText(phases[currentPhase]);
    }, 2500);

    // Alerta de tempo (REGRA 7 — TEMPO: Se passar de 10s, avisa "Demorando mais que o normal.")
    const timeoutId = setTimeout(() => {
      setIaLoadingText('Demorando mais que o normal. Continuamos buscando a melhor resposta...');
    }, 10000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [iaIsLoading]);

  const updateProfilePin = async () => {
    if (!user || newPinInput.length < 4) {
      alert("O PIN deve ter pelo menos 4 dígitos!");
      return;
    }
    setIsUpdatingPin(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        pin: newPinInput
      });
      alert("PIN atualizado com sucesso!");
      setNewPinInput('');
    } catch (err) {
      console.error("Erro ao atualizar PIN:", err);
      alert("Erro ao atualizar PIN.");
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const resetVendorAccess = async () => {
    if (!user || !GESTOR_EMAILS.includes(user.email || '')) {
      alert("Apenas um Gerente pode realizar esta ação.");
      return;
    }
    
    if (!window.confirm("ATENÇÃO: Isso removerá o acesso de TODOS os vendedores imediatamente. Eles precisarão se cadastrar do zero. Confirmar?")) {
      return;
    }

    setIsAppReady(false); // Trava o app durante a limpeza
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      let count = 0;
      
      usersSnap.forEach(docSnap => {
        const userData = docSnap.data();
        const emailLower = userData.email?.toLowerCase();
        // Não apagar os gestores da lista
        if (!GESTOR_EMAILS.includes(emailLower)) {
          batch.delete(docSnap.ref);
          count++;
        }
      });

      await batch.commit();
      alert(`SUCESSO: ${count} acessos de vendedores foram revogados. Agora eles podem se cadastrar novamente.`);
    } catch (err) {
      console.error("Erro ao resetar vendedores:", err);
      alert("Erro ao realizar a limpeza. Tente novamente.");
    } finally {
      setIsAppReady(true);
    }
  };

  const updateProfileName = async () => {
    if (!user || !newNameInput.trim()) return;
    setIsUpdatingName(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: newNameInput.trim()
      });
      alert("Nome atualizado com sucesso!");
    } catch (err) {
      console.error("Erro ao atualizar nome:", err);
      alert("Erro ao atualizar nome.");
    } finally {
      setIsUpdatingName(false);
    }
  };

  const updateProfileWascriptToken = async () => {
    if (!user) return;
    setIsUpdatingWascriptToken(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        wascriptToken: wascriptTokenInput.trim()
      });
      alert("Token do WAScript atualizado com sucesso!");
    } catch (err) {
      console.error("Erro ao atualizar token WAScript:", err);
      alert("Erro ao atualizar token do WAScript.");
    } finally {
      setIsUpdatingWascriptToken(false);
    }
  };

  const isKarol = user?.email?.toLowerCase().trim() === 'karol@opera.com';
  const isEmily = 
    (user?.email && (
      ['emily@opera.com', 'emilyopera@gmail.com'].includes(user.email.toLowerCase()) ||
      user.email.toLowerCase().includes('emily')
    )) ||
    (userProfile?.name && userProfile.name.toLowerCase().includes('emily'));
  const isLucas = !!((user?.email && [
    'lucasgoncalvestributario@gmail.com',
    'goncalvesopera@gmail.com',
    'operaformacao@gmail.com',
    'operaformacar@gmail.com',
    'lucas@opera.com',
    'opera@gerente.com'
  ].includes(user.email.trim().toLowerCase())) || (
    userProfile?.name && (
      userProfile.name.toLowerCase().includes('lucas') && (userProfile.name.toLowerCase().includes('goncalves') || userProfile.name.toLowerCase().includes('gonçalves'))
    )
  ) || (
    user?.displayName && (
      user.displayName.toLowerCase().includes('lucas') && (user.displayName.toLowerCase().includes('goncalves') || user.displayName.toLowerCase().includes('gonçalves'))
    )
  ));
  const isOperaGoncalves = !!(user?.email && ['opera@goncalves.com', 'oepra@goncalves.com'].includes(user.email.trim().toLowerCase()));
  const isGlobalManager = !!(user?.email && ['lucas@opera.com', 'opera@gerente.com'].includes(user.email.trim().toLowerCase()));
  const isLucasStrictReport = !!(user?.email && ['lucas@opera.com', 'lucasgoncalvestributario@gmail.com'].includes(user.email.trim().toLowerCase()));
  const isLucasVendedor = isLucas || isOperaGoncalves;
  const isGestor = (user?.email?.toLowerCase() && GESTOR_EMAILS.includes(user.email.toLowerCase())) || userProfile?.role === 'gerente' || isLucas || isOperaGoncalves || isGlobalManager;
  const isSecretaria = 
    (user?.email && (
      ['emily@opera.com', 'emilyopera@gmail.com', 'karol@opera.com'].includes(user.email.toLowerCase()) ||
      user.email.toLowerCase().includes('emily') ||
      user.email.toLowerCase().includes('secretaria')
    )) || 
    userProfile?.role === 'secretaria' ||
    isKarol ||
    (userProfile?.name && userProfile.name.toLowerCase().includes('emily')) ||
    (userProfile?.name && userProfile.name.toLowerCase().includes('karol'));
  const isValiandro = user?.email && [
    'valiandroopera@gmail.com',
    'valiandrobock@gmail.com',
    'valiandro@gmail.com'
  ].includes(user.email.toLowerCase());

  useEffect(() => {
    const canSeeCarteirinha = isLucas || isGlobalManager || isGestor || userProfile?.role === 'gerente';
    if (isGlobalManager) {
      if (!['resumo', 'vendas', 'contratos', 'config', 'equipe', 'carteirinha'].includes(activeTab)) {
        setActiveTab('resumo');
      }
    } else {
      const allowed = ['resumo', 'contratos', 'config'];
      if (canSeeCarteirinha) {
        allowed.push('carteirinha');
      }
      const isSellerOrEmily = !isKarol && (!isSecretaria || isEmily);
      if (isSellerOrEmily) {
        allowed.push('vendas');
      }
      if (isSecretaria) {
        allowed.push('planilhas', 'taxas', 'historico', 'recibos');
      }
      if (isKarol) {
        allowed.push('recebimento', 'automacao');
      }
      const canSeeEquipe = isLucas || isOperaGoncalves || isGestor || userProfile?.role === 'gerente';
      if (canSeeEquipe) {
        allowed.push('equipe');
      }
      if (!allowed.includes(activeTab)) {
        setActiveTab('resumo');
      }
    }
  }, [isGlobalManager, isSecretaria, isKarol, isLucas, isOperaGoncalves, isGestor, userProfile, isEmily, activeTab]);

  const removeSeller = async (sellerId: string, sellerName: string) => {
    if (!window.confirm(`Deseja realmente remover o vendedor ${sellerName}? Ele perderá o acesso e desaparecerá da equipe imediatamente.`)) return;
    
    try {
      const sellerObj = rawAllUsers.find(u => u.id === sellerId);
      const sellerEmail = sellerObj?.email?.toLowerCase().trim();

      if (sellerEmail) {
        await setDoc(doc(db, 'revoked_users', sellerEmail), {
          email: sellerEmail,
          uid: sellerId,
          name: sellerName,
          revokedAt: new Date().toISOString()
        });
      }
      await setDoc(doc(db, 'revoked_users', sellerId), {
        email: sellerEmail || null,
        uid: sellerId,
        name: sellerName,
        revokedAt: new Date().toISOString()
      });

      // Também remover da tabela de users diretamente para que o listener remova em tempo real
      try {
        await deleteDoc(doc(db, 'users', sellerId));
      } catch (docErr) {
        console.warn("Erro ao deletar documento 'users' (pode não existir):", docErr);
      }

      // Removendo do estado local para feedback imediato na equipe
      setRawAllUsers(prev => prev.filter(u => u.id !== sellerId));
      if (selectedSellerId === sellerId) {
        setSelectedSellerId(null);
      }
      alert("Vendedor removido com sucesso e seu acesso foi totalmente revogado!");
    } catch (err) {
      console.error("Erro ao remover vendedor:", err);
      alert("Erro ao remover vendedor.");
    }
  };

  const handleAddExternalSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExtName.trim()) {
      alert("Insira o nome do vendedor.");
      return;
    }
    
    const emailToUse = newExtEmail.trim() || `${newExtName.trim().toLowerCase().replace(/\s+/g, '')}@opera.com`;
    const emailLower = emailToUse.toLowerCase();

    // Verificar se já existe vendedor com esse email
    const exists = rawAllUsers.some(u => u.email?.toLowerCase().trim() === emailLower);
    if (exists) {
      alert("Já existe um vendedor cadastrado com este e-mail.");
      return;
    }

    setIsAddingExt(true);
    try {
      const newId = 'ext_' + Date.now();
      
      // Limpar qualquer revogação anterior deste e-mail ou do novo ID fictício para que o usuário possa ser re-adicionado com sucesso
      try {
        await deleteDoc(doc(db, 'revoked_users', emailLower));
        await deleteDoc(doc(db, 'revoked_users', newId));
      } catch (revErr) {
        console.warn("Erro ao limpar revoked_users no handleAddExternalSeller:", revErr);
      }

      await setDoc(doc(db, 'users', newId), {
        id: newId,
        uid: newId,
        name: newExtName.trim(),
        email: emailToUse,
        role: 'vendedor',
        pin: '1234',
        leadsCount: 0,
        manualSalesAdjust: 0,
        createdAt: new Date().toISOString()
      });
      setNewExtName('');
      setNewExtEmail('');
      alert(`Vendedor "${newExtName.trim()}" foi cadastrado com sucesso na equipe!`);
    } catch (err) {
      console.error("Erro ao cadastrar vendedor sem acesso:", err);
      alert("Erro ao cadastrar vendedor sem acesso.");
    } finally {
      setIsAddingExt(false);
    }
  };

  // Sincronização de Gerência e Contratos
  const [allSales, setAllSales] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('opera_cached_allsales') || '[]');
    } catch {
      return [];
    }
  });
  const [rawAllUsers, setRawAllUsers] = useState<any[]>([]);
  const [revokedUsers, setRevokedUsers] = useState<any[]>([]);

  const allUsers = useMemo(() => {
    return rawAllUsers.filter(u => {
      const emailLower = u.email?.toLowerCase().trim() || '';
      const isRevoked = revokedUsers.some(r => 
        r.id === u.id || 
        r.uid === u.id || 
        (r.email && r.email.toLowerCase().trim() === emailLower) ||
        r.id === emailLower
      );
      return !isRevoked;
    });
  }, [rawAllUsers, revokedUsers]);

  const [managerPeriodFilter, setManagerPeriodFilter] = useState<'current' | 'all'>('current');

  // Limpeza de contas desativadas (Karol) do Firebase pelo Gestor
  useEffect(() => {
    if (isGestor && allUsers.length > 0) {
      const usersToClean = allUsers.filter(u => {
        const email = (u.email || '').toLowerCase();
        const name = (u.name || '').toLowerCase();
        return (email.includes('karol') && email !== 'karol@opera.com') || (name.includes('karol') && email !== 'karol@opera.com');
      });

      if (usersToClean.length > 0) {
        usersToClean.forEach(async (u) => {
          try {
            await deleteDoc(doc(db, 'users', u.id));
            console.log(`Conta desativada ${u.email || u.name} removida do Firestore por estar desativada.`);
          } catch (err) {
            console.error("Erro ao limpar dados de contas desativadas:", err);
          }
        });
      }
    }
  }, [allUsers, isGestor]);

  // Semeador automático para consultores externos fixos e persistentes
  useEffect(() => {
    if (isAppReady && allUsers.length > 0 && isGestor) {
      const targetConsultants = [
        { id: 'ext_michel', name: 'Michel', email: 'michel@opera.com' },
        { id: 'ext_renata', name: 'Renata POA', email: 'renatapoa@opera.com' },
        { id: 'ext_camilley', name: 'Camilley', email: 'camilley@opera.com' },
        { id: 'ext_valeria', name: 'Valéria', email: 'valeria@opera.com' },
        { id: 'ext_marcelo', name: 'Marcelo', email: 'marcelo@opera.com' }
      ];

      targetConsultants.forEach(async (c) => {
        // Verificar se este consultor foi revogado/excluído para não re-semear
        const isRevoked = revokedUsers.some(r => 
          r.uid === c.id || 
          r.id === c.id || 
          (r.email && r.email.toLowerCase().trim() === c.email.toLowerCase().trim())
        );
        if (isRevoked) {
          return;
        }

        const existingUser = allUsers.find(u => u.id === c.id);
        if (!existingUser) {
          const foundAlternative = allUsers.some(u => 
            (u.name && u.name.toLowerCase() === c.name.toLowerCase()) ||
            (u.email && u.email.toLowerCase() === c.email.toLowerCase())
          );
          if (!foundAlternative) {
            try {
              await setDoc(doc(db, 'users', c.id), {
                id: c.id,
                name: c.name,
                email: c.email,
                role: 'vendedor',
                pin: '1234',
                leadsCount: 0,
                manualSalesAdjust: 0,
                createdAt: new Date().toISOString()
              });
              console.log(`Consultor externo "${c.name}" foi adicionado com sucesso à equipe.`);
            } catch (err) {
              console.error(`Erro ao salvar consultor externo "${c.name}":`, err);
            }
          }
        } else {
          // Se já existe com o id, mas o nome ou email mudou (ex: de Renata para Renata POA)
          const normExistingName = (existingUser.name || '').normalize('NFC').trim().toLowerCase();
          const normCName = c.name.normalize('NFC').trim().toLowerCase();
          const normExistingEmail = (existingUser.email || '').normalize('NFC').trim().toLowerCase();
          const normCEmail = c.email.normalize('NFC').trim().toLowerCase();

          if (normExistingName !== normCName || normExistingEmail !== normCEmail) {
            try {
              await updateDoc(doc(db, 'users', c.id), {
                name: c.name,
                email: c.email
              });
              console.log(`Registro do consultor "${c.name}" foi atualizado para as novas informações.`);
            } catch (err) {
              console.error(`Erro ao atualizar consultor "${c.name}":`, err);
            }
          }
        }
      });
    }
  }, [allUsers, isGestor, isAppReady, revokedUsers]);

  // Reset manual adjustments to 0 once to ensure everyone starts clean with 0 sales
  useEffect(() => {
    if (isAppReady && allUsers.length > 0 && isGestor) {
      allUsers.forEach(async (u) => {
        if (u.manualSalesAdjust && u.manualSalesAdjust > 0) {
          try {
            await updateDoc(doc(db, 'users', u.id), { manualSalesAdjust: 0 });
            console.log(`Reset manualSalesAdjust for user ${u.name}`);
          } catch (err) {
            console.error("Error resetting manualSalesAdjust:", err);
          }
        }
      });
    }
  }, [isAppReady, allUsers.length, isGestor]);



  // -- DADOS MESCLADOS (ONLINE + OFFLINE PENDENTES) --
  const localPendingSales = useMemo(() => {
    return syncQueue
      .filter((x: any) => x.type === 'add_sale')
      .map((x: any) => ({ ...x.data, id: x.id, isLocalPending: true }));
  }, [syncQueue]);

  const displayedAllSales = useMemo(() => {
    const filteredPending = localPendingSales.filter(pending => 
      !allSales.some(s => s.name === pending.name && s.createdAt === pending.createdAt)
    );
    return [...filteredPending, ...allSales];
  }, [allSales, localPendingSales]);

  const displayedSales = useMemo(() => {
    const filteredPending = localPendingSales.filter(pending => 
      pending.vendorId === user?.uid &&
      !sales.some(s => s.name === pending.name && s.createdAt === pending.createdAt)
    );
    // Vendedores veem apenas as próprias vendas. No acesso do gerente Lucas Gonçalves, também deve aparecer somente as suas próprias vendas.
    const baseSales = sales.filter(isUserSale);
    const allUserSales = [...filteredPending, ...baseSales];
    
    const adjusted = adjustSalesForVendor(
      allUserSales,
      user?.email || '',
      userProfile?.name || user?.displayName || '',
      user?.uid
    );

    if ((isLucas || isOperaGoncalves) && managerPeriodFilter === 'current') {
      const filteredCurrent = adjusted.filter(s => isCurrentMonthSale(s.createdAt));
      return filteredCurrent;
    }
    return adjusted;
  }, [sales, localPendingSales, user, isLucas, isOperaGoncalves, managerPeriodFilter, isUserSale, userProfile]);

  const localPendingContracts = useMemo(() => {
    return syncQueue
      .filter((x: any) => x.type === 'add_contract')
      .map((x: any) => ({ ...x.data, id: x.id, isLocalPending: true }));
  }, [syncQueue]);

  const displayedContracts = useMemo(() => {
    const filteredPending = localPendingContracts.filter(pending =>
      !contracts.some(c => c.clientName === pending.clientName && c.vendorId === pending.vendorId)
    );
    return [...filteredPending, ...contracts];
  }, [contracts, localPendingContracts]);

  const localPendingReceipts = useMemo(() => {
    return syncQueue
      .filter((x: any) => x.type === 'submit_receipt')
      .map((x: any) => ({ ...x.data, id: x.id, isLocalPending: true }));
  }, [syncQueue]);

  const displayedReceiptSubmissions = useMemo(() => {
    const filteredPending = localPendingReceipts.filter(pending =>
      !receiptSubmissions.some(r => r.name === pending.name && r.value === pending.value)
    );
    return [...filteredPending, ...receiptSubmissions];
  }, [receiptSubmissions, localPendingReceipts]);

  useEffect(() => {
    if (!user) return;

    let unsubUsers = () => {};
    let unsubAllSales = () => {};
    let unsubRevokedUsers = () => {};

    // Sincronização Global de Vendas e Usuários (para Dashboards de todos)
    const salesRef = collection(db, 'sales');
    const salesQueryGlobal = (isGlobalManager || isSecretaria || isLucas || isOperaGoncalves)
      ? query(salesRef)
      : query(salesRef, where('vendorId', '==', user.uid));

    unsubAllSales = onSnapshot(salesQueryGlobal, (snap) => {
      trackSnapshotLoad('sales');
      const salesData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setAllSales(salesData);

    const changes = snap.docChanges();
    if (changes.length > 0) {
      changes.forEach(change => {
        const sale: any = change.doc.data();
        const isNew = sale.createdAt > appStartTime;
        if (!isNew) return;

        const vendorName = rawAllUsers.find(u => u.id === sale.vendorId)?.name || 'Vendedor';

        if (change.type === 'added') {
          if (isGlobalManager || isSecretaria || isUserSale(sale)) {
            const msg = `Venda de R$ ${sale.price} confirmada para ${sale.name} por ${vendorName}!`;
            sendSystemNotification('Nova Venda!', msg, 'resumo', change.doc.id);
          }
        } else if ((change.type === 'modified' || change.type === 'removed') && isValiandro) {
          const action = change.type === 'modified' ? 'atualizada para "' + sale.status + '"' : 'REMOVIDA';
          const msg = `Venda de ${sale.name} foi ${action} por ${vendorName}`;
          sendSystemNotification(`Venda ${change.type === 'modified' ? 'Atualizada' : 'Removida'}`, msg, 'resumo', change.doc.id + '_' + sale.status);
        }
      });
    }
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));

    const revokedRef = collection(db, 'revoked_users');
    unsubRevokedUsers = onSnapshot(revokedRef, (snap) => {
      const revokedData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
      setRevokedUsers(revokedData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'revoked_users'));

    const usersRef = collection(db, 'users');
    unsubUsers = onSnapshot(usersRef, (snap) => {
      trackSnapshotLoad('users');
      const usersData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
      const filtered = usersData.filter(u => u.name);
      setRawAllUsers(filtered);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    // Listeners exclusivos para Secretaria/Gerentes Globais
    let unsubFeeReports = () => {};
    if (isGlobalManager || isSecretaria) {
      const reportsRef = collection(db, 'fee_reports');
      unsubFeeReports = onSnapshot(reportsRef, (snap) => {
        trackSnapshotLoad('fee_reports');
        const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setFeeReports(data);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'fee_reports'));
    }

    // Sincronizar CONTRATOS (Universal: Emily vê tudo, Gerente vê tudo para equipe, Vendedor vê apenas o seu)
    const contractsRef = collection(db, 'contracts');
    // Se for Secretaria ou Gerente Global, sincroniza tudo. Se for vendedor, apenas os dele.
    const contractsQuery = (isSecretaria || isGlobalManager) 
      ? query(contractsRef) 
      : query(contractsRef, where('vendorId', '==', user.uid));

    const unsubContracts = onSnapshot(contractsQuery, (snap) => {
      trackSnapshotLoad('contracts');
      const contractsData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setContracts(contractsData);

      // Detectar se há novos contratos adicionados depois do carregamento do app em tempo real
      if (isAppReady) {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = { ...change.doc.data(), id: change.doc.id } as any;
            
            // Ignorar temporários e analisar timestamp de criação
            if (data.id && !data.id.startsWith('temp_')) {
              const contractTimeStr = data.generatedAt || data.createdAt || '';
              const isNew = contractTimeStr > appStartTime;
              
              if (isNew) {
                // Se o usuário logado for a Emily (ou se isSecretaria), mostrar notificação popup
                if (isSecretaria || ['emily@opera.com', 'emilyopera@gmail.com'].includes(user?.email?.toLowerCase() || '')) {
                  setContractToasts(prev => {
                    if (prev.some(t => t.contract.id === data.id)) return prev;
                    return [...prev, {
                      id: 'toast_' + data.id + '_' + Date.now(),
                      contract: data,
                      timestamp: Date.now()
                    }];
                  });

                  // Alerta falado via Web Speech API em português para Emily
                  if ('speechSynthesis' in window) {
                    try {
                      window.speechSynthesis.cancel();
                      const utterance = new SpeechSynthesisUtterance(`Emily, novo contrato de ${data.clientName} postado por ${data.vendorName || data.consultant || 'um vendedor'}`);
                      utterance.lang = 'pt-BR';
                      utterance.rate = 1.15;
                      window.speechSynthesis.speak(utterance);
                    } catch (speakErr) {
                      console.warn("Speech falhou", speakErr);
                    }
                  }
                }
              }
            }
          }
        });
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'contracts'));

    // Sincronizar Histórico de Contratos (Universal para verificação de status, mas filtrado por acesso)
    let unsubHistory = () => {};
    let unsubReceiptSubmissions = () => {};

    const historyRef = collection(db, 'contracts_history');
    const historyQuery = (isSecretaria || isGlobalManager)
      ? query(historyRef)
      : query(historyRef, where('vendorId', '==', user.uid));

    unsubHistory = onSnapshot(historyQuery, (snap) => {
      trackSnapshotLoad('contracts_history');
      const historyData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setContractsHistory(historyData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'contracts_history'));

    if (isSecretaria || isGlobalManager) {
      const receiptsRef = collection(db, 'receipt_submissions');
      if (isGlobalManager) {
        unsubReceiptSubmissions = onSnapshot(receiptsRef, (snap) => {
          const receiptsData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
          setReceiptSubmissions(receiptsData);
  
          // Notificação de novos recibos para Gestor
          const newDocs = snap.docChanges().filter(change => change.type === 'added');
          if (newDocs.length > 0) {
            newDocs.forEach(change => {
              const data: any = change.doc.data();
              // Usar 'timestamp' que é o campo usado em receipt_submissions
              const isNew = (data.timestamp || data.createdAt) > appStartTime;
              if (!isNew) return;

              // Notificação apenas fora do app (Push/Nativa) conforme solicitado
              sendSystemNotification('Novo Recibo Postado (Karol)', `Recebido de ${data.name}: R$ ${data.value}`, 'taxas_recibos', change.doc.id);
            });
          }
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'receipt_submissions'));
      }
    }

    // Sincronizar Notificações em Tempo Real
    let unsubNotifications = () => {};
    if (user) {
      const notifRef = collection(db, 'notifications');
      const notifQuery = query(notifRef, where('userId', 'in', [user.uid, 'all']));
      
      unsubNotifications = onSnapshot(notifQuery, (snap) => {
        const notifData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setNotifications(notifData.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)));
        
        // Alerta sonoro/visual para novas notificações
        const newNotifs = snap.docChanges().filter(change => change.type === 'added');
        if (newNotifs.length > 0 && isAppReady) {
          const last = newNotifs[0].doc.data() as any;
          if (last.createdAt > appStartTime && last.senderId !== user.uid) {
            // Pode adicionar um som aqui se tiver asset
            if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
          }
        }
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'));
    }

    // Sincronizar Planilhas em Tempo Real (Apenas para Gestor ou Secretaria)
    let unsubSpreadsheets = () => {};
    if (isSecretaria || isLucas || isOperaGoncalves) {
      const spreadsheetsRef = collection(db, 'spreadsheets');
      unsubSpreadsheets = onSnapshot(spreadsheetsRef, (snap) => {
        const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setSpreadsheets(data.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'spreadsheets'));
    }

    return () => {
      unsubUsers();
      unsubAllSales();
      unsubContracts();
      unsubFeeReports();
      unsubHistory();
      unsubReceiptSubmissions();
      unsubNotifications();
      unsubSpreadsheets();
      unsubRevokedUsers();
    };
  }, [isGestor, isSecretaria, user, isAppReady, userProfile?.role, userProfile?.name]);


  const pushNotification = async (userId: string, title: string, message: string, type: 'sale' | 'contract' | 'system' | 'report') => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        message,
        type,
        read: false,
        createdAt: new Date().toISOString(),
        senderId: user?.uid || 'system',
        senderName: userProfile?.name || 'Sistema'
      });

      // Se for para todos (all), avisar todos os cargos via Push para experiência estilo WhatsApp
      if (userId === 'all') {
        const pushType = type === 'sale' ? 'venda' : (type === 'report' ? 'recibo' : (type === 'contract' ? 'contrato' : undefined));
        const tab = type === 'report' ? 'taxas_recibos' : (type === 'contract' ? 'contratos' : 'resumo');
        notifyPush('gerente', title, message, tab, pushType);
        notifyPush('secretaria', title, message, tab, pushType);
        notifyPush('vendedor', title, message, tab, pushType);
      } else {
        // Notificar usuário específico
        notifyPush({ userId }, title, message, 'resumo');
      }
    } catch (err) {
      console.error("Erro ao enviar notificação:", err);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;
    const batch = writeBatch(db);
    const myNotifs = notifications.filter(n => n.userId === user.uid || n.userId === 'all');
    myNotifs.forEach(n => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    try {
      await batch.commit();
      setShowNotifications(false);
    } catch (err) {
      console.error("Erro ao limpar notificações:", err);
    }
  };

  const closeNotificationsAndMarkRead = async () => {
    setShowNotifications(false);
  };

  const unreadCount = 0; // Removido icon de notificações UI tray

  useEffect(() => {
    if (user && isPinVerified && isAppReady && ('Notification' in window)) {
      if (isValiandro || isLucas || isOperaGoncalves) {
        requestNotificationPermission();
        subscribeToPush();
      } else if (Notification.permission === 'default') {
        const timer = setTimeout(() => {
          requestNotificationPermission();
        }, 5000);
        return () => clearTimeout(timer);
      } else if (Notification.permission === 'granted') {
        subscribeToPush();
      }
    }
  }, [user, isPinVerified, isAppReady, isOperaGoncalves]);
  const sellersStats = useMemo(() => {
    return allUsers.map(vendedor => {
      let vSales = displayedAllSales.filter(s => isVendorSale(s, vendedor));
      if (managerPeriodFilter === 'current' || isValiandro) {
        vSales = vSales.filter(s => isCurrentMonthSale(s.createdAt));
      }
      
      vSales = adjustSalesForVendor(
        vSales,
        vendedor.email || '',
        vendedor.name || vendedor.displayName || '',
        vendedor.id
      );

      const confirmed = vSales.filter(s => s.status === 'confirmado');
      const dropouts = vSales.filter(s => s.status === 'desistente');
      const totalRevenue = confirmed.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
      const cities = Array.from(new Set(confirmed.map(s => s.city)));
      const needsAcc = confirmed.filter(s => s.needsAccommodation).length;
      
      const manualSales = vendedor.manualSalesAdjust || 0;

      // Detalhes por cidade
      const cityBreakdown = [...CITIES_LIST, 'EAD'].map(city => {
        const citySales = vSales.filter(s => s.city === city);
        const cityConfirmed = citySales.filter(s => s.status === 'confirmado');
        const cityDropouts = citySales.filter(s => s.status === 'desistente');
        
        const cityDiscount = cityConfirmed.reduce((acc, s) => {
          if (city === 'EAD') return acc;
          const price = Number(s.price) || 0;
          return acc + Math.max(0, 1799 - price);
        }, 0);

        const cityRevenue = cityConfirmed.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
        const cityAvgTicket = cityConfirmed.length > 0 ? (cityRevenue / cityConfirmed.length) : 0;

        return {
          city,
          count: cityConfirmed.length,
          dropoutCount: cityDropouts.length,
          discount: cityDiscount,
          avgTicket: cityAvgTicket
        };
      }).filter(c => c.count > 0 || c.dropoutCount > 0); 

      const presencialSales = confirmed.filter(s => s.city !== 'EAD');
      const presencialRevenue = presencialSales.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
      const avgTicket = presencialSales.length > 0 ? (presencialRevenue / presencialSales.length) : 0;
      
      const totalDiscount = confirmed.reduce((acc, s) => {
        if (s.city === 'EAD') return acc;
        const price = Number(s.price) || 0;
        return acc + Math.max(0, 1799 - price);
      }, 0);

      const presencialCount = confirmed.filter(s => s.city !== 'EAD').length;
      const potentialRevenue = presencialCount * 1799;
      const discountPercentage = potentialRevenue > 0 ? (totalDiscount / potentialRevenue) * 100 : 0;

      const leads = vendedor.leadsCount || 0;
      const sellerNameLower = (vendedor.name || '').toLowerCase();
      const isRenataSouzaUser = sellerNameLower.includes('souza') && sellerNameLower.includes('renata');

      let finalConfirmedCount = confirmed.length + manualSales;

      const conversionRate = leads > 0 ? (finalConfirmedCount / leads) * 105 : (vSales.length > 0 ? (finalConfirmedCount / vSales.length) * 105 : 0);

      return {
        ...vendedor,
        totalSales: vSales.length + manualSales,
        confirmedCount: finalConfirmedCount,
        eadCount: confirmed.filter(s => s.city === 'EAD').length,
        presencialCount: presencialCount,
        dropoutCount: dropouts.length,
        totalRevenue,
        presencialRevenue,
        avgTicket,
        totalDiscount,
        discountPercentage,
        leadsCount: leads,
        conversionRate,
        cities: cityBreakdown,
        needsAcc,
        rawSales: vSales,
        performance: finalConfirmedCount,
        manualSalesAdjust: manualSales
      };
    })
    .filter(s => {
      const name = s.name?.toLowerCase() || "";
      const email = s.email?.toLowerCase() || "";

      // Excluir Karol completamente de todas as telas do app
      if (email.includes('karol') || name.includes('karol')) {
        return false;
      }

      // No acesso do Lucas Gonçalves ou Gerente Gonçalves, queremos mostrar ABSOLUTAMENTE TODOS os usuários cadastrados
      // (inclusive se tiverem 0 vendas, qualquer cargo exceto Karol)
      if (isLucas || isOperaGoncalves) {
        return !!email;
      }

      // 1. Sempre manter o usuário logado para ele ver seus próprios dados
      if (user?.email && email === user.email.toLowerCase()) return true;

      // 2. Secretárias e Gestores sempre aparecem
      if (s.role === 'secretaria' || s.role === 'gerente') {
        return true;
      }

      // 3. Emily (Secretária) - mantendo por precaução
      if (email === 'emily@opera.com' || email === 'emilyopera@gmail.com' || name.includes('emily') || s.role === 'secretaria') return true;

      // 4. Regras Específicas para Vendedores (Tanto internos quanto externos)
      // Remover quem está com 0 vendas este mês para que a aba equipe fique limpa, mostrando apenas quem fez vendas.
      if (s.role === 'vendedor') {
        const confirmedSalesCount = s.confirmedCount || 0;
        if (confirmedSalesCount === 0 && !isLucas && !isOperaGoncalves) {
          return false;
        }
        return true;
      }

      return false;
    })
    .sort((a, b) => {
      const rateA = a.conversionRate || 0;
      const rateB = b.conversionRate || 0;
      if (Math.abs(rateB - rateA) > 0.001) {
        return rateB - rateA;
      }
      if (b.confirmedCount !== a.confirmedCount) {
        return b.confirmedCount - a.confirmedCount;
      }
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB);
      }
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [allUsers, allSales, isGestor, user, isLucas, isOperaGoncalves, isValiandro, managerPeriodFilter, isVendorSale]);

  const teamMetrics = useMemo(() => {
    if (sellersStats.length === 0) return null;

    // Filter sales to include only those from currently visible sellers
    let visibleSales: any[] = [];
    sellersStats.forEach(s => {
      visibleSales = [...visibleSales, ...(s.rawSales || [])];
    });

    // Aplicar Overrides
    const overrideEad = Number(config.overrides?.ead || 0);
    const overridePresencial = Number(config.overrides?.presencial || 0);
    const overrideDropout = Number(config.overrides?.dropout || 0);

    // Calculate sum directly from each seller's stats to be 100% consistent with the list rows
    const totalEad = sellersStats.reduce((acc, s) => acc + (s.eadCount || 0), 0) + overrideEad;
    const totalPresencial = sellersStats.reduce((acc, s) => acc + (s.presencialCount || 0) + (s.manualSalesAdjust || 0), 0) + overridePresencial;
    const totalConfirmed = totalEad + totalPresencial;
    const totalDropout = sellersStats.reduce((acc, s) => acc + (s.dropoutCount || 0), 0) + overrideDropout;

    const totalRevenue = sellersStats.reduce((acc, s) => acc + (s.totalRevenue || 0), 0);
    const presencialRevenue = sellersStats.reduce((acc, s) => acc + (s.presencialRevenue || 0), 0);
    const totalDiscount = sellersStats.reduce((acc, s) => acc + (s.totalDiscount || 0), 0);

    const sellersOnly = sellersStats.filter(s => {
      const email = (s.email || '').toLowerCase();
      const isVali = email.includes('valiandro');
      const isSec = s.role === 'secretaria';
      return !isVali && !isSec;
    });

    const activeSellersOnly = sellersOnly.filter(s => (s.leadsCount || 0) > 0 || (s.confirmedCount || 0) > 0);
    const sellersToEvaluate = activeSellersOnly.length > 0 ? activeSellersOnly : sellersOnly;
    const sortedByRate = [...sellersToEvaluate].sort((a, b) => {
      const rateA = a.conversionRate || 0;
      const rateB = b.conversionRate || 0;
      if (Math.abs(rateB - rateA) > 0.001) {
        return rateB - rateA;
      }
      const confA = a.confirmedCount || 0;
      const confB = b.confirmedCount || 0;
      if (confB !== confA) {
        return confB - confA;
      }
      const leadA = a.leadsCount || 0;
      const leadB = b.leadsCount || 0;
      if (leadB !== leadA) {
        return leadB - leadA;
      }
      const nameA = (a.name || '').normalize('NFC').trim().toLowerCase();
      const nameB = (b.name || '').normalize('NFC').trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return {
      best: sortedByRate[0] || sellersOnly[0] || sellersStats[0],
      worst: sortedByRate[sortedByRate.length - 1] || sellersOnly[sellersOnly.length - 1] || sellersStats[sellersStats.length - 1],
      totalConfirmed,
      totalEad,
      totalPresencial,
      totalDropout,
      totalRevenue: totalRevenue,
      presencialRevenue: presencialRevenue,
      totalDiscount: totalDiscount,
      cityStats: [...CITIES_LIST, 'EAD'].map(city => {
        const citySales = visibleSales.filter(s => s.city === city);
        const cityConfirmed = citySales.filter(s => s.status === 'confirmado');
        const cityDesistentes = citySales.filter(s => s.status === 'desistente');
        const cityNeedsAcc = cityConfirmed.filter(s => s.needsAccommodation).length;
        const cityRevenue = cityConfirmed.reduce((acc, sale) => acc + (Number(sale.price) || 0), 0);
        const cityDiscount = cityConfirmed.reduce((acc, sale) => {
          if (city === 'EAD') return acc;
          const price = Number(sale.price) || 0;
          return acc + Math.max(0, 1799 - price);
        }, 0);

        return {
          city,
          count: cityConfirmed.length,
          total: citySales.length,
          desistentes: cityDesistentes.length,
          lodging: cityNeedsAcc,
          revenue: cityRevenue,
          discount: cityDiscount,
          avgTicket: cityConfirmed.length > 0 ? cityRevenue / cityConfirmed.length : 0
        };
      })
    };
  }, [sellersStats, allSales, config.overrides, isLucas, isOperaGoncalves, isValiandro, managerPeriodFilter]);

  const teamYearlyConfirmed = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return allSales.filter(s => {
      if (s.status !== 'confirmado') return false;
      if (!s.createdAt) return false;
      const d = new Date(s.createdAt);
      return d.getFullYear() === currentYear;
    }).length;
  }, [allSales]);
  
  const downloadLucasSalesReportPDF = () => {
    const doc = new jsPDF();
    
    // Filter sales for the selected month and year
    const monthFilteredSales = displayedAllSales.filter(s => {
      if (!s.createdAt) return false;
      const d = new Date(s.createdAt);
      return d.getMonth() === reportMonth && d.getFullYear() === reportYear;
    });

    // Sort by date ascending
    monthFilteredSales.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    
    const selectedMonthLabel = monthNames[reportMonth];
    const now = new Date().toLocaleDateString('pt-BR');

    // Header Design (Dark premium card block)
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setTextColor(250, 204, 21); // Yellow accent
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("OPERA FORMAÇÃO", 15, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(`RELATÓRIO MENSAL DE VENDAS - ${selectedMonthLabel.toUpperCase()} / ${reportYear}`, 15, 29);
    
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Acesso Exclusivo: Lucas Gonçalves`, 15, 37);
    doc.text(`Gerado em: ${now}`, 160, 20);

    let finalY = 55;

    // Table Columns: Date, Seller, Student, City/Local, Price
    const tableData = monthFilteredSales.map(s => {
      const saleDate = new Date(s.createdAt).toLocaleDateString('pt-BR');
      const vendorName = s.vendorName || rawAllUsers.find((u: any) => u.id === s.vendorId)?.name || 'Desconhecido';
      const studentName = s.name || 'Sem Nome';
      const city = s.city || 'Sem Cidade';
      const value = Number(s.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return [saleDate, vendorName.toUpperCase(), studentName.toUpperCase(), city.toUpperCase(), value];
    });

    autoTable(doc, {
      startY: finalY,
      head: [['DATA', 'VENDEDOR', 'ALUNO', 'CIDADE / DESTINO', 'VALOR']],
      body: tableData.length > 0 ? tableData : [['-', 'NENHUMA VENDA NESTE PERÍODO', '-', '-', '-']],
      headStyles: { fillColor: [250, 204, 21], textColor: [0, 0, 0], fontStyle: 'bold' },
      bodyStyles: { textColor: [30, 30, 30], fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 45 },
        2: { cellWidth: 55 },
        3: { cellWidth: 45 },
        4: { cellWidth: 25, halign: 'right' }
      },
      margin: { left: 15, right: 15 }
    });

    // Calculate totals for summary block
    const totalSalesCount = monthFilteredSales.length;
    const totalRevenue = monthFilteredSales.reduce((acc, s) => acc + Number(s.price || 0), 0);
    const formattedTotalRevenue = totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Summary block below the table
    const tableInfo = (doc as any).lastAutoTable;
    const summaryY = tableInfo ? tableInfo.finalY + 15 : finalY + 30;

    // Check if we need a new page for the summary to prevent overflow
    if (summaryY > 265) {
      doc.addPage();
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, 210, 15, 'F');
      doc.setFontSize(10);
      doc.setTextColor(250, 204, 21);
      doc.text("RESUMO DO PERÍODO", 15, 10);
      
      // Reset y
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("RESUMO GERAL DO PERÍODO:", 15, 30);
      doc.setFont("helvetica", "normal");
      doc.text(`Total de Vendas Realizadas: ${totalSalesCount}`, 15, 40);
      doc.text(`Valor Total Faturado: ${formattedTotalRevenue}`, 15, 48);
    } else {
      // Summary Box
      doc.setFillColor(245, 245, 245);
      doc.rect(15, summaryY, 180, 25, 'F');
      
      doc.setDrawColor(220, 220, 220);
      doc.rect(15, summaryY, 180, 25, 'D');

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("RESUMO FINANCEIRO", 20, summaryY + 7);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Quantidade de Vendas: ${totalSalesCount}`, 20, summaryY + 15);
      doc.setFont("helvetica", "bold");
      doc.text(`Faturamento Total: ${formattedTotalRevenue}`, 110, summaryY + 15);
    }

    doc.save(`Relatorio_Vendas_${selectedMonthLabel}_${reportYear}.pdf`);
  };

  const downloadCityDetailedPDF = (cityName: string, ecoMode = false) => {
    const doc = new jsPDF();
    let cityConfirmed = displayedAllSales.filter(s => s.city === cityName && s.status === 'confirmado');
    let cityDesistentes = displayedAllSales.filter(s => s.city === cityName && s.status === 'desistente');
    
    if (((isLucas || isOperaGoncalves) && managerPeriodFilter === 'current') || isValiandro) {
      cityConfirmed = cityConfirmed.filter(s => isCurrentMonthSale(s.createdAt));
      cityDesistentes = cityDesistentes.filter(s => isCurrentMonthSale(s.createdAt));
    }
    const cityNeedsAcc = cityConfirmed.filter(s => s.needsAccommodation);
    const now = new Date().toLocaleDateString('pt-BR');

    // Header
    if (!ecoMode) {
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(250, 204, 21);
    } else {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(0, 0, 210, 40);
      doc.setTextColor(0, 0, 0);
    }
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(cityName.toUpperCase(), 15, 25);
    doc.setFontSize(10);
    if (!ecoMode) doc.setTextColor(255, 255, 255);
    else doc.setTextColor(0, 0, 0);
    doc.text("LISTAGEM DETALHADA DE ALUNOS - LOGÍSTICA", 15, 33);
    doc.text(now, 170, 20);

    let finalY = 50;

    // Tabela 1: Confirmados
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text("ALUNOS CONFIRMADOS", 15, finalY);
    
    const confirmedData = cityConfirmed.map(s => {
      const vendor = rawAllUsers.find(u => u.id === s.vendorId);
      return [s.name.toUpperCase(), vendor?.name || 'DESCONHECIDO', new Date(s.createdAt).toLocaleDateString('pt-BR')];
    });

    autoTable(doc, {
      startY: finalY + 5,
      head: [['NOME DO ALUNO', 'VENDEDOR', 'DATA DA VENDA']],
      body: confirmedData.length > 0 ? confirmedData : [['NENHUM ALUNO CONFIRMADO', '-', '-']],
      headStyles: { fillColor: ecoMode ? [240, 240, 240] : [250, 204, 21], textColor: [0, 0, 0] },
      styles: { fontSize: 8 },
    });

    finalY = (doc as any).lastAutoTable.finalY + 15;

    // Tabela 2: Desistentes
    doc.setFontSize(12);
    doc.text("ALUNOS DESISTENTES", 15, finalY);
    
    const desistentesData = cityDesistentes.map(s => {
      const vendor = rawAllUsers.find(u => u.id === s.vendorId);
      return [s.name.toUpperCase(), vendor?.name || 'DESCONHECIDO', new Date(s.createdAt).toLocaleDateString('pt-BR')];
    });

    autoTable(doc, {
      startY: finalY + 5,
      head: [['NOME DO ALUNO', 'VENDEDOR', 'DATA DA VENDA']],
      body: desistentesData.length > 0 ? desistentesData : [['NENHUMA DESISTÊNCIA REGISTRADA', '-', '-']],
      headStyles: { fillColor: ecoMode ? [230, 230, 230] : [239, 68, 68], textColor: ecoMode ? [0, 0, 0] : [255, 255, 255] },
      styles: { fontSize: 8 },
    });

    finalY = (doc as any).lastAutoTable.finalY + 15;

    // Tabela 3: Hospedagem
    doc.setFontSize(12);
    doc.text("LISTA DE HOSPEDAGEM", 15, finalY);
    
    const needsAccData = cityNeedsAcc.map(s => {
      const vendor = rawAllUsers.find(u => u.id === s.vendorId);
      return [s.name.toUpperCase(), vendor?.name || 'DESCONHECIDO', 'HOTEL INDICADO'];
    });

    autoTable(doc, {
      startY: finalY + 5,
      head: [['NOME DO ALUNO', 'VENDEDOR', 'LOCAL']],
      body: needsAccData.length > 0 ? needsAccData : [['NENHUM ALUNO PRECISA DE HOSPEDAGEM', '-', '-']],
      headStyles: { fillColor: ecoMode ? [230, 230, 230] : [2, 132, 199], textColor: ecoMode ? [0, 0, 0] : [255, 255, 255] },
      styles: { fontSize: 8 },
    });

    doc.save(`ALUNOS_${cityName.toUpperCase().replace(/\s+/g, '_')}_${ecoMode ? 'ECO_' : ''}${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const downloadCityStatsReport = (ecoMode = false) => {
    const doc = new jsPDF();
    
    // Header
    if (!ecoMode) {
      doc.setFillColor(34, 197, 94); // Green tint for logistics
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(0, 0, 210, 40);
      doc.setTextColor(0, 0, 0);
    }
    
    doc.setFontSize(22);
    doc.text("ESTATÍSTICAS POR CIDADE", 15, 20);
    doc.setFontSize(10);
    doc.text("RELATÓRIO DE LOGÍSTICA E TURMAS", 15, 30);
    doc.text(new Date().toLocaleDateString('pt-BR'), 170, 20);

    const tableData = (teamMetrics?.cityStats || []).map(s => [
      s.city.toUpperCase(),
      s.total,
      s.count,
      s.desistentes,
      s.lodging,
      `R$ ${s.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['CIDADE', 'ADICIONADOS', 'CONFIRMADOS', 'DESISTENTES', 'HOSPEDAGEM', 'TKT MÉDIO']],
      body: tableData,
      headStyles: { fillColor: ecoMode ? [240, 240, 240] : [34, 197, 94], textColor: ecoMode ? [0, 0, 0] : [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 7 },
      margin: { left: 15, right: 15 }
    });

    doc.save(`Estatisticas_Cidades_Opera_${ecoMode ? 'ECO_' : ''}${new Date().toISOString().split('T')[0]}.pdf`);
  };

  useEffect(() => {
    if (userProfile?.leadsCount !== undefined && !selectedSellerId) {
      setLocalLeadsInput(userProfile.leadsCount);
    }
  }, [userProfile?.leadsCount, selectedSellerId]);

  useEffect(() => {
    if (config?.travelCount !== undefined) {
      setLocalTravelCount(config.travelCount);
    }
  }, [config?.travelCount]);

  // Efeito para Salvar Leads Automaticamente (Debounced) - Para todos os vendedores e gerentes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentLeads = Number(localLeadsInput);
      if (isNaN(currentLeads)) return;

      if (selectedSellerId) {
        // Modo Gestor: salvando leads do vendedor selecionado (Apenas Gonçalves Gerente can edit others)
        if (isLucas || isOperaGoncalves) {
          const seller = sellersStats.find(s => s.id === selectedSellerId);
          if (seller && currentLeads !== seller.leadsCount) {
            updateSellerLeads(selectedSellerId, currentLeads);
          }
        }
      } else if (user && isPinVerified && !isSecretaria) {
        // Modo Vendedor/Gerente: salvando seus próprios leads
        if (currentLeads !== (userProfile?.leadsCount || 0)) {
          setIsSavingLeads(true);
          updateDoc(doc(db, 'users', user.uid), { leadsCount: currentLeads })
            .finally(() => setIsSavingLeads(false));
        }
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [localLeadsInput, selectedSellerId, user?.uid, isLucas, isOperaGoncalves, isSecretaria, userProfile?.leadsCount]);

  // Efeito para Salvar a Contagem de Viagens e Bônus de Turma Automaticamente (Debounced)
  useEffect(() => {
    if (!user) return;
    
    // Evita loop se os valores locais forem iguais aos do config carregado
    if (localTravelCount === config?.travelCount && JSON.stringify(classBonuses) === JSON.stringify(config?.classBonuses)) return;

    const timeoutId = setTimeout(() => {
      saveConfigToFirebase({ ...config, travelCount: localTravelCount, classBonuses });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [localTravelCount, classBonuses]);

  useEffect(() => {
    if (user && isPinVerified) {
      const namesToRedirect = ['Lucas', 'Amanda', 'Dani', 'Lucas Gonçalves'];
      if (namesToRedirect.includes(user.displayName || '')) {
        setActiveTab('turmas');
      }
    }
  }, [user, isPinVerified]);
  useEffect(() => {
    if (!user) {
      setSales([]);
      setTravelCount(0);
      setConfig(DEFAULT_SETTINGS);
      return;
    }

    // Vendas - Visão de Gestor vs Vendedor (Sincronizado para todos poderem ver o painel geral e mudar status de todos sem exceção)
    const salesRef = collection(db, 'sales');
    const salesQuery = (isGlobalManager || isSecretaria)
      ? query(salesRef)
      : query(salesRef, where('vendorId', '==', user.uid));

    const unsubSales = onSnapshot(salesQuery, (snap) => {
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setSales(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `sales`));

    // Configurações (Pessoais por vendedor ou Global para gestor)
    const configPath = isGlobalManager ? doc(db, 'settings', 'global') : doc(db, 'users', user.uid, 'configs', 'main');
    const unsubConfig = onSnapshot(configPath, (snap) => {
      let defaultWithGoals = isValiandro 
        ? { ...DEFAULT_SETTINGS, monthlyGoal: 297, yearlyGoal: 1850 }
        : DEFAULT_SETTINGS;

      if (isGlobalManager) {
        defaultWithGoals = { ...defaultWithGoals, baseSalary: 3000 };
      }

      if (snap.exists()) {
        const data = snap.data();
        const mergedBaseSalary = isGlobalManager && (data.baseSalary === 1600 || !data.baseSalary) ? 3000 : (data.baseSalary || defaultWithGoals.baseSalary);
        setConfig({ ...defaultWithGoals, ...data, baseSalary: mergedBaseSalary });
        if (!isGlobalManager && data.travelCount !== undefined) setTravelCount(data.travelCount);
        if (data.classBonuses !== undefined) setClassBonuses(data.classBonuses);
      } else {
        setConfig(defaultWithGoals);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, isGlobalManager ? 'settings/global' : `users/${user.uid}/configs/main`));

    // Perfil
    // A sincronização do perfil já é feita pelo listener principal de auth/profile no início do componente
    // para evitar redundância e garantir que userProfile esteja sempre atualizado.

    return () => {
      unsubSales();
      unsubConfig();
    };
  }, [user, isGestor]);

  // Persistência local (mantida para configs não sincronizadas se necessário, mas foco no Firebase agora)
  // Removido useEffect original de localStorage

  // --- LÓGICA DE PROJEÇÃO DE RITMO ---
  const projections = useMemo(() => {
    const now = new Date();
    const cutoff = new Date('2026-07-01T00:00:00Z');
    const isNewCycle = now >= cutoff;
    const activeMonth = isNewCycle ? 6 : now.getMonth();
    const activeYear = isNewCycle ? 2026 : now.getFullYear();
    const dayOfMonth = isNewCycle && now.getMonth() === 5 ? 1 : now.getDate();
    const totalDays = new Date(activeYear, activeMonth + 1, 0).getDate();
    
    // Para todos os vendedores e gerentes, as projeções consideram todas as vendas conjuntas
    const effectiveSales = displayedSales;
    
    const confirmedSales = effectiveSales.filter((s: any) => s.status === 'confirmado');
    const confirmedCount = confirmedSales.length;
    const rhythm = confirmedCount / (dayOfMonth || 1);
    const projectedCount = Math.round(rhythm * totalDays);
    
    const baseSalar = (isLucas || isOperaGoncalves)
      ? (Number(config?.baseSalary) === 1600 ? 3000 : (Number(config?.baseSalary) || 3000))
      : (Number(config?.baseSalary) || 1600);

    // Projeção de Comissões
    const commThreshold = Number(config?.commissionThreshold) || 10;
    const commValue = Number(config?.commissionValue) || 150;
    const commCount = Math.max(0, projectedCount - commThreshold);
    const projectedComm = commCount * commValue;
    
    // Projeção de Bônus Geral
    let projectedGenBonus = 0;
    if (projectedCount >= 35) projectedGenBonus = Number(config?.bonusGeneral35) || 1500;
    else if (projectedCount >= 25) projectedGenBonus = Number(config?.bonusGeneral25) || 1000;

    // Projeção de Viagens e Bônus Extra de Viagem
    const projectedTrips = Math.round(localTravelCount * (totalDays / (dayOfMonth || 1)));
    const tripValue = Number(config?.tripValue) || 400;
    const projectedTripsValue = projectedTrips * tripValue;

    // Projeção de Taxas por Cidade
    let projectedStudentsValue = 0;
    CITIES_LIST.forEach(city => {
      const cityConfirmed = confirmedSales.filter((s: any) => s.city === city).length;
      if (cityConfirmed > 0) {
        const projectedCityCount = Math.round((cityConfirmed / (dayOfMonth || 1)) * totalDays);
        let cityRate = 100;
        if (projectedCityCount >= 20) cityRate = Number(config?.studentRateHigh) || 200;
        else if (projectedCityCount >= 15) cityRate = Number(config?.studentRateMedium) || 150;
        else cityRate = Number(config?.studentRateLow) || 100;
        projectedStudentsValue += projectedCityCount * cityRate;
      }
    });

    const projectedSalary = baseSalar + projectedComm + projectedGenBonus + projectedTripsValue + projectedStudentsValue;

    const monthlyGoal = Number(config?.monthlyGoal) || 30;
    const goalGap = Math.max(0, monthlyGoal - projectedCount);
    const goalStatus = projectedCount >= monthlyGoal ? 'Batida' : 'Pendente';
    const goalPercentage = Math.min(100, (projectedCount / (monthlyGoal || 1)) * 100);

    return {
      rhythm: rhythm.toFixed(2),
      projectedCount,
      projectedSalary,
      projectedComm,
      projectedGenBonus,
      projectedTripsValue,
      projectedStudentsValue,
      percentOfMonth: (dayOfMonth / (totalDays || 1)) * 100,
      goalGap,
      goalStatus,
      goalPercentage
    };
  }, [displayedSales, config, localTravelCount]);

  // --- LÓGICA DE CÁLCULOS ---
  const totals = useMemo(() => {
    // Para todos os usuários com papel ativo de vendas, o resumo de comissões/metas considera todas as vendas conjuntas
    const effectiveSales = displayedSales;
    const now = new Date();

    const currentMonthSales = effectiveSales.filter(s => isCurrentMonthSale(s.createdAt));
    
    const currentYearSales = effectiveSales.filter(s => {
      const d = new Date(s.createdAt);
      return d.getFullYear() === now.getFullYear();
    });

    const totalEntries = currentMonthSales.length;
    const confirmedSales = currentMonthSales.filter((s: any) => s.status === 'confirmado');
    const yearlyConfirmedSales = currentYearSales.filter((s: any) => s.status === 'confirmado');
    
    const confirmedCount = confirmedSales.length + (userProfile?.manualSalesAdjust || 0);
    const yearlyConfirmedCount = yearlyConfirmedSales.length + (userProfile?.manualSalesAdjust || 0);
    
    const confirmedPresencial = confirmedSales.filter((s: any) => s.city !== 'EAD');
    const eadSales = confirmedSales.filter((s: any) => s.city === 'EAD');
    
    // REGRA CRÍTICA: Comissão (Taxas) somente a partir da 11ª venda CONFIRMADA
    const commThreshold = Number(config?.commissionThreshold) || 10;
    const commValue = Number(config?.commissionValue) || 150;
    const commissionableSales = Math.max(0, confirmedCount - commThreshold);
    const totalCommission = commissionableSales * commValue;

    const eadBonus = eadSales.length >= 15 ? (Number(config?.bonusEAD15) || 500) : 0;

    let generalBonus = 0;
    if (confirmedCount >= 35) generalBonus = Number(config?.bonusGeneral35) || 1500;
    else if (confirmedCount >= 25) generalBonus = Number(config?.bonusGeneral25) || 1000;

    const baseSalaryValue = (isLucas || isOperaGoncalves)
      ? (Number(config?.baseSalary) === 1600 ? 3000 : (Number(config?.baseSalary) || 3000))
      : (Number(config?.baseSalary) || 1600);
    const tripValue = Number(config?.tripValue) || 400;
    const tripsTotal = localTravelCount * tripValue;
    const bonusViagemValue = Number(config?.bonusViagem) || 0;
    const extraTripsBonus = localTravelCount > 0 ? bonusViagemValue : 0;
    
    // Bônus especial para operaformacao@gmail.com
    const isOperaEmail = user?.email === 'operaformacao@gmail.com' || user?.email === 'operaformacar@gmail.com';
    const classBonusesTotal = isOperaEmail 
      ? (classBonuses.filter(b => b).length * 1000) 
      : 0;

    // REGRA DE TAXA POR TURMA (CIDADE)
    const salesByCity = confirmedSales.reduce((acc: any, sale: any) => {
      if (sale.city === 'EAD') return acc;
      acc[sale.city] = (acc[sale.city] || 0) + 1;
      return acc;
    }, {});

    const rateLow = Number(config?.studentRateLow) || 100;
    const rateMed = Number(config?.studentRateMedium) || 150;
    const rateHigh = Number(config?.studentRateHigh) || 200;

    const studentsValue = Object.values(salesByCity).reduce((acc: number, count: any) => {
      const v = Number(count) || 0;
      if (v <= 14) return acc + (v * rateLow);
      if (v <= 19) return acc + (v * rateMed);
      return acc + (v * rateHigh);
    }, 0);

    const confirmedPresencialCount = confirmedPresencial.length;

    // Cálculo de Bônus Extras
    const extrasTotal = (config?.extraBonuses || []).reduce((acc: number, b: any) => acc + (Number(b.value) || 0), 0);

    const grandTotal = baseSalaryValue + totalCommission + tripsTotal + generalBonus + eadBonus + extraTripsBonus + extrasTotal + classBonusesTotal + studentsValue;

    const leadsCountProfile = Number(userProfile?.leadsCount);
    const realLeads = (localLeadsInput !== '' && !selectedSellerId) ? Number(localLeadsInput) : (leadsCountProfile || totalEntries);
    let conversionRate = realLeads > 0 ? (confirmedCount / (realLeads || 1)) * 100 : 0;

    if (isLucas || isOperaGoncalves) {
      const teamTotalLeads = sellersStats.reduce((sum, s) => sum + (s.leadsCount || 0), 0);
      const teamTotalConfirmed = sellersStats.reduce((sum, s) => sum + (s.confirmedCount || 0), 0);
      conversionRate = teamTotalLeads > 0 ? (teamTotalConfirmed / teamTotalLeads) * 100 : 0;
    }

    const totalRevenue = confirmedSales.reduce((acc: number, s: any) => acc + (Number(s.price) || 0), 0);
    const totalDiscount = confirmedSales.reduce((accSum: number, s: any) => {
      if (s.city === 'EAD') return accSum;
      const priceVal = Number(s.price) || 0;
      return accSum + Math.max(0, 1799 - priceVal);
    }, 0);

    const personalGoal = Number(userProfile?.personalGoal) || Number(config?.monthlyGoal) || 30;
    const personalGoalPercentage = personalGoal > 0 ? (confirmedCount / personalGoal) * 100 : 0;

    return {
      baseSalary: baseSalaryValue,
      commissionCount: commissionableSales,
      commission: totalCommission,
      eadBonus,
      generalBonus,
      tripsTotal,
      extraTripsBonus,
      studentsValue,
      extrasTotal,
      grandTotal,
      totalSalesCount: totalEntries,
      leadsCount: realLeads,
      confirmedCount,
      yearlyConfirmedCount,
      confirmedPresencialCount,
      eadCount: eadSales.length,
      revenue: totalRevenue,
      totalDiscount,
      conversionRate,
      personalGoal,
      personalGoalPercentage
    };
  }, [sales, displayedSales, isUserSale, localTravelCount, config, userProfile, localLeadsInput, selectedSellerId, classBonuses, user, isLucas, isOperaGoncalves, sellersStats]);

  const mySellerStats = useMemo(() => {
    if (!user) return null;
    return sellersStats.find(s => s.id === user.uid || (s.email && s.email.toLowerCase() === user.email?.toLowerCase()));
  }, [sellersStats, user]);

  const confirmedCountToDisplay = mySellerStats ? mySellerStats.confirmedCount : (totals?.confirmedCount || 0);
  const personalGoalToDisplay = mySellerStats ? (mySellerStats.personalGoal || totals?.personalGoal || 30) : (totals?.personalGoal || 30);
  const personalGoalPercentageToDisplay = personalGoalToDisplay > 0 ? (confirmedCountToDisplay / personalGoalToDisplay) * 100 : 0;
  const conversionRateToDisplay = mySellerStats ? mySellerStats.conversionRate : (totals?.conversionRate || 0);
  const totalDiscountToDisplay = mySellerStats ? mySellerStats.totalDiscount : (totals?.totalDiscount || 0);

  // --- FUNÇÕES CRUD & CONFIG ---
  const saveConfigToFirebase = async (newConfig: any) => {
    if (!user) return;
    setIsSavingConfig(true);
    try {
      if (isLucas || isOperaGoncalves) {
        await setDoc(doc(db, 'settings', 'global'), newConfig);
      } else {
        await setDoc(doc(db, 'users', user.uid, 'configs', 'main'), {
          ...newConfig,
          userId: user.uid
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, (isLucas || isOperaGoncalves) ? 'settings/global' : `users/${user.uid}/configs/main`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const addExtraBonus = () => {
    if (!extraBonusForm.label || !extraBonusForm.value) return alert("Preencha o nome e o valor do bônus!");
    const newConfig = {
      ...config,
      extraBonuses: [...(config.extraBonuses || []), { ...extraBonusForm, id: Date.now() }]
    };
    saveConfigToFirebase(newConfig);
    setExtraBonusForm({ label: '', value: 0 });
  };

  const removeExtraBonus = (id: number) => {
    const newConfig = {
      ...config,
      extraBonuses: config.extraBonuses.filter((b: any) => b.id !== id)
    };
    saveConfigToFirebase(newConfig);
  };

  const addSale = async () => {
    if (!user) return;
    if (!newSale.name) return alert("Digite o nome do aluno!");
    
    // Captura os dados antes de resetar para usar no addDoc
    const discount = (newSale.city !== 'EAD') ? Math.max(0, 1799 - (Number(newSale.price) || 0)) : 0;
    const saleData = { 
      ...newSale, 
      discount,
      vendorId: user.uid,
      vendorName: user.displayName || user.email?.split('@')[0],
      vendorEmail: user.email,
      createdAt: new Date().toISOString() 
    };

    // Reseta o form IMEDIATAMENTE para ser responsivo
    setNewSale({ 
      name: '', city: 'Curitiba', status: 'confirmado', price: 1799, needsAccommodation: false 
    });

    if (!navigator.onLine) {
      const tempId = 'temp_sale_' + generateId();
      setSyncQueue(prev => [...prev, {
        type: 'add_sale',
        id: tempId,
        data: saleData,
        createdAt: new Date().toISOString()
      }]);
      alert("Aparelho Offline: Venda salva localmente! Sincronizará automaticamente com o sistema assim que a conexão retornar.");
      return;
    }

    try {
      await addDoc(collection(db, 'sales'), saleData);
      
      // Notificar em tempo real (In-app) - apenas se não for gerente global
      if (!isGlobalManager) {
        pushNotification('all', 'Nova Venda!', `🔥 ${saleData.vendorName} acaba de confirmar uma venda em ${saleData.city}!`, 'sale');
      }
      
      // Notificar os Gerentes Globais via Push - apenas se não for gerente global
      if (!isGlobalManager) {
        notifyPush(
          ['lucas@opera.com', 'opera@gerente.com'],
          'Nova Venda!', 
          `${userProfile?.name || 'Vendedor'} registrou uma venda em ${saleData.city} para ${saleData.name}`,
          'resumo',
          'venda'
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `sales`);
    }
  };

  const registerExternalSale = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    
    let { vendorType, existingVendorId, newVendorName, studentName, city, price, needsAccommodation } = externalSaleForm;
    
    if (vendorType === 'new' && !newVendorName.trim()) {
      alert("Digite o nome do novo vendedor/consultor!");
      return;
    }
    if (vendorType === 'existing' && !existingVendorId) {
      alert("Selecione um vendedor existente na lista!");
      return;
    }
    if (!studentName.trim()) {
      alert("Digite o nome do aluno!");
      return;
    }
    
    const parsedPrice = Number(price) || 0;
    
    try {
      let finalVendorId = '';
      let finalVendorName = '';
      let finalVendorEmail = '';
      
      if (vendorType === 'new') {
        const nameTrimmed = newVendorName.trim();
        // Check if seller already exists case-insensitive
        const existingUser = allUsers.find(u => u.name && u.name.toLowerCase() === nameTrimmed.toLowerCase());
        
        if (existingUser) {
          finalVendorId = existingUser.id;
          finalVendorName = existingUser.name;
          finalVendorEmail = existingUser.email || '';
        } else {
          // Create new user in Firestore 'users' collection
          finalVendorId = 'ext_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          finalVendorName = nameTrimmed;
          finalVendorEmail = `${nameTrimmed.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '')}@opera.com`;
          
          await setDoc(doc(db, 'users', finalVendorId), {
            id: finalVendorId,
            name: finalVendorName,
            email: finalVendorEmail,
            role: 'vendedor',
            pin: '1234',
            leadsCount: 0,
            manualSalesAdjust: 0,
            createdAt: new Date().toISOString()
          });
          
          alert(`Consultor desprovido do app "${finalVendorName}" foi registrado e fixado na equipe com sucesso.`);
        }
      } else {
        const chosenUser = rawAllUsers.find(u => u.id === existingVendorId);
        if (!chosenUser) {
          alert("Vendedor selecionado inválido!");
          return;
        }
        finalVendorId = chosenUser.id;
        finalVendorName = chosenUser.name || chosenUser.displayName || chosenUser.email?.split('@')[0];
        finalVendorEmail = chosenUser.email || '';
      }
      
      const discountVal = (city !== 'EAD') ? Math.max(0, 1799 - parsedPrice) : 0;
      
      const saleData = {
        name: studentName.trim(),
        city,
        status: 'confirmado',
        price: parsedPrice,
        needsAccommodation: !!needsAccommodation,
        discount: discountVal,
        vendorId: finalVendorId,
        vendorName: finalVendorName,
        vendorEmail: finalVendorEmail,
        createdAt: new Date().toISOString(),
        hasContract: true
      };
      
      await addDoc(collection(db, 'sales'), saleData);
      
      alert(`Venda registrada com sucesso para o consultor ${finalVendorName}! Ela foi contabilizada em todas as métricas.`);
      
      // Reset form controls
      setExternalSaleForm({
        vendorType: 'existing',
        existingVendorId: '',
        newVendorName: '',
        studentName: '',
        city: 'Curitiba',
        price: '1799',
        needsAccommodation: false
      });
      setShowExternalSaleModal(false);
    } catch (err) {
      console.error("Erro ao registrar venda externa:", err);
      alert("Erro ao salvar no banco. Verifique sua conexão.");
    }
  };

  const deleteSale = async (id: string) => {
    if (!user) return;
    if (id.startsWith('temp_sale_')) {
      setSyncQueue(prev => prev.filter(x => x.id !== id));
      return;
    }
    if (!navigator.onLine) {
      setSyncQueue(prev => [...prev, {
        type: 'delete_sale',
        id: 'temp_del_' + generateId(),
        saleId: id,
        createdAt: new Date().toISOString()
      }]);
      alert("Remoção agendada! A venda será excluída do servidor quando você reestabelecer conexão.");
      return;
    }
    try {
      await deleteDoc(doc(db, 'sales', id));
      
      // Sincronizar exclusão com o contrato correspondente em background
      try {
        const q = query(collection(db, 'contracts'), where('saleId', '==', id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          for (const d of snap.docs) {
            await deleteDoc(doc(db, 'contracts', d.id));
          }
        }
      } catch (e) {
        console.warn("Falha ao remover contrato associado à venda excluída:", e);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sales/${id}`);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!isGestor && !isSecretaria) return;

    const sellerObj = rawAllUsers.find(u => u.id === userId);
    const sellerName = sellerObj?.name || 'Vendedor';
    const sellerEmail = sellerObj?.email?.toLowerCase().trim();

    if (!window.confirm(`Deseja realmente remover o vendedor ${sellerName}? Ele perderá o acesso e desaparecerá da equipe imediatamente.`)) return;

    setIsDeleting(true);
    try {
      // Optimistic update: remove from local state immediately
      if (rawAllUsers) {
        setRawAllUsers(prev => prev.filter(u => u.id !== userId));
      }
      if (selectedSellerId === userId) {
        setSelectedSellerId(null);
      }
      
      if (sellerEmail) {
        await setDoc(doc(db, 'revoked_users', sellerEmail), {
          email: sellerEmail,
          uid: userId,
          name: sellerName,
          revokedAt: new Date().toISOString()
        });
      }
      await setDoc(doc(db, 'revoked_users', userId), {
        email: sellerEmail || null,
        uid: userId,
        name: sellerName,
        revokedAt: new Date().toISOString()
      });

      // Deletar o documento da coleção 'users' definitivamente para que suma de todo o sistema
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (docErr) {
        console.warn("Erro ao deletar documento 'users' no deleteUser:", docErr);
      }

      alert("Vendedor removido com sucesso e seu acesso foi totalmente revogado!");
    } catch (err) {
      console.error("Erro ao deletar usuário:", err);
      alert("Erro ao remover usuário.");
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditing = (sale: any) => {
    setEditingId(sale.id);
    setEditFormData({ ...sale });
  };

  const saveEdit = async () => {
    if (!user || !editingId || !editFormData) return;
    
    const id = editingId;
    try {
      const discount = (editFormData.city !== 'EAD') ? Math.max(0, 1799 - (Number(editFormData.price) || 0)) : 0;
      const data = { ...editFormData, discount, updatedAt: new Date().toISOString() };

      // Limpa estado de edição imediatamente para resposta visual rápida
      setEditingId(null);
      setEditFormData(null);

      await updateDoc(doc(db, 'sales', id), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sales/${id}`);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'sales', id), { status });

      // Sincronizar mudança de status com o contrato correspondente em background
      try {
        const q = query(collection(db, 'contracts'), where('saleId', '==', id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          for (const d of snap.docs) {
            await updateDoc(doc(db, 'contracts', d.id), { status });
          }
        }
      } catch (e) {
        console.warn("Falha ao atualizar status do contrato associado:", e);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sales/${id}`);
    }
  };

  const updateSellerLeads = async (sellerId: string, leads: number) => {
    setIsSavingLeads(true);
    if (!navigator.onLine) {
      setSyncQueue(prev => [...prev, {
        type: 'update_leads',
        id: 'temp_leads_' + generateId(),
        sellerId,
        leads,
        createdAt: new Date().toISOString()
      }]);
      setIsSavingLeads(false);
      alert("Aparelho Offline: Quantidade de Leads foi salva localmente de forma 100% segura! Ela atualizará automaticamente no painel principal assim que o sinal de rede restabelecer.");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', sellerId), { leadsCount: leads });
    } catch (err) {
      console.error("Erro ao atualizar leads:", err);
      alert("Erro ao salvar leads.");
    } finally {
      setIsSavingLeads(false);
    }
  };

  const updateSellerManualSales = async (sellerId: string, manualCount: number) => {
    try {
      await updateDoc(doc(db, 'users', sellerId), { manualSalesAdjust: manualCount });
    } catch (err) {
      console.error("Erro ao atualizar vendas manuais:", err);
      alert("Erro ao salvar vendas.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetUserId?: string) => {
    const uid = targetUserId || user?.uid;
    if (!uid) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Permitir resolução maior para fotos nítidas (até 1000px)
          const MAX_RESOLUTION = 1000; 
          if (width > height) {
            if (width > MAX_RESOLUTION) {
              height *= MAX_RESOLUTION / width;
              width = MAX_RESOLUTION;
            }
          } else {
            if (height > MAX_RESOLUTION) {
              width *= MAX_RESOLUTION / height;
              height = MAX_RESOLUTION;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, width, height);
          
          let quality = 0.8; // Começar com boa qualidade
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // Loop de segurança: Se a string base64 for maior que 1MB (Firestore limit), 
          // vai reduzindo a qualidade gradualmente até caber.
          // 1MB = 1.048.576 bytes. Deixamos uma margem de segurança (900KB).
          while (dataUrl.length > 900000 && quality > 0.1) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          try {
            await updateDoc(doc(db, 'users', uid), { 
              profilePic: dataUrl,
              updatedAt: new Date().toISOString()
            });
            alert("Sua foto foi salva e agora está permanente no sistema!");
          } catch (err) {
            console.error("Erro ao salvar foto de perfil:", err);
            // Se ainda assim der erro de tamanho, tentar compressão máxima
            try {
              const extremeUrl = canvas.toDataURL('image/jpeg', 0.1);
              await updateDoc(doc(db, 'users', uid), { 
                profilePic: extremeUrl,
                updatedAt: new Date().toISOString()
              });
              alert("Foto salva com compressão automática para caber no banco de dados.");
            } catch (retryErr) {
              handleFirestoreError(retryErr, OperationType.WRITE, `users/${uid}`);
              alert("Erro crítico: A imagem é grande demais para o sistema, tente outra foto.");
            }
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const exportCSV = () => {
    const headers = ["ID", "Nome", "Cidade", "Valor", "Status", "Hospedagem", "Data"];
    const rows = displayedSales.map((s: any) => [
      s.id, s.name, s.city, s.price, s.status, s.needsAccommodation ? "SIM" : "NÃO",
      new Date(s.createdAt || s.id).toLocaleDateString()
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vendas_opera_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const printMonthlyVendorReport = () => {
    const doc = new jsPDF();
    const now = new Date();
    
    // Filter to ensure we only get current user's sales of the active month
    const userSalesOfThisMonth = displayedSales.filter(s => {
      if (s.isLocalPending) return true; // keep pending
      if (!s.createdAt) return true;
      const d = new Date(s.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && isUserSale(s);
    });

    const confirmedSales = userSalesOfThisMonth.filter(s => s.status === 'confirmado');
    const totalSalesCount = confirmedSales.length;

    // Calculate total discount
    const totalDiscount = confirmedSales.reduce((accSum, s) => {
      if (s.city === 'EAD') return accSum;
      const priceVal = Number(s.price) || 0;
      return accSum + Math.max(0, 1799 - priceVal);
    }, 0);

    const leadsCountProfile = Number(userProfile?.leadsCount);
    const realLeads = (localLeadsInput !== '' && !selectedSellerId) ? Number(localLeadsInput) : (leadsCountProfile || userSalesOfThisMonth.length);
    const conversionRate = realLeads > 0 ? (totalSalesCount / realLeads) * 100 : 0;

    const personalGoal = Number(userProfile?.personalGoal) || Number(config?.monthlyGoal) || 30;
    const personalGoalPercentage = personalGoal > 0 ? (totalSalesCount / personalGoal) * 100 : 0;
    const totalRevenue = confirmedSales.reduce((acc, s) => acc + (Number(s.price) || 0), 0);

    // Header styling - Elegant Black and Gold
    doc.setFillColor(18, 18, 18);
    doc.rect(0, 0, 210, 42, 'F');
    
    doc.setTextColor(250, 204, 21); // Yellow/Gold
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("OPERA FORMAÇÃO", 15, 20);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text("RELATÓRIO DE VENDAS DO MÊS - CONSULTOR", 15, 30);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 15, 36);

    // Vendor info box (right side of header)
    doc.setFont("helvetica", "bold");
    doc.text((userProfile?.name || user?.displayName || 'Vendedor').toUpperCase(), 135, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text(`E-mail: ${user?.email || ''}`, 135, 26);
    doc.text(`Portal do Vendedor • Impresso via App`, 135, 32);

    // Stats Grid - Cards using boxes
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(250, 250, 250);
    
    // Card 1: Vendas
    doc.rect(15, 50, 42, 28, 'FD');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("VENDAS CONFIRMADAS", 20, 56);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text(`${totalSalesCount}`, 20, 68);

    // Card 2: Desconto
    doc.rect(62, 50, 42, 28, 'FD');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text("DESCONTO CONCEDIDO", 67, 56);
    doc.setTextColor(220, 38, 38); // Red for discounts
    doc.setFontSize(12);
    doc.text(`R$ ${totalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 67, 68);

    // Card 3: Conversão %
    doc.rect(109, 50, 42, 28, 'FD');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text("TAXA CONVERSÃO", 114, 56);
    doc.setTextColor(37, 99, 235); // Blue
    doc.setFontSize(14);
    doc.text(`${conversionRate.toFixed(1)}%`, 114, 68);

    // Card 4: Meta Batida
    doc.rect(156, 50, 39, 28, 'FD');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text("META DO MÊS", 161, 56);
    doc.setTextColor(22, 163, 74); // Green
    doc.setFontSize(11);
    doc.text(`${personalGoalPercentage.toFixed(0)}% (${totalSalesCount}/${personalGoal})`, 161, 68);

    // Table of sales
    const tableData = userSalesOfThisMonth.map((s, idx) => {
      const priceVal = Number(s.price) || 0;
      const discountVal = s.city === 'EAD' ? 0 : Math.max(0, 1799 - priceVal);
      return [
        (idx + 1).toString(),
        s.name.toUpperCase(),
        s.city.toUpperCase(),
        `R$ ${priceVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${discountVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        s.status.toUpperCase(),
        new Date(s.createdAt).toLocaleDateString('pt-BR')
      ];
    });

    autoTable(doc, {
      startY: 85,
      head: [['Nº', 'ALUNO', 'CIDADE', 'VALOR PAGO', 'DESCONTO', 'STATUS', 'DATA']],
      body: tableData,
      headStyles: { 
        fillColor: [18, 18, 18], 
        textColor: [250, 204, 21], 
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left'
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { fontStyle: 'bold' },
        3: { halign: 'left' },
        4: { halign: 'left' }
      },
      margin: { left: 15, right: 15 }
    });

    // Summary of total revenues at the end
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, finalY, 195, finalY);

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(`Total de alunos no relatório: ${userSalesOfThisMonth.length}`, 15, finalY + 8);
    doc.text(`Faturamento líquido gerado: R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 15, finalY + 14);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Assinatura do Consultor:", 120, finalY + 8);
    doc.line(120, finalY + 20, 195, finalY + 20);

    // Open in new window/tab for instant printing
    const pdfUrl = doc.output('bloburl');
    window.open(pdfUrl, '_blank');
  };

  const generatePDFReport = (type: 'all' | 'month' | 'week', ecoMode = false) => {
    const doc = new jsPDF();
    const now = new Date();
    
    let filteredSales = displayedSales;
    let title = "Relatório de Vendas";
    
    if (type === 'all') {
      title = "Tudo até o Momento";
      filteredSales = displayedSales;
    } else if (type === 'month') {
      title = "Vendas do Mês";
      filteredSales = displayedSales.filter(s => isCurrentMonthSale(s.createdAt));
    } else {
      title = "Vendas da Semana";
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
      startOfWeek.setHours(0,0,0,0);
      
      filteredSales = displayedSales.filter(s => {
        const date = new Date(s.createdAt);
        return date >= startOfWeek;
      });
    }

    // Header
    if (!ecoMode) {
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(250, 204, 21);
    } else {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(0, 0, 210, 40);
      doc.setTextColor(0, 0, 0);
    }
    
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    
    if (!ecoMode) doc.setTextColor(255, 255, 255);
    else doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(title.toUpperCase(), 15, 30);
    doc.text(new Date().toLocaleDateString('pt-BR'), 170, 20);

    const tableData = filteredSales.map(s => [
      s.name.toUpperCase(),
      s.city.toUpperCase(),
      `R$ ${Number(s.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      s.status.toUpperCase(),
      s.needsAccommodation ? "SIM" : "NÃO",
      new Date(s.createdAt).toLocaleDateString('pt-BR')
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['ALUNO', 'CIDADE', 'VALOR', 'STATUS', 'HOSP.', 'DATA']],
      body: tableData,
      headStyles: { fillColor: ecoMode ? [240, 240, 240] : [250, 204, 21], textColor: [0, 0, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { fontSize: 8 },
      margin: { left: 15, right: 15 }
    });

    if (!ecoMode) {
      // Abrir em nova aba para visualização imediata
      const pdfUrl = doc.output('bloburl');
      window.open(pdfUrl, '_blank');
    } else {
      doc.save(`Relatorio_${title.replace(/\s+/g, '_')}_ECO_${new Date().toISOString().split('T')[0]}.pdf`);
    }
  };

  const generateContractPDF = async (externalData?: any, skipSave = false, ecoMode = false) => {
    const f = {
      consultant: (externalData?.consultant || contractForm.consultant || '').toString(),
      clientName: (externalData?.clientName || contractForm.clientName || '').toString(),
      clientCpf: (externalData?.clientCpf || contractForm.clientCpf || '').toString(),
      clientRg: (externalData?.clientRg || contractForm.clientRg || '').toString(),
      clientBirthDate: (externalData?.clientBirthDate || contractForm.clientBirthDate || '').toString(),
      clientPhone: (externalData?.clientPhone || contractForm.clientPhone || '').toString(),
      recado1Phone: (externalData?.recado1Phone || contractForm.recado1Phone || '').toString(),
      recado1Nome: (externalData?.recado1Nome || contractForm.recado1Nome || '').toString(),
      recado1Grau: (externalData?.recado1Grau || contractForm.recado1Grau || '').toString(),
      recado2Phone: (externalData?.recado2Phone || contractForm.recado2Phone || '').toString(),
      recado2Nome: (externalData?.recado2Nome || contractForm.recado2Nome || '').toString(),
      recado2Grau: (externalData?.recado2Grau || contractForm.recado2Grau || '').toString(),
      rua: (externalData?.rua || contractForm.rua || '').toString(),
      numero: (externalData?.numero || contractForm.numero || '').toString(),
      bairro: (externalData?.bairro || contractForm.bairro || '').toString(),
      cidade: (externalData?.cidade || contractForm.cidade || '').toString(),
      estado: (externalData?.estado || contractForm.estado || '').toString(),
      cep: (externalData?.cep || contractForm.cep || '').toString(),
      courseType: (externalData?.courseType || contractForm.courseType || '').toString(),
      courseModality: (externalData?.courseModality || contractForm.courseModality || '').toString(),
      certificateType: (externalData?.certificateType || contractForm.certificateType || '').toString(),
      courseDate: (externalData?.courseDate || contractForm.courseDate || '').toString(),
      courseCity: (externalData?.courseCity || contractForm.courseCity || '').toString(),
      mainModality: (externalData?.mainModality || contractForm.mainModality || '').toString(),
      totalValue: (externalData?.totalValue || contractForm.totalValue || '0').toString(),
      matriculaValue: (externalData?.matriculaValue || contractForm.matriculaValue || '0').toString(),
      remainderValue: (externalData?.remainderValue || contractForm.remainderValue || '0').toString(),
      needsLodging: (externalData?.needsLodging || contractForm.needsLodging || 'NÃO').toString(),
      observations: (externalData?.observations || contractForm.observations || '').toString(),
    };

    // Se for a Secretaria imprimindo, marcar como impresso no banco
    if (isSecretaria && externalData?.id) {
      try {
        const contractRef = doc(db, 'contracts', externalData.id);
        await updateDoc(contractRef, { isPrinted: true });
      } catch (err) {
        console.error("Erro ao marcar como impresso:", err);
      }
    }

    const pdfDoc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const marginX = 20;
    let y = 20;

    // --- PÁGINA 1: CABEÇALHO E DADOS ---
    pdfDoc.setFontSize(28);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text("CONTRATO", marginX, y);
    y += 10;
    pdfDoc.setFontSize(14);
    pdfDoc.text("PRESTAÇÃO DE SERVIÇO", marginX, y);
    
    y += 15;
    if (!ecoMode) {
      pdfDoc.setFillColor(0, 0, 0);
      pdfDoc.rect(marginX, y, 40, 6, 'F');
      pdfDoc.setTextColor(255, 255, 255);
    } else {
      pdfDoc.setTextColor(0, 0, 0);
      pdfDoc.rect(marginX, y, 40, 6);
    }
    pdfDoc.setFontSize(10);
    pdfDoc.text("CONSULTOR:", marginX + 2, y + 4.5);
    y += 10;
    pdfDoc.setTextColor(0, 0, 0);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.text(`Nome: ${f.consultant.toUpperCase() || 'NÃO INFORMADO'}`, marginX, y);
    
    y += 10;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text(`MODALIDADE: ( ${f.mainModality === 'Reciclagem' ? 'X' : ' '} ) RECICLAGEM   ( ${f.mainModality === 'Presencial' ? 'X' : ' '} ) PRESENCIAL`, 60, y);
    
    y += 10;
    if (!ecoMode) {
      pdfDoc.setFillColor(0, 0, 0);
      pdfDoc.rect(marginX, y, 40, 6, 'F');
      pdfDoc.setTextColor(255, 255, 255);
    } else {
      pdfDoc.setTextColor(0, 0, 0);
      pdfDoc.rect(marginX, y, 40, 6);
    }
    pdfDoc.text("CONTRATANTE:", marginX + 2, y + 4.5);
    y += 10;
    pdfDoc.setTextColor(0, 0, 0);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.text(`Nome: ${f.clientName.toUpperCase() || 'NÃO INFORMADO'}`, marginX, y);
    y += 8;
    pdfDoc.text(`CPF: ${f.clientCpf || 'NÃO INFORMADO'}`, marginX, y);
    pdfDoc.text(`RG: ${f.clientRg || 'XXXX'}`, 100, y);
    y += 8;
    pdfDoc.text(`Data de Nascimento: ${f.clientBirthDate || 'NÃO INFORMADA'}`, marginX, y);
    y += 8;
    pdfDoc.text(`Telefone: ${f.clientPhone || 'NÃO INFORMADO'}`, marginX, y);
    y += 8;
    pdfDoc.text(`RECADO 1°: ${f.recado1Phone || 'N/A'}`, marginX, y);
    pdfDoc.text(`NOME: ${f.recado1Nome || 'N/A'}`, 90, y);
    pdfDoc.text(`GRAU: ${f.recado1Grau || 'N/A'}`, 150, y);
    y += 8;
    pdfDoc.text(`RECADO 2°: ${f.recado2Phone || 'N/A'}`, marginX, y);
    pdfDoc.text(`NOME: ${f.recado2Nome || 'N/A'}`, 90, y);
    pdfDoc.text(`GRAU: ${f.recado2Grau || 'N/A'}`, 150, y);
    y += 8;
    pdfDoc.text(`Rua: ${f.rua.toUpperCase() || 'N/A'}`, marginX, y);
    y += 8;
    pdfDoc.text(`Cidade: ${f.cidade.toUpperCase() || 'N/A'}`, marginX, y);
    pdfDoc.text(`Estado: ${f.estado.toUpperCase() || 'N/A'}`, 100, y);
    pdfDoc.text(`CEP: ${f.cep || 'N/A'}`, 140, y);

    // Normalizações robustas para marcação de Curso e Modalidade
    const normalizedCourseType = (f.courseType || '').trim().toLowerCase();
    const isPesadas = normalizedCourseType.includes('pesada');
    const isAgricolas = normalizedCourseType.includes('agrícola') || normalizedCourseType.includes('agricola');
    const isMunck = normalizedCourseType.includes('munck');
    const isEmpilhadeira = normalizedCourseType.includes('empilhadeira');
    const isFlorestais = normalizedCourseType.includes('florestal') || normalizedCourseType.includes('florestais');

    const normalizedMainModality = (f.mainModality || '').trim().toLowerCase();
    const normalizedCourseModality = (f.courseModality || '').trim().toLowerCase();

    const isReciclagemCheck = normalizedMainModality === 'reciclagem';
    const isEadCheck = normalizedCourseModality === 'ead';
    const isPresencialCheck = normalizedCourseModality === 'presencial' || normalizedMainModality === 'presencial';

    y += 12;
    if (!ecoMode) {
      pdfDoc.setFillColor(0, 0, 0);
      pdfDoc.rect(marginX, y, 45, 6, 'F');
      pdfDoc.setTextColor(255, 255, 255);
    } else {
      pdfDoc.setTextColor(0, 0, 0);
      pdfDoc.rect(marginX, y, 45, 6);
    }
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text("CURSO CONTRATADO:", marginX + 2, y + 4.5);
    y += 10;
    pdfDoc.setTextColor(0, 0, 0);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.text(`Formação:  ( ${isPesadas ? 'X' : ' '} ) Máquinas Pesadas   ( ${isAgricolas ? 'X' : ' '} ) Máquinas Agrícolas ( ${isMunck ? 'X' : ' '} ) Munck`, marginX, y);
    y += 6;
    pdfDoc.text(`( ${isEmpilhadeira ? 'X' : ' '} ) Empilhadeira   ( ${isFlorestais ? 'X' : ' '} ) Florestais`, marginX + 20, y);
    y += 8;
    pdfDoc.text(`Modalidade:  ( ${isEadCheck ? 'X' : ' '} ) EAD   ( ${isPresencialCheck && !isEadCheck ? 'X' : ' '} ) Presencial`, marginX, y);
    pdfDoc.text(`Cidade do curso: ${f.courseCity.toUpperCase() || 'NÃO INFORMADO'}`, 110, y);
    y += 8;
    pdfDoc.text(`Certificado:  ( ${f.certificateType === 'Tradicional' ? 'X' : ' '} ) Tradicional   ( ${f.certificateType === 'Premium' ? 'X' : ' '} ) Premium`, marginX, y);
    pdfDoc.text(`Data do curso: ${f.courseDate || 'NÃO INFORMADO'}`, 110, y);

    y += 12;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text("VALOR DO CONTRATO E OPÇÃO DE PAGAMENTO", pdfDoc.internal.pageSize.width / 2, y, { align: 'center' });
    y += 6;
    pdfDoc.setFontSize(8);
    pdfDoc.setFont("helvetica", "normal");
    const disclaimer = "Em contraprestação e pagamento dos serviços educacionais, em conformidade com o artigo 1º, § 1º e § 3º da Lei 9.870/99, a CONTRATANTE pagará a CONTRATADA o valor e condições abaixo especificados.";
    pdfDoc.text(pdfDoc.splitTextToSize(disclaimer, 170), marginX, y);
    y += 12;
    pdfDoc.setFontSize(10);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text(`Matrícula - Valor pago: R$ ${f.matriculaValue}`, marginX, y);
    y += 8;
    pdfDoc.text(`Valor à PAGAR à VISTA: R$ ${f.remainderValue}`, marginX, y);
    
    y += 10;
    pdfDoc.text(`Em caso de PARCELAMENTO em até 12 (doze) vezes no CARTÃO DE CRÉDITO, com acréscimo das taxas (JUROS) da operadora de cartão, utilizando o limite disponível do cartão.`, marginX, y, { maxWidth: 170 });
    
    y += 10;
    pdfDoc.text(`Aluno necessita de Hospedagem? ( ${f.needsLodging === 'SIM' ? 'X' : ' '} ) SIM   ( ${f.needsLodging === 'NÃO' ? 'X' : ' '} ) NÃO`, marginX, y);

    y += 12;
    pdfDoc.setFillColor(200, 200, 200);
    pdfDoc.rect(marginX, y, 170, 20, 'F');
    pdfDoc.setTextColor(0, 0, 0);
    pdfDoc.text("OBSERVAÇÕES:", marginX + 5, y + 8);
    pdfDoc.setFont("helvetica", "normal");
    const cleanObs = (f.observations || "").replace(/(https?:\/\/[^\s]+)/g, "").trim();
    pdfDoc.text(cleanObs, marginX + 5, y + 14);

    // --- PÁGINA 2: CLÁUSULAS ---
    pdfDoc.addPage();
    y = 20;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(12);
    pdfDoc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS", pdfDoc.internal.pageSize.width / 2, y, { align: 'center' });
    y += 10;
    pdfDoc.text("CLÁUSULA 1 – OBJETO", marginX, y);
    y += 6;
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(10);
    const clauses2 = [
      "1.1. O presente contrato tem por objeto a prestação de serviços educacionais pela CONTRATADA ao CONTRATANTE, através do seguinte curso:",
      `• Curso: ( ${isPesadas ? 'X' : ' '} ) PESADAS   ( ${isAgricolas ? 'X' : ' '} ) AGRÍCOLAS   ( ${isMunck ? 'X' : ' '} ) MUNCK   ( ${isEmpilhadeira ? 'X' : ' '} ) EMPILHADEIRA   ( ${isFlorestais ? 'X' : ' '} ) FLORESTAIS`,
      `• Modalidade: ( ${isReciclagemCheck ? 'X' : ' '} ) RECICLAGEM   ( ${isEadCheck ? 'X' : ' '} ) EAD   ( ${isPresencialCheck && !isReciclagemCheck && !isEadCheck ? 'X' : ' '} ) PRESENCIAL`,
      "• Período de acesso à plataforma (EAD): 180 (cento e oitenta) dias",
      "• Conteúdo programático:",
      "     o Normas Regulamentadoras (NR 6, NR 7, NR 12, NR 18, NR 22, NR 26, NR 28, NR 31)",
      "     o Checklist Operacional de Máquinas",
      `     o Fundamentos e Teorias de ${f.courseType || 'Máquinas Pesadas'}`,
      "1.2. Ao término e mediante cumprimento das obrigações acadêmicas e financeiras, será emitido Certificado de Conclusão.",
      "",
      "CLÁUSULA 2 – MATRÍCULA E ACESSO",
      "2.1. A matrícula se dará mediante o envio, por WhatsApp ou outro meio digital acordado, do comprovante de pagamento da taxa de inscrição e da documentação solicitada (RG, CPF e outros que forem necessários). Após o envio da documentação e da taxa de inscrição, o aluno estará devidamente matriculado, declarando estar ciente e de acordo com todos os termos deste contrato.",
      "2.2. A efetivação da matrícula implica plena aceitação de todas as cláusulas deste contrato.",
      "2.3. O acesso ao material será concedido em até 8 (oito) dias úteis após a confirmação do pagamento.",
      "",
      "CLÁUSULA 3 – PAGAMENTO",
      "3.1. O curso poderá ser pago por meio de:",
      "( ) PIX   ( ) DINHEIRO   ( ) CARTÃO DE CRÉDITO   ( ) CARTÃO DE DÉBITO.",
      "Caso o pagamento seja realizado no cartão de crédito, haverá acréscimo referente às taxas/juros da operadora de cartão, resultando em valor total superior ao pagamento à vista.",
      "3.2. O não pagamento poderá acarretar:",
      "• Suspensão de acesso ao curso;",
      "• Recusa de emissão de certificado;",
      "• Inclusão do nome do CONTRATANTE nos órgãos de proteção ao crédito (SPC/Serasa) e protesto em cartório;",
      "• Cobrança judicial ou extrajudicial do débito.",
      "3.3. A solicitação de documentação adicional (2° VIA, profissional ou de reciclagem) implicará em cobrança adicional, conforme acordado previamente com a CONTRATADA."
    ];
    clauses2.forEach(line => {
      if (line.startsWith("CLÁUSULA")) pdfDoc.setFont("helvetica", "bold");
      else pdfDoc.setFont("helvetica", "normal");
      const lines = pdfDoc.splitTextToSize(line, 170);
      pdfDoc.text(lines, marginX, y);
      y += (lines.length * 5) + 1;
    });

    // --- PÁGINA 3: CONTINUAÇÃO CLÁUSULAS ---
    pdfDoc.addPage();
    y = 20;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text("CLÁUSULA 4 – CANCELAMENTO, DESISTÊNCIA E DIREITO DE ARREPENDIMENTO", marginX, y);
    y += 10;
    pdfDoc.setFont("helvetica", "normal");
    const clauses3 = [
      "4.1. Cursos Presenciais:",
      "• O envio do comprovante e documentos caracteriza contratação irretratável.",
      "• O NÃO COMPARECIMENTO, sem a apresentação de atestado médico emitido em nome do aluno, implicará em multa de R$ 380,00 (trezentos e oitenta reais), a ser paga em até 5 (cinco) dias úteis após a data do curso.",
      "Atestados de terceiros não serão aceitos para fins de isenção da multa.",
      "Cursos EAD:",
      "• Caso a contratação tenha ocorrido fora do estabelecimento físico, o CONTRATANTE poderá exercer o direito de arrependimento em até 7 (sete) dias corridos, com reembolso integral.",
      "• Após este prazo, não haverá reembolso de valores, pois o curso e acesso à plataforma já foram disponibilizados.",
      "4.3. A não realização da prova em até 90 (noventa) dias será considerada desistência, com perda dos valores pagos e sem direito à emissão de certificado.",
      "",
      "CLÁUSULA 5 – OBRIGAÇÕES DO CONTRATANTE",
      "5.1. O CONTRATANTE declara:",
      "• Ser operador de máquinas (no caso de cursos de reciclagem);",
      "• Estar ciente das normas de segurança e do uso obrigatório de EPIs;",
      "• Ser responsável por qualquer infração ou dano decorrente do descumprimento dessas normas.",
      "5.2. O CONTRATANTE compromete-se a comparecer nas datas definidas (para cursos presenciais) e realizar as atividades avaliativas obrigatórias.",
      "",
      "CLÁUSULA 6 – RESCISÃO CONTRATUAL",
      "6.1. A CONTRATADA poderá rescindir o contrato em caso de inadimplência ou descumprimento das obrigações contratuais.",
      "6.2. O CONTRATANTE poderá solicitar a rescisão com aviso prévio de 30 dias, desde que não tenha acessado o curso ou solicitado emissão de documentos.",
      "",
      "CLÁUSULA 7 – RESPONSABILIDADE SOBRE CONDIÇÕES DE SAÚDE",
      "O(a) ALUNO(a) declara, sob sua exclusiva responsabilidade, estar em plenas condições físicas e de saúde para participar das atividades práticas do curso, que envolvem a operação de máquinas e equipamentos pesados. Reconhece que eventuais doenças ou condições médicas pré-existentes, tais como epilepsia, labirintite, problemas cardíacos, ortopédicos, psicológicos ou outras que possam comprometer sua segurança ou a de terceiros, são de sua inteira responsabilidade, comprometendo-se a informar previamente à ESCOLA qualquer limitação que possa afetar sua participação, isentando-a de responsabilidade por omissões ou consequências decorrentes."
    ];
    clauses3.forEach(line => {
      if (line.startsWith("CLÁUSULA")) pdfDoc.setFont("helvetica", "bold");
      else pdfDoc.setFont("helvetica", "normal");
      const lines = pdfDoc.splitTextToSize(line, 170);
      pdfDoc.text(lines, marginX, y);
      y += (lines.length * 5) + 1;
    });

    // --- PÁGINA 4: FINALIZAÇÃO ---
    pdfDoc.addPage();
    y = 20;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text("CLÁUSULA 8 – ALIMENTAÇÃO E HOSPEDAGEM", marginX, y);
    y += 10;
    pdfDoc.setFont("helvetica", "normal");
    const clauses4 = [
      "A ESCOLA se responsabiliza por fornecer ao(a) ALUNO(a), durante a realização das aulas práticas, CAFÉ DA MANHÃ E ALMOÇO, sem custo adicional. Qualquer outra despesa com alimentação, bebidas ou necessidades pessoais será de inteira responsabilidade do(a) ALUNO(a). O(a) ALUNO(a) declara estar ciente de que a ESCOLA não se responsabiliza por eventuais efeitos adversos que os alimentos fornecidos possam causar em seu organismo, incluindo, mas não se limitando a reações alérgicas, intolerâncias, desconfortos ou quaisquer outras condições de saúde decorrentes do consumo.",
      "8.1– HOSPEDAGEM",
      "A ESCOLA disponibiliza hospedagem ao(à) ALUNO(a) durante o período do curso, AOS QUE SÃO DE FORA DA CIDADE, em estabelecimento previamente indicado, sem custo adicional. O check-in deverá ser realizado na sexta-feira e o checkout no domingo pela manhã, respeitando os horários estabelecidos pelo local de hospedagem.",
      "O(a) ALUNO(a) declara estar ciente de que:",
      "a) A ESCOLA não se responsabiliza pela guarda, extravio, perda ou dano de objetos e pertences pessoais durante a estadia;",
      "b) Qualquer consumo adicional realizado no local de hospedagem (como frigobar, refeições, serviços, telefonia, lavanderia, entre outros) será de inteira responsabilidade e custeado pelo(a) ALUNO(a).",
      "",
      "CLÁUSULA 9 – PROTEÇÃO DE DADOS (LGPD)",
      "9.1. O CONTRATANTE autoriza o tratamento de seus dados pessoais para execução do presente contrato, nos termos da Lei nº 13.709/2018.",
      "9.2. Os dados serão utilizados exclusivamente para fins educacionais, administrativos e legais, sendo assegurado o direito de acesso, correção ou exclusão mediante solicitação por e-mail: operaformacao@gmail.com.",
      "",
      "CLÁUSULA 10 – DISPOSIÇÕES FINAIS",
      "10.2. Foro: Para cursos EAD ou firmados eletronicamente, fica eleito o foro do domicílio do CONTRATANTE. Para cursos presenciais realizados em Itajaí/SC, prevalecerá o foro da sede da CONTRATADA.",
      "10.3. Ao assinar (ou enviar documentação e pagamento), o CONTRATANTE declara ter lido e aceitado todos os termos."
    ];
    clauses4.forEach(line => {
      if (line.startsWith("CLÁUSULA") || line.startsWith("8.1")) pdfDoc.setFont("helvetica", "bold");
      else pdfDoc.setFont("helvetica", "normal");
      const lines = pdfDoc.splitTextToSize(line, 170);
      pdfDoc.text(lines, marginX, y);
      y += (lines.length * 5) + 1;
    });

    y += 10;
    const today = new Date();
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    pdfDoc.text(`Itajaí/SC, ${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}`, marginX, y);

    y += 20;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text("CONTRATADA:", marginX, y);
    y += 8;
    pdfDoc.text("Opera Formação CNPJ: 58.349.569/0001-47", marginX, y);
    y += 5;
    pdfDoc.text("Representante legal: VALIANDRO BOCK (DIRETOR EXECUTIVO)", marginX, y);
    
    y += 20;
    pdfDoc.text("CONTRATANTE:", marginX, y);
    y += 8;
    pdfDoc.text(`NOME: ${f.clientName.toUpperCase() || 'NÃO INFORMADO'}`, marginX, y);
    y += 8;
    pdfDoc.text(`CPF: ${f.clientCpf || 'NÃO INFORMADO'}`, marginX, y);

    // Adicionar o termo do script de multa colado embaixo no PDF
    y += 12;
    pdfDoc.setFillColor(245, 245, 245);
    pdfDoc.rect(marginX - 2, y, 174, 42, 'F');
    pdfDoc.setDrawColor(200, 200, 200);
    pdfDoc.rect(marginX - 2, y, 174, 42);
    
    y += 5;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(9);
    pdfDoc.setTextColor(0, 0, 0);
    pdfDoc.text("CONFIRMAÇÃO DOS DADOS E CIÊNCIA DO REGULAMENTO (TERMO DE MULTA)", marginX, y);
    
    y += 5;
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(8);
    pdfDoc.text(`NOME COMPLETO: ${f.clientName.toUpperCase()}`, marginX, y);
    y += 4;
    pdfDoc.text(`VALOR A SER PAGO NO PRIMEIRO DIA DE TREINAMENTO: R$ ${f.remainderValue} (No primeiro dia, em: ${f.courseDate})`, marginX, y);
    y += 4;
    
    const fineText = `TERMO DE MULTA E NÃO COMPARECIMENTO: Caso você não compareça no primeiro dia de aula (${f.courseDate}) sem aviso prévio de desistência, haverá uma multa rescisória e indenizatória por custos de logística de vaga no valor de R$ 380,00 por quebra de contrato.`;
    const fineLines = pdfDoc.splitTextToSize(fineText, 170);
    pdfDoc.text(fineLines, marginX, y);
    y += (fineLines.length * 3.8) + 1.5;
    
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text("FAVOR RESPONDER A MENSAGEM DO WHATSAPP COM UM \"OK\" CONFIRMANDO A MATRÍCULA.", marginX, y);

    const safeName = f.clientName.trim() ? f.clientName.replace(/\s+/g, '_').toUpperCase() : 'ALUNO';
    const fileName = `CONTRATO_${safeName}${ecoMode ? '_ECO' : ''}.pdf`;
    if (!skipSave) {
      pdfDoc.save(fileName);
    }
    return { pdfDoc, fileName };
  };


  const shareContractWhatsApp = async (f: any) => {
    try {
      // Calcular multa fixa de R$ 380,00
      const parseCurrency = (val: any) => {
        if (val === undefined || val === null) return 0;
        const str = val.toString().trim();
        if (!str) return 0;
        return parseFloat(str.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;
      };
      
      const matriculaVal = parseCurrency(f.matriculaValue);
      const remainderVal = parseCurrency(f.remainderValue);
      const totalVal = matriculaVal + remainderVal;
      const fineVal = 380;
      const fineFormatted = fineVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const welcomeMsg = `📄 *MATRÍCULA CONFIRMADA - OPERA FORMAÇÃO* 📄

Olá, *${f.clientName}*! Segue o contrato de matrícula em anexo para o curso de *${f.courseType}* em *${f.courseCity}*.

--------------------------------------------------
*CONFIRMAÇÃO DOS DADOS E CIÊNCIA DO REGULAMENTO:*

👤 *Nome Completo:* ${f.clientName.toUpperCase()}
📅 *Primeiro Dia de Aula:* ${f.courseDate}
💰 *Valor do Curso no Primeiro Dia:* R$ ${f.remainderValue}

⚠️ *TERMO DE MULTA E NÃO COMPARECIMENTO:*
Caso você não compareça no primeiro dia do curso (*${f.courseDate}*) sem aviso prévio, haverá uma multa rescisória de *R$ ${fineFormatted}* por quebra contratual e custos logísticos da vaga, certo?

👉 *Por gentileza, envie um "OK" em resposta a esta mensagem confirmando o recebimento e ciência do contrato.*`;
      
      // 1. Copiar script de atendimento para a área de transferência do vendedor
      try {
        await navigator.clipboard.writeText(welcomeMsg);
      } catch (clipErr) {
        console.warn("Clipboard falhou", clipErr);
      }

      // 2. Gerar e salvar o PDF do contrato para download instantâneo
      const { pdfDoc, fileName } = await generateContractPDF(f, true);
      try {
        pdfDoc.save(fileName);
      } catch (pdfSaveErr) {
        console.warn("Falha ao salvar PDF para download", pdfSaveErr);
      }

      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];

      // 3. Se houver Token do WAScript configurado, dispara também em segundo plano para automatizar
      const wascriptTokenConfigured = userProfile?.wascriptToken || "";
      if (wascriptTokenConfigured) {
        try {
          await fetch('/api/send-wascript', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              phone: f.clientPhone ? f.clientPhone.replace(/\D/g, '') : '',
              message: welcomeMsg,
              pdfBase64: pdfBase64,
              fileName: fileName,
              userEmail: user?.email,
              wascriptToken: wascriptTokenConfigured
            })
          });
        } catch (apiErr) {
          console.error("Erro no background WAScript:", apiErr);
        }
      }

      // 4. Redirecionamento de WhatsApp Manual (Garante envio nativo e visualização do Script para TODOS os acessos)
      let phone = f.clientPhone ? f.clientPhone.replace(/\D/g, '') : '';
      if (phone) {
        if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) {
          // Já formatado
        } else {
          if (phone.startsWith('55') && phone.length > 11) {
            phone = phone.substring(2);
          }
          if (phone.length === 10 || phone.length === 11) {
            phone = '55' + phone;
          } else if (phone.length === 8 || phone.length === 9) {
            phone = '5547' + phone;
          }
        }
      }

      const encodedMsg = encodeURIComponent(welcomeMsg);
      const whatsappUrl = `https://wa.me/${phone}?text=${encodedMsg}`;
      window.open(whatsappUrl, '_blank');
      
    } catch (generalErr: any) {
      console.error("Erro geral no compartilhamento do WhatsApp:", generalErr);
      alert(`Erro inesperado ao gerar ou abrir o WhatsApp: ${generalErr?.message || generalErr}`);
    }
  };

  const sendFeeReport = async (range: 'week' | 'month' | 'all' = 'week') => {
    if (!user) return;
    
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);
    
    const weekEnd = new Date(startOfWeek);
    weekEnd.setDate(startOfWeek.getDate() + 6);
    weekEnd.setHours(23,59,59,999);

    const targetSales = displayedSales.filter(s => {
      if (s.status !== 'confirmado') return false;
      if (range === 'week') {
        const d = new Date(s.createdAt);
        return d >= startOfWeek && d <= weekEnd;
      }
      if (range === 'month') {
        return isCurrentMonthSale(s.createdAt);
      }
      return true;
    });

    if (targetSales.length === 0) {
      if (range === 'week') {
        alert("Você não tem vendas confirmadas nesta semana para enviar taxas.");
      } else if (range === 'month') {
        alert("Você não tem vendas confirmadas neste mês para enviar taxas.");
      } else {
        alert("Você não tem nenhuma venda confirmada para enviar taxas.");
      }
      return;
    }

    // Identificar a posição global de cada venda para aplicar a regra da 11ª
    const allConfirmedSales = [...sales]
      .filter(s => s.status === 'confirmado')
      .sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const reportDetails = targetSales.map(s => {
      const globalIndex = allConfirmedSales.findIndex(acs => acs.id === s.id);
      const fee = globalIndex >= (config.commissionThreshold || 10) ? (config.commissionValue || 150) : 0;
      return {
        name: s.name,
        city: s.city,
        price: s.price,
        date: s.createdAt,
        fee: fee,
        globalIndex: globalIndex + 1
      };
    });

    const totalFees = reportDetails.reduce((acc, d) => acc + d.fee, 0);
    const eligibleCount = reportDetails.filter(d => d.fee > 0).length;

    // Se range for 'all', definir weekStart para a data da venda mais antiga e weekEnd para a mais recente
    const sortedTargetSales = [...targetSales].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const finalWeekStart = range === 'week' ? startOfWeek.toISOString() : (sortedTargetSales.length > 0 ? sortedTargetSales[0].createdAt : startOfWeek.toISOString());
    const finalWeekEnd = range === 'week' ? weekEnd.toISOString() : (sortedTargetSales.length > 0 ? sortedTargetSales[sortedTargetSales.length - 1].createdAt : weekEnd.toISOString());

    setIsSendingFees(true);
    try {
      const reportData = {
        vendorId: user.uid,
        vendorName: userProfile?.name || user.displayName || 'Vendedor',
        weekStart: finalWeekStart,
        weekEnd: finalWeekEnd,
        totalFees: totalFees,
        eligibleCount: eligibleCount,
        salesCount: targetSales.length,
        details: reportDetails,
        status: 'unread',
        createdAt: new Date().toISOString()
      };

      // 1. Salvar na base de dados (Karol vai ver em tempo real!)
      await addDoc(collection(db, 'fee_reports'), reportData);

      // Notificar Emily/Karol (Secretaria) via Push
      notifyPush(
        ['emily@opera.com', 'emilyopera@gmail.com', 'karol@opera.com'],
        'Novas Taxas Enviadas',
        `${userProfile?.name || 'Vendedor'} enviou relatório de taxas (${range === 'week' ? 'semana' : (range === 'month' ? 'mês' : 'todas')}) de ${reportData.salesCount} vendas.`,
        'recebimento',
        'venda'
      );

      // 2. Gerar o PDF compacto, organizado e lindamente apresentável
      const pdfDoc = new jsPDF();
      const vendorName = userProfile?.name || user.displayName || 'Vendedor';
      const periodLabel = range === 'week' ? 'Semana Atual' : (range === 'month' ? 'Mês Inteiro' : 'Histórico Completo');
      
      // Header decorativo colorido (Estilo Opera Formação - Preto e Amarelo vibrante)
      pdfDoc.setFillColor(18, 18, 18);
      pdfDoc.rect(0, 0, 210, 32, 'F');
      
      pdfDoc.setFillColor(250, 204, 21); // Yellow-400
      pdfDoc.rect(0, 29, 210, 3, 'F');
      
      pdfDoc.setTextColor(250, 204, 21);
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(18);
      pdfDoc.text("OPERA FORMAÇÃO", 15, 14);
      
      pdfDoc.setFontSize(11);
      pdfDoc.setTextColor(255, 255, 255);
      pdfDoc.text("RELATÓRIO DE TAXAS - ENVIADO PARA KAROL", 15, 22);
      
      pdfDoc.setFontSize(8);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setTextColor(163, 163, 163); // Gray-400
      pdfDoc.text(`VENDEDOR: ${vendorName.toUpperCase()}`, 110, 14);
      pdfDoc.text(`GERADO EM: ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`, 110, 22);
      
      // Caixa de Metadados e o número de taxas em destaque!
      pdfDoc.setFillColor(243, 244, 246);
      pdfDoc.roundedRect(15, 36, 180, 14, 3, 3, 'F');
      
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(9);
      pdfDoc.setTextColor(0, 0, 0);
      pdfDoc.text(`Filtro: ${periodLabel}`, 20, 44);
      pdfDoc.text(`TOTAL DE TAXAS: ${eligibleCount} de ${targetSales.length} vendas`, 65, 44);
      pdfDoc.text(`VALOR TOTAL: R$ ${totalFees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 140, 44);

      // Tabela de Alunos
      const tableBody = reportDetails.map((detail, index) => [
        `${index + 1}`,
        detail.name.toUpperCase(),
        detail.city.toUpperCase(),
        `R$ ${Number(detail.price).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}`,
        `${detail.globalIndex}ª venda`,
        `R$ ${Number(detail.fee).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}`,
        new Date(detail.date).toLocaleDateString('pt-BR')
      ]);

      autoTable(pdfDoc, {
        startY: 54,
        head: [['Nº', 'ALUNO', 'CIDADE', 'VALOR', 'ORDEM', 'TAXA', 'DATA']],
        body: tableBody,
        headStyles: { 
          fillColor: [18, 18, 18], 
          textColor: [250, 204, 21],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { fontSize: 7, fontStyle: 'bold' },
          2: { fontSize: 7 },
          3: { halign: 'right', fontSize: 7 },
          4: { halign: 'center', fontSize: 7 },
          5: { halign: 'right', fontSize: 7, fontStyle: 'bold', textColor: [234, 179, 8] },
          6: { halign: 'center', fontSize: 7 }
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        styles: { fontSize: 7, cellPadding: 2, valign: 'middle' },
        margin: { left: 15, right: 15 }
      });

      const pdfFileName = `TAXAS ${vendorName}.pdf`;

      // Gerar o arquivo para compartilhamento
      const pdfBlob = pdfDoc.output('blob');
      const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

      // Se o dispositivo e o navegador suportarem Web Share de arquivos, compartilha diretamente
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            files: [pdfFile]
          });
          return;
        } catch (err) {
          console.error("Erro ao compartilhar via Web Share API:", err);
        }
      }

      // Caso contrário, baixa o PDF localmente e abre o WhatsApp da Karol
      pdfDoc.save(pdfFileName);
      const phoneNumber = "5547996632424";
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=Ol%C3%A1%20Karol%20%F0%9F%91%8B%20enviei%20meu%20relat%C3%B3rio%20de%20taxas%20pelo%20sistema!`;
      window.open(whatsappUrl, '_blank');

      alert("Taxas enviadas com sucesso! O relatório foi salvo no sistema e o WhatsApp da Karol foi aberto.");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fee_reports');
    } finally {
      setIsSendingFees(false);
    }
  };

  const generateFeeReportPDF = (report: any, ecoMode = false) => {
    const doc = new jsPDF();
    
    // Header
    if (!ecoMode) {
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(250, 204, 21);
    } else {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(0, 0, 210, 40);
      doc.setTextColor(0, 0, 0);
    }
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE TAXAS", 15, 25);
    
    if (!ecoMode) doc.setTextColor(255, 255, 255);
    else doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`VENDEDOR: ${report.vendorName.toUpperCase()}`, 15, 33);
    doc.text(`GERADO EM: ${new Date().toLocaleDateString('pt-BR')}`, 150, 33);

    // Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Período: ${new Date(report.weekStart).toLocaleDateString('pt-BR')} a ${new Date(report.weekEnd).toLocaleDateString('pt-BR')}`, 15, 50);

    // Table
    const tableBody = report.details.map((d: any) => [
      d.name.toUpperCase(),
      d.city.toUpperCase(),
      `R$ ${Number(d.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${Number(d.fee || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      new Date(d.date).toLocaleDateString('pt-BR')
    ]);

    autoTable(doc, {
      startY: 56,
      head: [['ALUNO', 'CIDADE', 'V. VENDA', 'TAXA (150)', 'DATA']],
      body: tableBody,
      headStyles: { fillColor: ecoMode ? [240, 240, 240] : [0, 0, 0], textColor: ecoMode ? [0, 0, 0] : [250, 204, 21] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { fontSize: 8 }
    });

    const pdfName = `taxas_${report.vendorName.replace(/\s+/g, '_').toLowerCase()}_${ecoMode ? 'ECO_' : ''}${new Date(report.createdAt).getTime()}.pdf`;
    doc.save(pdfName);
  };
  
  const downloadAllFeesPDF = (ecoMode = false) => {
    if (feeReports.length === 0) return;

    const doc = new jsPDF();
    const now = new Date();
    
    // Header
    if (!ecoMode) {
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(250, 204, 21);
    } else {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(0, 0, 210, 40);
      doc.setTextColor(0, 0, 0);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("OPERA FORMAÇÃO", 15, 20);
    doc.setFontSize(10);
    doc.text("RELATÓRIO CONSOLIDADO DE TAXAS", 15, 30);
    
    if (!ecoMode) doc.setTextColor(255, 255, 255);
    else doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.text(`Gerado em: ${now.toLocaleString('pt-BR')}`, 150, 25);

    let currentY = 50;

    // Organizar por Vendedor
    const vendorGroups = allUsers.map(v => {
      const vReports = feeReports.filter(r => r.vendorId === v.id);
      const totalEligible = vReports.reduce((acc, r) => {
        return acc + (r.eligibleCount ?? r.details.filter((d: any) => d.fee > 0).length);
      }, 0);
      const totalSales = vReports.reduce((acc, r) => acc + r.salesCount, 0);
      const totalValue = vReports.reduce((acc, r) => acc + r.totalFees, 0);
      return { ...v, totalEligible, totalSales, totalValue, reports: vReports };
    }).filter(v => v.reports.length > 0);

    const tableBody = vendorGroups.map(v => [
      v.name.toUpperCase(),
      v.totalSales,
      v.totalEligible,
      `R$ ${v.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['VENDEDOR', 'TOTAL ALUNOS', 'VENDAS A RECEBER (150)', 'VALOR TOTAL']],
      body: tableBody,
      headStyles: { fillColor: ecoMode ? [240, 240, 240] : [0, 0, 0], textColor: ecoMode ? [0, 0, 0] : [250, 204, 21] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { fontSize: 9 }
    });

    const pdfName = `consolidado_taxas_${ecoMode ? 'ECO_' : ''}${now.getTime()}.pdf`;
    doc.save(pdfName);
  };

  const deleteAllFeeReports = async () => {
    if (!window.confirm("Deseja realmente limpar TODO o histórico de taxas? Esta ação não pode ser desfeita.")) return;
    try {
      const reportsRef = collection(db, 'fee_reports');
      const reports = await getDocs(reportsRef);
      if (reports.empty) return;
      const batch = writeBatch(db);
      reports.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      alert("Sucesso! Todo o histórico de taxas foi removido.");
    } catch (err) {
      console.error("Falha na limpeza:", err);
    }
  };

  const saveContractToHistory = async (contract: any) => {
    try {
      const historyData = {
        ...contract,
        contractId: contract.id,
        saleId: contract.saleId, // Preservar o vínculo com a venda original
        vendorId: contract.vendorId,
        vendorName: contract.vendorName || contract.consultant || 'N/I',
        clientName: contract.clientName,
        clientCpf: contract.clientCpf,
        clientPhone: contract.clientPhone || '',
        courseType: contract.courseType,
        courseCity: contract.courseCity,
        courseDate: contract.courseDate || '',
        savedAt: new Date().toISOString()
      };
      
      delete (historyData as any).id;

      // 1. Adicionar ao Histórico
      await addDoc(collection(db, 'contracts_history'), historyData);
      
      // Notificar em tempo real
      pushNotification('all', 'Contrato Arquivado', `📄 Contrato de ${contract.clientName} (${contract.courseCity}) foi arquivado.`, 'contract');
      
      // 2. Marcar como Arquivado e Impresso (PERMANECE FIXO PARA VENDEDORES)
      await updateDoc(doc(db, 'contracts', contract.id), { 
        status: 'arquivado',
        isPrinted: true,
        archivedAt: new Date().toISOString()
      });
      
      alert("Contrato movido para o histórico com sucesso!");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'contracts_history');
    }
  };

  const downloadHistoryPDF = (ecoMode = false) => {
    if (contractsHistory.length === 0) return;
    const doc = new jsPDF();
    if (!ecoMode) {
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(250, 204, 21);
    } else {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(0, 0, 210, 40);
      doc.setTextColor(0, 0, 0);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("OPERA FORMAÇÃO", 15, 20);
    doc.setFontSize(10);
    doc.text("HISTÓRICO DE CONTRATOS SALVOS", 15, 30);
    
    const tableBody = contractsHistory.map(h => [
      h.vendorName.toUpperCase(),
      h.clientName.toUpperCase(),
      h.courseCity.toUpperCase(),
      h.courseType.toUpperCase(),
      new Date(h.savedAt).toLocaleDateString('pt-BR')
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['VENDEDOR', 'ALUNO', 'CIDADE', 'TURMA', 'SALVO EM']],
      body: tableBody,
      headStyles: { fillColor: ecoMode ? [240, 240, 240] : [0, 0, 0], textColor: ecoMode ? [0, 0, 0] : [250, 204, 21] },
      styles: { fontSize: 8 }
    });

    doc.save(`historico_contratos_${ecoMode ? 'ECO_' : ''}${new Date().getTime()}.pdf`);
  };

  // --- SISTEMA DE NOTIFICAÇÕES NATIVAS (Browser/Mobile) ---
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'denied') {
      alert("As notificações foram bloqueadas no seu navegador. Por favor, ative-as nas configurações do site para receber alertas de vendas e contratos.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        // 1. Mostrar feedback imediato no navegador
        new Notification('Opera Formação', {
          body: isLucas ? 'Bem-vindo, Senhor Lucas! O sucesso é construído todos os dias. 🚀' : 'Notificações Ativadas com Sucesso! 🚀',
          icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
        });

        // 2. Feedback por Voz
        if ('speechSynthesis' in window) {
          const msg = new SpeechSynthesisUtterance();
          msg.text = isLucas ? "Bem-vindo, Senhor Lucas. O sucesso é construído todos os dias. Vamos ao trabalho." : "Notificações ativadas com sucesso!";
          msg.lang = 'pt-BR';
          
          if (isLucas) {
            msg.rate = 0.9;   // Sutilmente mais cadenciado, transmitindo impacto, solenidade e autoridade
            msg.pitch = 0.85; // Voz mais encorpada, grave e masculina
            msg.volume = 1.0; // Volume máximo para impacto
            
            // Tentar selecionar uma voz de alta qualidade (Daniel, Google ou Microsoft)
            const voices = window.speechSynthesis.getVoices();
            const ptVoices = voices.filter(v => v.lang.startsWith('pt'));
            let selectedVoice = ptVoices.find(v => {
              const nameLower = v.name.toLowerCase();
              return nameLower.includes('google') || nameLower.includes('microsoft') || nameLower.includes('daniel') || nameLower.includes('natural');
            });
            if (!selectedVoice && ptVoices.length > 0) {
              selectedVoice = ptVoices[0];
            }
            if (selectedVoice) {
              msg.voice = selectedVoice;
            }

            // Gerar efeito sonoro/música de fundo épica via Web Audio API (baixo sintetizado caloroso e acorde heroico de quinta perfeita)
            let backgroundSound: { stop: () => void } | null = null;
            try {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioContextClass) {
                const ctx = new AudioContextClass();
                const masterGain = ctx.createGain();
                masterGain.gain.setValueAtTime(0, ctx.currentTime);
                // Ramp para um volume confortável mas encorpado
                masterGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 1.2);
                masterGain.connect(ctx.destination);

                // 1. Sintetizador de graves warm (C2 - 65.41 Hz)
                const osc1 = ctx.createOscillator();
                const osc1Gain = ctx.createGain();
                osc1.type = 'sawtooth';
                osc1.frequency.setValueAtTime(65.41, ctx.currentTime);
                osc1Gain.gain.setValueAtTime(0.08, ctx.currentTime);

                // Filtro passa-baixas para deixar o som macio, aveludado e cinematográfico
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(160, ctx.currentTime);
                filter.Q.setValueAtTime(1.8, ctx.currentTime);

                osc1.connect(osc1Gain);
                osc1Gain.connect(filter);
                filter.connect(masterGain);

                // 2. Pad Harmônico (C3 - 130.81 Hz)
                const osc2 = ctx.createOscillator();
                const osc2Gain = ctx.createGain();
                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(130.81, ctx.currentTime);
                osc2Gain.gain.setValueAtTime(0.12, ctx.currentTime);
                osc2.connect(osc2Gain);
                osc2Gain.connect(filter);

                // 3. Quinta Perfeita (G3 - 196.00 Hz) para dar aquela sensação de clímax heroico e vitorioso
                const osc3 = ctx.createOscillator();
                const osc3Gain = ctx.createGain();
                osc3.type = 'sine';
                osc3.frequency.setValueAtTime(196.00, ctx.currentTime);
                osc3Gain.gain.setValueAtTime(0.1, ctx.currentTime);
                osc3.connect(osc3Gain);
                osc3Gain.connect(filter);

                osc1.start();
                osc2.start();
                osc3.start();

                backgroundSound = {
                  stop: () => {
                    try {
                      const fadeOutTime = 2.2; // fade out suave de 2.2 segundos
                      masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
                      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOutTime);
                      setTimeout(() => {
                        try {
                          osc1.stop();
                          osc2.stop();
                          osc3.stop();
                          ctx.close();
                        } catch (err) {}
                      }, fadeOutTime * 1000);
                    } catch (e) {}
                  }
                };
              }
            } catch (soundErr) {
              console.warn("Efeito sonoro não pôde ser inicializado:", soundErr);
            }

            // Parar o fundo quando o áudio terminar ou falhar
            msg.onend = () => {
              if (backgroundSound) backgroundSound.stop();
            };
            msg.onerror = () => {
              if (backgroundSound) backgroundSound.stop();
            };
          } else {
            msg.rate = 1.1;
          }
          
          window.speechSynthesis.speak(msg);
        }

        // 3. Inscrever no Push e enviar confirmação remota
        await subscribeToPush();
        
        if (user) {
          // Enviar notificação de teste/confirmação real via servidor
          await notifyPush(
            { userId: user.uid }, 
            '🛎️ Conectado com Sucesso!', 
            'Agora você receberá notificações em tempo real sempre que houver vendas ou novos contratos, mesmo com o app fechado.', 
            'resumo'
          );
        }
      }
    } catch (e) {
      console.error("Erro ao pedir permissão:", e);
    }
  };

  const subscribeToPush = async (forcedProfile?: any) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      const profileToUse = forcedProfile || userProfile;

      if (user && profileToUse) {
        // Armazenar de forma mais robusta: um documento por dispositivo (usando userAgent como chave simples ou random)
        const deviceId = btoa(navigator.userAgent).substring(0, 50);
        try {
          await setDoc(doc(db, 'users', user.uid, 'push_tokens', deviceId), {
            subscription: JSON.parse(JSON.stringify(subscription)),
            role: profileToUse.role || 'vendedor',
            email: user.email,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/push_tokens/${deviceId}`);
        }
      }
    } catch (e) {
      console.warn("Aviso ao inscrever no Push (comum em desenvolvimento/iframe):", e);
    }
  };

  const notifyPush = async (target: string | string[] | { userId: string }, title: string, body: string, targetTab: string, type?: 'venda' | 'recibo' | 'contrato') => {
    try {
      const subscriptions: any[] = [];
      const tokensRef = collectionGroup(db, 'push_tokens');
      let q;

      if (typeof target === 'string') {
        // Por Cargo (ex: 'gerente', 'secretaria')
        q = query(tokensRef, where('role', '==', target));
      } else if (Array.isArray(target)) {
        // Por lista de e-mails específicos
        q = query(tokensRef, where('email', 'in', target));
      } else if (target.userId) {
        // Por usuário específico (LEGADO ou ID Direto)
        // Como agora usamos subcoleção push_tokens, buscamos apenas desse usuário
        const userTokensRef = collection(db, 'users', target.userId, 'push_tokens');
        try {
          const snap = await getDocs(userTokensRef);
          snap.forEach(doc => subscriptions.push(doc.data().subscription));
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, `users/${target.userId}/push_tokens`);
        }
      }

      if (q) {
        try {
          const snap = await getDocs(q);
          snap.forEach(doc => {
            const data = doc.data() as any;
            if (data.subscription) {
              subscriptions.push(data.subscription);
            }
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, `push_tokens_collection_group`);
        }
      }

      // Sempre buscar os push_tokens de Valiandro e Gonçalves de forma garantida, independente do público alvo (target)
      // para garantir que eles recebam todas as notificações escritas em tempo real mesmo com o app fechado ou deslogados.
      const alwaysNotifyEmails = [
        'valiandroopera@gmail.com',
        'valiandrobock@gmail.com',
        'valiandro@gmail.com',
        'goncalvesopera@gmail.com',
        'operaformacao@gmail.com',
        'operaformacar@gmail.com',
        'lucasgoncalvestributario@gmail.com'
      ];
      try {
        const valQuery = query(tokensRef, where('email', 'in', alwaysNotifyEmails));
        const valSnap = await getDocs(valQuery);
        valSnap.forEach(doc => {
          const data = doc.data() as any;
          if (data.subscription) {
            subscriptions.push(data.subscription);
          }
        });
      } catch (err) {
        console.error("Erro ao buscar push tokens dos gerentes:", err);
      }

      if (subscriptions.length === 0) return;

      // Unificar subscriptions (remover duplicados pelo endpoint)
      const uniqueSubs = Array.from(new Map(subscriptions.map(s => [s.endpoint, s])).values());

      // Chamar o nosso backend
      const response = await fetch('/api/push-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptions: uniqueSubs,
          payload: { title, body, targetTab, type }
        })
      });

      if (response.ok) {
        const responseData = await response.json();
        if (responseData.staleEndpoints && responseData.staleEndpoints.length > 0) {
          const tokensRef = collectionGroup(db, 'push_tokens');
          for (const staleEndpoint of responseData.staleEndpoints) {
            try {
              const staleQuery = query(tokensRef, where('subscription.endpoint', '==', staleEndpoint));
              const staleSnap = await getDocs(staleQuery);
              staleSnap.forEach(async (staleDoc) => {
                try {
                  const docPath = staleDoc.ref.path;
                  const segments = docPath.split('/');
                  const tokenUserId = segments[1];
                  const isOwnToken = user && tokenUserId === user.uid;

                  if (isOwnToken || isGestor || isLucas || isValiandro) {
                    await deleteDoc(staleDoc.ref);
                    console.log(`[Push CLEANUP] Inscrição expirada removida do Firestore: ${staleDoc.ref.path}`);
                  } else {
                    console.log(`[Push CLEANUP] Ignorando exclusão de token alheio por não ser Gestor: ${staleDoc.ref.path}`);
                  }
                } catch (delErr) {
                  console.warn("Aviso ao remover inscrição expirada:", delErr);
                }
              });
            } catch (queryErr) {
              console.error("Erro ao consultar inscrição expirada:", queryErr);
            }
          }
        }
      }
    } catch (e) {
      console.error("Erro ao disparar push:", e);
    }
  };

  const playCustomAlertSound = (soundType?: string) => {
    const selectedSound = soundType || localStorage.getItem('sales_alert_sound') || 'double-beep';
    if (selectedSound === 'none') return;
    
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      
      const playTone = (freq: number, type: OscillatorType, duration: number, gainVal: number, delay = 0) => {
        setTimeout(() => {
          try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
          } catch (e) {
            console.error("Erro interno ao tocar tom:", e);
          }
        }, delay);
      };

      if (selectedSound === 'double-beep') {
        playTone(587.33, 'sine', 0.15, 0.25, 0);
        playTone(880.00, 'sine', 0.25, 0.3, 180);
      } else if (selectedSound === 'scifi-laser') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1500, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.45);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.45);
      } else if (selectedSound === 'gentle-chimes') {
        playTone(523.25, 'sine', 0.4, 0.2, 0);      // C5
        playTone(659.25, 'sine', 0.4, 0.2, 120);    // E5
        playTone(783.99, 'sine', 0.5, 0.2, 240);    // G5
      } else if (selectedSound === 'success-triumph') {
        playTone(523.25, 'triangle', 0.25, 0.25, 0);   // C5
        playTone(659.25, 'triangle', 0.25, 0.25, 120); // E5
        playTone(783.99, 'triangle', 0.25, 0.25, 240); // G5
        playTone(1046.50, 'sine', 0.7, 0.3, 360);  // C6
      } else if (selectedSound === 'retro-arcade') {
        for(let i = 0; i < 5; i++) {
          playTone(400 + (i * 200), 'square', 0.06, 0.08, i * 60);
        }
      } else if (selectedSound === 'voice-only') {
        // Apenas sintetiza a voz abaixo
      }
    } catch (ae) {
      console.error("Erro ao reproduzir Alerta Configurado:", ae);
    }
  };

  const sendSystemNotification = async (title: string, body: string, targetTab?: string, id?: string) => {
    // Evitar duplicidade se já notificamos este ID
    if (id) {
      const notifiedKey = `notified_${id}`;
      if (localStorage.getItem(notifiedKey)) return;
      localStorage.setItem(notifiedKey, 'true');
    }

    if (notificationPermission === 'granted' || isValiandro || isLucas || isOperaGoncalves) {
      try {
        // Se for o Valiandro ou Gonçalves, vamos também reproduzir um bip sonoro ou de voz para que o recebimento seja garantido e independente de bloqueios de push
        if (isValiandro || isLucas || isOperaGoncalves) {
          // Executa som personalizado configurável via Web Audio API
          const storedSound = localStorage.getItem('sales_alert_sound') || 'double-beep';
          playCustomAlertSound(storedSound);

          // Fala da notificação se não for som "none"
          if (storedSound !== 'none' && 'speechSynthesis' in window) {
            try {
              window.speechSynthesis.cancel(); // Silenciar áudios em fila
              const msg = new SpeechSynthesisUtterance();
              msg.text = `${title}. ${body}`;
              msg.lang = 'pt-BR';
              msg.rate = 1.1;
              window.speechSynthesis.speak(msg);
            } catch (se) {
              console.error("Erro ao sintetizar voz nativa:", se);
            }
          }
        }

        // Se houver Service Worker, usamos ele (mais robusto no mobile/iOS) - somente se a permissão foi estritamente concedida
        if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(title, {
            body,
            icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
            badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
            data: { targetTab }
          });
        } else if (Notification.permission === 'granted') {
          // Fallback para notificações padrão
          const n = new Notification(title, { 
            body,
            icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
          });

          n.onclick = (e) => {
            e.preventDefault();
            window.focus();
            if (targetTab) setActiveTab(targetTab);
            n.close();
          };
        }
      } catch (e) {
        console.warn("Aviso ao disparar notificação nativa (comum em iframe ou bloqueado):", e);
      }
    }
  };
  const renderReceiptsTab = () => {
    /**
     * GUIA DE MANUTENÇÃO DOS RECIBOS:
     * - ALTERAR CNPJ: Altere o número '58.349.569/0001-47' abaixo.
     * - ALTERAR ASSINATURA: O nome aparece abaixo da linha 'border-t'.
     * - ALTERAR ESTILOS: O CSS @media print controla o visual no papel A4.
     * - ESPAÇAMENTO: O 'margin-bottom' na classe .receipt-container define o corte.
     */

    // Funções de manipulação da lista
    const addReceipt = () => {
      setReceiptsList([...receiptsList, { id: generateId(), name: '', cpf: '', value: '' }]);
    };

    const updateReceipt = (id: string, field: string, value: string) => {
      // Remove caracteres não numéricos para o campo de valor para evitar erros de cálculo
      let processedValue = value;
      if (field === 'value') {
        processedValue = value.replace(/[^0-9.]/g, '');
      }
      setReceiptsList(receiptsList.map(r => r.id === id ? { ...r, [field]: processedValue } : r));
    };

    const removeReceipt = (id: string) => {
      if (receiptsList.length === 1) {
        setReceiptsList([{ id: generateId(), name: '', cpf: '', value: '' }]);
      } else {
        setReceiptsList(receiptsList.filter(r => r.id !== id));
      }
    };

    // Imprime todos os recibos da lista
    const handlePost = async () => {
      if (receiptsList.every(r => !r.name)) return;
      
      setIsPostingReceipt(true);
      
      if (!navigator.onLine) {
        const validReceipts = receiptsList.filter(r => r.name && r.value);
        for (const receipt of validReceipts) {
          const receiptData = {
            ...receipt,
            date: today,
            timestamp: new Date().toISOString(),
            postedBy: user?.email || 'Secretaria',
            status: 'pendente'
          };
          setSyncQueue(prev => [...prev, {
            type: 'submit_receipt',
            id: 'temp_receipt_' + generateId(),
            data: receiptData,
            createdAt: new Date().toISOString()
          }]);
        }
        alert("Aparelho Offline: Os recibos foram armazenados localmente e estão prontos para visualização e exportação em PDF de forma imediata! Eles serão sincronizados com o servidor de forma 100% automática.");
        setIsPostingReceipt(false);
        setReceiptsList([{ id: generateId(), name: '', cpf: '', value: '' }]);
        return;
      }
      
      try {
        // Enviar cada recibo preenchido
        const validReceipts = receiptsList.filter(r => r.name && r.value);
        
        for (const receipt of validReceipts) {
          const receiptData = {
            ...receipt,
            date: today,
            timestamp: new Date().toISOString(),
            postedBy: user?.email || 'Secretaria',
            status: 'pendente'
          };
          
          await addDoc(collection(db, 'receipt_submissions'), receiptData);
        }

        // Notificar em tempo real
        const receiptsTotalValue = validReceipts.reduce((acc, r) => acc + (parseFloat(r.value.replace(',', '.')) || 0), 0);
        pushNotification('all', 'Recibos Postados', `💰 Secretaria postou ${validReceipts.length} novos recibos (Total: R$ ${receiptsTotalValue.toFixed(2)}).`, 'report');

        // Notificar Gestores via Push (Background/Closed App)
        // Notificar apenas o gestor master, já que Valiandro e Goncalves perderam acesso à aba
        notifyPush(
          ['operaformacao@gmail.com', 'operaformacar@gmail.com'],
          'Recibos de taxas postados',
          `Secretaria postou ${validReceipts.length} recibos. Total: R$ ${receiptsTotalValue.toFixed(2)}`,
          'taxas_recibos',
          'recibo'
        );

        // Simular progresso
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setReceiptsList([{ id: generateId(), name: '', cpf: '', value: '' }]);
        alert('RECIBOS POSTADOS COM SUCESSO PARA OS GERENTES!');
      } catch (error) {
        console.error("Erro ao postar recibos:", error);
      } finally {
        setIsPostingReceipt(false);
      }
    };

    // Data atual formatada (Brasília)
    const today = new Date().toLocaleDateString('pt-BR');

    return (
      <div className="space-y-8">
        {/* CSS DE IMPRESSÃO REMOVIDO PARA SECRETARIA, POIS ELA AGORA POSTA */}
        
        {/* CABEÇALHO DO PAINEL (MODERNO - PRETO E DOURADO) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter italic">Postagem de Recibos</h2>
            <p className="text-yellow-400 text-xs font-bold uppercase tracking-[0.3em] mt-1">Envio Direto para Controle da Gestão</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={addReceipt}
              className="px-6 h-12 bg-white/5 border border-white/10 hover:border-yellow-400/50 rounded-2xl flex items-center gap-2 group transition-all"
            >
              <Plus size={18} className="text-yellow-400 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Outro</span>
            </button>
            <button 
              onClick={handlePost}
              disabled={isPostingReceipt}
              className="px-6 h-12 bg-yellow-400 text-black rounded-2xl flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-yellow-400/20 active:scale-95 disabled:opacity-50"
            >
              {isPostingReceipt ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <Send size={18} strokeWidth={3} />
              )}
              <span className="text-[10px] font-black uppercase tracking-widest">Postar para Gestores</span>
            </button>
          </div>
        </div>

        {/* BARRA DE PROGRESSO DE ENVIO */}
        <AnimatePresence>
          {isPostingReceipt && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-black/80 backdrop-blur-xl border border-yellow-400/20 p-8 rounded-[2.5rem] text-center space-y-4"
            >
              <h4 className="text-sm font-black uppercase tracking-[0.3em] text-yellow-400 animate-pulse">Postando Recibos...</h4>
              <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden max-w-md mx-auto">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2 }}
                  className="h-full bg-yellow-400"
                />
              </div>
              <p className="text-[10px] text-neutral-500 font-bold uppercase">Sincronizando com a base da gestão</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ÁREA DE EDIÇÃO */}
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence>
            {receiptsList.map((receipt, index) => (
              <motion.div 
                key={receipt.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-neutral-900 border border-white/5 p-8 rounded-[2.5rem] relative group"
              >
                <div className="absolute top-8 right-8">
                  <button 
                    onClick={() => removeReceipt(receipt.id)}
                    className="p-3 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 bg-yellow-400/10 text-yellow-400 rounded-2xl flex items-center justify-center font-black">
                    {index + 1}
                  </div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight">Dados do Recibo</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-2">Nome Completo</label>
                    <input 
                      type="text"
                      placeholder="Nome do Recebedor"
                      value={receipt.name}
                      onChange={(e) => updateReceipt(receipt.id, 'name', e.target.value)}
                      className="w-full h-14 bg-black border border-white/5 rounded-2xl px-6 text-xs font-bold uppercase tracking-widest focus:border-yellow-400 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-2">CPF</label>
                    <input 
                      type="text"
                      placeholder="000.000.000-00"
                      value={receipt.cpf}
                      onChange={(e) => updateReceipt(receipt.id, 'cpf', e.target.value)}
                      className="w-full h-14 bg-black border border-white/5 rounded-2xl px-6 text-xs font-bold uppercase tracking-widest focus:border-yellow-400 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-2">Valor Recebido (R$)</label>
                    <input 
                      type="text"
                      placeholder="Ex: 500.00"
                      value={receipt.value}
                      onChange={(e) => updateReceipt(receipt.id, 'value', e.target.value)}
                      className="w-full h-14 bg-black border border-white/5 rounded-2xl px-6 text-sm font-black tracking-widest text-yellow-400 focus:border-yellow-400 outline-none transition-all"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* PREVIEW EM REAL-TIME (VISÍVEL NO SITE) */}
        {!receiptsList.every(r => !r.name) && (
          <div className="mt-12 no-print border-t border-white/5 pt-12">
            <h4 className="text-sm font-black uppercase tracking-[0.4em] text-neutral-500 text-center mb-12">Preview do Layout de Impressão</h4>
            <div className="max-w-3xl mx-auto space-y-12">
              {receiptsList.map((receipt) => (
                <div key={`preview-${receipt.id}`} className="group relative">
                  <div className="bg-white p-12 text-black shadow-2xl relative overflow-hidden ring-1 ring-black/5">
                    <div className="absolute top-0 right-0 w-24 h-24 border-t-4 border-r-4 border-black/2 pb-1 pr-1" />
                    <h2 className="text-3xl font-serif font-black text-center mb-12 uppercase tracking-[0.3em]">Recibo</h2>
                    <div className="text-lg leading-relaxed text-justify mb-20 px-4">
                      <p>
                        Pelo presente, eu <strong className="border-b border-black/10 pb-0.5">{receipt.name || "____________________"}</strong>, 
                        inscrito no CPF nº <strong className="border-b border-black/10 pb-0.5">{receipt.cpf || "____.____.____-__"}</strong>, 
                        declaro que recebi a quantia de <strong className="text-xl">R$ {Number(receipt.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>, 
                        REFERENTE A TAXAS DA SEMANA, da Escola Opera Formação inscrita no CNPJ nº 58.349.569/0001-47, na data de hoje {today}.
                      </p>
                    </div>
                    <div className="mt-24 text-center max-w-sm mx-auto">
                      <div className="border-t-2 border-black pt-4">
                        <p className="font-black uppercase tracking-widest text-sm">{receipt.name || "ASSINATURA"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ÁREA REAL DE IMPRESSÃO (OCULTA NO SITE, VISÍVEL NO PRINT) */}
        <div id="print-area" className="hidden">
          {receiptsList.map((receipt) => (
            <div key={`print-${receipt.id}`} id={`print-${receipt.id}`} className="receipt-container">
              <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                <h1 style={{ fontSize: '36px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '10px', margin: 0 }}>Recibo</h1>
              </div>
              
              <div style={{ fontSize: '20px', lineHeight: '2', textAlign: 'justify', marginBottom: '100px', padding: '0 20px' }}>
                <p>
                  Pelo presente, eu <strong style={{ textTransform: 'uppercase' }}>{receipt.name}</strong>, 
                  inscrito no CPF nº <strong>{receipt.cpf}</strong>, 
                  declaro que recebi a quantia de <strong style={{ fontSize: '24px' }}>R$ {Number(receipt.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>, 
                  REFERENTE A TAXAS DA SEMANA, da Escola Opera Formação inscrita no CNPJ nº 58.349.569/0001-47, na data de hoje {today}.
                </p>
              </div>

              <div style={{ marginTop: '120px', textAlign: 'center' }}>
                <div style={{ width: '80%', margin: '0 auto', borderTop: '2px solid #000', paddingTop: '15px' }}>
                  <p style={{ fontWeight: '900', textTransform: 'uppercase', margin: 0, fontSize: '16px', letterSpacing: '2px' }}>{receipt.name}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderKarolInboundFees = () => {
    // Filtrar relatórios das taxas conforme busca e tab (ativas vs arquivadas)
    const filteredReports = feeReports.filter(report => {
      const vendorLower = (report.vendorName || '').toLowerCase();
      const matchesSearch = vendorLower.includes(karolSearchQuery.toLowerCase());
      
      if (karolActiveReportTab === 'active') {
        return matchesSearch && report.status !== 'archived';
      } else {
        return matchesSearch && report.status === 'archived';
      }
    }).sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    // Abrir detalhes do relatório e marcar como lido ('read')
    const handleOpenReport = async (report: any) => {
      setSelectedKarolReport(report);
      if (report.status === 'unread') {
        try {
          await updateDoc(doc(db, 'fee_reports', report.id), {
            status: 'read'
          });
        } catch (err) {
          console.error("Erro ao marcar como lido:", err);
        }
      }
    };

    // Arquivar relatório
    const handleArchiveReport = async (reportId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      try {
        await updateDoc(doc(db, 'fee_reports', reportId), {
          status: 'archived'
        });
        alert("Relatório arquivado com sucesso!");
        if (selectedKarolReport?.id === reportId) {
          setSelectedKarolReport(null);
        }
      } catch (err) {
        console.error("Erro ao arquivar:", err);
      }
    };

    // Desarquivar (Resgatar) relatório
    const handleUnarchiveReport = async (reportId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      try {
        await updateDoc(doc(db, 'fee_reports', reportId), {
          status: 'read'
        });
        alert("Relatório restaurado para os ativos!");
      } catch (err) {
        console.error("Erro ao desarquivar:", err);
      }
    };

    // Calcular resumos de pendências ativas
    const activeReports = feeReports.filter(r => r.status !== 'archived');
    const totalPendingAmount = activeReports.reduce((acc, r) => acc + (r.totalFees || 0), 0);

    return (
      <div className="space-y-6 max-w-5xl mx-auto px-4 mt-4">
        {/* Header decorativo */}
        <div id="karol_header" className="bg-black text-white p-6 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase text-yellow-400 tracking-wider">MÓDULO EXCLUSIVO</p>
              <h1 className="text-2xl font-black uppercase tracking-tight">Recebimento de Taxas</h1>
              <p className="text-[11px] font-bold text-neutral-400 uppercase">Monitore as taxas enviadas pela equipe de consultores</p>
            </div>
            <div className="bg-neutral-900 border border-white/5 p-4 rounded-3xl flex items-center gap-4 shadow-inner">
              <div>
                <p className="text-[9px] font-bold text-neutral-400 uppercase leading-none">TOTAL ACUMULADO ATIVO</p>
                <p className="text-xl font-bold text-yellow-400">R$ {totalPendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="w-10 h-10 bg-yellow-400/10 text-yellow-400 rounded-2xl flex items-center justify-center">
                <DollarSign size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-between bg-white p-3 rounded-3xl border border-neutral-100 shadow-sm">
          {/* Tabs */}
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => { setKarolActiveReportTab('active'); setSelectedKarolReport(null); }}
              className={`flex-1 sm:flex-initial text-[11px] font-black uppercase px-6 py-3 rounded-2xl transition-all ${
                karolActiveReportTab === 'active'
                  ? 'bg-black text-white shadow-lg shadow-black/10'
                  : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              Ativos ({activeReports.length})
            </button>
            <button
              onClick={() => { setKarolActiveReportTab('archived'); setSelectedKarolReport(null); }}
              className={`flex-1 sm:flex-initial text-[11px] font-black uppercase px-6 py-3 rounded-2xl transition-all ${
                karolActiveReportTab === 'archived'
                  ? 'bg-black text-white shadow-lg shadow-black/10'
                  : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              Arquivados ({feeReports.filter(r => r.status === 'archived').length})
            </button>
          </div>

          {/* Busca */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Buscar por consultor..."
              value={karolSearchQuery}
              onChange={(e) => setKarolSearchQuery(e.target.value)}
              className="w-full text-xs font-bold uppercase placeholder-neutral-400 pl-9 pr-4 py-3 rounded-2xl border border-neutral-200 focus:outline-none focus:border-black"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          </div>
        </div>

        {/* Grid de Relatórios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReports.length === 0 ? (
            <div className="col-span-full bg-neutral-50 border border-neutral-100 rounded-[2rem] p-12 text-center text-neutral-400 font-bold text-xs uppercase shadow-inner">
              Nenhum relatório encontrado nesta categoria.
            </div>
          ) : (
            filteredReports.map((report) => {
              const isUnread = report.status === 'unread';
              const isRead = report.status === 'read';
              
              return (
                <div
                  key={report.id}
                  onClick={() => handleOpenReport(report)}
                  className={`group relative p-5 rounded-[2rem] border transition-all cursor-pointer hover:shadow-xl hover:scale-[1.01] ${
                    isUnread 
                      ? 'bg-white border-amber-300 shadow-md shadow-amber-500/5' 
                      : isRead 
                        ? 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50/60' 
                        : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  {/* Indicador superior */}
                  <div className="absolute top-5 right-5 flex items-center gap-2">
                    {isUnread && (
                      <span className="bg-amber-400 text-amber-950 font-black text-[8px] uppercase px-2 py-0.5 rounded-full animate-pulse shadow-sm shadow-amber-400/20">
                        Novo
                      </span>
                    )}
                    {isRead && (
                      <span className="bg-emerald-100 text-emerald-800 font-black text-[8px] uppercase px-2 py-0.5 rounded-full shadow-sm">
                        Lido
                      </span>
                    )}
                    {report.status === 'archived' && (
                      <span className="bg-neutral-200 text-neutral-600 font-black text-[8px] uppercase px-2 py-0.5 rounded-full">
                        Arquivado
                      </span>
                    )}
                  </div>

                  <div className="flex gap-4 items-start">
                    {/* Icone do Consultor */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black uppercase text-white shadow-md ${
                      isUnread ? 'bg-gradient-to-br from-amber-400 to-yellow-500' : 'bg-gradient-to-br from-neutral-800 to-black'
                    }`}>
                      {(report.vendorName || 'V').slice(0, 2)}
                    </div>

                    <div className="space-y-1">
                      <p className="font-extrabold text-sm text-neutral-900 leading-tight uppercase group-hover:text-amber-500 transition-colors">
                        {report.vendorName}
                      </p>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase">
                        {new Date(report.createdAt || report.weekStart).toLocaleDateString('pt-BR')} &bull; {report.salesCount || 0} VENDAS
                      </p>
                      
                      <div className="pt-2 flex items-center gap-3">
                        <div className="bg-black/5 px-3 py-1 rounded-xl">
                          <p className="text-[11px] font-black text-neutral-900 leading-none">
                            R$ {(report.totalFees || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions rápidas */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <p className="text-[9px] font-bold text-neutral-400 uppercase">Clique para abrir detalhes</p>
                    <div className="flex gap-2">
                      {report.status !== 'archived' ? (
                        <button
                          onClick={(e) => handleArchiveReport(report.id, e)}
                          title="Arquivar no banco"
                          className="p-1.5 hover:bg-neutral-100 rounded-xl text-neutral-400 hover:text-neutral-900 transition-colors"
                        >
                          <CheckSquare size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleUnarchiveReport(report.id, e)}
                          title="Desarquivar / Restaurar"
                          className="bg-emerald-500 hover:bg-emerald-600 px-3 py-1 text-[9px] font-black uppercase text-white rounded-xl transition-all"
                        >
                          Restaurar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Detalhado de Relatório */}
        <AnimatePresence>
          {selectedKarolReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border"
              >
                {/* Header */}
                <div className="p-6 bg-neutral-950 text-white flex items-center justify-between border-b">
                  <div>
                    <span className="text-[9px] font-black uppercase text-yellow-400">DETALHAMENTO DE REPASSES</span>
                    <h2 className="text-lg font-black uppercase tracking-tight">{selectedKarolReport.vendorName}</h2>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase">
                      Total de Taxas: R$ {(selectedKarolReport.totalFees || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedKarolReport(null)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Conteúdo */}
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                  {/* Resumo visual rápido */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-neutral-50 p-4 rounded-3xl border border-neutral-100">
                      <p className="text-[8px] font-bold text-neutral-400 uppercase leading-none">TOTAL COMPENSADO</p>
                      <p className="text-base font-black text-black">R$ {(selectedKarolReport.totalFees || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-neutral-50 p-4 rounded-3xl border border-neutral-100">
                      <p className="text-[8px] font-bold text-neutral-400 uppercase leading-none">VENDAS QUALIFICADAS</p>
                      <p className="text-base font-black text-black">{selectedKarolReport.eligibleCount || 0} de {selectedKarolReport.salesCount || 0} vendas</p>
                    </div>
                    <div className="bg-neutral-50 p-4 rounded-3xl border border-neutral-100">
                      <p className="text-[8px] font-bold text-neutral-400 uppercase leading-none">DATA DE RECEBIMENTO</p>
                      <p className="text-base font-black text-black">{new Date(selectedKarolReport.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>

                  {/* Tabela de Alunos inclusos neste repasse */}
                  <div className="border border-neutral-100 rounded-3xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-900 text-yellow-400 uppercase font-bold">
                        <tr>
                          <th className="p-3 text-center">Nº</th>
                          <th className="p-3">Aluno</th>
                          <th className="p-3">Cidade</th>
                          <th className="p-3 text-right">Valor Curso</th>
                          <th className="p-3 text-right">Taxa Karol</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-semibold uppercase text-neutral-700">
                        {(selectedKarolReport.details || []).map((detail: any, i: number) => (
                          <tr key={i} className="hover:bg-neutral-50/50">
                            <td className="p-3 text-center text-neutral-400 font-bold">{i + 1}</td>
                            <td className="p-3 font-extrabold text-neutral-900">{detail.name}</td>
                            <td className="p-3 text-neutral-500">{detail.city}</td>
                            <td className="p-3 text-right">R$ {Number(detail.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right text-emerald-600 font-extrabold">R$ {Number(detail.fee || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer com botões de ação */}
                <div className="p-5 bg-neutral-50 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    {selectedKarolReport.status !== 'archived' && (
                      <button
                        onClick={(e) => handleArchiveReport(selectedKarolReport.id, e)}
                        className="w-full sm:w-auto bg-neutral-200 hover:bg-neutral-300 text-neutral-700 text-[10px] font-black uppercase px-6 py-3.5 rounded-2xl transition-all"
                      >
                        Arquivar Relatório
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        // Enviar pelo whatsapp o PDF pronto
                        const doc = new jsPDF();
                        // Header decorativo colorido
                        doc.setFillColor(18, 18, 18);
                        doc.rect(0, 0, 210, 32, 'F');
                        doc.setFillColor(250, 204, 21); // Yellow-400
                        doc.rect(0, 29, 210, 3, 'F');
                        
                        doc.setTextColor(250, 204, 21);
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(18);
                        doc.text("OPERA FORMAÇÃO", 15, 14);
                        
                        doc.setFontSize(11);
                        doc.setTextColor(255, 255, 255);
                        doc.text("RELATÓRIO REVISADO DE TAXAS", 15, 22);
                        
                        doc.setFontSize(8);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(163, 163, 163);
                        doc.text(`CONSULTOR: ${selectedKarolReport.vendorName.toUpperCase()}`, 110, 14);
                        doc.text(`Processado: ${new Date().toLocaleDateString('pt-BR')}`, 110, 22);

                        // Caixa de Resumo no topo
                        doc.setFillColor(243, 244, 246);
                        doc.roundedRect(15, 36, 180, 14, 3, 3, 'F');
                        
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(9);
                        doc.setTextColor(0, 0, 0);
                        doc.text(`Taxas Qualificadas: ${selectedKarolReport.eligibleCount || 0}`, 20, 44);
                        doc.text(`TOTAL DE TAXAS: R$ ${(selectedKarolReport.totalFees || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 85, 44);

                        const tableBody = (selectedKarolReport.details || []).map((d: any, idx: number) => [
                          `${idx + 1}`,
                          d.name.toUpperCase(),
                          d.city.toUpperCase(),
                          `R$ ${Number(d.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                          `R$ ${Number(d.fee).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                          new Date(d.date).toLocaleDateString('pt-BR')
                        ]);

                        autoTable(doc, {
                          startY: 54,
                          head: [['Nº', 'ALUNO', 'CIDADE', 'V. CURSO', 'TAXA KAROL', 'DATA']],
                          body: tableBody,
                          headStyles: { fillColor: [18, 18, 18], textColor: [250, 204, 21], fontSize: 8 },
                          styles: { fontSize: 7, cellPadding: 2, valign: 'middle' },
                          margin: { left: 15, right: 15 }
                        });

                        doc.save(`REPASSE_${selectedKarolReport.vendorName}.pdf`);
                        
                        // Envia para o WhatsApp do Consultor correspondente
                        const userPhone = "5547996632424"; // Telefone administrativo preferencial das taxas
                        const whatsappUrl = `https://wa.me/${userPhone}?text=Ol%C3%A1!%20Aqui%20est%C3%A1%20o%20Relat%C3%B3rio%20de%20Taxas%20de%20${selectedKarolReport.vendorName}%20prontinho%20para%20confer%C3%AAncia.%20Valor%20total:%20R$%20${selectedKarolReport.totalFees.toLocaleString('pt-BR')}`;
                        window.open(whatsappUrl, '_blank');
                      }}
                      className="w-full sm:w-auto bg-black text-white hover:bg-neutral-800 text-[10px] font-black uppercase px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      <Download size={14} /> Download e Whatsapp
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderKarolAutomations = () => {
    // 1. Obter lista de consultores únicos
    const uniqueConsultants = Array.from(new Set(feeReports.map(r => r.vendorName || 'Vendedor'))).filter(Boolean);

    // 2. Filtrar e consolidar relatórios para o consultor selecionado
    const selectedVendorReports = feeReports.filter(r => {
      if (!automationSelectedVendor) return false;
      const isSameVendor = (r.vendorName || '').toLowerCase() === automationSelectedVendor.toLowerCase();
      
      if (!isSameVendor) return false;

      if (automationDateFilter === 'all') return true;
      
      const reportDate = new Date(r.createdAt || r.weekStart);
      const diffTime = Math.abs(new Date().getTime() - reportDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (automationDateFilter === 'week') return diffDays <= 7;
      if (automationDateFilter === 'month') return diffDays <= 30;
      
      return true;
    });

    // 3. Somatório das taxas consolidadas
    const consolidatedTotal = selectedVendorReports.reduce((acc, r) => acc + (r.totalFees || 0), 0);
    const consolidatedSalesCount = selectedVendorReports.reduce((acc, r) => acc + (r.salesCount || 0), 0);

    // 4. Copiar mensagem rápida
    const copyLiberationTemplate = () => {
      if (!automationSelectedVendor) {
        alert("Escolha um consultor primeiro para gerar o template!");
        return;
      }
      const text = `Olá, ${automationSelectedVendor}! 👋🏻\n` +
                   `Acabei de revisar e processar seus relatórios de taxas no sistema.\n\n` +
                   `📊 *Resumo Consolidado*\n` +
                   `• Volume total: *${consolidatedSalesCount} vendas*\n` +
                   `• Valor das Taxas Liberadas: *R$ ${consolidatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n` +
                   `Excelente trabalho! O financeiro já foi atualizado. 🚀`;
      navigator.clipboard.writeText(text);
      alert("Template copiado com sucesso! Agora é só colar no WhatsApp.");
    };

    const downloadConsolidatedPDF = () => {
      if (selectedVendorReports.length === 0) {
        alert("Não há relatórios para gerar o PDF consolidado.");
        return;
      }

      const doc = new jsPDF();
      doc.setFillColor(18, 18, 18);
      doc.rect(0, 0, 210, 32, 'F');
      doc.setFillColor(250, 204, 21); // Yellow-400
      doc.rect(0, 29, 210, 3, 'F');
      
      doc.setTextColor(250, 204, 21);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("OPERA FORMAÇÃO", 15, 14);
      
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("CONSOLIDADOR GERAL DE REPASSES - ADMIN", 15, 22);
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(163, 163, 163);
      doc.text(`CONSULTOR / PARCEIRO: ${automationSelectedVendor.toUpperCase()}`, 110, 14);
      doc.text(`EMISSÃO EM: ${new Date().toLocaleDateString('pt-BR')}`, 110, 22);

      // Caixa superior
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(15, 36, 180, 14, 3, 3, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total de Relatórios Somados: ${selectedVendorReports.length}`, 20, 44);
      doc.text(`VOLUME TOTAL DE VENDAS: ${consolidatedSalesCount}`, 85, 44);
      doc.text(`TOTAL LIBERADO: R$ ${consolidatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 140, 44);

      // Agrupar todos os detalhes de todos os relatórios em um array único
      const allStudentsDetails: any[] = [];
      selectedVendorReports.forEach(r => {
        if (r.details) {
          allStudentsDetails.push(...r.details);
        }
      });

      const tableBody = allStudentsDetails.map((student, index) => [
        `${index + 1}`,
        (student.name || '').toUpperCase(),
        (student.city || '').toUpperCase(),
        `R$ ${Number(student.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${Number(student.fee || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        new Date(student.date || student.createdAt).toLocaleDateString('pt-BR')
      ]);

      autoTable(doc, {
        startY: 54,
        head: [['Nº', 'ALUNO', 'CIDADE', 'V. CURSO', 'TAXA KAROL', 'DATA VENDEDOR']],
        body: tableBody,
        headStyles: { fillColor: [18, 18, 18], textColor: [250, 204, 21], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 1.5, valign: 'middle' },
        margin: { left: 15, right: 15 }
      });

      doc.save(`CONSOLIDADO_TAXAS_${automationSelectedVendor}.pdf`);
      alert("PDF Consolidado baixado com sucesso!");
    };

    return (
      <div className="space-y-6 max-w-5xl mx-auto px-4 mt-4">
        {/* Header decorativo */}
        <div className="bg-gradient-to-r from-neutral-900 to-neutral-950 text-white p-6 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" />
          <div>
            <p className="text-[10px] font-black uppercase text-yellow-400 tracking-wider">MÓDULO EXCLUSIVO</p>
            <h1 className="text-2xl font-black uppercase tracking-tight">Central de Automação</h1>
            <p className="text-[11px] font-bold text-neutral-400 uppercase">Ferramentas de escala e relatórios agregados para Karol</p>
          </div>
        </div>

        {/* Console de ferramentas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Caixa de Consolidação */}
          <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black/5 text-black rounded-xl flex items-center justify-center">
                <TableProperties size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase text-neutral-900">Agregador de Repasses</h3>
                <p className="text-[9px] font-bold text-neutral-400 uppercase">Combine múltiplos relatórios em um único lote</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-neutral-400">Selecionar Consultor</label>
                <select
                  value={automationSelectedVendor}
                  onChange={(e) => setAutomationSelectedVendor(e.target.value)}
                  className="w-full text-xs font-bold uppercase py-3 px-4 rounded-xl border border-neutral-200 focus:outline-none"
                >
                  <option value="">-- Escolha um Consultor --</option>
                  {uniqueConsultants.map((vendor, idx) => (
                    <option key={idx} value={vendor}>{vendor}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-neutral-400">Filtrar Histórico por</label>
                <select
                  value={automationDateFilter}
                  onChange={(e: any) => setAutomationDateFilter(e.target.value)}
                  className="w-full text-xs font-bold uppercase py-3 px-4 rounded-xl border border-neutral-200 focus:outline-none"
                >
                  <option value="all">Todo o Histórico</option>
                  <option value="week">Últimos 7 dias</option>
                  <option value="month">Últimos 30 dias</option>
                </select>
              </div>
            </div>

            {automationSelectedVendor && (
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-neutral-400">Resultados da Agregação</p>
                  <span className="bg-neutral-800 text-yellow-400 font-extrabold text-[8px] uppercase px-2 py-0.5 rounded-full">
                    {selectedVendorReports.length} Relatórios Somados
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[8px] font-black uppercase text-neutral-400 leading-none">Total Consolidado</span>
                    <p className="text-base font-black text-black">R$ {consolidatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-neutral-400 leading-none">Vendas Somadas</span>
                    <p className="text-base font-black text-black">{consolidatedSalesCount} alunos</p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={downloadConsolidatedPDF}
                    disabled={selectedVendorReports.length === 0}
                    className="flex-1 bg-black text-white hover:bg-neutral-800 text-[10px] font-black uppercase px-4 py-3 rounded-xl transition-all disabled:opacity-50"
                  >
                    Baixar Relatório Unificado [.PDF]
                  </button>
                  <button
                    onClick={copyLiberationTemplate}
                    className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-850 text-[10px] font-black uppercase px-4 py-3 rounded-xl transition-all"
                  >
                    Copiar WhatsApp de Liberação
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-400/10 text-yellow-400 rounded-xl flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-neutral-900">Configuração Rápida</h3>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase">Mensagens instantâneas e atalhos</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                  <p className="text-[9px] font-black text-emerald-800 uppercase">Acesso Liberado para Karol</p>
                  <p className="text-[8px] font-semibold text-emerald-600 uppercase">Seu e-mail profissional karol@opera.com possui permissão administrativa total das taxas.</p>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <p className="text-[9px] font-bold text-neutral-500 uppercase">Suporte Whatsapp das Taxas</p>
                  <p className="text-[10px] font-extrabold text-neutral-800 leading-tight uppercase">5547996632424</p>
                </div>

                <div className="p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase text-yellow-600">Automação Push Agendada</p>
                    <span className="bg-yellow-400 text-black font-extrabold text-[8px] uppercase px-2 py-0.5 rounded-full animate-pulse">
                      Ativo 09h00
                    </span>
                  </div>
                  <p className="text-[9.5px] font-bold text-neutral-600 leading-snug">
                    Lembrete automático diário de vendas enviado para os vendedores para que preencham suas vendas em tempo real.
                  </p>
                  <button
                    onClick={async () => {
                      if (!window.confirm("Deseja testar e disparar o lembrete diário de vendas de 09:00 agora para todos os vendedores cadastrados?")) {
                        return;
                      }
                      try {
                        const res = await fetch("/api/trigger-vendedor-reminder", { method: "POST" });
                        if (res.ok) {
                          const data = await res.json();
                          alert(`🚀 Lembrete disparado com sucesso!\nEnviados com sucesso: ${data.sentCount} dispositivo(s)\nTokens inativos limpos: ${data.staleCount}`);
                        } else {
                          throw new Error("Erro no servidor");
                        }
                      } catch (err: any) {
                        alert("❌ Erro ao disparar lembrete de teste: " + err.message);
                      }
                    }}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black text-[9px] font-black uppercase px-4 py-3 rounded-xl transition-all shadow-md shadow-yellow-400/20 flex items-center justify-center gap-1.5"
                  >
                    <Send size={10} /> Disparar Teste Manual Agora
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-100">
              <p className="text-[8px] font-bold text-neutral-400 text-center uppercase">Modulo de Automação &copy; Opera Inteligência</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGestorReceipts = () => {
    const today = new Date().toLocaleDateString('pt-BR');

    const downloadReceiptsPDF = (receiptsToPrint: any[], ecoMode = false) => {
      const doc = new jsPDF();
      const today = new Date().toLocaleDateString('pt-BR');
      
      let currentY = 20;

      receiptsToPrint.forEach((receipt, index) => {
        // Se já tem um recibo na página e não cabe o próximo, adiciona nova página
        // Colocamos no máximo 2 recibos por página
        if (index > 0 && index % 2 === 0) {
          doc.addPage();
          currentY = 20;
        } else if (index > 0 && index % 2 !== 0) {
          // Segundo recibo da página, mover para a metade de baixo
          currentY = 155;
          // Desenha uma linha de corte pontilhada entre eles
          doc.setDrawColor(200, 200, 200);
          doc.setLineDashPattern([2, 1], 0);
          doc.line(10, 148.5, 200, 148.5);
          doc.setLineDashPattern([], 0);
        }

        // Título Estilizado
        doc.setFont('times', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.text('RECIBO', 105, currentY + 15, { align: 'center' });

        doc.setLineWidth(0.5);
        doc.setDrawColor(0, 0, 0);
        doc.line(40, currentY + 22, 170, currentY + 22);

        // Corpo do Texto
        doc.setFont('times', 'normal');
        doc.setFontSize(14);
        
        const valor = Number(receipt.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const text = `Pelo presente, eu ${String(receipt.name || "____________________").toUpperCase()}, inscrito no CPF nº ${receipt.cpf || "____.____.____-__"}, declaro que recebi a quantia de R$ ${valor}, REFERENTE A TAXAS DA SEMANA, da Escola Opera Formação inscrita no CNPJ nº 58.349.569/0001-47, na data de hoje ${today}.`;
        
        const splitText = doc.splitTextToSize(text, 160);
        doc.text(splitText, 25, currentY + 40);

        // Linha de Assinatura
        doc.line(55, currentY + 95, 155, currentY + 95);
        doc.setFontSize(11);
        doc.setFont('times', 'bold');
        doc.text(String(receipt.name || "ASSINATURA").toUpperCase(), 105, currentY + 102, { align: 'center' });
        
        // Rodapé pequeno
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 150, 150);
        doc.text(`Autenticado digitalmente via Sistema Opera em ${new Date().toLocaleString('pt-BR')}`, 105, currentY + 125, { align: 'center' });
      });

      doc.save(`recibos_opera_${ecoMode ? 'ECO_' : ''}${new Date().getTime()}.pdf`);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tighter uppercase">Gestão de Recibos e Taxas</h2>
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Recibos postados pela Secretaria Karol</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => downloadReceiptsPDF(displayedReceiptSubmissions, false)}
              className="px-6 h-12 bg-yellow-400 text-black rounded-2xl flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-yellow-400/20 active:scale-95"
            >
              <Eye size={18} strokeWidth={3} />
              <span className="text-[10px] font-black uppercase tracking-widest">Ver Todos</span>
            </button>
            <button 
              onClick={() => downloadReceiptsPDF(displayedReceiptSubmissions, true)}
              className="px-6 h-12 bg-white/5 border border-white/10 text-white rounded-2xl flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95"
            >
              <Printer size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Eco Print</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedReceiptSubmissions.length === 0 ? (
            <div className="lg:col-span-3 py-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
               <ClipboardCheck size={48} className="text-neutral-700 mx-auto mb-4" />
               <p className="text-neutral-500 font-bold uppercase text-[10px] tracking-widest">Nenhum recibo postado até o momento</p>
            </div>
          ) : (
            [...displayedReceiptSubmissions].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).map(submission => (
              <motion.div 
                key={submission.id}
                className="bg-neutral-900 border border-white/5 p-6 rounded-[2.5rem] space-y-4 hover:border-yellow-400/30 transition-all relative overflow-hidden group"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Valor Recebido</p>
                    <p className="text-3xl font-black text-white">R$ {Number(submission.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className={`px-3 py-1 text-[8px] font-black uppercase rounded-full border ${submission.isLocalPending ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                    {submission.isLocalPending ? 'SALVO OFFLINE' : new Date(submission.timestamp || '').toLocaleDateString()}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <User size={14} className="text-neutral-500" />
                    <div>
                      <p className="text-[8px] font-black text-neutral-500 uppercase">Recebedor</p>
                      <p className="text-xs font-bold uppercase flex items-center gap-1.5">
                        {submission.name}
                        {submission.isLocalPending && (
                          <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1 py-0.5 rounded text-[7px] font-black uppercase tracking-wider">
                            PENDENTE SINC
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CreditCard size={14} className="text-neutral-500" />
                    <div>
                      <p className="text-[8px] font-black text-neutral-500 uppercase">CPF</p>
                      <p className="text-xs font-bold">{submission.cpf}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => downloadReceiptsPDF([submission], false)}
                    className="flex-1 py-4 bg-yellow-400 text-black rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-yellow-400/10"
                  >
                    <Eye size={16} /> VER
                  </button>
                  <button 
                    onClick={() => handleDeleteReceipt(submission.id)}
                    className="p-4 bg-red-400/10 text-red-500 rounded-2xl border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shadow-xl shadow-red-500/5 group/del"
                    title="Excluir Recibo"
                  >
                    <Trash2 size={16} className="group-hover/del:scale-110 transition-transform" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    );
  };

  // --- IA CHATBOT FUNCTIONS & COMPONENT ---
  const getLocalFallbackResponseFront = (userMessage: string): string => {
    const text = (userMessage || "").toLowerCase().trim();

    if (text === "oi" || text === "olá" || text === "ola" || text === "bom dia" || text === "boa tarde" || text === "olá, tudo bem?") {
      return "Oi, tudo bem? Que bom falar com você! Me conta, você já trabalha na área ou seria seu primeiro curso?";
    }

    if (text.includes("qual valor") || text.includes("preço") || text.includes("custo") || text.includes("quanto custa") || text.includes("valores")) {
      return "Já te explico isso, mas me conta rapidinho o que te chamou atenção nas máquinas pesadas.";
    }

    if (text.includes("já tenho experiência") || text.includes("ja tenho experiencia") || text.includes("tenho experiência")) {
      return "Muito legal! Ter experiência prévia facilita bastante o processo de certificação e aprendizado das novas máquinas. Com quais modelos você já trabalhou?";
    }

    if (text.includes("primeiro curso") || text.includes("é meu primeiro") || text.includes("nunca fiz")) {
      return "Fazer o primeiro curso é uma grande conquista e abre muitas portas! Nós acolhemos todo mundo que está começando do absoluto zero e damos toda a segurança e suporte nas aulas práticas.";
    }

    if (text.includes("caro") || text.includes("salgado") || text.includes("preço alto") || text.includes("muito caro")) {
      return "Essa questão do investimento é super comum e muito importante de avaliar. Normalmente, vale a pena entender com o que o cliente está comparando para ressaltar as nossas aulas práticas em máquinas reais e o certificado nacional. O que você sente que pesa mais para ele?";
    }

    if (text.includes("vou pensar") || text.includes("pensar") || text.includes("analisar")) {
      return "O tempo de reflexão faz parte do processo de qualquer decisão importante. Uma ótima saída aqui é manter a porta aberta de forma leve e perguntar se faltou alguma informação sobre as aulas práticas ou certificado. Como você costuma dar esse retorno?";
    }

    if (text.includes("sem dinheiro") || text.includes("dinheiro") || text.includes("liso") || text.includes("apertado")) {
      return "Essa situação financeira exige muito cuidado e empatia no atendimento. O melhor caminho é mostrar o retorno rápido que a profissão de operador de máquinas traz e oferecer formas de parcelamento facilitadas. O que acha de propor uma simulação mais leve?";
    }

    if (text.includes("sem tempo") || text.includes("tempo") || text.includes("corrido")) {
      return "A correria do dia a dia é um desafio real para muitos alunos. O ideal é ressaltar que nossa formação é intensiva e focada na prática no fim de semana para não atrapalhar o trabalho dele. Qual horário você sugeriu para falar com ele?";
    }

    if (text.includes("esposa") || text.includes("marido") || text.includes("família") || text.includes("falar com")) {
      return "Decidir em família é sempre o melhor caminho e traz muito apoio. Uma boa ideia é enviar fotos das nossas máquinas de verdade e do certificado nacional para ele mostrar em casa. Quer que eu te passe esses materiais agora?";
    }

    if (text.includes("sumiu") || text.includes("não responde") || text.includes("vácuo") || text.includes("ignora")) {
      return "Isso acontece bastante no dia a dia. Uma retomada sem pressão é o melhor caminho, mostrando que você está aqui para ajudar e não para forçar uma venda. Você já tentou mandar um áudio descontraído ou fotos das máquinas?";
    }

    if (text.includes("cansado") || text.includes("cansada") || text.includes("esgotado")) {
      return "Esses dias puxados drenam bastante a nossa energia. Se quiser, faz uma pausa rápida para respirar e depois voltamos com tudo nos treinamentos.";
    }

    if (text.includes("não sei") || text.includes("nao sei") || text.includes("não tenho informação")) {
      return "Não tenho informação suficiente para afirmar isso.";
    }

    if (text === "quanto é 2+2" || text === "2+2") {
      return "4";
    }

    return "Boa colocação. No atendimento do dia a dia, nosso foco é sempre entender o momento de vida da pessoa e oferecer a melhor orientação. Onde você sente que está o maior desafio na sua rotina atual?";
  };

  const iaChatEndRef = useRef<HTMLDivElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (iaChatEndRef.current) {
      iaChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [iaMessages, iaIsLoading]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleSendIAMessage = async (textToSend?: string) => {
    const text = (textToSend || iaInput).trim();
    if (!text) return;

    // Remove old error messages or internal system flags
    setIaMessages(prev => prev.filter(m => !m.isError));

    const userMsg = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...iaMessages.filter(m => !m.isError), userMsg];
    setIaMessages(updatedMessages);
    setIaInput('');
    setIaIsLoading(true);

    let success = false;
    let aiResponseText = "";
    let attempts = 0;
    const maxAttempts = 3;

    while (!success && attempts < maxAttempts) {
      attempts++;
      try {
        const response = await fetch('/api/gemini-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages.map(m => ({ role: m.role, content: m.content }))
          })
        });

        const data = await response.json();
        if (data.success && data.text) {
          aiResponseText = data.text;
          success = true;
        }
      } catch (err) {
        console.warn(`Tentativa ${attempts} de ${maxAttempts} falhou:`, err);
      }
    }

    if (success && aiResponseText) {
      setIaMessages(prev => [
        ...prev,
        {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          content: aiResponseText,
          timestamp: new Date().toISOString()
        }
      ]);
    } else {
      // Se falhar após as 3 tentativas, exibir a mensagem obrigatória
      setIaMessages(prev => [
        ...prev,
        {
          id: `ast-err-${Date.now()}`,
          role: 'assistant',
          content: "Não consegui responder agora. Tente novamente em instantes.",
          timestamp: new Date().toISOString(),
          isError: true,
          retryText: text
        }
      ]);
    }

    setIaIsLoading(false);
  };

  const resetIAChat = () => {
    setIaMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: "Olá! Sou o seu Treinador de Vendas IA. Estou aqui para te ensinar a dominar o script de atendimento humano da Opera Formação, quebrar objeções e dominar os fechamentos e ligações de sucesso! Como posso te ajudar hoje?",
        timestamp: new Date().toISOString()
      }
    ]);
  };

  const renderEquipeTab = () => {
    // Calcular as métricas coletivas da equipe
    const teamTotalConfirmed = sellersStats.reduce((sum, s) => sum + (s.confirmedCount || 0), 0);
    const teamTotalLeads = sellersStats.reduce((sum, s) => sum + (s.leadsCount || 0), 0);
    const teamConversionRate = teamTotalLeads > 0 ? (teamTotalConfirmed / teamTotalLeads) * 100 : 0;
    const teamTotalDiscount = sellersStats.reduce((sum, s) => sum + (s.totalDiscount || 0), 0);

    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Banner de Boas-vindas / Título */}
        <div className="bg-gradient-to-r from-neutral-900 to-neutral-850 border border-neutral-800 p-6 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-yellow-400/10 rounded-2xl text-yellow-400 animate-pulse">
              <Users size={32} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase text-white tracking-tight">Painel da Equipe Gonçalves</h2>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-1">Acesso Exclusivo: Gerente Gonçalves & Lucas Gonçalves</p>
            </div>
          </div>
          <div className="flex gap-2 relative z-10 w-full md:w-auto">
            <button
              onClick={() => downloadEquipeReport(false)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-yellow-400 text-black font-black uppercase text-[10px] tracking-wider rounded-2xl hover:bg-yellow-300 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-yellow-400/10 cursor-pointer"
            >
              <Printer size={16} /> Imprimir Tudo (PDF)
            </button>
            <button
              onClick={() => downloadEquipeReport(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-neutral-800 border border-neutral-700 text-white font-black uppercase text-[10px] tracking-wider rounded-2xl hover:bg-neutral-700 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Printer size={16} /> Impressão ECO
            </button>
          </div>
        </div>

        {/* Métricas Coletivas da Equipe */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-neutral-900 border border-neutral-800/80 p-5 rounded-[2rem] text-center relative overflow-hidden group">
            <p className="text-3xl font-black text-white">{teamTotalConfirmed}</p>
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-1.5 flex items-center justify-center gap-1">
              <CheckCircle2 size={12} className="text-green-500" /> Vendas Confirmadas
            </p>
            <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500/80" />
          </div>

          <div className="bg-neutral-900 border border-neutral-800/80 p-5 rounded-[2rem] text-center relative overflow-hidden group">
            <p className="text-3xl font-black text-yellow-400">{teamTotalLeads}</p>
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-1.5 flex items-center justify-center gap-1">
              <Target size={12} className="text-yellow-400" /> Leads Recebidos
            </p>
            <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-400" />
          </div>

          <div className="bg-neutral-900 border border-neutral-800/80 p-5 rounded-[2rem] text-center relative overflow-hidden group">
            <p className="text-3xl font-black text-cyan-400">{teamConversionRate.toFixed(1)}%</p>
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-1.5 flex items-center justify-center gap-1">
              <Percent size={12} className="text-cyan-400" /> Conversão Coletiva
            </p>
            <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-400" />
          </div>

          <div className="bg-neutral-900 border border-neutral-800/80 p-5 rounded-[2rem] text-center relative overflow-hidden group">
            <p className="text-2xl font-black text-red-500">R$ {Math.round(teamTotalDiscount).toLocaleString('pt-BR')}</p>
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-1.5 flex items-center justify-center gap-1">
              <DollarSign size={12} className="text-red-500" /> Descontos Concedidos
            </p>
            <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
          </div>
        </div>

        {/* Formulário: Adicionar Consultor Sem Acesso */}
        <div className="bg-neutral-900 border border-neutral-800/80 p-6 rounded-[2.5rem] shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="text-yellow-400" size={18} />
            <h3 className="text-sm font-black uppercase text-white tracking-wider">Adicionar Vendedor Sem Acesso</h3>
          </div>
          <form onSubmit={handleAddExternalSeller} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Nome Completo</label>
              <input 
                type="text"
                placeholder="Ex: Amanda Souza"
                value={newExtName}
                onChange={(e) => setNewExtName(e.target.value)}
                className="w-full bg-black/60 border border-neutral-800 focus:border-yellow-400/50 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none transition-colors"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">E-mail (Para identificação)</label>
              <input 
                type="email"
                placeholder="Ex: amanda@opera.com"
                value={newExtEmail}
                onChange={(e) => setNewExtEmail(e.target.value)}
                className="w-full bg-black/60 border border-neutral-800 focus:border-yellow-400/50 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none transition-colors"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={isAddingExt}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-yellow-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-black uppercase text-[10px] tracking-wider rounded-2xl hover:bg-yellow-300 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-lg shadow-yellow-400/5 font-black"
              >
                {isAddingExt ? <RefreshCcw size={14} className="animate-spin" /> : <PlusCircle size={14} />} Adicionar na Equipe
              </button>
            </div>
          </form>
        </div>

        {/* Lista Detalhada de Cada Membro da Equipe */}
        <div className="bg-neutral-900 border border-neutral-800/60 p-6 rounded-[2.5rem] space-y-4 shadow-xl">
          <div className="flex justify-between items-center px-2">
            <div>
              <h3 className="text-sm font-black uppercase text-white tracking-wider">Acompanhamento Individual</h3>
              <p className="text-[9px] text-neutral-500 font-bold uppercase mt-0.5">Insira a quantidade de leads de cada consultor para calcular a conversão individual em tempo real.</p>
            </div>
            {isSavingLeads && (
              <span className="text-[9px] font-black text-yellow-400 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                <RefreshCcw size={12} className="animate-spin" /> Salvando...
              </span>
            )}
          </div>

          <div className="space-y-3">
            {sellersStats.map((seller: any) => {
              const conversion = seller.leadsCount > 0 
                ? ((seller.confirmedCount / seller.leadsCount) * 100).toFixed(1) 
                : '0.0';

              return (
                <div 
                  key={seller.id}
                  className="bg-black/40 border border-neutral-800/80 hover:border-neutral-750 p-4 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4 transition-all"
                >
                  {/* Informações Básicas do Vendedor */}
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center overflow-hidden border border-white/5 shrink-0">
                      {seller.profilePic ? (
                        <img src={seller.profilePic} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="text-yellow-400" size={24} />
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-sm uppercase text-white flex items-center gap-1.5">
                        {seller.name || 'Consultor'}
                        {seller.id === user?.uid && <span className="text-[8px] bg-yellow-400 text-black px-1.5 py-0.5 rounded font-black tracking-widest uppercase">VOCÊ</span>}
                      </h4>
                      <p className="text-[9px] text-neutral-500 font-bold uppercase mt-0.5 tracking-wider">{seller.email}</p>
                    </div>
                  </div>

                  {/* Estatísticas Individuais (Vendas & Desconto) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:flex items-center gap-4 md:gap-8 w-full md:w-auto justify-between border-t border-b border-white/5 md:border-none py-3 md:py-0">
                    <div className="text-center md:text-right">
                      <p className="text-neutral-500 text-[8px] font-black uppercase tracking-widest">Vendas</p>
                      <p className="text-lg font-black text-white mt-0.5">{seller.confirmedCount || 0}</p>
                    </div>

                    <div className="text-center md:text-right">
                      <p className="text-neutral-500 text-[8px] font-black uppercase tracking-widest">Descontos</p>
                      <p className="text-sm font-black text-red-500 mt-1">R$ {Math.round(seller.totalDiscount || 0).toLocaleString('pt-BR')}</p>
                    </div>

                    <div className="col-span-2 sm:col-span-1 text-center md:text-right flex flex-col items-center md:items-end">
                      <p className="text-neutral-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                        <Percent size={10} className="text-cyan-400" /> Conversão
                      </p>
                      <p className="text-sm font-black text-cyan-400 mt-0.5">{conversion}%</p>
                    </div>
                  </div>

                  {/* Controle de Leads (Input de Leads) & Ações */}
                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto bg-black/60 p-2 md:p-1.5 rounded-2xl border border-neutral-800">
                      <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest ml-2 block md:hidden">Quantidade de Leads:</span>
                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={() => {
                            const currentVal = seller.leadsCount || 0;
                            updateSellerLeads(seller.id, Math.max(0, currentVal - 1));
                          }}
                          className="w-8 h-8 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 active:scale-95 rounded-xl text-white transition-all text-sm font-black cursor-pointer"
                        >
                          -
                        </button>
                        <input 
                          type="number" 
                          className="bg-black/80 text-center text-xs font-black w-14 py-1.5 rounded-xl border border-neutral-800 outline-none text-yellow-400 focus:border-yellow-400/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={seller.leadsCount || 0}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            updateSellerLeads(seller.id, val);
                          }}
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const currentVal = seller.leadsCount || 0;
                            updateSellerLeads(seller.id, currentVal + 1);
                          }}
                          className="w-8 h-8 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 active:scale-95 rounded-xl text-white transition-all text-sm font-black cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {seller.id !== user?.uid && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSeller(seller.id, seller.name);
                        }}
                        className="w-11 h-11 shrink-0 flex items-center justify-center bg-red-500/10 hover:bg-red-500 hover:text-white rounded-2xl text-red-500 border border-red-500/20 transition-all cursor-pointer"
                        title="Remover Vendedor"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {sellersStats.length === 0 && (
              <div className="text-center py-12 bg-neutral-950/40 rounded-3xl border border-dashed border-neutral-800">
                <p className="text-xs font-black text-neutral-500 uppercase tracking-widest">Nenhum consultor registrado na equipe.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCarteirinhaTab = () => {
    const isCarteirinhaManager = isLucas;

    const machineCategories = [
      {
        name: 'Máquinas Pesadas',
        items: [
          'Escavadeira Hidráulica',
          'Retroescavadeira',
          'Pá Carregadeira',
          'Mini Pá Carregadeira',
          'Motoniveladora',
          'Trator de Esteira',
          'Rolo Compactador'
        ]
      },
      {
        name: 'Máquinas Agrícolas',
        items: [
          'Trator Agrícola',
          'Pulverizador',
          'Colheitadeira'
        ]
      },
      {
        name: 'Máquinas Florestais',
        items: [
          'Harvester',
          'Forwarder',
          'Skidder',
          'Feller Buncher',
          'Processador Florestal'
        ]
      },
      {
        name: 'Empilhadeira',
        items: [
          'Empilhadeira'
        ]
      },
      {
        name: 'Caminhão Munck',
        items: [
          'Caminhão Munck'
        ]
      }
    ];

    const handleMachineToggle = (machine: string) => {
      const currentList = carteirinhaMachines.split('\n').map(m => m.trim()).filter(Boolean);
      let newList: string[];
      if (currentList.some(m => m.toLowerCase() === machine.toLowerCase())) {
        newList = currentList.filter(m => m.toLowerCase() !== machine.toLowerCase());
      } else {
        newList = [...currentList, machine];
      }
      setCarteirinhaMachines(newList.join('\n'));
    };

    const handleSelectClient = (client: any) => {
      setCarteirinhaClientName(client.name);
      setCarteirinhaCpf(formatCPF(client.cpf || ''));
      setCarteirinhaPhone('');
      
      if (client.birthDate) {
        setCarteirinhaBirthDate(formatBirthDate(client.birthDate));
      } else {
        setCarteirinhaBirthDate('');
      }

      // Automated validity: today + 1 year
      const today = new Date();
      const validityDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
      const formattedDate = validityDate.toLocaleDateString('pt-BR');
      setCarteirinhaValidity(formattedDate);

      // Pre-select machine based on course name
      if (client.course) {
        let matched: string[] = [];
        machineCategories.forEach(cat => {
          cat.items.forEach(item => {
            if (client.course.toLowerCase().includes(item.toLowerCase())) {
              matched.push(item);
            }
          });
        });
        if (matched.length > 0) {
          setCarteirinhaMachines(matched.join('\n'));
        } else {
          setCarteirinhaMachines(client.course);
        }
      }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setRawPhotoUrl(event.target.result as string);
            setCropZoom(1.0);
            setCropX(0);
            setCropY(0);
            setCropRotation(0);
            setIsCropping(true);
          }
        };
        reader.readAsDataURL(file);
      }
    };

    const generateCroppedImage = () => {
      if (!rawPhotoUrl) return;
      const img = new Image();
      img.src = rawPhotoUrl;
      img.onload = () => {
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 600;
        cropCanvas.height = 800;
        const ctx = cropCanvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

        ctx.save();
        ctx.translate(cropCanvas.width / 2, cropCanvas.height / 2);
        ctx.rotate((cropRotation * Math.PI) / 180);
        ctx.scale(cropZoom, cropZoom);

        const scaleFactor = 600 / 300;
        ctx.translate(cropX * scaleFactor / cropZoom, cropY * scaleFactor / cropZoom);

        const imgRatio = img.width / img.height;
        const targetRatio = 600 / 800;
        let drawW, drawH;
        if (imgRatio > targetRatio) {
          drawH = 800;
          drawW = 800 * imgRatio;
        } else {
          drawW = 600;
          drawH = 600 / imgRatio;
        }

        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        const croppedDataUrl = cropCanvas.toDataURL('image/jpeg', 0.9);
        setCarteirinhaPhotoUrl(croppedDataUrl);
        setIsCropping(false);
      };
    };

    const handleSaveCalibration = async () => {
      if (!isCarteirinhaManager) {
        alert("Acesso negado: Apenas o gerente Lucas tem permissão para alterar as calibragens!");
        return;
      }

      try {
        setIsSavingCalibration(true);
        await setDoc(doc(db, 'settings', 'carteirinha_calibration'), calibration);
        alert("Calibragem salva com sucesso! Todos os vendedores passarão a utilizar este layout imediatamente.");
      } catch (err) {
        console.error("Erro ao salvar calibragem:", err);
        alert("Erro ao salvar calibragem no Firebase. Verifique suas permissões.");
      } finally {
        setIsSavingCalibration(false);
      }
    };

    const handleResetCalibration = () => {
      if (window.confirm("Deseja realmente redefinir as calibragens para os valores padrão de fábrica?")) {
        setCalibration(DEFAULT_CALIBRATION);
      }
    };

    const handleExportImage = () => {
      const canvas = canvasRef.current;
      if (!canvas) return alert("Erro: Prévia não disponível.");

      try {
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Prévia Carteirinha - ${carteirinhaClientName || 'Cliente'}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error("Erro ao exportar imagem:", err);
        alert("Erro ao gerar imagem. Verifique se a foto do cliente foi carregada corretamente.");
      }
    };

    const handleCopyMessage = async () => {
      const clientName = carteirinhaClientName || 'Cliente';
      const message = `Olá, ${clientName}! 👋

Segue uma prévia de como ficará a sua Carteira de Operador.

⚠️ Esta imagem é apenas um EXEMPLAR, utilizada exclusivamente para demonstração durante o processo de matrícula e não possui validade legal.

Após a confirmação da sua documentação, você receberá a documentação oficial emitida pela Opera Formação.

Ficou alguma dúvida ou podemos dar continuidade e finalizar sua documento? 😊

Estou à disposição!`;

      try {
        await navigator.clipboard.writeText(message);
        setCopiedSuccess(true);
        setTimeout(() => setCopiedSuccess(false), 3000);
      } catch (err) {
        console.error("Erro ao copiar mensagem:", err);
        alert("Não foi possível copiar o texto automaticamente.");
      }
    };

    const updateCalibrationProp = (prop: string, val: any) => {
      setCalibration((prev: any) => ({
        ...prev,
        [prop]: val
      }));
    };

    return (
      <div className="space-y-8 max-w-7xl mx-auto px-4 py-2 text-white">
        {/* Crop Modal */}
        <AnimatePresence>
          {isCropping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-neutral-900 border border-white/10 rounded-[2.5rem] p-6 max-w-xl w-full shadow-2xl space-y-6 my-8"
              >
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-black text-yellow-400 uppercase tracking-tighter">
                    Recorte da Foto do Cliente
                  </h3>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                    Enquadre a foto na área amarela. Ela preencherá a carteirinha perfeitamente.
                  </p>
                </div>

                {/* Crop Box */}
                <div className="relative flex justify-center">
                  <div
                    ref={null}
                    className="relative w-[240px] h-[320px] overflow-hidden rounded-2xl border-4 border-yellow-400 bg-neutral-950 shadow-2xl select-none cursor-grab active:cursor-grabbing"
                    style={{ aspectRatio: '3/4' }}
                    onMouseDown={(e) => {
                      const startX = e.clientX - cropX;
                      const startY = e.clientY - cropY;
                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        setCropX(moveEvent.clientX - startX);
                        setCropY(moveEvent.clientY - startY);
                      };
                      const handleMouseUp = () => {
                        window.removeEventListener('mousemove', handleMouseMove);
                        window.removeEventListener('mouseup', handleMouseUp);
                      };
                      window.addEventListener('mousemove', handleMouseMove);
                      window.addEventListener('mouseup', handleMouseUp);
                    }}
                    onTouchStart={(e) => {
                      if (e.touches.length === 1) {
                        const startX = e.touches[0].clientX - cropX;
                        const startY = e.touches[0].clientY - cropY;
                        const handleTouchMove = (moveEvent: TouchEvent) => {
                          if (moveEvent.touches.length === 1) {
                            setCropX(moveEvent.touches[0].clientX - startX);
                            setCropY(moveEvent.touches[0].clientY - startY);
                          }
                        };
                        const handleTouchEnd = () => {
                          window.removeEventListener('touchmove', handleTouchMove);
                          window.removeEventListener('touchend', handleTouchEnd);
                        };
                        window.addEventListener('touchmove', handleTouchMove);
                        window.addEventListener('touchend', handleTouchEnd);
                      }
                    }}
                  >
                    <img
                      src={rawPhotoUrl || ''}
                      alt="Corte"
                      draggable={false}
                      className="absolute max-w-none origin-center"
                      style={{
                        transform: `translate(${cropX}px, ${cropY}px) scale(${cropZoom}) rotate(${cropRotation}deg)`,
                        top: '0',
                        left: '0',
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none'
                      }}
                    />

                    {/* Guidelines overlay */}
                    <div className="absolute inset-0 border border-white/20 pointer-events-none flex flex-col justify-between p-4">
                      <div className="flex justify-between w-full">
                        <div className="w-4 h-4 border-t-2 border-l-2 border-yellow-400/80"></div>
                        <div className="w-4 h-4 border-t-2 border-r-2 border-yellow-400/80"></div>
                      </div>
                      <div className="self-center text-center bg-black/60 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-yellow-400 border border-yellow-400/20">
                        Arraste para mover
                      </div>
                      <div className="flex justify-between w-full">
                        <div className="w-4 h-4 border-b-2 border-l-2 border-yellow-400/80"></div>
                        <div className="w-4 h-4 border-b-2 border-r-2 border-yellow-400/80"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="space-y-4 bg-neutral-950/40 p-4 rounded-2xl border border-white/5">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                        <span>Zoom</span>
                        <span className="font-mono text-yellow-400">{cropZoom.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="0.1"
                        value={cropZoom}
                        onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                        className="w-full accent-yellow-400 bg-neutral-800"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição X</span>
                          <span className="font-mono text-neutral-300">{cropX}px</span>
                        </div>
                        <input
                          type="range"
                          min="-300"
                          max="300"
                          step="1"
                          value={cropX}
                          onChange={(e) => setCropX(parseInt(e.target.value))}
                          className="w-full accent-yellow-400 bg-neutral-800"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição Y</span>
                          <span className="font-mono text-neutral-300">{cropY}px</span>
                        </div>
                        <input
                          type="range"
                          min="-400"
                          max="400"
                          step="1"
                          value={cropY}
                          onChange={(e) => setCropY(parseInt(e.target.value))}
                          className="w-full accent-yellow-400 bg-neutral-800"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => {
                        setCropX(0);
                        setCropY(0);
                        setCropZoom(1.0);
                        setCropRotation(0);
                      }}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer"
                    >
                      Centralizar Rosto
                    </button>

                    <button
                      onClick={() => setCropRotation((prev) => (prev + 90) % 360)}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1"
                    >
                      <RotateCw size={10} /> Girar 90°
                    </button>
                  </div>
                </div>

                {/* Final Buttons */}
                <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
                  <button
                    onClick={() => {
                      setIsCropping(false);
                      setRawPhotoUrl(null);
                    }}
                    className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={generateCroppedImage}
                    className="px-6 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-black rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-yellow-400/20 cursor-pointer"
                  >
                    Confirmar Foto
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cabecalho de Status */}
        <div className="bg-neutral-900/40 border border-white/5 p-6 rounded-[2rem] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
              <CreditCard className="text-yellow-400" size={28} />
              Prévia da Carteirinha
            </h2>
            <p className="text-xs text-neutral-400 font-medium uppercase tracking-wider mt-1">
              Módulo de simulação comercial de Carteira de Operador (sem validade legal)
            </p>
          </div>

          {isCarteirinhaManager && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCalibrating(!isCalibrating)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 ${
                  isCalibrating 
                    ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20 hover:bg-yellow-500' 
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-white/5'
                }`}
              >
                <Settings size={14} />
                {isCalibrating ? 'Sair da Calibragem' : 'Modo Calibragem'}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* COLUNA ESQUERDA: FORMULÁRIO */}
          <div className="lg:col-span-5 space-y-6">
            {/* Bloco CRM: Buscar Cliente */}
            <div className="bg-neutral-900/50 border border-white/5 p-6 rounded-[2rem] shadow-xl space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-yellow-400 flex items-center gap-2">
                <Search size={16} />
                Buscar do CRM (Contratos/Vendas)
              </h3>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
                  Selecione o Cliente Cadastrado
                </label>
                <div className="relative">
                  <select
                    onChange={(e) => {
                      const client = uniqueClients.find(c => c.name === e.target.value);
                      if (client) handleSelectClient(client);
                    }}
                    defaultValue=""
                    className="w-full bg-neutral-950 border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 cursor-pointer appearance-none"
                  >
                    <option value="" disabled>-- Selecione um Cliente --</option>
                    {uniqueClients.map((client, idx) => (
                      <option key={idx} value={client.name}>
                        {client.name.toUpperCase()} {client.cpf ? `(${client.cpf})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
                <p className="text-[10px] text-neutral-500 font-semibold mt-2 uppercase tracking-wide">
                  O CPF e data de nascimento serão preenchidos automaticamente com base no cadastro do CRM.
                </p>
              </div>
            </div>

            {/* Formulário de Preenchimento */}
            <div className="bg-neutral-900/50 border border-white/5 p-6 rounded-[2rem] shadow-xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Preencher Dados da Carteira
              </h3>

              {/* Upload da Foto */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Foto do Cliente *
                </label>
                <div className="border border-dashed border-white/10 hover:border-yellow-400/40 rounded-2xl p-4 bg-neutral-950/40 transition-colors">
                  <div className="flex flex-col items-center justify-center text-center gap-3">
                    {carteirinhaPhotoUrl ? (
                      <div className="relative group">
                        <img 
                          src={carteirinhaPhotoUrl} 
                          alt="Foto Cliente" 
                          className="w-24 h-32 object-cover rounded-xl border border-white/10"
                        />
                        <button
                          onClick={() => setCarteirinhaPhotoUrl('')}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors cursor-pointer shadow-lg"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Camera className="text-neutral-500" size={32} />
                        <div>
                          <label className="cursor-pointer bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold px-4 py-2 rounded-xl transition-colors inline-block">
                            Selecionar Foto
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handlePhotoChange} 
                              className="hidden" 
                            />
                          </label>
                          <p className="text-[9px] text-neutral-500 font-semibold mt-1.5 uppercase tracking-wider">
                            Selecione a imagem do cliente para abrir o editor de corte
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Nome Completo */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={carteirinhaClientName}
                  onChange={(e) => setCarteirinhaClientName(e.target.value)}
                  placeholder="NOME DO CLIENTE"
                  className="w-full bg-neutral-950 border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              {/* CPF e Nascimento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    CPF
                  </label>
                  <input
                    type="text"
                    value={carteirinhaCpf}
                    onChange={(e) => handleCpfChange(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full bg-neutral-950 border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    Data de Nascimento
                  </label>
                  <input
                    type="text"
                    value={carteirinhaBirthDate}
                    onChange={(e) => handleBirthDateChange(e.target.value)}
                    placeholder="DD/MM/AAAA"
                    className="w-full bg-neutral-950 border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              </div>

              {/* Máquinas Checkbox Selection */}
              <div className="space-y-3">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Máquinas Habilitadas
                </label>
                
                <div className="space-y-4">
                  {machineCategories.map((category, catIdx) => (
                    <div key={catIdx} className="bg-neutral-950/60 p-4 rounded-2xl border border-white/5 space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400 border-b border-white/5 pb-1 block">
                        {category.name}
                      </span>
                      <div className="grid grid-cols-1 gap-1.5">
                        {category.items.map((m, idx) => {
                          const isChecked = carteirinhaMachines.split('\n').map(x => x.trim().toLowerCase()).includes(m.toLowerCase());
                          return (
                            <label 
                              key={idx} 
                              className={`flex items-center gap-2.5 p-1.5 rounded-lg cursor-pointer transition-colors text-xs font-bold ${
                                isChecked ? 'bg-yellow-400/10 text-yellow-400' : 'hover:bg-white/5 text-neutral-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleMachineToggle(m)}
                                className="rounded text-yellow-400 focus:ring-yellow-400 bg-neutral-900 border-white/10"
                              />
                              {m}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AÇÕES DE EXPORTAÇÃO */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleExportImage}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-lg shadow-green-600/20"
                >
                  <Download size={16} />
                  Salvar Imagem
                </button>

                <button
                  onClick={handleCopyMessage}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-lg shadow-blue-600/20"
                >
                  <Copy size={16} />
                  Copiar Mensagem
                </button>
              </div>

              <AnimatePresence>
                {copiedSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="bg-blue-500/10 border border-blue-500/30 rounded-xl py-2 px-4 text-xs font-bold text-blue-400 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={14} />
                    <span>✅ Mensagem copiada com sucesso!</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* COLUNA DIREITA: PREVIEW E CALIBRAGEM */}
          <div className="lg:col-span-7 space-y-6 flex flex-col items-center">
            {/* Visual Canvas Display */}
            <div className="w-full bg-neutral-900/50 border border-white/5 p-6 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 self-start">
                🖼️ PRÉVIA EM ALTA DEFINIÇÃO
              </span>
              
              <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">
                {!bgLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCcw className="animate-spin text-yellow-400" size={32} />
                      <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">
                        Carregando fundo oficial...
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Real interactive canvas */}
                <canvas 
                  ref={canvasRef} 
                  className="w-full h-auto object-contain block bg-neutral-950"
                  style={{ maxHeight: '550px' }}
                />
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center mt-1">
                <AlertCircle size={12} className="text-yellow-500" />
                Demonstração visual comercial sem validade legal (validade gerada automaticamente: {carteirinhaValidity})
              </div>
            </div>

            {/* MODO CALIBRAGEM PANEL */}
            {isCalibrating && isCarteirinhaManager && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full bg-neutral-900 border border-yellow-400/20 p-8 rounded-[2.5rem] shadow-2xl space-y-8"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-yellow-400 uppercase tracking-tighter flex items-center gap-2">
                      <Settings size={20} />
                      PAINEL DE CALIBRAGEM GERAL
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
                      Ajuste as coordenadas finas em pixels para todos os elementos
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleResetCalibration}
                      className="px-3 py-1.5 bg-neutral-800 text-neutral-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider border border-white/5 cursor-pointer transition-colors"
                    >
                      Restaurar Padrão
                    </button>
                    <button
                      onClick={handleSaveCalibration}
                      disabled={isSavingCalibration}
                      className="px-4 py-1.5 bg-green-500 text-white hover:bg-green-600 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isSavingCalibration ? 'Salvando...' : 'Salvar Calibragem'}
                    </button>
                  </div>
                </div>

                {/* Siders Sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* SEÇÃO FOTO */}
                  <div className="bg-neutral-950/40 p-5 rounded-2xl border border-white/5 space-y-4">
                    <h4 className="text-xs font-black text-yellow-400 uppercase tracking-widest border-b border-white/5 pb-2">
                      📷 Posicionamento da Foto
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição X</span>
                          <span className="font-mono text-white">{calibration.photoX}px</span>
                        </div>
                        <input 
                          type="range" min="0" max="800" step="1" 
                          value={calibration.photoX} 
                          onChange={(e) => updateCalibrationProp('photoX', parseInt(e.target.value))}
                          className="w-full accent-yellow-400 bg-neutral-800"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição Y</span>
                          <span className="font-mono text-white">{calibration.photoY}px</span>
                        </div>
                        <input 
                          type="range" min="0" max="800" step="1" 
                          value={calibration.photoY} 
                          onChange={(e) => updateCalibrationProp('photoY', parseInt(e.target.value))}
                          className="w-full accent-yellow-400 bg-neutral-800"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                            <span>Largura</span>
                            <span className="font-mono text-white">{calibration.photoW}px</span>
                          </div>
                          <input 
                            type="range" min="50" max="400" step="1" 
                            value={calibration.photoW} 
                            onChange={(e) => updateCalibrationProp('photoW', parseInt(e.target.value))}
                            className="w-full accent-yellow-400 bg-neutral-800"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                            <span>Altura</span>
                            <span className="font-mono text-white">{calibration.photoH}px</span>
                          </div>
                          <input 
                            type="range" min="50" max="400" step="1" 
                            value={calibration.photoH} 
                            onChange={(e) => updateCalibrationProp('photoH', parseInt(e.target.value))}
                            className="w-full accent-yellow-400 bg-neutral-800"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                            <span>Zoom Foto</span>
                            <span className="font-mono text-white">{calibration.photoZoom}x</span>
                          </div>
                          <input 
                            type="range" min="0.5" max="3.0" step="0.05" 
                            value={calibration.photoZoom || 1.0} 
                            onChange={(e) => updateCalibrationProp('photoZoom', parseFloat(e.target.value))}
                            className="w-full accent-yellow-400 bg-neutral-800"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                            <span>Deslocamento X</span>
                            <span className="font-mono text-white">{calibration.photoOffsetX || 0}px</span>
                          </div>
                          <input 
                            type="range" min="-150" max="150" step="1" 
                            value={calibration.photoOffsetX || 0} 
                            onChange={(e) => updateCalibrationProp('photoOffsetX', parseInt(e.target.value))}
                            className="w-full accent-yellow-400 bg-neutral-800"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Deslocamento Y</span>
                          <span className="font-mono text-white">{calibration.photoOffsetY || 0}px</span>
                        </div>
                        <input 
                          type="range" min="-150" max="150" step="1" 
                          value={calibration.photoOffsetY || 0} 
                          onChange={(e) => updateCalibrationProp('photoOffsetY', parseInt(e.target.value))}
                          className="w-full accent-yellow-400 bg-neutral-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO NOME */}
                  <div className="bg-neutral-950/40 p-5 rounded-2xl border border-white/5 space-y-4">
                    <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest border-b border-white/5 pb-2">
                      👤 Calibragem do Nome
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição X</span>
                          <span className="font-mono text-white">{calibration.nameX}px</span>
                        </div>
                        <input 
                          type="range" min="100" max="900" step="1" 
                          value={calibration.nameX} 
                          onChange={(e) => updateCalibrationProp('nameX', parseInt(e.target.value))}
                          className="w-full accent-blue-400 bg-neutral-800"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição Y</span>
                          <span className="font-mono text-white">{calibration.nameY}px</span>
                        </div>
                        <input 
                          type="range" min="50" max="600" step="1" 
                          value={calibration.nameY} 
                          onChange={(e) => updateCalibrationProp('nameY', parseInt(e.target.value))}
                          className="w-full accent-blue-400 bg-neutral-800"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                            <span>Tamanho Fonte</span>
                            <span className="font-mono text-white">{calibration.nameSize}px</span>
                          </div>
                          <input 
                            type="range" min="12" max="42" step="1" 
                            value={calibration.nameSize} 
                            onChange={(e) => updateCalibrationProp('nameSize', parseInt(e.target.value))}
                            className="w-full accent-blue-400 bg-neutral-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                            Alinhamento
                          </label>
                          <select
                            value={calibration.nameAlign || 'left'}
                            onChange={(e) => updateCalibrationProp('nameAlign', e.target.value)}
                            className="w-full bg-neutral-900 border border-white/10 rounded-lg p-2 text-xs font-bold text-white focus:outline-none"
                          >
                            <option value="left">Esquerda</option>
                            <option value="center">Centralizado</option>
                            <option value="right">Direita</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO CPF */}
                  <div className="bg-neutral-950/40 p-5 rounded-2xl border border-white/5 space-y-4">
                    <h4 className="text-xs font-black text-green-400 uppercase tracking-widest border-b border-white/5 pb-2">
                      🆔 Calibragem do CPF
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição X</span>
                          <span className="font-mono text-white">{calibration.cpfX}px</span>
                        </div>
                        <input 
                          type="range" min="100" max="900" step="1" 
                          value={calibration.cpfX} 
                          onChange={(e) => updateCalibrationProp('cpfX', parseInt(e.target.value))}
                          className="w-full accent-green-400 bg-neutral-800"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição Y</span>
                          <span className="font-mono text-white">{calibration.cpfY}px</span>
                        </div>
                        <input 
                          type="range" min="50" max="600" step="1" 
                          value={calibration.cpfY} 
                          onChange={(e) => updateCalibrationProp('cpfY', parseInt(e.target.value))}
                          className="w-full accent-green-400 bg-neutral-800"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Tamanho Fonte</span>
                          <span className="font-mono text-white">{calibration.cpfSize}px</span>
                        </div>
                        <input 
                          type="range" min="12" max="36" step="1" 
                          value={calibration.cpfSize} 
                          onChange={(e) => updateCalibrationProp('cpfSize', parseInt(e.target.value))}
                          className="w-full accent-green-400 bg-neutral-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO DATA DE NASCIMENTO */}
                  <div className="bg-neutral-950/40 p-5 rounded-2xl border border-white/5 space-y-4">
                    <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest border-b border-white/5 pb-2">
                      📅 Calibragem de Nascimento
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição X</span>
                          <span className="font-mono text-white">{calibration.birthX ?? 310}px</span>
                        </div>
                        <input 
                          type="range" min="100" max="900" step="1" 
                          value={calibration.birthX ?? 310} 
                          onChange={(e) => updateCalibrationProp('birthX', parseInt(e.target.value))}
                          className="w-full accent-amber-500 bg-neutral-800"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição Y</span>
                          <span className="font-mono text-white">{calibration.birthY ?? 430}px</span>
                        </div>
                        <input 
                          type="range" min="50" max="1200" step="1" 
                          value={calibration.birthY ?? 430} 
                          onChange={(e) => updateCalibrationProp('birthY', parseInt(e.target.value))}
                          className="w-full accent-amber-500 bg-neutral-800"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Tamanho Fonte</span>
                          <span className="font-mono text-white">{calibration.birthSize ?? 18}px</span>
                        </div>
                        <input 
                          type="range" min="12" max="36" step="1" 
                          value={calibration.birthSize ?? 18} 
                          onChange={(e) => updateCalibrationProp('birthSize', parseInt(e.target.value))}
                          className="w-full accent-amber-500 bg-neutral-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO MÁQUINAS */}
                  <div className="bg-neutral-950/40 p-5 rounded-2xl border border-white/5 space-y-4">
                    <h4 className="text-xs font-black text-purple-400 uppercase tracking-widest border-b border-white/5 pb-2">
                      🚜 Calibragem das Máquinas
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição X</span>
                          <span className="font-mono text-white">{calibration.machinesX}px</span>
                        </div>
                        <input 
                          type="range" min="100" max="900" step="1" 
                          value={calibration.machinesX} 
                          onChange={(e) => updateCalibrationProp('machinesX', parseInt(e.target.value))}
                          className="w-full accent-purple-400 bg-neutral-800"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição Y</span>
                          <span className="font-mono text-white">{calibration.machinesY}px</span>
                        </div>
                        <input 
                          type="range" min="100" max="600" step="1" 
                          value={calibration.machinesY} 
                          onChange={(e) => updateCalibrationProp('machinesY', parseInt(e.target.value))}
                          className="w-full accent-purple-400 bg-neutral-800"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                            <span>Espaçamento Linhas</span>
                            <span className="font-mono text-white">{calibration.machinesSpacing}px</span>
                          </div>
                          <input 
                            type="range" min="10" max="40" step="1" 
                            value={calibration.machinesSpacing} 
                            onChange={(e) => updateCalibrationProp('machinesSpacing', parseInt(e.target.value))}
                            className="w-full accent-purple-400 bg-neutral-800"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                            <span>Tamanho Fonte</span>
                            <span className="font-mono text-white">{calibration.machinesSize}px</span>
                          </div>
                          <input 
                            type="range" min="10" max="30" step="1" 
                            value={calibration.machinesSize} 
                            onChange={(e) => updateCalibrationProp('machinesSize', parseInt(e.target.value))}
                            className="w-full accent-purple-400 bg-neutral-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO VALIDADE */}
                  <div className="bg-neutral-950/40 p-5 rounded-2xl border border-white/5 space-y-4">
                    <h4 className="text-xs font-black text-red-400 uppercase tracking-widest border-b border-white/5 pb-2">
                      📅 Calibragem da Validade
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição X</span>
                          <span className="font-mono text-white">{calibration.validityX}px</span>
                        </div>
                        <input 
                          type="range" min="100" max="900" step="1" 
                          value={calibration.validityX} 
                          onChange={(e) => updateCalibrationProp('validityX', parseInt(e.target.value))}
                          className="w-full accent-red-400 bg-neutral-800"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Posição Y</span>
                          <span className="font-mono text-white">{calibration.validityY}px</span>
                        </div>
                        <input 
                          type="range" min="50" max="1200" step="1" 
                          value={calibration.validityY} 
                          onChange={(e) => updateCalibrationProp('validityY', parseInt(e.target.value))}
                          className="w-full accent-red-400 bg-neutral-800"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                          <span>Tamanho Fonte</span>
                          <span className="font-mono text-white">{calibration.validitySize}px</span>
                        </div>
                        <input 
                          type="range" min="12" max="36" step="1" 
                          value={calibration.validitySize} 
                          onChange={(e) => updateCalibrationProp('validitySize', parseInt(e.target.value))}
                          className="w-full accent-red-400 bg-neutral-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Final Actions in Calibration mode */}
                <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-6">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mr-auto">
                    ⚠️ Lembre-se de clicar em salvar para publicar as novas calibragens para todos os vendedores.
                  </span>
                  <button
                    onClick={() => setIsCalibrating(false)}
                    className="px-5 py-2.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer border border-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveCalibration}
                    disabled={isSavingCalibration}
                    className="px-6 py-2.5 bg-yellow-400 text-black hover:bg-yellow-500 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-yellow-400/15 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isSavingCalibration ? 'Salvando...' : 'Salvar Calibragem'}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderIATab = () => {
    return (
      <div className="flex flex-col h-[650px] max-w-4xl mx-auto bg-neutral-950 rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
        {/* Topo: somente nome: IA */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-neutral-950">
          <span className="text-sm font-black uppercase tracking-widest text-white">IA</span>
          <button
            onClick={resetIAChat}
            className="text-[9px] text-neutral-500 hover:text-white font-bold uppercase tracking-widest transition-colors flex items-center gap-1 cursor-pointer"
            title="Reiniciar conversa"
          >
            <RefreshCcw size={10} /> Reiniciar Chat
          </button>
        </div>

        {/* Centro: conversa */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-950 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {iaMessages.map((msg, index) => {
            const isUser = msg.role === 'user';
            if (msg.isSystem) return null; // Não exibe mensagens internas do sistema

            return (
              <div
                key={msg.id || index}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2.5`}
              >
                <div
                  className={`max-w-[80%] rounded-[1.25rem] px-4 py-3 text-xs leading-relaxed transition-all ${
                    isUser
                      ? 'bg-yellow-400 text-black font-medium rounded-tr-none'
                      : msg.isError
                        ? 'bg-red-950/20 border border-red-500/20 text-neutral-200 rounded-tl-none'
                        : 'bg-neutral-900 text-neutral-100 border border-white/5 rounded-tl-none'
                  }`}
                >
                  <div className="whitespace-pre-line text-[11px] leading-relaxed">
                    {msg.content}
                  </div>

                  {/* Rodapé com hora */}
                  <div className="flex items-center justify-between gap-4 mt-2 pt-1 border-t border-white/5 text-[8px] text-neutral-500 font-bold uppercase tracking-widest">
                    <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    {!isUser && !msg.isError && (
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="hover:text-yellow-400 transition-colors flex items-center gap-0.5"
                      >
                        <Copy size={9} />
                        {copiedMessageId === msg.id ? 'Copiado!' : 'Copiar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Balão de digitando */}
          {iaIsLoading && (
            <div className="flex justify-start items-end gap-2.5">
              <div className="bg-neutral-900 border border-white/5 rounded-[1.25rem] rounded-tl-none px-4 py-3 min-w-[120px] flex items-center gap-1.5 text-neutral-400 text-[10px] font-black uppercase tracking-wider animate-pulse">
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="ml-1 text-yellow-400/90 tracking-wide font-black">Analisando...</span>
              </div>
            </div>
          )}
          <div ref={iaChatEndRef} />
        </div>

        {/* Rodapé: campo escrever, botão enviar */}
        <div className="p-4 border-t border-white/5 bg-neutral-950 flex gap-2.5 items-center">
          <input
            type="text"
            value={iaInput}
            onChange={e => setIaInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSendIAMessage();
            }}
            disabled={iaIsLoading}
            placeholder="Digite sua mensagem ou relato comercial..."
            className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-yellow-400 transition-colors shadow-inner"
          />
          <button
            onClick={() => handleSendIAMessage()}
            disabled={iaIsLoading || !iaInput.trim()}
            className="p-3 bg-yellow-400 hover:bg-yellow-500 text-black font-black rounded-xl transition-all shadow-lg shadow-yellow-400/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    );
  };

  const renderSimulatorTab = () => {
    const value = parseFloat(simCardValue) || 0;

    const rates = [
      { n: 1, r: 0.0599 },
      { n: 2, r: 0.1139 },
      { n: 3, r: 0.1249 },
      { n: 4, r: 0.1309 },
      { n: 5, r: 0.1379 },
      { n: 6, r: 0.1449 },
      { n: 7, r: 0.1549 },
      { n: 8, r: 0.1609 },
      { n: 9, r: 0.1669 },
      { n: 10, r: 0.1739 },
      { n: 11, r: 0.1839 },
      { n: 12, r: 0.1879 },
    ];

    const presets = [100, 400, 1000, 1799, 1999];

    const handleDownloadSimulatorImage = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1240;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dark theme background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0f172a'); // slate-900
      gradient.addColorStop(1, '#020617'); // slate-950
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Decorative ambient radial glow
      ctx.save();
      ctx.beginPath();
      ctx.arc(400, -100, 350, 0, Math.PI * 2);
      const glowGrad = ctx.createRadialGradient(400, -100, 50, 400, -100, 350);
      glowGrad.addColorStop(0, 'rgba(250, 204, 21, 0.14)');
      glowGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fill();
      ctx.restore();

      // Top yellow accent bar
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 0, canvas.width, 10);

      // App Brand Name & Header
      ctx.fillStyle = '#facc15';
      ctx.font = '900 24px system-ui, -apple-system, sans-serif';
      ctx.fillText('OPERA', 50, 58);

      ctx.fillStyle = '#94a3b8'; // slate-400
      ctx.font = '700 11px system-ui, -apple-system, sans-serif';
      ctx.fillText('FINANCEIRO • SIMULADOR DE TARIFAS', 50, 82);

      // Generation Timestamp
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748b'; // slate-500
      ctx.font = '700 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(`TABELA GERADA EM ${dateStr} ÀS ${timeStr}`, 750, 58);
      ctx.textAlign = 'left';

      // Horizontal separator line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, 105);
      ctx.lineTo(750, 105);
      ctx.stroke();

      // Rounded Rectangle drawing helper
      const drawRoundedRect = (
        c: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number,
        fillColor?: string,
        strokeColor?: string
      ) => {
        c.beginPath();
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r);
        c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h);
        c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r);
        c.quadraticCurveTo(x, y, x + r, y);
        c.closePath();
        if (fillColor) {
          c.fillStyle = fillColor;
          c.fill();
        }
        if (strokeColor) {
          c.strokeStyle = strokeColor;
          c.lineWidth = 1.5;
          c.stroke();
        }
      };

      // Reference base amount container
      drawRoundedRect(ctx, 50, 125, 700, 105, 20, '#030712', 'rgba(250, 204, 21, 0.35)');

      ctx.fillStyle = '#facc15';
      ctx.font = '900 11px system-ui, -apple-system, sans-serif';
      ctx.fillText('VALOR LÍQUIDO DE REFERÊNCIA', 75, 160);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 36px system-ui, -apple-system, sans-serif';
      ctx.fillText(`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 75, 205);

      // Repasse system status badge
      const badgeTxt = "REPASSE ATIVO (ALUNO PAGA AS TAXAS)";
      ctx.font = '900 10px system-ui, -apple-system, sans-serif';
      const badgeW = ctx.measureText(badgeTxt).width;
      drawRoundedRect(ctx, 750 - badgeW - 35, 162, badgeW + 25, 30, 8, 'rgba(234, 179, 8, 0.1)', '#eab308');
      ctx.fillStyle = '#facc15';
      ctx.fillText(badgeTxt, 750 - badgeW - 22, 181);

      // Parcelamento Section Header
      ctx.fillStyle = '#94a3b8';
      ctx.font = '900 12px system-ui, -apple-system, sans-serif';
      ctx.fillText('OPÇÕES DE PAGAMENTO (DÉBITO & CRÉDITO PARCELADO):', 50, 270);

      // Render Débito Row on Canvas first
      let rowY = 285;
      {
        const studentPays = value * (1 + 0.0279);
        const rowBg = 'rgba(250, 204, 21, 0.06)';
        drawRoundedRect(ctx, 50, rowY, 700, 52, 12, rowBg, 'rgba(250, 204, 21, 0.2)');

        // Label
        ctx.fillStyle = '#facc15';
        ctx.font = '900 15px system-ui, -apple-system, sans-serif';
        ctx.fillText('DÉBITO (1x)', 75, rowY + 31);

        // Amount
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 18px system-ui, -apple-system, sans-serif';
        ctx.fillText(`R$ ${studentPays.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 205, rowY + 32);

        // Muted details
        ctx.textAlign = 'right';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '700 13px system-ui, -apple-system, sans-serif';
        ctx.fillText('Taxa: 2,79% • Total: R$ ' + studentPays.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), 725, rowY + 31);
        ctx.textAlign = 'left';

        rowY += 60;
      }

      // Render Credit Installments List
      rates.forEach((rateObj, index) => {
        const studentPays = value * (1 + rateObj.r);
        const installment = studentPays / rateObj.n;

        const isEven = index % 2 === 0;
        const rowBg = isEven ? '#0f172a' : '#1e293b';

        // Installment row container
        drawRoundedRect(ctx, 50, rowY, 700, 52, 12, rowBg);

        // Installment label
        ctx.fillStyle = '#facc15';
        ctx.font = '900 15px system-ui, -apple-system, sans-serif';
        ctx.fillText(`${rateObj.n.toString().padStart(2, '0')}x de`, 75, rowY + 31);

        // Installment amount
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 18px system-ui, -apple-system, sans-serif';
        ctx.fillText(`R$ ${installment.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 135, rowY + 32);

        // Muted calculated total
        ctx.textAlign = 'right';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '700 13px system-ui, -apple-system, sans-serif';
        ctx.fillText(`Taxa: ${(rateObj.r * 100).toFixed(2).replace('.', ',')}% • Total: R$ ${studentPays.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 725, rowY + 31);
        ctx.textAlign = 'left';

        rowY += 60;
      });

      // Horizontal separator line before footer
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(50, rowY + 10);
      ctx.lineTo(750, rowY + 10);
      ctx.stroke();

      // Footnote & Disclaimer
      ctx.fillStyle = '#64748b';
      ctx.font = '600 10.5px system-ui, -apple-system, sans-serif';
      ctx.fillText('* Atenção: Os valores incluem as tarifas regulamentadas da adquirente InfinitePay.', 50, rowY + 33);
      ctx.fillText('Opera Formação Profissional © Todos os direitos reservados.', 50, rowY + 49);

      // Trigger standard browser save dialog
      const downloadLink = document.createElement('a');
      downloadLink.download = `parcelas-credito-R$${value.toFixed(0)}.png`;
      downloadLink.href = canvas.toDataURL('image/png');
      downloadLink.click();
    };

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tighter uppercase text-white flex items-center gap-2">
              <CreditCard className="text-yellow-400" /> Simulador de Taxas
            </h2>
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">
              Simulação baseada nas tarifas InfinitePay para parcelamentos aplicados
            </p>
          </div>
          
          <button
            onClick={handleDownloadSimulatorImage}
            className="flex items-center gap-2 px-5 py-3.5 bg-yellow-400 text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg hover:shadow-yellow-400/20 cursor-pointer self-stretch md:self-auto justify-center"
          >
            <Camera size={14} className="stroke-[3]" /> Baixar Imagem das Taxas
          </button>
        </div>

        {/* Card de Configuração e Input */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 md:p-8 rounded-[2.5rem] space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            
            {/* Input de Valor */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-yellow-400 tracking-widest">Valor do Produto (R$)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">R$</span>
                <input
                  type="number"
                  value={simCardValue}
                  onChange={(e) => setSimCardValue(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-12 pr-4 py-4 bg-black border border-neutral-800 rounded-2xl text-xl font-bold text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all font-mono"
                />
              </div>
              
              {/* Presets */}
              <div className="flex flex-wrap gap-2 pt-2">
                {presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => setSimCardValue(p.toString())}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                      value === p 
                        ? 'bg-yellow-400 text-black border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]' 
                        : 'bg-black text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    R$ {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Informativo de Repasse de Taxas */}
            <div className="bg-black/50 border border-neutral-800 p-6 rounded-2xl space-y-2">
              <label className="text-[10px] font-black uppercase text-yellow-400 tracking-widest block font-sans">Regra de Cobrança</label>
              <p className="text-xs font-black text-white uppercase tracking-tight font-sans">
                Repasse de Taxas (Aluno Paga)
              </p>
              <p className="text-[10px] font-medium text-neutral-400 uppercase leading-relaxed font-sans">
                O valor final cobrado do aluno será reajustado aplicando as taxas da InfinitePay, garantindo que caia exatamente o valor integral líquido do produto na conta.
              </p>
            </div>
            
          </div>
        </div>

        {/* Highlights de Destaque */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Highlight Débito */}
          {(() => {
            const studentPays = value * (1 + 0.0279);
            const fee = value * 0.0279;
            const netVal = value;
            return (
              <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl flex items-center justify-between relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-24 h-24 bg-yellow-400/5 rounded-full blur-2xl group-hover:bg-yellow-400/10 transition-colors" />
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-yellow-400 uppercase tracking-widest bg-yellow-400/10 px-2 py-0.5 rounded font-sans">No Débito (1x)</span>
                  <p className="text-3xl font-black text-white mt-1">
                    R$ {studentPays.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[9px] font-bold text-neutral-500 uppercase font-sans">
                    Taxa: R$ {fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (2,79%) • Líquido Recebido: R$ {netVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-neutral-500">Débito</span>
                </div>
              </div>
            );
          })()}

          {/* Highlight A Vista */}
          {(() => {
            const h1 = rates[0];
            const studentPays = value * (1 + h1.r);
            const fee = value * h1.r;
            const netVal = value;
            return (
              <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl flex items-center justify-between relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-24 h-24 bg-yellow-400/5 rounded-full blur-2xl group-hover:bg-yellow-400/10 transition-colors" />
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-yellow-400 uppercase tracking-widest bg-yellow-400/10 px-2 py-0.5 rounded font-sans">À Vista no Crédito (1x)</span>
                  <p className="text-3xl font-black text-white mt-1">
                    R$ {studentPays.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[9px] font-bold text-neutral-500 uppercase font-sans">
                    Taxa: R$ {fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({ (h1.r * 100).toFixed(2).replace('.', ',') }%) • Líquido Recebido: R$ {netVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-neutral-500">1x Crédito</span>
                </div>
              </div>
            );
          })()}

          {/* Highlight 12x */}
          {(() => {
            const h12 = rates[11];
            const studentPays = value * (1 + h12.r);
            const fee = value * h12.r;
            const installment = studentPays / 12;
            const netVal = value;
            return (
              <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl flex items-center justify-between relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-24 h-24 bg-yellow-400/5 rounded-full blur-2xl group-hover:bg-yellow-400/10 transition-colors" />
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-yellow-400 uppercase tracking-widest bg-yellow-400/10 px-2 py-0.5 rounded font-sans">Parcelado em 12x</span>
                  <p className="text-3xl font-black text-white mt-1">
                    12x R$ {installment.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[9px] font-bold text-neutral-500 uppercase font-sans">
                    Total: R$ {studentPays.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Taxa: R$ {fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({ (h12.r * 100).toFixed(2).replace('.', ',') }%) • Líquido: R$ {netVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-neutral-500">12x Crédito</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Tabela de Parcelamentos */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl font-sans">
          <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
            <span className="text-xs font-black uppercase text-white font-sans">Tabela Detalhada de Parcelas (Débito e Crédito 1x até 12x)</span>
            <span className="text-[9px] font-black text-yellow-400 uppercase tracking-widest bg-yellow-400/10 px-3 py-1 rounded-full font-sans">Simulação Ativa</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black text-neutral-500 uppercase font-black text-[9px] tracking-widest font-sans">
                <tr>
                  <th className="p-4 text-center">Tipo / Parcelas</th>
                  <th className="p-4">Taxa %</th>
                  <th className="p-4">Valor da Parcela</th>
                  <th className="p-4">Total Pago Aluno</th>
                  <th className="p-4">Valor da Taxa</th>
                  <th className="p-4 text-right">Líquido Recebido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 font-extrabold text-neutral-300">
                {/* Débito Row */}
                {(() => {
                  const studentPays = value * (1 + 0.0279);
                  const fee = value * 0.0279;
                  return (
                    <tr className="hover:bg-neutral-800/40 transition-colors uppercase font-mono bg-yellow-400/5">
                      <td className="p-4 text-center text-yellow-400 font-black">DÉBITO (1x)</td>
                      <td className="p-4 text-neutral-400 font-bold">2,79%</td>
                      <td className="p-4 font-black text-white">
                        1x R$ {studentPays.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-neutral-400 font-bold">
                        R$ {studentPays.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-red-500/70 font-semibold">
                        R$ {fee.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right text-emerald-400 font-black">
                        R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })()}

                {rates.map((rateObj) => {
                  const studentPays = value * (1 + rateObj.r);
                  const installment = studentPays / rateObj.n;
                  const fee = value * rateObj.r;
                  const netVal = value;

                  return (
                    <tr 
                      key={rateObj.n} 
                      className="hover:bg-neutral-800/40 transition-colors uppercase font-mono"
                    >
                      <td className="p-4 text-center text-yellow-400 font-black">CRÉDITO {rateObj.n}x</td>
                      <td className="p-4 text-neutral-500 font-bold">{(rateObj.r * 100).toFixed(2).replace('.', ',')}%</td>
                      <td className="p-4 font-black text-white">
                        {rateObj.n}x R$ {installment.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-neutral-400 font-bold">
                        R$ {studentPays.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-red-500/70 font-semibold">
                        R$ {fee.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right text-emerald-400 font-black">
                        R$ {netVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    );
  };


  const renderHistoryTab = () => {
    const filteredHistory = contractsHistory.filter(h => 
      h.clientName.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      h.vendorName.toLowerCase().includes(historySearchTerm.toLowerCase())
    );

    // Agrupar por Vendedor
    const vendors = Array.from(new Set(filteredHistory.map(h => h.vendorName))).sort();

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tighter uppercase">Histórico de Contratos</h2>
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Contratos arquivados para consulta</p>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
            <div className="flex gap-2">
              <button 
                onClick={() => downloadHistoryPDF(false)}
                className="h-12 px-6 bg-yellow-400 text-black text-[10px] font-black uppercase tracking-widest rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-yellow-400/20 flex items-center gap-2"
              >
                <Eye size={16} /> Ver PDF Lista
              </button>
              <button 
                onClick={() => downloadHistoryPDF(true)}
                className="h-12 px-6 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 active:scale-95 transition-all flex items-center gap-2"
              >
                <Printer size={16} /> Eco Print Lista
              </button>
            </div>
            <div className="relative w-full md:w-64">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search size={14} className="text-yellow-400 opacity-50" />
              </div>
              <input
                type="text"
                placeholder="BUSCAR NO HISTÓRICO..."
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 text-[10px] font-black uppercase tracking-widest focus:border-yellow-400/50 outline-none transition-all placeholder:text-neutral-600"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {vendors.map(vendor => {
            const vendorItems = filteredHistory.filter(h => h.vendorName === vendor);
            const cities = Array.from(new Set(vendorItems.map(h => h.courseCity))).sort();

            return (
              <div key={vendor} className="bg-neutral-900/50 border border-white/5 p-6 rounded-[2.5rem] space-y-4">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <h3 className="font-bold text-lg leading-tight uppercase text-yellow-400">{vendor}</h3>
                </div>

                <div className="space-y-4">
                  {cities.map(city => {
                    const cityItems = vendorItems.filter(h => h.courseCity === city);
                    return (
                      <div key={city} className="space-y-2">
                        <p className="text-[10px] font-black text-neutral-500 uppercase px-2">{city} — {cityItems.length} Alunos</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {cityItems.map(item => (
                            <div key={item.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between items-center group">
                              <div>
                                <p className="text-xs font-black uppercase text-white">{item.clientName}</p>
                                <p className="text-[8px] font-bold text-neutral-500 uppercase">{item.courseType} • {new Date(item.savedAt).toLocaleDateString()}</p>
                              </div>
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => {
                                    setExportingContract(item);
                                    if (spreadsheets.length > 0) {
                                      setSelectedExportSpreadsheetId(spreadsheets[0].id);
                                    } else {
                                      setSelectedExportSpreadsheetId('');
                                    }
                                  }}
                                  className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                                  title="Colocar na Planilha Google"
                                >
                                  <TableProperties size={14} />
                                </button>
                                <button 
                                  onClick={() => generateContractPDF(item, false, true)}
                                  className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                  title="Imprimir (ECO)"
                                >
                                  <Printer size={14} />
                                </button>
                                <button 
                                  onClick={async () => {
                                    try {
                                      if (confirm("Você tem certeza que deseja excluir este contrato do histórico?")) {
                                        await deleteDoc(doc(db, 'contracts_history', item.id));
                                      }
                                    } catch (err) { alert("Erro ao excluir do histórico"); }
                                  }}
                                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                  title="Excluir Registro"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filteredHistory.length === 0 && (
            <div className="bg-neutral-900/50 border border-dashed border-white/5 p-12 rounded-[2.5rem] text-center">
               <p className="text-neutral-500 font-bold uppercase text-xs">
                 {historySearchTerm ? `Nenhum resultado encontrado para "${historySearchTerm}"` : "Nenhum contrato arquivado no histórico."}
               </p>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  const renderFeesPanel = () => {
    // Organizar por Vendedor
    const vendorGroups = allUsers.map(v => {
      const vReports = feeReports.filter(r => r.vendorId === v.id)
        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return { ...v, reports: vReports };
    }).filter(v => v.reports.length > 0);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tighter uppercase">Gestão de Taxas</h2>
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Histórico de envios dos vendedores</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => downloadAllFeesPDF(false)}
              className="flex items-center gap-2 px-6 h-12 bg-yellow-400 rounded-2xl text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-yellow-400/20 group"
            >
              <Eye size={16} className="group-hover:rotate-6 transition-transform" />
              Ver Consolidado
            </button>
            <button 
              onClick={() => downloadAllFeesPDF(true)}
              className="flex items-center gap-2 px-6 h-12 bg-white/5 border border-white/10 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all group"
            >
              <Printer size={16} className="group-hover:scale-110 transition-transform" />
              Eco Print
            </button>
          </div>
          <button 
            onClick={deleteAllFeeReports}
            className="flex items-center gap-2 px-6 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5 group"
          >
            <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
            Limpar Todo o Histórico
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {vendorGroups.map(vendor => (
            <div key={vendor.id} className="bg-neutral-900/50 border border-white/5 p-6 rounded-[2.5rem] space-y-4">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="w-10 h-10 bg-yellow-400 rounded-2xl flex items-center justify-center font-black text-black">
                  {vendor.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight uppercase">{vendor.name}</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase">Relatórios: {vendor.reports.length}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {vendor.reports.map((report: any) => (
                  <div key={report.id} className="bg-black/40 border border-white/5 p-5 rounded-3xl flex flex-col justify-between group hover:border-yellow-400/30 transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[8px] bg-yellow-400 text-black px-2 py-0.5 rounded font-black uppercase tracking-tighter">
                          {report.eligibleCount ?? report.details.filter((d: any) => d.fee > 0).length} VENDAS A RECEBER
                        </span>
                        <span className="text-[8px] text-neutral-500 font-bold">
                          {new Date(report.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                        Período Semanal
                      </h4>
                      <p className="text-xs font-bold">
                        {new Date(report.weekStart).toLocaleDateString('pt-BR')} — {new Date(report.weekEnd).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-[10px] text-neutral-500 mt-1 uppercase font-bold">
                        {report.salesCount} Alunos Registrados
                      </p>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <button 
                        onClick={() => generateFeeReportPDF(report, false)}
                        className="flex-1 bg-yellow-400 h-10 rounded-2xl flex items-center justify-center gap-2 text-[10px] text-black font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-yellow-400/10"
                      >
                        <Eye size={14} /> VER
                      </button>
                      <button 
                        onClick={() => generateFeeReportPDF(report, true)}
                        className="flex-1 bg-white/5 border border-white/10 h-10 rounded-2xl flex items-center justify-center gap-2 text-[10px] text-white font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                      >
                        <Printer size={14} /> ECO
                      </button>

                      <button 
                        onClick={async () => {
                          try {
                            await deleteDoc(doc(db, 'fee_reports', report.id));
                          } catch (err) {
                            console.error("Erro ao excluir relatório:", err);
                            alert("Erro ao excluir!");
                          }
                        }}
                        className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all"
                        title="Excluir Relatório"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {vendorGroups.length === 0 && (
            <div className="bg-neutral-900/50 border border-dashed border-white/5 p-12 rounded-[2.5rem] text-center">
              <p className="text-neutral-500 font-bold uppercase text-xs">Nenhum relatório de taxas recebido ainda.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const processSpeechToContract = async (transcriptText: string) => {
    const textToSend = transcriptText || voiceTranscriptText || voiceAccumulatedRef.current;
    
    if (!textToSend || textToSend.trim() === '') {
      setVoiceStatus(null);
      setVoiceProgress(null);
      alert("Não conseguimos capturar nenhum áudio/fala. Por favor, tente gravar de novo falando de forma mais devagar.");
      return;
    }

    setVoiceStatus("Enviando texto reconhecido para a Inteligência Artificial...");
    setVoiceProgress(5);

    // Barra de progresso animada simulada enquanto a rota do Gemini processa os dados (que costuma levar de 1 a 3 segundos)
    const progressInterval = setInterval(() => {
      setVoiceProgress(prev => {
        if (prev === null) return null;
        if (prev >= 90) return prev; // segurar no 90% até obter resposta real
        return prev + Math.floor(Math.random() * 8) + 2; // avanço randômico
      });
    }, 200);

    try {
      const response = await fetch('/api/parse-contract-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: textToSend,
          userEmail: user?.email
        })
      });

      clearInterval(progressInterval);
      setVoiceProgress(95);

      const result = await response.json();
      if (response.ok && result.success && result.data) {
        const data = result.data;
        
        setContractForm(prev => ({
          ...prev,
          consultant: data.consultant || prev.consultant,
          clientName: data.nome || data.clientName || prev.clientName,
          clientCpf: data.cpf || data.clientCpf || prev.clientCpf,
          clientRg: data.rg || data.clientRg || prev.clientRg,
          clientBirthDate: data.dataNascimento || data.clientBirthDate || prev.clientBirthDate,
          clientPhone: data.telefone || data.clientPhone || prev.clientPhone,
          rua: data.endereco || data.rua || prev.rua,
          numero: data.numero !== undefined ? String(data.numero) : prev.numero,
          bairro: data.bairro !== undefined ? String(data.bairro) : prev.bairro,
          cidade: data.cidade || prev.cidade,
          estado: data.estado || prev.estado,
          cep: data.cep || prev.cep,
          email: data.email || prev.email,
          profissao: data.profissao || prev.profissao,
          estadoCivil: data.estadoCivil || prev.estadoCivil,
          nacionalidade: data.nacionalidade || prev.nacionalidade,
          courseType: data.tipoCurso || data.courseType || prev.courseType,
          courseCity: data.cidadeCurso || data.courseCity || prev.courseCity,
          courseDate: data.dataContrato || data.courseDate || prev.courseDate,
          matriculaValue: data.valor || data.valorMatricula || data.matriculaValue || prev.matriculaValue,
          remainderValue: data.valorRestante || data.remainderValue || prev.remainderValue,
          needsLodging: data.needsLodging || prev.needsLodging,
          observations: (data.observacoes || data.observations) ? 
            (prev.observations ? prev.observations + "\n" + (data.observacoes || data.observations) : (data.observacoes || data.observations)) 
            : prev.observations
        }));

        setVoiceProgress(100);
        setTimeout(() => {
          setVoiceProgress(null);
          setVoiceStatus(null);
          alert("Contrato preenchido com sucesso com a Inteligência Artificial!");
        }, 500);
      } else {
        setVoiceProgress(null);
        setVoiceStatus(null);
        alert(`Infelizmente a IA não conseguiu interpretar o áudio: ${result.error || 'Por favor, tente falar novamente.'}`);
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error("Erro no preenchimento de áudio:", err);
      setVoiceProgress(null);
      setVoiceStatus(null);
      alert("Infelizmente ocorreu um erro de conexão ao tentar processar seu áudio.");
    }
  };

  const startVoiceRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz direto. Recomendamos usar o Google Chrome ou Microsoft Edge.");
      return;
    }

    if ((window as any)._activeRecognition || isRecordingVoice) {
      // O usuário está escolhendo finalizar a gravação!
      setVoiceStatus("Processando áudio gravado e chamando a IA...");
      voiceShouldRestartRef.current = false;
      setIsRecordingVoice(false);
      
      const activeRec = (window as any)._activeRecognition;
      if (activeRec) {
        try {
          activeRec.onend = null; // desativa callback de reinício
          activeRec.stop();
        } catch (e) {
          console.error("Erro ao parar reconhecimento:", e);
        }
      }
      (window as any)._activeRecognition = null;
      
      // Chamar processamento usando o texto completo real e mais atualizado (incluindo interim)
      processSpeechToContract(voiceLatestFullTextRef.current);
      return;
    }

    // Iniciar gravação limpa
    voiceAccumulatedRef.current = '';
    voiceLatestFullTextRef.current = '';
    setVoiceTranscriptText('');
    voiceShouldRestartRef.current = true;
    setIsRecordingVoice(true);
    setVoiceStatus("Iniciando gravação... Fale as informações do contrato lentamente.");

    const runSpeechSession = () => {
      if (!voiceShouldRestartRef.current) return;

      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setVoiceStatus("🎙️ Ouvindo... Pode falar todos os dados do contrato normalmente (ex: Nome, CPF, RG, Endereço, Curso, Cidade, Valores).");
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          voiceAccumulatedRef.current += (voiceAccumulatedRef.current ? ' ' : '') + finalTranscript;
        }

        const currentFullText = voiceAccumulatedRef.current + (interimTranscript ? ' ' + interimTranscript : '');
        voiceLatestFullTextRef.current = currentFullText;
        setVoiceTranscriptText(currentFullText);
        setVoiceStatus(`🎙️ Gravando voz... Ouvido até agora: "${currentFullText.substring(0, 150)}${currentFullText.length > 150 ? '...' : ''}"`);
      };

      recognition.onerror = (event: any) => {
        console.error("Erro no reconhecimento de fala:", event.error);
        if (event.error === 'no-speech') {
          // Ignorar silenciosamente
          return;
        }
        setVoiceStatus(`Aviso do Microfone: ${event.error}`);
      };

      recognition.onend = () => {
        if (voiceShouldRestartRef.current) {
          console.log("[VoiceRecognition] Sessão finalizada. Reiniciando uma nova sessão limpa de forma ininterrupta.");
          setTimeout(() => {
            runSpeechSession();
          }, 300);
        }
      };

      (window as any)._activeRecognition = recognition;
      try {
        recognition.start();
      } catch (err) {
        console.error("Falha ao iniciar reconhecimento:", err);
      }
    };

    runSpeechSession();
  };

  const validateContract = (isDownload = false) => {
    // Lucas Gonçalves pode baixar o contrato em branco caso queira
    if (isDownload && (isLucas || isOperaGoncalves)) {
      return true;
    }

    const requiredFields = [
      { key: 'consultant', label: 'Nome do Consultor' },
      { key: 'clientName', label: 'Nome do Contratante' },
      { key: 'clientCpf', label: 'CPF' },
      { key: 'clientRg', label: 'RG' },
      { key: 'clientBirthDate', label: 'Data de Nascimento' },
      { key: 'clientPhone', label: 'Telefone' },
      { key: 'rua', label: 'Rua e Número' },
      { key: 'cidade', label: 'Cidade' },
      { key: 'estado', label: 'UF' },
      { key: 'cep', label: 'CEP' },
      { key: 'courseCity', label: 'Cidade do Curso' },
      { key: 'courseDate', label: 'Data do Curso' },
      { key: 'matriculaValue', label: 'Matrícula' },
      { key: 'remainderValue', label: 'Valor a Pagar' }
    ];

    if (isSecretaria) {
      requiredFields.push({ key: 'destinoTurma', label: 'Destino (Turma)' });
    }

    const missing = requiredFields.filter(field => {
      const val = contractForm[field.key as keyof typeof contractForm];
      return !val || val.toString().trim() === '';
    });

    if (missing.length > 0) {
      setShowContractValidation(true);
      const missingLabels = missing.map(m => m.label).join(', ');
      alert(`CONTRATO BLOQUEADO: Preencha todos os campos em destaque vermelho antes de prosseguir.\nFaltando: ${missingLabels}`);
      return false;
    }

    return true;
  };

  const copyContractMessage = () => {
    const parseCurrency = (val: string) => {
      if (!val) return 0;
      return parseFloat(val.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;
    };
    
    const matriculaVal = parseCurrency(contractForm.matriculaValue);
    const remainderVal = parseCurrency(contractForm.remainderValue);
    const totalVal = matriculaVal + remainderVal;
    const fineVal = 380;
    const fineFormatted = fineVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const msg = `📄 *MATRÍCULA CONFIRMADA - OPERA FORMAÇÃO* 📄

Olá, *${contractForm.clientName}*! Segue o detalhamento do seu contrato de matrícula para o curso de *${contractForm.courseType}* em *${contractForm.courseCity}*.

--------------------------------------------------
*CONFIRMAÇÃO DOS DADOS E CIÊNCIA DO REGULAMENTO:*

👤 *Nome Completo:* ${contractForm.clientName.toUpperCase()}
📅 *Primeiro Dia de Aula:* ${contractForm.courseDate}
💰 *Valor do Curso no Primeiro Dia:* R$ ${contractForm.remainderValue}

⚠️ *TERMO DE MULTA E NÃO COMPARECIMENTO:*
Caso você não compareça no primeiro dia do curso (*${contractForm.courseDate}*) sem aviso prévio, haverá uma multa rescisória de *R$ ${fineFormatted}* por quebra contratual e custos logísticos da vaga, certo?

👉 *Por gentileza, envie um "OK" em resposta a esta mensagem confirmando o recebimento e ciência do contrato.*`;
    navigator.clipboard.writeText(msg);
    alert("Mensagem copiada para o envio!");
  };

   const postContract = async () => {
    if (!user) {
      alert("Sua sessão expirou. Por favor, faça login novamente.");
      setAuthView('login');
      return;
    }

    if (!validateContract(false)) {
      return;
    }

    setIsPosting(true);
    setPostProgress(10);

    const docVendorName = (contractForm.consultant || contractForm.vendorName || userProfile?.name || 'Vendedor').trim();
    const contractData = {
      ...contractForm,
      vendorId: user.uid,
      vendorName: docVendorName,
      consultant: docVendorName,
      updatedAt: new Date().toISOString(),
      status: 'postado',
      isPrinted: false
    };

    // 1. Progressão super rápida e fluida de carregamento (cerca de 500ms) para carregar instantaneamente
    let progress = 10;
    const progressInterval = setInterval(() => {
      progress += Math.floor(Math.random() * 20) + 15;
      if (progress >= 95) {
        progress = 95;
        clearInterval(progressInterval);
      }
      setPostProgress(Math.min(95, progress));
    }, 70);

    const dataToSave = { 
      ...contractData,
      createdAt: contractForm.createdAt || new Date().toISOString(),
      generatedAt: new Date().toISOString()
    };
    delete (dataToSave as any).id;

    // Sanitize any undefined properties to prevent Firestore crashes
    const sanitizedData: any = {};
    Object.entries(dataToSave).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        sanitizedData[key] = val;
      } else {
        sanitizedData[key] = ''; // safe fallback for firestore
      }
    });

    const tempId = 'temp_contract_' + generateId();
    const formToShare = { ...contractForm };

    // 2. Gravação de contrato garantida (Aguardando resposta do servidor)
    try {
      let contractId = contractForm.id || '';
      
      // Se houver saleId, tentar achar o ID do contrato correspondente para atualizar
      if (!contractId && contractForm.saleId) {
        try {
          const q = query(collection(db, 'contracts'), where('saleId', '==', contractForm.saleId));
          const snap = await getDocs(q);
          if (!snap.empty) {
            contractId = snap.docs[0].id;
          }
        } catch (e) {
          console.warn("Checagem de ID do contrato falhou", e);
        }
      }

      if (contractId) {
        await updateDoc(doc(db, 'contracts', contractId), sanitizedData);
      } else {
        await addDoc(collection(db, 'contracts'), sanitizedData);
      }

      // Notificar Emily via Push em background
      try {
        await notifyPush(
          ['emily@opera.com', 'emilyopera@gmail.com'],
          'Novo Contrato Postado',
          `${userProfile?.name || 'Sistema'} postou/atualizou o contrato de ${contractData.clientName} para ${contractData.courseCity}`,
          'lista-contratos',
          'contrato'
        );
      } catch (pushErr) {
        console.warn("Falha ao disparar push de notificações em background", pushErr);
      }

      // Progresso concluído com sucesso total
      clearInterval(progressInterval);
      setPostProgress(100);
      
      setTimeout(() => {
        setIsPosting(false);
        setPostProgress(0);

        // Limpar o formulário para a próxima criação (esvaziando todas as informações antigas)
        setContractForm({
          id: '',
          title: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS',
          consultant: '',
          mainModality: 'Presencial',
          clientName: '',
          clientCpf: '',
          clientRg: '',
          clientBirthDate: '',
          clientPhone: '',
          recado1Phone: '', recado1Nome: '', recado1Grau: '',
          recado2Phone: '', recado2Nome: '', recado2Grau: '',
          rua: '', cidade: '', estado: '', cep: '',
          courseType: 'Máquinas Pesadas',
          courseModality: 'Presencial',
          courseCity: '',
          certificateType: 'Tradicional',
          courseDate: '',
          matriculaValue: '',
          remainderValue: '',
          needsLodging: 'NÃO',
          observations: '',
          destinoTurma: '',
          saleId: '',
          vendorId: '',
          vendorName: '',
          numero: '',
          bairro: '',
          email: '',
          profissao: '',
          estadoCivil: '',
          nacionalidade: ''
        });
        setShowContractValidation(false);
        // Mudar para a aba de listas instantaneamente
        setContractSubTab('lista');
        
        // Notificação de sucesso personalizada focada no envio para a Emily
        alert("Enviado com sucesso para a Emily imprimir!\n\nAbrindo compartilhamento de contrato no WhatsApp a seguir...");
        
        // Disparar WhatsApp de forma segura e imediata usando a confirmação do Alert como gesto ativo do usuário
        shareContractWhatsApp(formToShare);
      }, 150);

    } catch (dbErr: any) {
      console.error("Erro ao salvar contrato", dbErr);
      clearInterval(progressInterval);
      setIsPosting(false);
      setPostProgress(0);

      const errorMsg = dbErr?.message || String(dbErr);
      if (errorMsg.includes('permission') || errorMsg.includes('Forbidden')) {
        alert("CONTRATO NÃO ENVIADO: Falha de autorização / Permissão Negada no Banco de Dados.\nSaia e faça login novamente ou contacte o administrador do sistema.\nDetalhes: " + errorMsg);
        return;
      }

      // Em caso de falha de gravação direta (ex: rede offline), enfileira na fila offline durável
      alert("Problema de conexão! O contrato foi salvo offline de forma segura e será enviado automaticamente para a Emily assim que seu aparelho reconectar com a internet.\n\nAbrindo compartilhamento de contrato no WhatsApp a seguir...");

      setSyncQueue(prev => {
        const jaExiste = prev.some(item => item.type === 'add_contract' && item.data.saleId === contractForm.saleId && item.data.clientName === contractForm.clientName);
        if (jaExiste) return prev;
        return [...prev, {
          type: 'add_contract',
          id: tempId,
          data: sanitizedData,
          createdAt: new Date().toISOString()
        }];
      });

      // Limpar o formulário para a próxima criação
      setContractForm(prev => ({ ...prev, id: '' }));
      setShowContractValidation(false);
      // Mudar para a aba de listas instantaneamente
      setContractSubTab('lista');

      // Compartilhar mesmo em modo offline
      shareContractWhatsApp(formToShare);
    }
  };

  const prefillContract = (sale: any) => {
    setContractForm({
      ...contractForm,
      id: '',
      clientName: sale.name,
      remainderValue: sale.price?.toString() || '1799',
      courseCity: sale.city,
      needsLodging: sale.needsAccommodation ? 'SIM' : 'NÃO',
      consultant: userProfile?.name || '',
      saleId: sale.id,
      vendorId: user?.uid || '',
      vendorName: userProfile?.name || 'Vendedor'
    });
    setContractSubTab('novo');
    setActiveTab('contratos');
  };

  const deleteContract = async (id: string) => {
    if (window.confirm("Você tem certeza que deseja excluir permanentemente este contrato?")) {
      try {
        await deleteDoc(doc(db, 'contracts', id));
      } catch (err) {
        console.error(err);
        alert("Erro ao excluir contrato.");
      }
    }
  };



  const renderGlobalLoading = (text: string = "Carregando Dados") => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
    >
      <div className="flex flex-col items-center gap-6 p-10 bg-neutral-900/50 rounded-[3rem] border border-white/10 shadow-2xl w-full max-w-xs">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl bg-yellow-400/20 animate-pulse" />
          <RefreshCcw className="text-yellow-400 animate-spin relative z-10" size={56} />
        </div>
        <div className="text-center">
          <p className="text-white font-black uppercase tracking-[0.3em] text-[10px] mb-1">Opera Formação</p>
          <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">{text}</h3>
        </div>
      </div>
    </motion.div>
  );

  const handleExportContractToSpreadsheet = async (contract: any, sheetId: string) => {
    if (!sheetId) {
      alert("Por favor, selecione uma planilha.");
      return;
    }
    const targetSheet = spreadsheets.find(s => s.id === sheetId);
    if (!targetSheet) {
      alert("Planilha não localizada.");
      return;
    }

    if (isSecretaria) {
      if (!selectedDestinoTurma || selectedDestinoTurma.trim() === '') {
        alert("Selecione a turma antes de salvar.");
        return;
      }
    }

    setIsExporting(true);
    setExportStatus('loading');
    setExportMessage('');

    // Formatar todas as informações em letra maiúscula
    const nome = (contract.clientName || '').trim().toUpperCase();
    const contato = (contract.clientPhone || '').trim().toUpperCase();
    const taxa = (contract.matriculaValue || '').trim().toUpperCase();
    
    // Conforme pedido: trocar cidade pelo valor que foi combinado para ser pago do curso (geralmente 1799 mas colocar o valor do contrato)
    const cursoValue = contract.remainderValue || contract.price || '1799';
    const curso = cursoValue.toString().replace(/R\$\s?/gi, '').trim().toUpperCase();
    
    const hotel = (contract.needsLodging || 'NÃO').trim().toUpperCase();
    const consultor = (contract.consultant || contract.vendorName || '').trim().toUpperCase();
    const obs = "";
    const boleto = "";

    // 1. Usuário escolhe Destino (Turma).
    // 2. Capturar exatamente o texto selecionado.
    // 3. Converter para nome exato da aba (letra minúscula conforme exemplo "Curitiba Agosto" -> "curitiba agosto").
    const targetAbaLower = selectedDestinoTurma.trim().toLowerCase();

    if (isSecretaria) {
      const googleToken = userProfile?.googleSheetsToken;
      if (!googleToken) {
        setExportStatus('error');
        setExportMessage("Por favor, conecte o seu e-mail do Google (Gmail) na aba 'Planilhas' antes de salvar.");
        setIsExporting(false);
        return;
      }

      try {
        // Enviar os dados para nossa API que obterá metadados e verificará as abas
        const response = await fetch('/api/export-to-google-sheets-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            spreadsheetUrl: targetSheet.url,
            googleSheetsToken: googleToken,
            tabName: targetAbaLower,
            rowValues: [nome, contato, taxa, curso, hotel, consultor, obs, boleto]
          })
        });

        const resJson = await response.json();

        if (response.ok && resJson.success) {
          // Salvar localmente no Firestore como log de sucesso
          const rowData = {
            nome,
            contato,
            taxa,
            curso,
            hotel,
            consultor,
            obs,
            boleto,
            contractId: contract.id,
            createdAt: new Date().toISOString(),
            destinoTurma: selectedDestinoTurma,
            aba: resJson.tabName
          };
          await addDoc(collection(db, 'spreadsheets', sheetId, 'rows'), rowData);

          // Atualizar o documento da planilha com o log do último salvamento e aba utilizada (Data, Hora e Aba utilizada)
          const now = new Date();
          const dataFormatted = now.toLocaleDateString('pt-BR');
          const horaFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const logText = `${resJson.tabName} (${dataFormatted} às ${horaFormatted})`;
          
          await updateDoc(doc(db, 'spreadsheets', sheetId), {
            lastSavedTab: logText
          });

          setExportStatus('success');
          // Após salvar: Exibir: "Cadastro salvo com sucesso na aba:\n[NOME_DA_ABA]"
          setExportMessage(`Cadastro salvo com sucesso na aba:\n${resJson.tabName}`);
        } else {
          // Se falhar: Mostrar a mensagem correspondente e cancelar operação sem salvar localmente
          setExportStatus('error');
          if (response.status === 404 || resJson.error?.includes("não localizada") || resJson.error?.includes("não encontrada") || resJson.error?.includes("not found")) {
            setExportMessage("Aba selecionada não encontrada.");
          } else if (resJson.error?.includes("Planilha incompatível") || resJson.error?.includes("Office file") || resJson.error?.includes("not supported for this document")) {
            setExportMessage("Planilha incompatível. Utilize Google Sheets convertido.");
          } else {
            setExportMessage(resJson.error || "Houve uma falha inesperada ao tentar salvar na aba selecionada.");
          }
        }
      } catch (err: any) {
        console.error("Erro na comunicação com a API de Planilhas:", err);
        setExportStatus('error');
        setExportMessage("Não foi possível localizar a aba selecionada.");
      } finally {
        setIsExporting(false);
      }
      return;
    }

    // Fluxo padrão para outros acessos (não-secretaria) caso haja, usando webhook antigo
    const rowData = {
      nome,
      contato,
      taxa,
      curso,
      hotel,
      consultor,
      obs,
      boleto,
      contractId: contract.id,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'spreadsheets', sheetId, 'rows'), rowData);

      if (targetSheet.webhookUrl) {
        try {
          const response = await fetch('/api/trigger-sheets-webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              webhookUrl: targetSheet.webhookUrl,
              rowData: {
                nome,
                contato,
                taxa,
                curso,
                hotel,
                consultor,
                obs,
                boleto
              }
            })
          });
          const resJson = await response.json();
          if (resJson.success) {
            setExportStatus('success');
            setExportMessage(`As informações do aluno ${nome} foram salvas com sucesso.`);
          } else {
            setExportStatus('warn');
            setExportMessage(resJson.error || 'Verifique se o seu Google Apps Script foi implantado corretamente.');
          }
        } catch (webhookErr: any) {
          console.error("Erro ao acionar webhook de planilha:", webhookErr);
          setExportStatus('error');
          setExportMessage(webhookErr.message || 'Houve uma falha de conexão ao enviar os dados para a planilha.');
        }
      } else {
        setExportStatus('success');
        setExportMessage(`As informações de ${nome} foram salvas localmente no sistema para esta planilha.`);
      }
    } catch (err: any) {
      console.error("Erro ao exportar contrato no banco:", err);
      setExportStatus('error');
      setExportMessage("Ocorreu um erro interno ao tentar salvar as informações no banco de dados.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleLinkGoogleEmailForSheets = async () => {
    if (!user) {
      alert("Você precisa estar logado!");
      return;
    }
    setIsLinkingGoogle(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/spreadsheets');
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const { initializeApp: initTempApp, getApps } = await import('firebase/app');
      const { getAuth: getTempAuth } = await import('firebase/auth');
      const firebaseConfig = (await import('../firebase-applet-config.json')).default;
      
      const existingApps = getApps();
      const tempApp = existingApps.find(app => app.name === "GoogleSheetsAuthTemp") || initTempApp(firebaseConfig, "GoogleSheetsAuthTemp");
      const tempAuth = getTempAuth(tempApp);
      
      const result = await signInWithPopup(tempAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const googleUser = result.user;
      
      if (googleUser && googleUser.email) {
        const email = googleUser.email.toLowerCase();
        
        // Atualizar no banco de dados para o usuário atual
        await updateDoc(doc(db, 'users', user.uid), {
          googleSheetsEmail: email,
          googleSheetsToken: credential?.accessToken || null,
          googleSheetsLinkedAt: new Date().toISOString()
        });
        
        setUserProfile((prev: any) => ({
          ...prev,
          googleSheetsEmail: email,
          googleSheetsToken: credential?.accessToken || null,
          googleSheetsLinkedAt: new Date().toISOString()
        }));
        
        alert(`CONECTADO COM SUCESSO!\n\nO e-mail ${googleUser.email} foi conectado ao seu acesso com sucesso para termos de permissão de preenchimento de planilhas.`);
      }
      
      await tempAuth.signOut();
    } catch (err: any) {
      console.error("Erro ao conectar conta Google:", err);
      if (err.code !== 'auth/popup-closed-by-user') {
        alert("Ocorreu um erro ao conectar a conta Google: " + (err.message || err));
      }
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  const renderSpreadsheetsTab = () => {
    const spreadsheetCategories = (Array.from(new Set(
      spreadsheets
        .map(s => s.category?.trim())
        .filter((cat): cat is string => typeof cat === 'string' && cat !== '')
    )) as string[]).sort();

    const categoriesForFilter: string[] = ['Todas', ...spreadsheetCategories];

    // Filtrar planilhas
    const filteredSpreadsheets = spreadsheets.filter((sheet) => {
      const matchesSearch = 
        (sheet.name?.toLowerCase() || '').includes(spreadsheetSearch.toLowerCase()) || 
        (sheet.description?.toLowerCase() || '').includes(spreadsheetSearch.toLowerCase());
      const matchesCategory = selectedSpreadsheetCategory === 'Todas' || 
        (sheet.category && sheet.category.trim().toLowerCase() === selectedSpreadsheetCategory.trim().toLowerCase());
      return matchesSearch && matchesCategory;
    });

    const handleCreateSpreadsheet = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newSpreadsheetForm.name.trim() || !newSpreadsheetForm.url.trim()) {
        alert("Por favor, preencha o Nome e a URL da planilha.");
        return;
      }

      let url = newSpreadsheetForm.url.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      try {
        await addDoc(collection(db, 'spreadsheets'), {
          name: newSpreadsheetForm.name.trim(),
          url: url,
          description: newSpreadsheetForm.description.trim(),
          category: newSpreadsheetForm.category,
          webhookUrl: newSpreadsheetForm.webhookUrl?.trim() || '',
          createdAt: new Date().toISOString()
        });
        setIsAddingSpreadsheet(false);
        setNewSpreadsheetForm({ name: '', url: '', description: '', category: 'Vendas', webhookUrl: '' });
      } catch (err) {
        console.error("Erro ao adicionar planilha:", err);
        alert("Erro ao salvar a planilha no banco de dados.");
      }
    };

    const handleUpdateSpreadsheet = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingSpreadsheetId || !editingSpreadsheetForm.name.trim() || !editingSpreadsheetForm.url.trim()) {
        alert("Por favor, preencha o Nome e a URL.");
        return;
      }

      let url = editingSpreadsheetForm.url.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      try {
        await updateDoc(doc(db, 'spreadsheets', editingSpreadsheetId), {
          name: editingSpreadsheetForm.name.trim(),
          url: url,
          description: editingSpreadsheetForm.description.trim(),
          category: editingSpreadsheetForm.category,
          webhookUrl: editingSpreadsheetForm.webhookUrl?.trim() || ''
        });
        setEditingSpreadsheetId(null);
      } catch (err) {
        console.error("Erro ao atualizar planilha:", err);
        alert("Erro ao atualizar a planilha.");
      }
    };

    const handleDeleteSpreadsheet = async (id: string) => {
      try {
        await deleteDoc(doc(db, 'spreadsheets', id));
      } catch (err) {
        console.error("Erro ao excluir planilha:", err);
        alert("Erro ao deletar planilha.");
      }
    };

    const startEditing = (sheet: any) => {
      setEditingSpreadsheetId(sheet.id);
      setEditingSpreadsheetForm({
        name: sheet.name || '',
        url: sheet.url || '',
        description: sheet.description || '',
        category: sheet.category || 'Vendas',
        webhookUrl: sheet.webhookUrl || ''
      });
    };

    return (
      <div className="space-y-8 pb-24 text-white">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <TableProperties className="text-yellow-400" size={28} />
              <h1 className="text-3xl font-black italic uppercase tracking-tighter">PLANILHAS DE CONTROLE</h1>
            </div>
            <p className="text-xs text-neutral-400 uppercase tracking-widest mt-1 font-semibold">
              Gerencie e acesse de forma rápida as principais planilhas de monitoramento da Opera.
            </p>
          </div>
          
          <button
            onClick={() => setIsAddingSpreadsheet(!isAddingSpreadsheet)}
            className="p-3 px-6 bg-yellow-400 hover:bg-yellow-500 text-black font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-400/10 hover:shadow-yellow-400/20 text-xs self-start"
          >
            <Plus size={16} strokeWidth={3} />
            {isAddingSpreadsheet ? 'Cancelar' : 'Nova Planilha'}
          </button>
        </div>

        {/* CONEXÃO DE E-MAIL GOOGLE PARA O SISTEMA DE PLANILHAS (EXCLUSIVO EMILY/SECRETARIA) */}
        {isSecretaria && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neutral-900/40 backdrop-blur-md border border-white/5 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group shadow-2xl"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 text-neutral-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
              <Mail size={120} />
            </div>
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Mail size={26} className="group-hover:scale-110 transition-transform duration-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-black uppercase text-indigo-400 leading-none tracking-widest">Integração Google Planilhas</p>
                  {userProfile?.googleSheetsEmail && (
                    <span className="text-[8px] font-black uppercase bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20">Autorizado</span>
                  )}
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-white mt-1">
                  E-mail de Acesso &amp; Permissão de Sincronização
                </h3>
                <p className="text-[11px] text-neutral-400 mt-1 max-w-xl leading-relaxed">
                  Conecte o e-mail do Google (Gmail) para conceder acesso às planilhas. Nenhuma outra permissão ou acesso de login do sistema será alterado.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10 w-full md:w-auto">
              {userProfile?.googleSheetsEmail ? (
                <div className="flex flex-col items-center sm:items-end text-center sm:text-right">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-green-400">Google Ativo</span>
                  </div>
                  <strong className="text-xs text-neutral-200 mt-0.5 font-bold">{userProfile.googleSheetsEmail}</strong>
                  <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-0.5">Permissão Vinculada</p>
                </div>
              ) : (
                <div className="text-center sm:text-right">
                  <div className="flex items-center gap-2 justify-center sm:justify-end">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500">Sem Vínculo</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 font-semibold mt-1">Conecte o Gmail de Edição</p>
                </div>
              )}
              
              <button
                type="button"
                onClick={handleLinkGoogleEmailForSheets}
                disabled={isLinkingGoogle}
                className="w-full sm:w-auto px-6 py-4 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg text-[10px] flex items-center justify-center gap-2 active:scale-95 animate-none"
              >
                {isLinkingGoogle ? (
                  <>
                    <RefreshCcw className="animate-spin" size={14} />
                    Processando...
                  </>
                ) : userProfile?.googleSheetsEmail ? (
                  "Alterar Conta"
                ) : (
                  "Conectar Google"
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* MODAL / BOX PARA ADICIONAR NOVA PLANILHA */}
        {isAddingSpreadsheet && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neutral-900 border border-yellow-400/30 p-6 rounded-[2.5rem] space-y-4 text-white"
          >
            <h3 className="text-lg font-black uppercase tracking-tight text-yellow-400">Cadastrar Nova Planilha</h3>
            <form onSubmit={handleCreateSpreadsheet} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Nome da Planilha</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Planilha de Comissões 2026"
                  className="w-full bg-neutral-950 border border-white/10 p-3 rounded-xl text-sm font-bold placeholder-neutral-600 focus:border-yellow-400 outline-none text-white"
                  value={newSpreadsheetForm.name}
                  onChange={(e) => setNewSpreadsheetForm({...newSpreadsheetForm, name: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Categoria (Tema / Separação)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Karol, Financeiro, Vendas..."
                  className="w-full bg-neutral-950 border border-white/10 p-3 rounded-xl text-sm font-bold focus:border-yellow-400 outline-none text-white"
                  value={newSpreadsheetForm.category}
                  onChange={(e) => setNewSpreadsheetForm({...newSpreadsheetForm, category: e.target.value})}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Link da Planilha (URL do Google Sheets)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"><Link2 size={16} /></span>
                  <input
                    type="text"
                    required
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full bg-neutral-950 border border-white/10 p-3 pl-10 rounded-xl text-sm font-bold placeholder-neutral-600 focus:border-yellow-400 outline-none text-white"
                    value={newSpreadsheetForm.url}
                    onChange={(e) => setNewSpreadsheetForm({...newSpreadsheetForm, url: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-yellow-400">URL do Script Google (Opcional - Para Envio Automático)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"><Code size={16} /></span>
                  <input
                    type="text"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full bg-neutral-950 border border-white/10 p-3 pl-10 rounded-xl text-sm font-bold placeholder-neutral-600 focus:border-yellow-400 outline-none text-white"
                    value={newSpreadsheetForm.webhookUrl || ''}
                    onChange={(e) => setNewSpreadsheetForm({...newSpreadsheetForm, webhookUrl: e.target.value})}
                  />
                </div>
                <p className="text-[9px] text-neutral-500 font-semibold uppercase tracking-wider pl-1 pt-0.5">
                  Insira o link do "WebApp" do seu Google Apps Script para que novos contratos sincronizem automaticamente na sua planilha no Sheets.
                </p>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Breve Descrição</label>
                <textarea
                  placeholder="Para que serve esta planilha..."
                  rows={2}
                  className="w-full bg-neutral-950 border border-white/10 p-3 rounded-xl text-sm font-bold placeholder-neutral-600 focus:border-yellow-400 outline-none resize-none text-white"
                  value={newSpreadsheetForm.description}
                  onChange={(e) => setNewSpreadsheetForm({...newSpreadsheetForm, description: e.target.value})}
                />
              </div>

              <div className="md:col-span-2 pt-2">
                <button
                  type="submit"
                  className="w-full p-3 bg-yellow-400 hover:bg-yellow-500 text-black font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  Salvar Planilha
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* BOX PARA EDITAR PLANILHA EXISTENTE */}
        {editingSpreadsheetId && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neutral-900 border border-blue-400/30 p-6 rounded-[2.5rem] space-y-4 text-white"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black uppercase tracking-tight text-blue-400">Editar Detalhes da Planilha</h3>
              <button type="button" onClick={() => setEditingSpreadsheetId(null)} className="text-neutral-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateSpreadsheet} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Nome da Planilha</label>
                <input
                  type="text"
                  required
                  className="w-full bg-neutral-950 border border-white/10 p-3 rounded-xl text-sm font-bold focus:border-blue-400 outline-none text-white"
                  value={editingSpreadsheetForm.name}
                  onChange={(e) => setEditingSpreadsheetForm({...editingSpreadsheetForm, name: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Categoria (Tema / Separação)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Karol, Financeiro, Vendas..."
                  className="w-full bg-neutral-950 border border-white/10 p-3 rounded-xl text-sm font-bold focus:border-blue-400 outline-none text-white"
                  value={editingSpreadsheetForm.category}
                  onChange={(e) => setEditingSpreadsheetForm({...editingSpreadsheetForm, category: e.target.value})}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Link da Planilha</label>
                <input
                  type="text"
                  required
                  className="w-full bg-neutral-950 border border-white/10 p-3 rounded-xl text-sm font-bold focus:border-blue-400 outline-none text-white"
                  value={editingSpreadsheetForm.url}
                  onChange={(e) => setEditingSpreadsheetForm({...editingSpreadsheetForm, url: e.target.value})}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">URL do Script Google (Opcional - Para Envio Automático)</label>
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full bg-neutral-950 border border-white/10 p-3 rounded-xl text-sm font-bold placeholder-neutral-600 focus:border-blue-400 outline-none text-white"
                  value={editingSpreadsheetForm.webhookUrl || ''}
                  onChange={(e) => setEditingSpreadsheetForm({...editingSpreadsheetForm, webhookUrl: e.target.value})}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Descrição</label>
                <textarea
                  rows={2}
                  className="w-full bg-neutral-950 border border-white/10 p-3 rounded-xl text-sm font-bold focus:border-blue-400 outline-none resize-none text-white"
                  value={editingSpreadsheetForm.description}
                  onChange={(e) => setEditingSpreadsheetForm({...editingSpreadsheetForm, description: e.target.value})}
                />
              </div>

              <div className="md:col-span-2 pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingSpreadsheetId(null)}
                  className="w-1/2 p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold uppercase tracking-wider rounded-xl transition-all text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 p-3 bg-blue-500 hover:bg-blue-600 text-white font-black uppercase tracking-wider rounded-xl transition-all text-xs"
                >
                  Atualizar
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* FILTROS E BUSCA */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* BUSCA */}
          <div className="bg-neutral-900 border border-white/5 p-4 rounded-2xl flex items-center gap-3 flex-1">
            <Search className="text-yellow-400" size={18} />
            <input
              type="text"
              placeholder="PESQUISAR PLANILHA..."
              value={spreadsheetSearch}
              onChange={(e) => setSpreadsheetSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full font-bold uppercase tracking-widest text-white placeholder-neutral-500"
            />
          </div>

          {/* CATEGORIAS */}
          <div className="flex flex-wrap gap-2">
            {categoriesForFilter.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedSpreadsheetCategory(cat)}
                className={`py-2 px-4 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
                  selectedSpreadsheetCategory.toLowerCase().trim() === cat.toLowerCase().trim()
                    ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/10'
                    : 'bg-neutral-900 border border-white/5 text-neutral-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* GRID DE PLANILHAS */}
        {filteredSpreadsheets.length === 0 ? (
          <div className="bg-neutral-900/30 border border-white/5 rounded-[2.5rem] p-12 text-center text-neutral-500">
            <TableProperties size={48} className="mx-auto mb-4 opacity-20 text-yellow-400" />
            <p className="text-xs font-black uppercase tracking-widest">Nenhuma planilha cadastrada ou correspondente à busca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSpreadsheets.map((sheet) => (
              <motion.div
                key={sheet.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-neutral-900/40 backdrop-blur-md border border-white/5 p-6 rounded-[2rem] hover:border-yellow-400/30 transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] bg-yellow-400/10 text-yellow-400 px-2.5 py-1 rounded-full">
                      {sheet.category || 'Geral'}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(sheet)}
                        className="p-1 px-2 hover:bg-white/5 rounded text-neutral-400 hover:text-white transition-all"
                        title="Editar planilha"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSpreadsheet(sheet.id)}
                        className="p-1 px-2 hover:bg-red-500/10 rounded text-neutral-400 hover:text-red-500 transition-all"
                        title="Deletar planilha"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-base font-black uppercase tracking-tight text-white group-hover:text-yellow-400 transition-colors">
                      {sheet.name}
                    </h4>
                    {sheet.description && (
                      <p className="text-[11px] text-neutral-400 leading-relaxed max-w-xs">
                        {sheet.description}
                      </p>
                    )}
                    {sheet.lastSavedTab && (
                      <div className="mt-3 p-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] uppercase font-black tracking-wider space-y-0.5">
                        <span className="text-neutral-400 block text-[9px]">Último salvamento:</span>
                        <span className="text-white font-extrabold text-[11px] block">{sheet.lastSavedTab}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] font-medium text-neutral-500 uppercase tracking-widest">
                    {sheet.createdAt ? new Date(sheet.createdAt).toLocaleDateString('pt-BR') : 'Sem data'}
                  </span>
                  
                  <a
                    href={sheet.url}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    rel="noopener noreferrer"
                    className="p-2 px-4 bg-neutral-800 hover:bg-yellow-400 text-neutral-300 hover:text-black font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 text-[9px]"
                  >
                    Abrir Planilha <ExternalLink size={10} />
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSecretaryPanel = () => {
    const sellers = Array.from(new Set(contracts.map(c => ((c.vendorName || c.consultant || 'Vendedor Sem Nome') as string).trim()))).sort();
    const cities = Array.from(new Set(contracts.map(c => ((c.courseCity || 'Cidade Não Informada') as string).trim()))).sort();

    return (
      <div className="space-y-8 pb-24">
        {/* BUSCA */}
        <div className="bg-neutral-900 border border-white/5 p-6 rounded-[2.5rem] flex items-center gap-4">
          <Search className="text-yellow-400" />
          <input 
            className="bg-transparent border-none outline-none text-sm w-full font-bold uppercase tracking-widest"
            placeholder="BUSCAR CONTRATO (NOME OU CPF)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* ORGANIZAÇÃO POR VENDEDOR */}
        <div className="space-y-6">
          <div className="flex items-center gap-4 px-4">
            <Briefcase size={20} className="text-yellow-400" />
            <h2 className="text-xl font-black uppercase tracking-tighter">Contratos por Vendedor</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
                {sellers.map(seller => {
                  const sellerContracts = contracts.filter(c => {
                    const cVendor = (((c as any).vendorName || (c as any).consultant || 'Vendedor Sem Nome') as string).trim().toLowerCase();
                    const sTarget = ((seller as any) || 'Vendedor Sem Nome').trim().toLowerCase();
                    return cVendor === sTarget && 
                           ((c as any).clientName.toLowerCase().includes(searchTerm.toLowerCase()) || ((c as any).clientCpf && (c as any).clientCpf.includes(searchTerm)));
                  });
                  if (sellerContracts.length === 0) return null;

                  return (
                    <div key={seller} className="bg-neutral-900/50 border border-white/5 rounded-[2rem] overflow-hidden">
                      <div className="p-6 bg-neutral-800/30 border-b border-white/5 flex justify-between items-center">
                        <p className="text-sm font-black uppercase tracking-widest text-yellow-400">{seller}</p>
                        <span className="bg-yellow-400 text-black px-3 py-1 rounded-full text-[10px] font-black">{sellerContracts.length} CONTRATOS</span>
                      </div>
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {sellerContracts.map(contract => (
                          <div key={contract.id} className={`bg-black/40 border p-4 rounded-2xl flex justify-between items-center group transition-all ${contract.status === 'desistente' ? 'border-red-500/20 opacity-60' : contract.isPrinted ? 'border-[#39FF14]/50 shadow-[0_0_15px_rgba(57,255,20,0.1)]' : 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]'}`}>
                            <div>
                              <div className={`inline-block px-2 py-0.5 rounded-md mb-1 ${contract.status === 'desistente' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : contract.isPrinted ? 'bg-[#39FF14] text-black shadow-[0_0_8px_rgba(57,255,20,0.4)]' : 'bg-red-500 text-white animate-pulse'}`}>
                                 <p className="text-[10px] font-black uppercase tracking-tighter">
                                   {contract.status === 'desistente' ? 'DESISTENTE' : contract.isPrinted ? 'CONTRATO OK' : 'PENDENTE'}
                                 </p>
                              </div>
                              <p className="text-xs font-black uppercase text-white">{contract.clientName}</p>
                              <p className="text-[10px] font-bold text-neutral-500 uppercase mt-1">{contract.courseCity} • {contract.courseType}</p>
                            </div>
                            <div className="flex gap-2">
                               <button 
                                 onClick={() => {
                                   setExportingContract(contract);
                                   if (spreadsheets.length > 0) {
                                     setSelectedExportSpreadsheetId(spreadsheets[0].id);
                                   } else {
                                     setSelectedExportSpreadsheetId('');
                                   }
                                 }}
                                 className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-lg hover:scale-105 active:scale-95"
                                 title="Colocar na Planilha Google"
                               >
                                 <TableProperties size={16} />
                               </button>
                               <button 
                                 onClick={() => generateContractPDF(contract, false, true)}
                                 className="p-3 bg-white/5 border border-white/10 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center hover:scale-105 active:scale-95"
                                 title="Imprimir (ECO)"
                               >
                                 <Printer size={16} />
                               </button>
                               <button 
                                 onClick={() => deleteContract(contract.id)}
                                 className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl transition-all flex items-center justify-center shadow-lg hover:scale-105 active:scale-95"
                                 title="Excluir Contrato"
                               >
                                 <Trash2 size={16} />
                               </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ORGANIZAÇÃO POR CIDADE / TURMA */}
            <div className="space-y-6">
              <div className="flex items-center gap-4 px-4">
                <MapPin size={20} className="text-yellow-400" />
                <h2 className="text-xl font-black uppercase tracking-tighter">Contratos por Cidade</h2>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {cities.map(city => {
                  const cityContracts = contracts.filter(c => {
                    const cCity = (((c as any).courseCity || 'Cidade Não Informada') as string).trim().toLowerCase();
                    const targetCity = ((city as any) || 'Cidade Não Informada').trim().toLowerCase();
                    return cCity === targetCity && 
                           ((c as any).clientName.toLowerCase().includes(searchTerm.toLowerCase()) || ((c as any).clientCpf && (c as any).clientCpf.includes(searchTerm)));
                  });
                  if (cityContracts.length === 0) return null;

                  return (
                    <div key={city} className="bg-neutral-900/50 border border-white/5 rounded-[2rem] overflow-hidden">
                      <div className="p-6 bg-neutral-800/30 border-b border-white/5 flex justify-between items-center">
                        <p className="text-sm font-black uppercase tracking-widest text-yellow-400">{city}</p>
                        <span className="bg-yellow-400 text-black px-3 py-1 rounded-full text-[10px] font-black">{cityContracts.length} ALUNOS</span>
                      </div>
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {cityContracts.map(contract => (
                          <div key={contract.id} className={`bg-black/40 border p-4 rounded-2xl flex justify-between items-center group transition-all ${contract.status === 'desistente' ? 'border-red-500/20 opacity-60' : contract.isPrinted ? 'border-[#39FF14]/50 shadow-[0_0_15px_rgba(57,255,20,0.1)]' : 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]'}`}>
                            <div>
                              <div className={`inline-block px-2 py-0.5 rounded-md mb-1 ${contract.status === 'desistente' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : contract.isPrinted ? 'bg-[#39FF14] text-black shadow-[0_0_8px_rgba(57,255,20,0.4)]' : 'bg-red-500 text-white animate-pulse'}`}>
                                 <p className="text-[10px] font-black uppercase tracking-tighter">
                                   {contract.status === 'desistente' ? 'DESISTENTE' : contract.isPrinted ? 'CONTRATO OK' : 'PENDENTE'}
                                 </p>
                              </div>
                              <p className="text-xs font-black uppercase text-white">{contract.clientName}</p>
                              <p className="text-[10px] font-bold text-neutral-500 uppercase mt-1">Vend: {contract.vendorName || contract.consultant}</p>
                            </div>
                            <div className="flex gap-2">
                               <button 
                                 onClick={() => {
                                   setExportingContract(contract);
                                   if (spreadsheets.length > 0) {
                                     setSelectedExportSpreadsheetId(spreadsheets[0].id);
                                   } else {
                                     setSelectedExportSpreadsheetId('');
                                   }
                                 }}
                                 className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-lg hover:scale-105 active:scale-95"
                                 title="Colocar na Planilha Google"
                               >
                                 <TableProperties size={16} />
                               </button>
                               <button 
                                 onClick={() => generateContractPDF(contract, false, true)}
                                 className="p-3 bg-white/5 border border-white/10 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center hover:scale-105 active:scale-95"
                                 title="Imprimir (ECO)"
                               >
                                 <Printer size={16} />
                               </button>
                               <button 
                                 onClick={() => deleteContract(contract.id)}
                                 className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl transition-all flex items-center justify-center shadow-lg hover:scale-105 active:scale-95"
                                 title="Excluir Contrato"
                               >
                                 <Trash2 size={16} />
                               </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
      </div>
    );
  };

  const renderContractGenerator = () => {
    const inputClass = "w-full bg-black border border-neutral-800 p-4 rounded-2xl focus:border-yellow-400 outline-none transition-all text-sm";
    const labelClass = "text-[10px] font-black uppercase text-neutral-500 tracking-widest ml-2 mb-1 block";

    const getFieldClass = (fieldName: string) => {
      const isEmpty = !contractForm[fieldName as keyof typeof contractForm]?.toString().trim();
      const shouldHighlight = showContractValidation && isEmpty;
      return `${inputClass} ${shouldHighlight ? 'border-red-500 bg-red-500/10 focus:border-red-500 focus:ring-1 focus:ring-red-500 placeholder-red-400 text-red-200' : ''}`;
    };

    const getLabelClass = (fieldName: string) => {
      const isEmpty = !contractForm[fieldName as keyof typeof contractForm]?.toString().trim();
      const shouldHighlight = showContractValidation && isEmpty;
      return `${labelClass} ${shouldHighlight ? 'text-red-500 font-extrabold animate-pulse' : ''}`;
    };

    return (
      <div className="space-y-8 max-w-4xl mx-auto pb-12">
        {/* CABEÇALHO UNIFICADO COM MICROFONE IA DA OPERA FORMAÇÃO */}
        {isLucasVendedor && (
          <div className="space-y-4">
            <div className="bg-neutral-900 border border-yellow-400/20 p-6 rounded-[2rem] relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between gap-5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-full blur-3xl"></div>
              <div className="space-y-2 text-center md:text-left z-10 flex-1">
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <span className="bg-yellow-400 text-black px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest animate-pulse">Tecnologia IA</span>
                  <h2 className="text-lg font-black uppercase tracking-tighter text-white">Preenchimento via Áudio Inteligente</h2>
                </div>
                <p className="text-xs text-neutral-400 max-w-md leading-relaxed">
                  {isRecordingVoice 
                    ? "🎙️ Gravando sua voz... Fale todos os dados normalmente. Quando terminar de falar, clique em 'SALVAR E ENVIAR'." 
                    : "Diga os dados do contrato (ex: Nome do Cliente, CPF, RG, Endereço, Curso, Cidade e Valores). Nossa Inteligência Artificial preencherá tudo de forma 100% automática!"}
                </p>

                {/* VISUALIZAÇÃO EM TEMPO REAL DA COMPREENSÃO DA VOZ */}
                {isRecordingVoice && voiceTranscriptText && (
                  <div className="w-full mt-3 bg-black/50 border border-neutral-800/80 p-3 rounded-xl max-h-24 overflow-y-auto font-mono text-[10px] text-yellow-101 flex items-start gap-2">
                    <span className="text-red-500 animate-pulse text-[14px] leading-none">●</span>
                    <div className="flex-1 text-neutral-300">
                      <span className="text-yellow-400 font-extrabold uppercase mr-1">Ouvido:</span>
                      "{voiceTranscriptText}"
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={startVoiceRecognition}
                type="button"
                className={`relative z-10 flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-xl w-full md:w-auto shrink-0 select-none active:scale-[0.97] cursor-pointer ${
                  isRecordingVoice 
                    ? 'bg-red-500 text-white border border-red-400 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                    : 'bg-yellow-400 text-black border border-yellow-500 hover:bg-yellow-300 hover:scale-105 shadow-[0_0_20px_rgba(250,204,21,0.25)]'
                }`}
              >
                <Mic className={isRecordingVoice ? "animate-bounce" : ""} size={18} />
                <span>{isRecordingVoice ? 'SALVAR E ENVIAR' : '🎙️ PREENCHER POR VOZ'}</span>
              </button>
            </div>

            {/* BARRA DE PROGRESSO FLUIDA DA INTELIGÊNCIA ARTIFICIAL */}
            {voiceProgress !== null && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="bg-neutral-900 border border-yellow-400/20 p-5 rounded-3xl shadow-xl space-y-3"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-300 font-bold uppercase tracking-wider flex items-center gap-2">
                    <RefreshCcw className="animate-spin text-yellow-400" size={14} />
                    {voiceStatus || "IA Estruturando e preenchendo as informações..."}
                  </span>
                  <span className="font-mono font-bold text-yellow-400">{voiceProgress}%</span>
                </div>
                <div className="h-3 w-full bg-neutral-950 rounded-full overflow-hidden p-0.5 border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${voiceProgress}%` }}
                    transition={{ duration: 0.15 }}
                    className="h-full bg-gradient-to-r from-yellow-500 via-yellow-400 to-green-500 rounded-full shadow-[0_0_12px_rgba(250,204,21,0.4)]"
                  />
                </div>
                <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider text-center">
                  O robô da Opera Formação está organizando os dados do contrato no formulário abaixo...
                </p>
              </motion.div>
            )}
          </div>
        )}

        {/* NAVEGAÇÃO DE SUB-ABAS DE CONTRATOS - Unificada para todos */}
        <div className="flex bg-neutral-900 border border-white/5 p-1 rounded-2xl max-w-md mx-auto">
          <button 
            onClick={() => setContractSubTab('novo')}
            className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${contractSubTab === 'novo' ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' : 'text-neutral-500 hover:bg-white/5'}`}
          >
            Novo Contrato
          </button>
          <button 
            onClick={() => setContractSubTab('lista')}
            className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${contractSubTab === 'lista' ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' : 'text-neutral-500 hover:bg-white/5'}`}
          >
            Meus Contratos
          </button>
        </div>

        {contractSubTab === 'lista' ? (
          <div className="space-y-4 px-2">
            <div className="flex items-center gap-4 px-4">
              <FilePlus size={20} className="text-yellow-400" />
              <h2 className="text-xl font-black uppercase tracking-tighter">Gerencial de Contratos</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {/* Filtro: Secretaria vê tudo, Vendedores e Gestores veem apenas os seus próprios contratos. Os contratos permanecem sempre fixos e intactos mesmo que a venda associada seja excluída ou arquivada. */}
              {(() => {
                const filteredList = (isSecretaria) ? displayedContracts : displayedContracts.filter(c => c.vendorId === user?.uid);
                
                if (filteredList.length === 0) return (
                  <div className="bg-neutral-900/50 border border-dashed border-white/5 p-12 rounded-[2.5rem] text-center">
                    <p className="text-neutral-500 font-bold uppercase text-xs">
                      {isSecretaria ? "Nenhum contrato ativo no sistema." : "Nenhum contrato postado por você ainda."}
                    </p>
                  </div>
                );

                return filteredList
                  .sort((a,b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
                  .map(contract => (
                  <div key={contract.id} className={`bg-neutral-900/50 border p-5 rounded-[2rem] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${contract.status === 'desistente' ? 'border-red-500/20 opacity-60' : contract.isPrinted ? 'border-[#39FF14]/50 shadow-[0_0_15px_rgba(57,255,20,0.05)]' : 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]'}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${contract.status === 'desistente' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : contract.isPrinted ? 'bg-[#39FF14] text-black shadow-[0_0_8px_rgba(57,255,20,0.4)]' : 'bg-red-500 text-white animate-pulse'}`}>
                          {contract.status === 'desistente' ? 'DESISTENTE' : contract.isPrinted ? 'CONTRATO OK' : 'PENDENTE'}
                        </span>
                        <p className="text-sm font-black uppercase text-white">{contract.clientName}</p>
                      </div>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase">{contract.courseCity} • {contract.courseType}</p>
                      <p className="text-[8px] text-neutral-600 font-bold">VENDEDOR: {contract.vendorName || 'Não Informado'} • EM: {new Date(contract.updatedAt || contract.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                       {(isSecretaria || isGestor) && (
                         <button 
                           onClick={() => {
                             setExportingContract(contract);
                             if (spreadsheets.length > 0) {
                               setSelectedExportSpreadsheetId(spreadsheets[0].id);
                             } else {
                               setSelectedExportSpreadsheetId('');
                             }
                           }}
                           className="flex-1 sm:flex-none p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-lg hover:scale-105 active:scale-95"
                           title="Colocar na Planilha Google"
                         >
                           <TableProperties size={16} />
                         </button>
                       )}
                       <button 
                         onClick={() => shareContractWhatsApp(contract)}
                         className="flex-1 sm:flex-none p-3 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 rounded-xl hover:bg-[#25D366] hover:text-black transition-all flex items-center justify-center shadow-lg hover:scale-105 active:scale-95"
                         title="Enviar WhatsApp"
                       >
                         <MessageCircle size={16} />
                       </button>
                       <button 
                         onClick={() => generateContractPDF(contract, false, true)}
                         className="flex-1 sm:flex-none p-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all flex items-center justify-center hover:scale-105 active:scale-95"
                         title="Imprimir (ECO)"
                       >
                         <Printer size={16} />
                       </button>
                       <button 
                         onClick={() => deleteContract(contract.id)}
                         className="flex-1 sm:flex-none p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl transition-all flex items-center justify-center shadow-lg hover:scale-105 active:scale-95"
                         title="Excluir Contrato"
                       >
                         <Trash2 size={16} />
                       </button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        ) : (
          <div className="bg-neutral-900 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <FileText size={120} />
            </div>
            
            <div className="relative z-10 mb-8 pb-4 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Gerador de Contrato</h3>
                <p className="text-xs text-neutral-500 font-medium">Preencha os campos abaixo ou use o microfone da Inteligência Artificial no topo.</p>
              </div>
            </div>

            <div className="space-y-8 relative z-10">
              {/* Título e Consultor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Título do Documento</label>
                  <input 
                    className={inputClass}
                    value={contractForm.title}
                    onChange={e => setContractForm({...contractForm, title: e.target.value})}
                    placeholder="CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS"
                  />
                </div>
                <div>
                  <label className={getLabelClass('consultant')}>Nome do Consultor *</label>
                  <input 
                    className={getFieldClass('consultant')}
                    value={contractForm.consultant}
                    onChange={e => setContractForm({...contractForm, consultant: e.target.value})}
                    placeholder="Nome do Vendedor"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                 <div>
                    <label className={labelClass}>Modalidade Principal</label>
                    <div className="flex gap-2 bg-black p-1 rounded-2xl border border-neutral-800">
                      {['Reciclagem', 'Presencial'].map(m => (
                        <button
                          key={m}
                          onClick={() => setContractForm({...contractForm, mainModality: m})}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${contractForm.mainModality === m ? 'bg-yellow-400 text-black' : 'text-neutral-500 hover:text-white'}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                 </div>
              </div>

              {/* Contratante */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-yellow-400 uppercase tracking-widest border-b border-white/5 pb-2">Dados do Contratante</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className={getLabelClass('clientName')}>Nome Completo *</label>
                    <input className={getFieldClass('clientName')} value={contractForm.clientName} onChange={e => setContractForm({...contractForm, clientName: e.target.value})} />
                  </div>
                  <div>
                    <label className={getLabelClass('clientCpf')}>CPF *</label>
                    <input className={getFieldClass('clientCpf')} value={contractForm.clientCpf} onChange={e => setContractForm({...contractForm, clientCpf: e.target.value})} />
                  </div>
                  <div>
                     <label className={getLabelClass('clientRg')}>RG *</label>
                     <input className={getFieldClass('clientRg')} value={contractForm.clientRg} onChange={e => setContractForm({...contractForm, clientRg: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={getLabelClass('clientPhone')}>Telefone *</label>
                    <input className={getFieldClass('clientPhone')} value={contractForm.clientPhone} onChange={e => setContractForm({...contractForm, clientPhone: e.target.value})} />
                  </div>
                  <div>
                    <label className={getLabelClass('clientBirthDate')}>Data Nascimento *</label>
                    <input className={getFieldClass('clientBirthDate')} value={contractForm.clientBirthDate} onChange={e => setContractForm({...contractForm, clientBirthDate: e.target.value})} placeholder="DD/MM/AAAA" />
                  </div>
                </div>

                {/* Endereço */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className={getLabelClass('rua')}>Rua e Número *</label>
                    <input className={getFieldClass('rua')} value={contractForm.rua} onChange={e => setContractForm({...contractForm, rua: e.target.value})} />
                  </div>
                  <div>
                    <label className={getLabelClass('cidade')}>Cidade *</label>
                    <input className={getFieldClass('cidade')} value={contractForm.cidade} onChange={e => setContractForm({...contractForm, cidade: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                     <div>
                       <label className={getLabelClass('estado')}>UF *</label>
                       <input className={getFieldClass('estado')} value={contractForm.estado} onChange={e => setContractForm({...contractForm, estado: e.target.value})} maxLength={2} />
                     </div>
                     <div>
                       <label className={getLabelClass('cep')}>CEP *</label>
                       <input className={getFieldClass('cep')} value={contractForm.cep} onChange={e => setContractForm({...contractForm, cep: e.target.value})} />
                     </div>
                  </div>
                </div>

                {/* Recados */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 bg-black/40 rounded-3xl border border-white/5">
                     <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest pl-2">Recado 1</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input className={inputClass} placeholder="Nome" value={contractForm.recado1Nome} onChange={e => setContractForm({...contractForm, recado1Nome: e.target.value})} />
                        <input className={inputClass} placeholder="Grau" value={contractForm.recado1Grau} onChange={e => setContractForm({...contractForm, recado1Grau: e.target.value})} />
                     </div>
                     <input className={inputClass} placeholder="Telefone" value={contractForm.recado1Phone} onChange={e => setContractForm({...contractForm, recado1Phone: e.target.value})} />
                  </div>
                  <div className="space-y-3 p-4 bg-black/40 rounded-3xl border border-white/5">
                     <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest pl-2">Recado 2</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input className={inputClass} placeholder="Nome" value={contractForm.recado2Nome} onChange={e => setContractForm({...contractForm, recado2Nome: e.target.value})} />
                        <input className={inputClass} placeholder="Grau" value={contractForm.recado2Grau} onChange={e => setContractForm({...contractForm, recado2Grau: e.target.value})} />
                     </div>
                     <input className={inputClass} placeholder="Telefone" value={contractForm.recado2Phone} onChange={e => setContractForm({...contractForm, recado2Phone: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Curso */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-yellow-400 uppercase tracking-widest border-b border-white/5 pb-2">Dados do Curso</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Formação</label>
                    <select className={inputClass} value={contractForm.courseType} onChange={e => setContractForm({...contractForm, courseType: e.target.value})}>
                      {['Máquinas Pesadas', 'Máquinas Agrícolas', 'Munck', 'Empilhadeira', 'Florestais'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={getLabelClass('courseCity')}>Cidade do Curso *</label>
                    <input className={getFieldClass('courseCity')} value={contractForm.courseCity} onChange={e => setContractForm({...contractForm, courseCity: e.target.value})} />
                  </div>
                </div>

                {isSecretaria && (
                  <div className="animate-in fade-in duration-200">
                    <label className={getLabelClass('destinoTurma')}>Destino (Turma) *</label>
                    <select
                      className={getFieldClass('destinoTurma')}
                      value={contractForm.destinoTurma || ''}
                      onChange={e => setContractForm({...contractForm, destinoTurma: e.target.value})}
                    >
                      <option value="">-- SELECIONE A TURMA --</option>
                      <option value="Diadema Junho">Diadema Junho</option>
                      <option value="Sorocaba Julho">Sorocaba Julho</option>
                      <option value="Goiania Julho">Goiania Julho</option>
                      <option value="Palhoça Julho">Palhoça Julho</option>
                      <option value="Londrina Agosto">Londrina Agosto</option>
                      <option value="Itajai Agosto">Itajai Agosto</option>
                      <option value="Curitiba Agosto">Curitiba Agosto</option>
                      <option value="Passo Fundo Agosto">Passo Fundo Agosto</option>
                      <option value="Toledo Setembro">Toledo Setembro</option>
                      <option value="Maringá/PR Agosto">Maringá/PR Agosto</option>
                      <option value="Porto Alegre Setembro">Porto Alegre Setembro</option>
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <label className={labelClass}>Modalidade</label>
                      <div className="flex gap-2 bg-black p-1 rounded-2xl border border-neutral-800">
                        {['EAD', 'Presencial'].map(m => (
                          <button
                            key={m}
                            onClick={() => setContractForm({...contractForm, courseModality: m})}
                            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${contractForm.courseModality === m ? 'bg-yellow-400 text-black' : 'text-neutral-500'}`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                   </div>
                   <div>
                      <label className={labelClass}>Certificado</label>
                      <div className="flex gap-2 bg-black p-1 rounded-2xl border border-neutral-800">
                        {['Tradicional', 'Premium'].map(c => (
                          <button
                            key={c}
                            onClick={() => setContractForm({...contractForm, certificateType: c})}
                            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${contractForm.certificateType === c ? 'bg-yellow-400 text-black' : 'text-neutral-500'}`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                   </div>
                </div>
                <div>
                   <label className={getLabelClass('courseDate')}>Data do Curso *</label>
                   <input className={getFieldClass('courseDate')} value={contractForm.courseDate} onChange={e => setContractForm({...contractForm, courseDate: e.target.value})} placeholder="Ex: 12-14 de JUNHO" />
                </div>
              </div>

              {/* Valores */}
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-yellow-400 uppercase tracking-widest border-b border-white/5 pb-2">Valores e Pagamento</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className={getLabelClass('matriculaValue')}>Matrícula (Valor Pago) *</label>
                     <input className={getFieldClass('matriculaValue')} value={contractForm.matriculaValue} onChange={e => setContractForm({...contractForm, matriculaValue: e.target.value})} placeholder="Ex: 200,00" />
                   </div>
                   <div>
                     <label className={getLabelClass('remainderValue')}>Valor a Pagar (À Vista) *</label>
                     <input className={getFieldClass('remainderValue')} value={contractForm.remainderValue} onChange={e => setContractForm({...contractForm, remainderValue: e.target.value})} placeholder="Ex: 1.699,00" />
                   </div>
                 </div>
                 <div>
                    <label className={labelClass}>Necessita Hospedagem?</label>
                    <div className="flex gap-2 bg-black p-1 rounded-2xl border border-neutral-800 w-32">
                      {['SIM', 'NÃO'].map(h => (
                        <button
                          key={h}
                          onClick={() => setContractForm({...contractForm, needsLodging: h})}
                          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${contractForm.needsLodging === h ? 'bg-yellow-400 text-black' : 'text-neutral-500'}`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                 </div>
              </div>

              <div className="space-y-2">
                 <label className={labelClass}>Observações Adicionais</label>
                 <textarea 
                   className={`${inputClass} min-h-[100px] resize-none`} 
                   value={contractForm.observations} 
                   onChange={e => setContractForm({...contractForm, observations: e.target.value})}
                 />
              </div>

               <div className="pt-8">
                 {isPosting && (
                   <div className="mb-6 space-y-2">
                     <div className="flex justify-between items-center text-xs font-black text-white px-2">
                       <span className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                         POSTANDO CONTRATO...
                       </span>
                       <span>{postProgress}%</span>
                     </div>
                     <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/10 p-[2px]">
                       <div 
                         className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-300"
                         style={{ width: `${postProgress}%` }}
                       />
                     </div>
                     {postProgress < 100 && (
                       <p className="text-[10px] text-neutral-400 text-center font-bold">
                         O Firestore salvará seu contrato mesmo em caso de queda de conexão.
                       </p>
                     )}
                   </div>
                 )}

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <button 
                     onClick={postContract}
                     disabled={isPosting}
                     className={`w-full bg-green-500 text-white font-black py-5 rounded-[2rem] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-green-500/20 ${isPosting ? 'opacity-50 cursor-not-allowed scale-100' : ''}`}
                   >
                     {isPosting ? <RefreshCcw className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
                     {isPosting ? 'SINCRONIZANDO...' : 'POSTAR CONTRATO'}
                   </button>
                <button 
                  onClick={() => { if (validateContract(true)) { shareContractWhatsApp(contractForm); } }}
                  className="w-full bg-[#25D366] text-white font-black py-5 rounded-[2rem] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-green-500/20"
                >
                  <MessageCircle size={24} />
                  ENVIAR WHATSAPP
                </button>
                <button 
                  onClick={() => { if (validateContract(true)) { copyContractMessage(); } }}
                  className="w-full bg-white/5 border border-white/10 text-white font-black py-5 rounded-[2rem] flex items-center justify-center gap-3 hover:bg-white/10 transition-all"
                >
                  <FileText size={24} className="text-yellow-400" />
                  COPIAR MENSAGEM
                </button>
              </div>

              {/* OPÇÃO DE BAIXAR EM PDF DIRETAMENTE SEM ENVIAR PARA EMILY */}
              <div className="mt-6 bg-neutral-900/60 p-6 rounded-[2rem] border border-neutral-800 space-y-4 text-left">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-white/5">
                  <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                    <Download size={14} className="text-yellow-400" /> Baixar Contrato em PDF (Sem enviar ou notificar)
                  </h4>
                  <span className="text-[9px] bg-yellow-400/10 text-yellow-400 px-2.5 py-1 rounded-full font-black uppercase">Seguro & Local</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button 
                    onClick={() => { if (validateContract(true)) { generateContractPDF(contractForm, false, false); } }}
                    className="w-full bg-black hover:bg-neutral-950 border border-neutral-800 hover:border-yellow-400/40 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-95 transition-all shadow-md group animate-none"
                  >
                    <Download size={18} className="text-yellow-400 group-hover:translate-y-0.5 transition-transform" />
                    <span className="text-[10px] uppercase">BAIXAR PDF PADRÃO</span>
                  </button>
                  <button 
                    onClick={() => { if (validateContract(true)) { generateContractPDF(contractForm, false, true); } }}
                    className="w-full bg-black hover:bg-neutral-950 border border-neutral-800 hover:border-green-400/40 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-95 transition-all shadow-md group animate-none"
                  >
                    <Download size={18} className="text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
                    <span className="text-[10px] uppercase">BAIXAR PDF ECO (MÁQ. PESADAS)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    );
  };
  const exportConversionsPDF = (ecoMode = false) => {
    if (!teamMetrics || (sellersStats || []).length === 0) return alert("Sem dados para exportar.");
    const doc = new jsPDF();
    
    // Header
    if (!ecoMode) {
      doc.setFillColor(15, 23, 42); // slate-900 / dark corporate
      doc.rect(0, 0, 210, 45, 'F');
      
      doc.setTextColor(250, 204, 21); // yellow accent
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("RELATORIO DE CONVERSAO E PERFORMANCE", 15, 22);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Metricas Analiticas de Vendas - Exclusivo Diretoria", 15, 30);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR')}`, 15, 36);
      
      // Icon accent
      doc.setDrawColor(250, 204, 21);
      doc.setLineWidth(1);
      doc.line(15, 40, 195, 40);
    } else {
      // ECO mode - minimalist black header outline, no filled rectangles
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(15, 12, 180, 25);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("RELATORIO DE CONVERSAO E PERFORMANCE", 20, 21);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Metricas Analiticas (Versao Economica) - Gerado em: ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR')}`, 20, 30);
    }

    // 1. INSIGHTS DA DIRETORIA
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("1. Resumo Analitico de Conversao", 15, 58);
    
    const totalLeads = (sellersStats || []).reduce((acc, s) => acc + (s.leadsCount || 0), 0);
    const totalConfirmed = teamMetrics?.totalConfirmed || 0;
    const teamConvRate = totalLeads > 0 ? (totalConfirmed / totalLeads) * 100 : 0;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Total de Leads Recebidos pela Equipe: ${totalLeads}`, 15, 66);
    doc.text(`Total de Alunos Matriculados: ${totalConfirmed}`, 15, 72);
    doc.text(`Desconto Total Concedido ate o Momento: R$ ${(teamMetrics?.totalDiscount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 15, 78);
    
    doc.setFont("helvetica", "bold");
    doc.text(`TAXA DE CONVERSAO EXECUTIVA DA EQUIPE: ${teamConvRate.toFixed(1)}%`, 15, 85);
    
    // Calculate stats for Gonçalves specifically
    const getManagerDirectStats = (nameQuery: string, emailQuery: string) => {
      const found = (sellersStats || []).find(s => {
        const email = (s.email || '').toLowerCase();
        const name = (s.name || '').toLowerCase();
        return email.includes(emailQuery) || name.includes(nameQuery);
      });
      if (found) return found;
      
      // Fallback calculation directly from sales
      let mSales = displayedAllSales.filter(s => {
        const vendorEmail = (s.vendorEmail || '').toLowerCase();
        const vendorName = (s.vendorName || '').toLowerCase();
        return vendorEmail.includes(emailQuery) || vendorName.includes(nameQuery);
      });
      if ((isLucas && managerPeriodFilter === 'current') || isValiandro) {
        mSales = mSales.filter(s => isCurrentMonthSale(s.createdAt));
      }
      const confirmed = mSales.filter(s => s.status === 'confirmado');
      const dropouts = mSales.filter(s => s.status === 'desistente');
      const totalDiscount = confirmed.reduce((acc, s) => {
        if (s.city === 'EAD') return acc;
        const price = Number(s.price) || 0;
        return acc + Math.max(0, 1799 - price);
      }, 0);
      
      return {
        id: 'ger_goncalves_seeded',
        name: 'Gerente Gonçalves',
        email: 'goncalvesopera@gmail.com',
        role: 'gerente',
        leadsCount: 0,
        confirmedCount: confirmed.length,
        dropoutCount: dropouts.length,
        conversionRate: 0,
        totalDiscount
      };
    };

    const goncalves = getManagerDirectStats('goncalves', 'goncalves');

    // Box for Best & Worst conversion
    if (!ecoMode) {
      doc.setFillColor(248, 250, 252); // soft grey
      doc.rect(15, 92, 180, 24, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, 92, 180, 24);
      
      doc.setFontSize(8.5);
      doc.setTextColor(21, 128, 61); // green
      doc.text(`MAIOR CONVERSAO (MELHOR): ${teamMetrics?.best?.name?.toUpperCase() || 'N/A'} - ${(teamMetrics?.best?.conversionRate || 0).toFixed(1)}% de Conversao (${teamMetrics?.best?.confirmedCount || 0} matriculados / ${teamMetrics?.best?.leadsCount || 0} leads)`, 20, 100);
      
      doc.setTextColor(185, 28, 28); // red
      doc.text(`MENOR CONVERSAO (PIOR): ${teamMetrics?.worst?.name?.toUpperCase() || 'N/A'} - ${(teamMetrics?.worst?.conversionRate || 0).toFixed(1)}% de Conversao (${teamMetrics?.worst?.confirmedCount || 0} matriculados / ${teamMetrics?.worst?.leadsCount || 0} leads)`, 20, 108);
    } else {
      // Minimalist outlines for ECO mode
      doc.setDrawColor(180, 180, 180);
      doc.rect(15, 92, 180, 24);
      
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(`MAIOR CONVERSAO (MELHOR): ${teamMetrics?.best?.name?.toUpperCase() || 'N/A'} - ${(teamMetrics?.best?.conversionRate || 0).toFixed(1)}% de Conversao (${teamMetrics?.best?.confirmedCount || 0} matriculados / ${teamMetrics?.best?.leadsCount || 0} leads)`, 20, 100);
      doc.text(`MENOR CONVERSAO (PIOR): ${teamMetrics?.worst?.name?.toUpperCase() || 'N/A'} - ${(teamMetrics?.worst?.conversionRate || 0).toFixed(1)}% de Conversao (${teamMetrics?.worst?.confirmedCount || 0} matriculados / ${teamMetrics?.worst?.leadsCount || 0} leads)`, 20, 108);
    }
    
    // 2. DETALHAMENTO DE CONVERSÃO DA EQUIPE (TABLE)
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("2. Ranking e Detalhamento de Conversao por Consultor", 15, 126);
    
    // Sort vendors by conversionRate descending for the table
    const eligibleSellersAndManagers = [...sellersStats].filter(s => {
      const email = (s.email || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      
      if (email.includes('karol') || name.includes('karol')) {
        return false;
      }
      
      // Retire Valiandro do PDF
      if (email.includes('valiandro') || name.includes('valiandro')) {
        return false;
      }
      
      if (s.role === 'vendedor') return true;
      
      const isGoncalvesEmailOrName = email.includes('goncalves') || email.includes('lucas') || name.includes('goncalves') || name.includes('gonçalves') || name.includes('lucas');
      
      if (s.role === 'gerente' && isGoncalvesEmailOrName) {
        return true;
      }
      
      return false;
    });

    const hasGoncalves = eligibleSellersAndManagers.some(s => {
      const e = (s.email || '').toLowerCase();
      const n = (s.name || '').toLowerCase();
      return e.includes('goncalves') || e.includes('lucas') || n.includes('goncalves') || n.includes('gonçalves') || n.includes('lucas');
    });
    if (!hasGoncalves) {
      eligibleSellersAndManagers.push(goncalves);
    }
      
    const headers = isLucas 
      ? ['RANK / CONSULTOR', 'LEADS', 'MATRICULAS', 'DESCONTO DADO', 'TAXA CONVERSAO', 'AVALIACAO']
      : ['RANK / CONSULTOR', 'MATRICULAS', 'DESCONTO DADO', 'TAXA CONVERSAO', 'AVALIACAO'];

    const tableData = eligibleSellersAndManagers
      .sort((a, b) => (b.conversionRate || 0) - (a.conversionRate || 0))
      .map((s, index) => {
        const convVal = s.conversionRate || 0;
        const progressSymbol = convVal >= 35 ? "Excelente" : convVal >= 20 ? "Otimo" : convVal >= 10 ? "Regular" : "Alerta";
        const isManager = s.role === 'gerente';
        const roleLabel = isManager ? "[GERENTE] " : "";
        const discountVal = s.totalDiscount || 0;
        
        const row = [
          `#${index + 1} ${roleLabel}${s.name?.toUpperCase() || 'CONSULTOR'}`
        ];
        if (isLucas) {
          row.push(s.leadsCount || 0);
        }
        row.push(s.confirmedCount || 0);
        row.push(`R$ ${discountVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        row.push(`${convVal.toFixed(1)}%`);
        row.push(progressSymbol);

        return row;
      });
    
    autoTable(doc, {
      startY: 132,
      head: [headers],
      body: tableData,
      headStyles: { fillColor: ecoMode ? [240, 240, 240] : [15, 23, 42], textColor: ecoMode ? [0, 0, 0] : [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold' }, // Deixa o nome dos vendedores em negrito!
        4: { fontStyle: 'bold', textColor: [15, 23, 42] }
      },
      margin: { left: 15, right: 15 }
    });
    
    doc.save(`diretoria_analise_conversao_${ecoMode ? 'ECO_' : ''}${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const downloadManagerReport = (ecoMode = false) => {
    if (!teamMetrics || (sellersStats || []).length === 0) return alert("Sem dados para exportar.");
    const doc = new jsPDF();
    
    // Header
    if (!ecoMode) {
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(0, 0, 210, 40);
      doc.setTextColor(0, 0, 0);
    }
    
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO EXECUTIVO DE VENDAS", 15, 30);
    doc.setFontSize(10);
    doc.text(new Date().toLocaleDateString('pt-BR'), 170, 20);

    // 1. RESUMO GERAL
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text("1. Resumo Consolidado da Equipe", 15, 55);
    doc.setFontSize(9);
    doc.text(`Total de Vendas Confirmadas: ${teamMetrics?.totalConfirmed || 0}`, 15, 65);
    doc.text(`Vendas Presenciais: ${teamMetrics?.totalPresencial || 0}`, 15, 71);
    doc.text(`Vendas EAD: ${teamMetrics?.totalEad || 0}`, 15, 77);
    const avgTicketPresencial = (teamMetrics?.totalPresencial || 0) > 0 ? (teamMetrics?.presencialRevenue || 0) / (teamMetrics?.totalPresencial || 1) : 0;
    const confirmedRevenue = teamMetrics?.presencialRevenue || 0;
    const totalPotential = (teamMetrics?.totalPresencial || 0) * 1799;
    const teamDiscountPerc = totalPotential > 0 ? ((teamMetrics?.totalDiscount || 0) / totalPotential) * 100 : 0;
    doc.text(`Ticket Médio Geral (Exceto EAD): R$ ${avgTicketPresencial.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`, 15, 83);
    doc.text(`Desconto Total Concedido: R$ ${(teamMetrics?.totalDiscount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${teamDiscountPerc.toFixed(1)}%)`, 15, 89);
    if (isLucas) {
      doc.text(`Total de Leads: ${(sellersStats || []).reduce((acc, s) => acc + (s.leadsCount || 0), 0)}`, 15, 95);
    }

    // 2. TABELA DE PERFORMANCE POR VENDEDOR
    const headers = isLucas
      ? ['VENDEDOR', 'CONFIRM.', 'DESIST.', 'TKT MÉDIO', 'DESC. TOTAL', 'LEADS', 'CONV.']
      : ['VENDEDOR', 'CONFIRM.', 'DESIST.', 'TKT MÉDIO', 'DESC. TOTAL', 'CONV.'];

    const mainTableData = sellersStats.map(s => {
      const conv = s.leadsCount > 0 ? ((s.confirmedCount / s.leadsCount) * 100).toFixed(1) + '%' : '0.0%';
      
      const row = [
        s.name?.toUpperCase() || 'VENDEDOR',
        s.confirmedCount,
        s.dropoutCount || 0,
        `R$ ${s.avgTicket.toLocaleString('pt-BR')}`,
        `R$ ${(s.totalDiscount || 0).toLocaleString('pt-BR')}`
      ];
      if (isLucas) {
        row.push(s.leadsCount || 0);
      }
      row.push(conv);
      return row;
    });

    autoTable(doc, {
      startY: 110,
      head: [headers],
      body: mainTableData,
      headStyles: { fillColor: ecoMode ? [240, 240, 240] : [250, 204, 21], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 7 },
      margin: { left: 15, right: 15 }
    });

    // 3. TABELA DE TURMAS (TOTAL ACUMULADO)
    let currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text("2. Total Acumulado por Cidade/Turma", 15, currentY);
    currentY += 10;

    const aggregateCityData = teamMetrics.cityStats
      .filter(s => s.count > 0)
      .map(s => [
        s.city.toUpperCase(),
        s.count,
        s.lodging
      ]);

    autoTable(doc, {
      startY: currentY,
      head: [['CIDADE / TURMA', 'TOTAL ALUNOS', 'HOSPEDAGEM']],
      body: aggregateCityData,
      headStyles: { fillColor: ecoMode ? [240, 240, 240] : [250, 204, 21], textColor: [0, 0, 0] },
      styles: { fontSize: 8 },
      margin: { left: 15, right: 15 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    // 4. DETALHAMENTO POR VENDEDOR
    doc.setFontSize(14);
    doc.text("3. Detalhamento por Vendedor", 15, currentY);
    currentY += 10;

    sellersStats.forEach((seller) => {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`> ${seller.name?.toUpperCase()} (DESC. TOTAL: R$ ${seller.totalDiscount.toLocaleString('pt-BR')} | ${seller.discountPercentage.toFixed(1)}%)`, 15, currentY);
      currentY += 5;

      const sellerConv = seller.leadsCount > 0 ? ((seller.confirmedCount / seller.leadsCount) * 100).toFixed(1) + '%' : '0.0%';
      const sellerDropoutRate = (seller.confirmedCount + (seller.dropoutCount || 0)) > 0 
        ? (((seller.dropoutCount || 0) / (seller.confirmedCount + (seller.dropoutCount || 0))) * 100).toFixed(1) + '%' 
        : '0.0%';
      
      const citiesData = (seller.cities || []).map((c: any) => {
        const cityTotal = c.count + (c.dropoutCount || 0);
        const cityDropoutRate = cityTotal > 0 ? ((c.dropoutCount / cityTotal) * 100).toFixed(1) + '%' : '0.0%';

        return [
          c.city.toUpperCase(),
          c.count,
          cityDropoutRate,
          sellerDropoutRate,
          `R$ ${(c.avgTicket || 0).toLocaleString('pt-BR')}`,
          `R$ ${(c.discount || 0).toLocaleString('pt-BR')}`,
          sellerConv
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['CIDADE', 'CONFIRM.', '% DESIST. CIDADE', 'DESIST. GERAL', 'TICKET MÉDIO', 'DESC. TOTAL', 'CONVERSÃO']],
        body: citiesData,
        headStyles: { fillColor: ecoMode ? [240, 240, 240] : [64, 64, 64], textColor: ecoMode ? [0, 0, 0] : [255, 255, 255] },
        styles: { fontSize: 6.5 }, // Reduced size to fit many columns
        margin: { left: 15, right: 15 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;
    });

    // Salvar
    doc.save(`Relatorio_Executivo_Opera_${ecoMode ? 'ECO_' : ''}${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const downloadEquipeReport = (ecoMode = false) => {
    if ((sellersStats || []).length === 0) return alert("Sem dados para exportar.");
    const doc = new jsPDF();

    // Header
    if (!ecoMode) {
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(0, 0, 210, 40);
      doc.setTextColor(0, 0, 0);
    }

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE DESEMPENHO DA EQUIPE", 15, 25);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Acesso Exclusivo: Gerente Gonçalves & Lucas Gonçalves", 15, 33);
    doc.text(new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR'), 150, 15);

    // Resumo Geral (Coletivo)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("1. Resumo Consolidado (Métricas Coletivas)", 15, 55);

    const teamTotalConfirmed = sellersStats.reduce((sum, s) => sum + (s.confirmedCount || 0), 0);
    const teamTotalLeads = sellersStats.reduce((sum, s) => sum + (s.leadsCount || 0), 0);
    const teamConversionRate = teamTotalLeads > 0 ? (teamTotalConfirmed / teamTotalLeads) * 100 : 0;
    const teamTotalDiscount = sellersStats.reduce((sum, s) => sum + (s.totalDiscount || 0), 0);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total de Vendas Confirmadas da Equipe: ${teamTotalConfirmed}`, 15, 65);
    doc.text(`Total de Leads Recebidos pela Equipe: ${teamTotalLeads}`, 15, 71);
    doc.text(`Porcentagem de Vendas Coletiva (Conversão): ${teamConversionRate.toFixed(1)}%`, 15, 77);
    doc.text(`Total de Desconto Concedido pela Equipe: R$ ${teamTotalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 15, 83);

    // Tabela Individual
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("2. Desempenho Individual por Consultor", 15, 100);

    const headers = ['VENDEDOR', 'VENDAS CONFIRMADAS', 'QUANTIDADE DE LEADS', 'PORCENTAGEM (CONV.)', 'DESCONTO CONCEDIDO'];

    const mainTableData = sellersStats.map(s => {
      const conv = s.leadsCount > 0 ? ((s.confirmedCount / s.leadsCount) * 100).toFixed(1) + '%' : '0.0%';
      return [
        s.name?.toUpperCase() || 'VENDEDOR',
        s.confirmedCount || 0,
        s.leadsCount || 0,
        conv,
        `R$ ${(s.totalDiscount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ];
    });

    autoTable(doc, {
      startY: 108,
      head: [headers],
      body: mainTableData,
      headStyles: { fillColor: ecoMode ? [240, 240, 240] : [250, 204, 21], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 8.5 },
      margin: { left: 15, right: 15 }
    });

    // Salvar
    doc.save(`Relatorio_Performance_Equipe_${ecoMode ? 'ECO_' : ''}${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const tabVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  const handleDeleteReceipt = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'receipt_submissions', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `receipt_submissions/${id}`);
    }
  };

  const menuItems = useMemo(() => {
    const isLucasOrGoncalves = isLucas || isOperaGoncalves;
    const canSeeEquipe = isLucasOrGoncalves || isGestor || userProfile?.role === 'gerente';
    const canSeeCarteirinha = isLucas || isGlobalManager || isGestor || userProfile?.role === 'gerente';

    if (isGlobalManager) {
      const items = [
        { id: 'resumo', label: 'Dashboard', icon: LayoutGrid },
        { id: 'vendas', label: 'Vendas', icon: Plus },
        { id: 'contratos', label: 'Contratos', icon: FileText },
      ];
      if (canSeeCarteirinha) {
        items.push({ id: 'carteirinha', label: 'Carteirinha', icon: CreditCard });
      }
      if (canSeeEquipe) {
        items.push({ id: 'equipe', label: 'Equipe', icon: Users });
      }
      items.push({ id: 'config', label: 'Ajustes', icon: Settings });
      return items;
    }

    // Todos os outros acessos sem exceção
    const items = [
      { id: 'resumo', label: 'Dashboard', icon: LayoutGrid },
    ];

    // Se for vendedor (não for Karol e não for Secretaria) ou for a Emily, conter a aba de Vendas
    const isSellerOrEmily = !isKarol && (!isSecretaria || isEmily);
    if (isSellerOrEmily) {
      items.push({ id: 'vendas', label: 'Vendas', icon: Plus });
    }

    items.push({ id: 'contratos', label: 'Contratos', icon: FileText });
    if (canSeeCarteirinha) {
      items.push({ id: 'carteirinha', label: 'Carteirinha', icon: CreditCard });
    }

    if (canSeeEquipe) {
      items.push({ id: 'equipe', label: 'Equipe', icon: Users });
    }
    items.push({ id: 'config', label: 'Ajustes', icon: Settings });
    return items;
  }, [isGlobalManager, isLucas, isOperaGoncalves, isGestor, userProfile, isKarol, isSecretaria, isEmily]);

  useEffect(() => {
    if (isAppReady && user && isPinVerified) {
      const isValiandro = user?.email && [
        'valiandroopera@gmail.com',
        'valiandrobock@gmail.com',
        'valiandro@gmail.com'
      ].includes(user.email.toLowerCase());

      if (isGestor && isValiandro && activeTab === 'resumo') {
        // Redirecionamento removido - Valiandro agora pode ver o resumo (sem métricas financeiras)
      }
    }
  }, [isGestor, activeTab, isAppReady, user, isPinVerified]);

  return (
    <div id="app_root" className="min-h-screen bg-black text-white font-sans pb-24 selection:bg-yellow-400 selection:text-black">
      {/* Barra de Progresso Global para Envios */}
      <AnimatePresence>
        {isSendingFees && (
          <motion.div 
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className="fixed top-0 left-0 w-full z-[200] h-1.5 bg-neutral-900 overflow-hidden"
          >
            <motion.div 
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="h-full bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)]"
            />
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl animate-pulse">
              Enviando Taxas para Karol...
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* SPLASH SCREEN PREMIUM */}
      <AnimatePresence>
        {!isAppReady && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden"
          >
            {/* Luzes de fundo dinâmicas sutis */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-yellow-400/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Apenas a logo centralizada com a barra de carregamento */}
            <div className="relative flex flex-col items-center justify-center space-y-12 z-10">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-80 h-80 sm:w-[480px] sm:h-[480px] flex items-center justify-center"
              >
                <motion.img 
                  src="https://i.postimg.cc/MThQB29B/Chat-GPT-Image-26-de-jun-de-2026-10-07-31.png" 
                  alt="Opera Formação Logo" 
                  className="w-full h-full object-contain filter drop-shadow-[0_0_25px_rgba(234,179,8,0.45)]"
                  referrerPolicy="no-referrer"
                  animate={{ 
                    scale: [1, 1.03, 1],
                  }}
                  transition={{ 
                    duration: 2.5, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                />
              </motion.div>

              {/* Barra de progresso elegante diretamente abaixo */}
              <div className="w-80 sm:w-[480px] h-2 bg-neutral-900 rounded-full overflow-hidden relative border border-white/5">
                <motion.div 
                  className="h-full bg-gradient-to-r from-yellow-500 via-yellow-400 to-amber-300 rounded-full shadow-[0_0_12px_rgba(234,179,8,0.6)]"
                  style={{ width: `${loadingProgress}%` }}
                  transition={{ ease: "easeInOut" }}
                />
              </div>
            </div>

            {/* Botão de Recuperação se demorar muito */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 6 }}
              className="absolute bottom-12 z-10"
            >
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-neutral-900 text-neutral-500 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-full border border-white/5 shadow-md active:scale-95 transition-all"
              >
                Demorando muito? Toque aqui para Recarregar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER PREMIUM */}
      <header id="main_header" className="p-3 bg-neutral-900/55 backdrop-blur-md border-b border-white/5 sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <img 
            src="https://i.postimg.cc/MThQB29B/Chat-GPT-Image-26-de-jun-de-2026-10-07-31.png" 
            alt="Opera Formação" 
            className="h-10 sm:h-12 w-auto object-contain brightness-110 filter drop-shadow-[0_0_8px_rgba(234,179,8,0.2)]" 
            referrerPolicy="no-referrer"
          />
          <div className="h-8 w-[1px] bg-white/10 hidden sm:block" />
          <div>
            {user && isPinVerified && (
              <p className="text-[11px] text-white/90 font-bold uppercase tracking-[0.15em] mt-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                {isSecretaria ? (userProfile?.name?.toUpperCase() || 'SECRETÁRIA') : (userProfile?.name || user.displayName || 'Vendedor')}
              </p>
            )}
            <div className="flex items-center gap-1.5 text-[8px] text-neutral-500 uppercase tracking-[0.1em] font-bold mt-1">
              <div className={`w-1.5 h-1.5 ${user && isPinVerified ? 'bg-green-500' : 'bg-red-500'} rounded-full animate-pulse`} /> 
              {user && isPinVerified ? (isSecretaria ? `SECRETÁRIA ${userProfile?.name?.toUpperCase() || ''}` : (userProfile?.role === 'gerente' || isLucas) ? 'MODO ADMINISTRADOR' : 'PORTAL VENDEDOR') : 'SESSÃO FECHADA'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && isPinVerified && (
            <div className="relative group mr-2">
              <button 
                onClick={() => setActiveTab('config')}
                className="p-3 bg-neutral-800 rounded-2xl text-yellow-400 hover:bg-neutral-700 transition-all"
                title="Configurações"
              >
                <Settings size={18} />
              </button>
            </div>
          )}
          {user && (
            <button onClick={logout} className="p-3 bg-neutral-800 rounded-2xl text-red-500 hover:bg-neutral-700 transition-colors">
              <LogOut size={18} />
            </button>
          )}
          <label className="relative cursor-pointer group">
            <input type="file" id="profile_pic_input" className="hidden" onChange={handleFileUpload} accept="image/*" />
            <div className="w-12 h-12 rounded-2xl border border-yellow-400/50 overflow-hidden bg-neutral-800 transition-transform active:scale-95 shadow-lg relative group-hover:rotate-3">
              {userProfile?.profilePic ? (
                <img src={userProfile.profilePic} className="w-full h-full object-cover" alt="Perfil" />
              ) : (
                <User className="p-2.5 text-yellow-400 w-full h-full" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={12} className="text-white" />
              </div>
              <div className="absolute bottom-0 right-0 bg-yellow-400 p-0.5 rounded-tl-lg shadow-sm">
                <Camera size={8} className="text-black" />
              </div>
            </div>
          </label>
        </div>
      </header>

      <main id="main_content" className="p-4 max-w-2xl mx-auto">
        {(!user || !isPinVerified) && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center space-y-8"
          >
            {authView === 'login' && (
              <div className="space-y-6 w-full max-w-xs bg-black p-10 rounded-[3rem] border border-yellow-400/20 shadow-2xl">
                <div className="space-y-4 mb-6 flex flex-col items-center">
                  <img 
                    src="https://i.postimg.cc/MThQB29B/Chat-GPT-Image-26-de-jun-de-2026-10-07-31.png" 
                    alt="Opera Formação" 
                    className="h-28 sm:h-32 w-auto object-contain filter drop-shadow-[0_0_15px_rgba(234,179,8,0.35)]" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="space-y-1">
                    <h2 className="text-lg font-black uppercase tracking-widest text-yellow-400">
                      {isRegistering ? "Primeiro Acesso" : "OPERA FORMAÇÃO"}
                    </h2>
                    <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest leading-none">
                      {isRegistering ? "Crie sua conta profissional" : "SISTEMA DE GESTÃO ELITE"}
                    </p>
                  </div>
                </div>

                {/* BOTÃO DE INSTALAÇÃO NO LOGIN (Rápido Acesso) */}
                {!isPWAInstalled && (
                  <motion.button 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    onClick={handleInstallClick}
                    className="w-full py-4 bg-green-500 text-black rounded-3xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Download size={16} /> 
                    {deferredPrompt ? "INSTALAR APLICATIVO" : "BAIXAR PARA CELULAR"}
                  </motion.button>
                )}

                <div className="space-y-4">
                  <div className="space-y-2 text-left">
                    <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest ml-4">E-mail Corporativo</label>
                    <input 
                      type="email"
                      className="w-full bg-black border border-neutral-800 p-5 rounded-3xl text-sm outline-none focus:border-yellow-400 transition-colors text-white"
                      placeholder="seu@email.com"
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2 text-left">
                    <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest ml-4">Senha de Acesso</label>
                    <input 
                      type="password"
                      className="w-full bg-black border border-neutral-800 p-5 rounded-3xl text-sm outline-none focus:border-yellow-400 transition-colors text-white"
                      placeholder="••••••••"
                      value={passwordInput}
                      onChange={e => setPasswordInput(e.target.value)}
                    />
                  </div>

                  {/* ESQUECEU A SENHA DE LOGIN */}
                  <div className="text-right px-2">
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={isResettingPassword}
                      className="text-[10px] font-black text-yellow-500 hover:text-yellow-400 uppercase tracking-widest transition-colors duration-200 disabled:opacity-50"
                    >
                      {isResettingPassword ? "Enviando..." : "Esqueci minha senha"}
                    </button>
                  </div>

                  {/* AJUDA PERSONALIZADA PARA THAÍZE */}
                  {emailInput.toLowerCase().trim() === 'thaieduarda123@gmail.com' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-yellow-400/10 border border-yellow-400/20 p-4 rounded-3xl text-left text-[10px] text-yellow-400 space-y-1.5 mt-2"
                    >
                      <p className="font-black uppercase tracking-wider">💡 Olá Thaíze!</p>
                      <p className="leading-relaxed opacity-90 font-medium">
                        Se você esqueceu sua senha de login, clique em <button type="button" className="underline font-black text-yellow-300" onClick={handleResetPassword}>Esqueci minha senha</button> acima para receber o link de redefinição no seu Gmail.
                      </p>
                      <p className="leading-relaxed opacity-90 font-medium">
                        <span className="font-black text-white">Dica:</span> Como seu e-mail é Gmail, você também pode clicar no botão <span className="font-black text-white">"Entrar com Google"</span> abaixo para acessar sua conta instantaneamente sem senha!
                      </p>
                    </motion.div>
                  )}

                  <div className="pt-2 gap-3 flex flex-col">
                    <button 
                      onClick={handleAuth}
                      disabled={isLoggingIn}
                      className="w-full py-5 bg-yellow-400 text-black font-black rounded-3xl flex items-center justify-center gap-3 hover:scale-95 active:scale-90 transition-all uppercase text-xs tracking-widest shadow-xl shadow-yellow-400/20 disabled:opacity-50"
                    >
                      {isLoggingIn ? (
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <LogIn className="w-5 h-5" />
                      )}
                      {isLoggingIn ? "PROCESSANDO..." : (isRegistering ? "CRIAR CONTA" : "ENTRAR NO SISTEMA")}
                    </button>

                    <div className="flex items-center gap-4 my-2">
                      <div className="flex-1 h-[1px] bg-white/5"></div>
                      <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">ou</span>
                      <div className="flex-1 h-[1px] bg-white/5"></div>
                    </div>

                    <button 
                      onClick={handleGoogleLogin}
                      className="w-full py-5 bg-white text-black font-black rounded-3xl flex items-center justify-center gap-3 hover:scale-95 active:scale-90 transition-all uppercase text-xs tracking-widest shadow-xl shadow-white/10"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                         <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                         <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                         <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                         <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Entrar com Google
                    </button>

                    <button 
                      onClick={() => {
                        setIsRegistering(!isRegistering);
                        setLoginError(null);
                      }}
                      className="w-full py-4 bg-white/5 border border-white/5 rounded-3xl text-neutral-400 font-black uppercase text-[10px] tracking-widest hover:bg-white/10 hover:text-white transition-all mt-2"
                    >
                      {isRegistering ? "JÁ TENHO CONTA • LOGIN" : "NOVO POR AQUI? • PRIMEIRO ACESSO"}
                    </button>
                  </div>

                  {loginError && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-[9px] text-red-400 font-black leading-tight uppercase mt-4">
                      {loginError}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FIM DA SEÇÃO AUTH */}

            {/* Botão de Instalação Global para Mobile/Android/iOS */}
            {(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) && (
              <div className="w-full max-w-xs mt-10">
                <button 
                  onClick={handleInstallClick}
                  disabled={isPWAInstalled}
                  className={`w-full py-5 border rounded-[2.5rem] flex items-center justify-center gap-4 transition-all group shadow-2xl ${
                    isPWAInstalled 
                    ? 'bg-green-500/10 border-green-500/20 text-green-500 opacity-60 grayscale'
                    : 'bg-green-500 border-green-400 text-black hover:scale-105 shadow-green-500/40'
                  }`}
                >
                  <div className={`${isPWAInstalled ? 'bg-green-500/10' : 'bg-black/10'} p-3 rounded-2xl`}>
                    <Download size={24} className="group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-left">
                    <p className="text-[14px] font-black uppercase tracking-tighter">
                      {isPWAInstalled ? 'APLICATIVO INSTALADO' : 'BAIXAR APP OPERA'}
                    </p>
                    <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest">
                      {isPWAInstalled ? 'Pronto para usar' : 'Versão Oficial para Android'}
                    </p>
                  </div>
                </button>
              </div>
            )}

            {authView === 'pin-create' && (
              <div className="space-y-6 w-full max-w-xs bg-black p-8 rounded-[3rem] border border-yellow-400/20 shadow-2xl flex flex-col items-center">
                <img 
                  src="https://i.postimg.cc/MThQB29B/Chat-GPT-Image-26-de-jun-de-2026-10-07-31.png" 
                  alt="Opera Formação" 
                  className="h-28 sm:h-32 w-auto object-contain mb-4 filter drop-shadow-[0_0_15px_rgba(234,179,8,0.35)]" 
                  referrerPolicy="no-referrer"
                />
                <div className="text-center">
                  <h2 className="text-xl font-black uppercase tracking-tight">Criar Acesso</h2>
                  <p className="text-neutral-500 text-xs mt-1">Defina seu PIN de segurança pessoal</p>
                </div>
                <div className="space-y-4 w-full">
                  <div className="text-left">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-4 mb-2 block">Definir PIN de Acesso</label>
                    <input 
                      type="password"
                      maxLength={6}
                      placeholder="Ex: 1234"
                      className="w-full bg-neutral-900 border border-neutral-800 p-5 rounded-3xl text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-yellow-400"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  
                  <div className="text-left">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-4 mb-2 block">Código de Gestão (Se houver)</label>
                    <input 
                      type="password"
                      placeholder="Somente para gerentes"
                      className="w-full bg-neutral-900 border border-neutral-800 p-4 rounded-3xl text-center text-xs font-bold tracking-widest uppercase outline-none focus:border-yellow-400"
                      value={managerCode}
                      onChange={(e) => setManagerCode(e.target.value)}
                    />
                  </div>

                  <button 
                    onClick={handleCreatePin}
                    className="w-full py-5 bg-yellow-400 text-black font-black rounded-[2rem] shadow-xl shadow-yellow-400/10 hover:scale-95 transition-transform"
                  >
                    ATIVAR MINHA CONTA
                  </button>

                  <button 
                    onClick={() => {
                      setIsPinVerified(true);
                      localStorage.setItem('isPinVerified', 'true');
                    }}
                    className="w-full py-2 text-neutral-500 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Pular PIN por enquanto (Não recomendado)
                  </button>
                </div>
              </div>
            )}

            {authView === 'pin-verify' && (
              <div className="space-y-6 w-full max-w-xs bg-black p-8 rounded-[3rem] border border-yellow-400/20 shadow-2xl flex flex-col items-center">
                <img 
                  src="https://i.postimg.cc/MThQB29B/Chat-GPT-Image-26-de-jun-de-2026-10-07-31.png" 
                  alt="Opera Formação" 
                  className="h-28 sm:h-32 w-auto object-contain mb-4 filter drop-shadow-[0_0_15px_rgba(234,179,8,0.35)]" 
                  referrerPolicy="no-referrer"
                />
                <div className="text-center">
                  <h2 className="text-xl font-black uppercase tracking-tight">Verificação</h2>
                  <p className="text-neutral-500 text-xs mt-1">Olá, {user?.displayName}! Digite seu PIN cadastrado.</p>
                </div>
                <div className="space-y-4 w-full">
                  <input 
                    type="password"
                    maxLength={6}
                    autoFocus
                    className="w-full bg-neutral-900 border border-neutral-800 p-5 rounded-3xl text-center text-3xl font-black tracking-[0.5em] focus:border-yellow-400 outline-none"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  />
                  <button 
                    onClick={handleVerifyPin}
                    className="w-full py-4 bg-yellow-400 text-black font-black rounded-3xl hover:scale-95 transition-transform"
                  >
                    ENTRAR NO PAINEL
                  </button>

                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={async () => {
                        if (window.confirm("Deseja realmente redefinir seu PIN? Você precisará cadastrar um novo.")) {
                          try {
                            await updateDoc(doc(db, 'users', user.uid), { pin: '' });
                            setAuthView('pin-create');
                            setPinInput('');
                          } catch (err) {
                            handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
                          }
                        }
                      }}
                      className="text-[9px] font-black text-neutral-600 uppercase tracking-widest hover:text-yellow-400 transition-colors"
                    >
                      Esqueceu o PIN? Redefinir
                    </button>
                    
                    <button onClick={logout} className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Sair da conta</button>

                    {/* CONFIGURAÇÃO DE NOTIFICAÇÕES NATIVAS */}
                    <div className="w-full pt-6 border-t border-white/5 space-y-4">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-3xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${notificationPermission === 'granted' ? 'bg-yellow-400 text-black' : 'bg-neutral-800 text-neutral-500'}`}>
                            <Bell size={14} />
                          </div>
                          <div className="text-left">
                            <p className="text-[9px] font-black uppercase text-white leading-none">Alertas Push</p>
                            <p className="text-[7px] font-bold text-neutral-500 uppercase mt-1">
                              {notificationPermission === 'granted' ? 'PERMISSÃO CONCEDIDA' : 'DESATIVADO NO NAVEGADOR'}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={requestNotificationPermission}
                          disabled={notificationPermission === 'granted'}
                          className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                            notificationPermission === 'granted' 
                            ? 'opacity-50 cursor-default' 
                            : 'bg-yellow-400 text-black hover:scale-105 active:scale-95 shadow-lg shadow-yellow-400/20'
                          }`}
                        >
                          {notificationPermission === 'granted' ? 'ATIVADO' : 'ATIVAR'}
                        </button>
                      </div>
                      <p className="text-[7px] text-neutral-600 font-bold uppercase text-center px-4 leading-tight italic">
                        *Útil para receber avisos fora do app (vendas e recibos).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {user && isPinVerified && (
          <>
             {/* Global Overlays */}
            <AnimatePresence>
              {isDeleting && renderGlobalLoading("Excluindo Vendedor")}
              {(loading || isGlobalLoading) && !isDeleting && renderGlobalLoading("Sincronizando")}
              {isPosting && renderGlobalLoading(`Postando Contrato (${postProgress}%)`)}
              
               {exportingContract && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 text-white"
                >
                  <div className="bg-neutral-900 border border-indigo-500/30 p-8 rounded-[2.5rem] w-full max-w-lg space-y-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
                    <button 
                      onClick={() => setExportingContract(null)} 
                      className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white transition-all hover:scale-110 active:scale-95"
                    >
                      <X size={18} />
                    </button>

                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                        <TableProperties size={24} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-indigo-400 leading-none tracking-widest">Sincronizador Automático</p>
                        <h3 className="text-xl font-black italic uppercase tracking-tighter mt-1 text-indigo-400">Google Sheets</h3>
                      </div>
                    </div>

                    {exportStatus === 'idle' && (
                      <>
                        <div className="bg-neutral-950/50 p-5 rounded-2xl border border-white/5 space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Aluno</span>
                            <strong className="font-extrabold uppercase text-white">{exportingContract.clientName}</strong>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Contato</span>
                            <strong className="font-extrabold uppercase text-white">{exportingContract.clientPhone || 'NÃO CONFIGURADO'}</strong>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Taxa Matrícula</span>
                            <strong className="font-extrabold uppercase text-yellow-400">{exportingContract.matriculaValue || 'R$ 0,00'}</strong>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1">
                              Valor Curso <span className="text-[8px] bg-indigo-500/10 text-indigo-400 px-1 py-0.5 rounded uppercase font-black">Aba Curso</span>
                            </span>
                            <strong className="font-extrabold uppercase text-green-400">
                              R$ {exportingContract.remainderValue || exportingContract.price || '1799'}
                            </strong>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Cidade</span>
                            <strong className="font-extrabold uppercase text-white">{exportingContract.courseCity || exportingContract.city || 'NÃO CONFIGURADA'}</strong>
                          </div>

                          {isSecretaria && (
                            <div className="space-y-1.5 pt-1.5 pb-1 border-t border-white/5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block">Destino (Turma) *</label>
                              <select
                                className="w-full bg-neutral-900 border border-white/10 p-3 rounded-xl text-xs font-bold uppercase focus:border-indigo-500 outline-none text-white"
                                value={selectedDestinoTurma}
                                onChange={(e) => setSelectedDestinoTurma(e.target.value)}
                              >
                                <option value="">-- SELECIONE A TURMA --</option>
                                <option value="Diadema Junho">Diadema Junho</option>
                                <option value="Sorocaba Julho">Sorocaba Julho</option>
                                <option value="Goiania Julho">Goiania Julho</option>
                                <option value="Palhoça Julho">Palhoça Julho</option>
                                <option value="Londrina Agosto">Londrina Agosto</option>
                                <option value="Itajai Agosto">Itajai Agosto</option>
                                <option value="Curitiba Agosto">Curitiba Agosto</option>
                                <option value="Passo Fundo Agosto">Passo Fundo Agosto</option>
                                <option value="Toledo Setembro">Toledo Setembro</option>
                                <option value="Maringá/PR Agosto">Maringá/PR Agosto</option>
                                <option value="Porto Alegre Setembro">Porto Alegre Setembro</option>
                              </select>
                            </div>
                          )}

                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Hospedagem</span>
                            <strong className="font-extrabold uppercase text-white">{exportingContract.needsLodging || 'NÃO'}</strong>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Consultor</span>
                            <strong className="font-extrabold uppercase text-white">{exportingContract.consultant || exportingContract.vendorName || 'NÃO INFORMADO'}</strong>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block pb-1">Selecione a Planilha de Destino:</label>
                          {spreadsheets.length === 0 ? (
                            <div className="p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-2xl text-yellow-400 text-xs font-semibold text-center uppercase tracking-wider">
                              Nenhuma planilha cadastrada no sistema. Cadastre uma planilha na aba "Planilhas" primeiro!
                            </div>
                          ) : (
                            <select
                              className="w-full bg-neutral-950 border border-white/10 p-4 rounded-2xl text-sm font-black uppercase focus:border-indigo-500 outline-none text-white"
                              value={selectedExportSpreadsheetId}
                              onChange={(e) => setSelectedExportSpreadsheetId(e.target.value)}
                            >
                              {spreadsheets.map((sheet) => (
                                <option key={sheet.id} value={sheet.id}>
                                  {sheet.name.toUpperCase()} ({sheet.category?.toUpperCase() || 'GERAL'})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div className="pt-2 flex gap-3">
                          <button
                            type="button"
                            onClick={() => setExportingContract(null)}
                            className="w-1/2 p-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold uppercase tracking-wider rounded-2xl transition-all text-xs hover:scale-[1.02] active:scale-95 duration-150"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={isExporting || spreadsheets.length === 0}
                            onClick={() => handleExportContractToSpreadsheet(exportingContract, selectedExportSpreadsheetId)}
                            className="w-1/2 p-4 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-black uppercase tracking-wider rounded-2xl transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 duration-150"
                          >
                            Exportar e Salvar
                          </button>
                        </div>
                      </>
                    )}

                    {exportStatus === 'loading' && (
                      <div className="py-8 flex flex-col items-center justify-center space-y-6">
                        <div className="relative">
                          <div className="absolute inset-0 blur-2xl bg-indigo-500/20 animate-pulse" />
                          <RefreshCcw className="text-indigo-400 animate-spin relative z-10" size={48} />
                        </div>
                        <div className="w-full space-y-2 text-center">
                          <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest animate-pulse">Sincronizando com o Google Sheets ...</p>
                          <div className="w-full bg-neutral-950 h-2.5 rounded-full overflow-hidden border border-white/5 relative">
                            <motion.div 
                              initial={{ width: "0%" }}
                              animate={{ width: "100%" }}
                              transition={{ duration: 1.8, ease: "easeInOut" }}
                              className="h-full bg-indigo-500 rounded-full"
                            />
                          </div>
                          <p className="text-[9px] text-neutral-500 uppercase tracking-widest italic pt-1">Por favor, mantenha esta janela aberta</p>
                        </div>
                      </div>
                    )}

                    {exportStatus === 'success' && (
                      <div className="py-6 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 shadow-lg shadow-green-500/5">
                          <CheckCircle2 size={36} className="animate-bounce" />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-xl font-black uppercase tracking-tighter text-green-400">Exportado com Sucesso!</h4>
                          <p className="text-xs text-neutral-300 px-4 leading-relaxed">
                            {exportMessage}
                          </p>
                        </div>

                        {spreadsheets.find(s => s.id === selectedExportSpreadsheetId) && (
                          <a
                            href={spreadsheets.find(s => s.id === selectedExportSpreadsheetId)?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full p-4 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 text-xs font-semibold"
                          >
                            <TableProperties size={16} />
                            Ver Planilha no Google Sheets
                            <ExternalLink size={12} />
                          </a>
                        )}

                        <button
                          onClick={() => setExportingContract(null)}
                          className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold uppercase tracking-wider rounded-2xl transition-all text-xs"
                        >
                          Fechar Janela
                        </button>
                      </div>
                    )}

                    {['warn', 'error'].includes(exportStatus) && (
                      <div className="py-6 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center text-yellow-500 shadow-lg">
                          <AlertTriangle size={36} className="animate-pulse" />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-xl font-black uppercase tracking-tighter text-yellow-500">
                            {exportStatus === 'warn' ? "Aviso na Sincronização" : "Falha na Comunicação"}
                          </h4>
                          <p className="text-xs text-neutral-300 px-4 leading-relaxed">
                            {exportStatus === 'warn' 
                              ? `Os dados foram salvos localmente com sucesso! No entanto, o seu webhook do Google Sheets retornou a seguinte mensagem de erro:\n\n${exportMessage}`
                              : `Os dados foram salvos localmente no sistema, mas houve uma falha ao enviar para o Google Sheets:\n\n${exportMessage}`}
                          </p>
                          
                          {(exportMessage.toLowerCase().includes("status: 405") || exportMessage.toLowerCase().includes("status: 404") || exportMessage.toLowerCase().includes("unable to open") || exportMessage.toLowerCase().includes("http 405")) ? (
                            <div className="text-[10px] text-red-300 font-medium uppercase tracking-wider px-4 py-3 bg-red-950/40 rounded-2xl border border-red-500/20 flex flex-col gap-2 mt-2 leading-relaxed text-left">
                              <span className="font-extrabold text-red-400">⚠️ CORREÇÃO DA CONFIGURAÇÃO:</span>
                              Você provavelmente colocou a URL comum de visualização da Planilha no campo "URL de Webhook (Script)". 
                              Para corrigir, abra a planilha, vá em <strong className="text-white">Extensões &gt; Apps Script</strong>, cole o código e faça uma <strong className="text-white">Nova Implantação de "App da Web" (Web App)</strong> habilitada para "Qualquer Pessoa". Insira o link gerado lá! Siga o passo a passo da aba "Planilhas".
                            </div>
                          ) : null}
                        </div>

                        {spreadsheets.find(s => s.id === selectedExportSpreadsheetId) && (
                          <a
                            href={spreadsheets.find(s => s.id === selectedExportSpreadsheetId)?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full p-4 bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white hover:bg-indigo-600 font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-105 active:scale-95 text-xs"
                          >
                            <TableProperties size={16} />
                            Abrir Planilha de Qualquer Forma
                            <ExternalLink size={12} />
                          </a>
                        )}

                        <button
                          onClick={() => setExportingContract(null)}
                          className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold uppercase tracking-wider rounded-2xl transition-all text-xs"
                        >
                          Fechar Janela
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
          {/* TAB: CONTRATOS */}
          {activeTab === 'contratos' && (
            <motion.div key="contratos" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-4 pb-24">
               {isSecretaria ? renderSecretaryPanel() : renderContractGenerator()}
            </motion.div>
          )}

          {/* TAB: PLANILHAS */}
          {activeTab === 'planilhas' && isSecretaria && (
            <motion.div key="planilhas" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-4 pb-24">
               {renderSpreadsheetsTab()}
            </motion.div>
          )}

          {/* TAB: TAXAS (KAROL) */}
          {activeTab === 'taxas' && isSecretaria && (
            <motion.div key="taxas" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-4 pb-24">
               {renderFeesPanel()}
            </motion.div>
          )}

          {/* TAB: HISTÓRICO (KAROL) */}
          {activeTab === 'historico' && isSecretaria && (
            <motion.div key="historico" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-4 pb-24">
               {renderHistoryTab()}
            </motion.div>
          )}

          {/* TAB: RECIBOS (GESTOR) */}
          {activeTab === 'taxas_recibos' && isGestor && !isValiandro && (
            <motion.div key="taxas_recibos" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-4 pb-24">
               {renderGestorReceipts()}
            </motion.div>
          )}

          {/* TAB: RECIBOS (ESTRATÉGICO KAROL) */}
          {activeTab === 'recibos' && isSecretaria && (
            <motion.div key="recibos" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-4 pb-24">
               {renderReceiptsTab()}
            </motion.div>
          )}

          {/* TAB: RECEBIMENTO DE TAXAS (KAROL) */}
          {activeTab === 'recebimento' && isKarol && (
            <motion.div key="recebimento" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-4 pb-24">
               {renderKarolInboundFees()}
            </motion.div>
          )}

          {/* TAB: AUTOMAÇÃO / CENTRAL (KAROL) */}
          {activeTab === 'automacao' && isKarol && (
            <motion.div key="automacao" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-4 pb-24">
               {renderKarolAutomations()}
            </motion.div>
          )}

          {activeTab === 'resumo' && (
            <motion.div key="resumo" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
              
              {/* BANNERS DE INSTALAÇÃO E NOTIFICAÇÃO (Estilo App Nativo) */}
              <div className="mx-2 space-y-2 mb-4">
                {/* Banner PWA (Instalar App) */}
                {(!isPWAInstalled && deferredPrompt) && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white text-black p-4 rounded-[2rem] flex items-center justify-between shadow-2xl border border-white/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center text-black shadow-inner">
                        <Smartphone size={24} />
                      </div>
                      <div>
                        <p className="text-[12px] font-black uppercase leading-tight">Instalar Aplicativo</p>
                        <p className="text-[9px] font-bold text-neutral-500 uppercase">Acesso rápido na tela inicial</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleInstallClick}
                      className="bg-black text-white text-[10px] font-black uppercase px-6 py-3 rounded-xl hover:bg-neutral-800 transition-colors"
                    >
                      Instalar
                    </button>
                  </motion.div>
                )}

                {/* Banner de Notificações (Estilo WhatsApp/Moderno) */}
                {notificationPermission !== 'granted' && !isValiandro && !isLucas && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 p-4 rounded-[2rem] flex items-center justify-between shadow-xl shadow-yellow-400/20 border border-white/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center text-black">
                        <Bell size={24} className="animate-bounce" />
                      </div>
                      <div>
                        <p className="text-[12px] font-black text-black uppercase leading-tight">Ativar Notificações</p>
                        <p className="text-[9px] font-bold text-black/60 uppercase">Receba alertas mesmo fora do app</p>
                      </div>
                    </div>
                    <button 
                      onClick={requestNotificationPermission}
                      className="bg-black text-white text-[10px] font-black uppercase px-6 py-3 rounded-xl hover:scale-105 transition-transform shadow-lg"
                    >
                      Ativar
                    </button>
                  </motion.div>
                )}
              </div>

              <div id="cover_photo" className="h-36 rounded-[2.5rem] bg-black border border-white/10 mb-[-2rem] z-0 overflow-hidden relative shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent" />
                <div className="absolute -top-10 -right-10 w-64 h-64 bg-yellow-400/10 rounded-full blur-[80px] animate-pulse" />
                <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle, #D4AF37 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                   <h1 className="text-8xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-[#D4AF37] via-[#F9E274] to-[#CFB53B] drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]">OPERA</h1>
                </div>
              </div>
              <div id="gestor_header" className="flex items-center justify-between mb-2 relative z-10 px-4 flex-wrap gap-2">
                <span className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">
                  Opera Formação • {isLucas ? 'Painel Gestor' : 'Painel Individual'}
                </span>
                <div className="flex items-center gap-2">
                  {syncStatus && (
                    <span className="text-[8px] font-bold text-yellow-400 animate-pulse bg-yellow-500/10 px-2.5 py-1 rounded-full border border-yellow-500/20 font-mono">
                      {syncStatus}
                    </span>
                  )}
                  <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full border flex items-center gap-1.5 font-mono ${isOnline ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500 animate-ping'}`} />
                    {isOnline ? '🟢 ONLINE' : '🔴 OFFLINE • DADOS SERÃO SINCRONIZADOS AUTOMATICAMENTE'}
                  </span>
                </div>
              </div>

              {/* DASHBOARD CONDICIONAL (GERENTE vs VENDEDORES) */}
              <div id="hero_summary" className="bg-neutral-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden z-10 mx-2 hover:border-yellow-400/30 transition-colors group">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 to-transparent pointer-events-none group-hover:from-yellow-400/10 transition-all" />
                
                {(isLucas) ? (
                  <>
                    {!isValiandro && !isLucas && (
                      <div className="flex justify-between items-start mb-8">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2 font-mono">Ganhos Operacionais</p>
                          <h2 className="text-4xl sm:text-5xl font-black text-white group-hover:text-yellow-400 transition-colors tracking-tighter">
                            R$ {(Number(totals?.grandTotal) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </h2>
                        </div>
                        <div className="bg-yellow-400/10 p-3 rounded-2xl border border-yellow-400/20 text-yellow-400 animate-pulse">
                          <TrendingUp size={24} />
                        </div>
                      </div>
                    )}
                    
                    <div className={`grid grid-cols-1 gap-4 relative z-10 ${(!isValiandro && !isLucas) ? 'mt-0' : 'mt-2'}`}>
                      {/* Meta Pessoal do Mês */}
                      <div className="bg-white/5 p-4 rounded-[2rem] backdrop-blur-md border border-white/5">
                        <p className="text-[9px] uppercase font-black tracking-widest opacity-40 mb-2 flex items-center gap-2">
                          <Target size={12} className="text-yellow-400" /> {isLucas ? "Meta Pessoal do Mês (Minhas Vendas)" : "Meta Mensal"}
                        </p>
                        <div className="flex justify-between items-end">
                          <p className="text-xl font-black">{(confirmedCountToDisplay || 0)} <span className="text-xs opacity-30">/ {(personalGoalToDisplay || 30)}</span></p>
                          <p className="text-[10px] font-black text-yellow-400 font-mono">
                             {(personalGoalPercentageToDisplay || 0).toFixed(0)}%
                          </p>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, personalGoalPercentageToDisplay || 0)}%` }}
                            className="h-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                          />
                        </div>
                      </div>

                      {/* Meta Coletiva da Equipe (Toda Equipe) */}
                      {isLucas && (
                        <div className="bg-white/5 p-4 rounded-[2rem] backdrop-blur-md border border-white/5">
                          <p className="text-[9px] uppercase font-black tracking-widest opacity-40 mb-2 flex items-center gap-2 text-yellow-400">
                            <Users size={12} /> Meta Coletiva da Equipe (Toda Equipe)
                          </p>
                          <div className="flex justify-between items-end">
                            <p className="text-xl font-black">
                              {(teamMetrics?.totalConfirmed || 0)}{' '}
                              <span className="text-xs opacity-30">
                                / {config.teamMonthlyGoal || config.monthlyGoal || 300}
                              </span>
                            </p>
                            <p className="text-[10px] font-black text-yellow-400 font-mono">
                              {(((teamMetrics?.totalConfirmed || 0) / (config.teamMonthlyGoal || config.monthlyGoal || 300)) * 100).toFixed(0)}%
                            </p>
                          </div>
                          <div className="h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, ((teamMetrics?.totalConfirmed || 0) / (config.teamMonthlyGoal || config.monthlyGoal || 300)) * 100)}%` }}
                              className="h-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                            />
                          </div>
                        </div>
                      )}

                      {/* Meta Coletiva Anual (Toda Equipe) */}
                      {isLucas && false && (
                        <div className="bg-white/5 p-4 rounded-[2rem] backdrop-blur-md border border-white/5">
                          <p className="text-[9px] uppercase font-black tracking-widest opacity-40 mb-2 flex items-center gap-2">
                            <TrendingUp size={12} className="text-yellow-400" /> Meta Coletiva Anual (Toda Equipe)
                          </p>
                          <div className="flex justify-between items-end">
                            <p className="text-xl font-black">{teamYearlyConfirmed} <span className="text-xs opacity-30">/ {(config?.yearlyGoal || 1850)}</span></p>
                            <p className="text-[10px] font-black text-yellow-400 font-mono">
                               {((teamYearlyConfirmed / (config?.yearlyGoal || 1850)) * 100).toFixed(0)}%
                            </p>
                          </div>
                          <div className="h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (teamYearlyConfirmed / (config?.yearlyGoal || 1850)) * 105)}%` }}
                              className="h-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 mt-4 relative z-10">
                      <div className="bg-white/5 p-4 rounded-[2rem] backdrop-blur-md border border-white/5">
                        <p className="text-[9px] uppercase font-black tracking-widest opacity-40 mb-2 flex items-center gap-2">
                          <CheckCircle2 size={12} className="text-green-500" /> Taxa de Conversão
                        </p>
                        <div className="flex justify-between items-center">
                          <p className="text-xl font-black">
                            {(totals?.conversionRate || 0).toFixed(1)}%
                          </p>
                          {!selectedSellerId && !isSecretaria && (
                            <div className="flex flex-col items-end mr-2">
                              <label className="text-[7px] font-black text-neutral-500 uppercase">Leads</label>
                              <input 
                                type="number"
                                className="w-12 bg-black/40 border border-white/5 rounded-lg text-center text-xs font-black p-1 outline-none focus:border-yellow-400 text-white"
                                value={localLeadsInput === '' ? 0 : localLeadsInput}
                                onChange={(e) => setLocalLeadsInput(e.target.value === '' ? '' : Number(e.target.value))}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-8">
                    <div className="flex justify-between items-center">
                       <h2 className="text-3xl font-black italic tracking-tighter text-yellow-400 uppercase">Resumo Performance</h2>
                       <div className="bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-4 py-1 rounded-full text-[9px] font-black tracking-widest uppercase">Portal Vendedor</div>
                    </div>

                    {/* VENDEDOR: APENAS META, CONVERSÃO E DESCONTO */}
                    <div className="grid grid-cols-1 gap-6">
                      {/* Meta Mensal */}
                      <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10">
                        <div className="flex justify-between items-center mb-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                            <Target size={16} className="text-yellow-400" /> Meta Mensal
                          </p>
                          <span className="text-yellow-400 font-black text-xl">{confirmedCountToDisplay} <span className="text-xs opacity-40">/ {personalGoalToDisplay}</span></span>
                        </div>
                        <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, personalGoalPercentageToDisplay)}%` }}
                            className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300"
                          />
                        </div>
                      </div>

                      {/* Taxa de Conversão */}
                      <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10">
                        <div className="flex justify-between items-center mb-4">
                           <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                             <CheckCircle2 size={16} className="text-green-500" /> Taxa de Conversão
                           </p>
                           <span className="text-green-400 font-black text-xl">{conversionRateToDisplay.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${conversionRateToDisplay}%` }}
                            className="h-full bg-gradient-to-r from-green-600 to-green-400"
                          />
                        </div>
                        {!isSecretaria && (
                          <div className="flex justify-between items-center mt-5 pt-4 border-t border-white/5">
                            <span className="text-[8px] font-black text-neutral-500 uppercase">Atualizar meus Leads:</span>
                            <input 
                              type="number"
                              className="w-16 bg-black border border-white/10 rounded-xl text-center text-sm font-black p-2 outline-none focus:border-yellow-400 text-white"
                              value={localLeadsInput === '' ? 0 : localLeadsInput}
                              onChange={(e) => setLocalLeadsInput(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                          </div>
                        )}
                      </div>

                      {/* Desconto Total Concedido */}
                      <div className="bg-red-500/5 p-6 rounded-[2.5rem] border border-red-500/10 flex justify-between items-center">
                         <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-500/10 rounded-2xl text-red-500">
                               <DollarSign size={24} />
                            </div>
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Desconto Concedido</p>
                               <p className="text-2xl font-black text-white italic">R$ {totalDiscountToDisplay.toLocaleString('pt-BR')}</p>
                            </div>
                         </div>
                         <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-tighter">Limites vigentes</p>
                         </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {isLucas && (
                 <div id="stat_grid" className={`grid gap-4 ${(isValiandro || isLucas) ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    <div 
                      className="bg-neutral-900 border border-white/5 p-6 rounded-[2.5rem] shadow-xl hover:-translate-y-1 hover:border-yellow-400/20 hover:shadow-2xl hover:shadow-red-500/[0.01] transition-all duration-300 flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2.5 bg-red-500/10 rounded-2xl text-red-500">
                          <DollarSign size={20} />
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-neutral-600">Turmas Presenciais</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-tight mb-1">Desconto Concedido</p>
                        <p className="text-xl font-black text-white">R$ {(Number(totals?.totalDiscount) || 0).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                    {[
                      { label: 'Salário Base', val: totals.baseSalary, icon: DollarSign, sub: 'Fixo Mensal' },
                      { label: 'Taxas (Pós 10ª)', val: totals.commission, icon: CheckCircle2, sub: `${totals.commissionCount} alunos extras` },
                      { label: 'Adic. Viagem', val: totals.tripsTotal, icon: Briefcase, sub: `${localTravelCount} viagens ativas` },
                      { label: 'Total Estimado', val: totals.grandTotal, icon: TrendingUp, sub: 'Previsão de Recebimento' },
                    ].filter(item => !isValiandro && !isLucas).map((item, i) => (
                      <div 
                        key={i}
                        className="bg-neutral-900 border border-white/5 p-6 rounded-[2.5rem] shadow-xl hover:-translate-y-1 hover:border-yellow-400/20 hover:shadow-2xl hover:shadow-yellow-400/[0.01] transition-all duration-300 flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-2.5 bg-yellow-400/5 rounded-2xl text-yellow-400">
                            <item.icon size={20} />
                          </div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-neutral-600">{item.sub}</span>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-tight mb-1">{item.label}</p>
                          <p className="text-xl font-black text-white">R$ {(Number(item.val) || 0).toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                    ))}
                 </div>
              )}
              
              {/* SEÇÃO DE VIAGENS - APENAS GESTOR (OCULTO PARA VALIANDRO) */}
              {(isGestor && !isLucas && !isValiandro) && (
                <div className="bg-neutral-900 border border-white/5 p-6 rounded-[2.5rem] shadow-xl hover:border-yellow-400/20 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-500/10 rounded-2xl text-blue-500">
                        <Briefcase size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-tight">Logística de Viagens</p>
                        <h4 className="text-sm font-black uppercase">Adicional de Viagem</h4>
                      </div>
                    </div>
                    <button 
                      onClick={() => setLocalTravelCount(prev => prev > 0 ? 0 : 1)}
                       className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
                        localTravelCount > 0 ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-yellow-400 text-black'
                      }`}
                    >
                      {localTravelCount > 0 ? 'DESATIVAR' : 'ATIVAR'}
                      {isSavingConfig && (
                        <div className="absolute -top-6 right-0 flex items-center gap-1 text-[7px] font-black text-yellow-400 animate-pulse whitespace-nowrap">
                          <RefreshCcw size={8} className="animate-spin" /> SALVANDO...
                        </div>
                      )}
                    </button>
                  </div>

                  {localTravelCount > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pt-2 border-t border-white/5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Quantidade de Viagens</span>
                        <div className="flex items-center gap-4 bg-black p-2 rounded-2xl border border-white/5">
                          <button 
                            onClick={() => setLocalTravelCount(prev => Math.max(1, prev - 1))}
                            className="w-8 h-8 flex items-center justify-center bg-neutral-800 rounded-xl text-white hover:bg-neutral-700"
                          >
                            -
                          </button>
                          <span className="text-lg font-black w-8 text-center">{localTravelCount}</span>
                          <button 
                            onClick={() => setLocalTravelCount(prev => prev + 1)}
                            className="w-8 h-8 flex items-center justify-center bg-neutral-800 rounded-xl text-white hover:bg-neutral-700"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="text-[9px] text-neutral-500 font-bold uppercase italic">
                        * Adicional de R$ {(localTravelCount * config.tripValue).toLocaleString('pt-BR')} (R$ {config.tripValue} por viagem)
                      </p>
                    </motion.div>
                  )}
                </div>
              )}

              {/* SEÇÃO DE BÔNUS DE TURMA - APENAS OPERAFORMACAO */}
              {(user?.email === 'operaformacao@gmail.com' || user?.email === 'operaformacar@gmail.com') && (
                <div className="bg-neutral-900 border border-white/5 p-6 rounded-[2.5rem] shadow-xl hover:border-yellow-400/20 transition-all">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-green-500/10 rounded-2xl text-green-500">
                      <GraduationCap size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-tight">Metas de Alunos por Turma</p>
                      <h4 className="text-sm font-black uppercase">Bônus de Turma (30+ Alunos)</h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {classBonuses.map((isActive, idx) => (
                      <button 
                        key={idx}
                        onClick={() => {
                          const newBonuses = [...classBonuses];
                          newBonuses[idx] = !newBonuses[idx];
                          setClassBonuses(newBonuses);
                        }}
                        className={`p-4 rounded-3xl border transition-all flex flex-col items-center gap-2 ${
                          isActive 
                          ? 'bg-green-500/20 border-green-500/30 text-green-500' 
                          : 'bg-white/5 border-white/10 text-neutral-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CheckSquare size={16} className={isActive ? 'text-green-500' : 'text-neutral-700'} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Turma {idx + 1}</span>
                        </div>
                        <p className="text-xs font-black">R$ 1.000,00</p>
                        <span className="text-[8px] font-bold uppercase">{isActive ? 'META BATIDA' : 'PENDENTE'}</span>
                      </button>
                    ))}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                    <p className="text-[10px] font-bold text-neutral-500 uppercase">Total em Bônus de Turma:</p>
                    <p className="text-lg font-black text-green-500">R$ {(classBonuses.filter(b => b).length * 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              )}

              {/* MENSAGEM MOTIVACIONAL INTELIGENTE */}
              <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 p-6 rounded-[2.5rem] text-black shadow-2xl relative overflow-hidden group">
                 <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-5 transition-opacity" />
                 <div className="flex items-center gap-4 relative z-10">
                    <div className="bg-black/10 p-3 rounded-full">
                       <TrendingUp size={24} />
                    </div>
                    <div>
                       <p className="text-xs font-black uppercase tracking-tight">Foco no Objetivo</p>
                       <p className="text-sm font-bold opacity-80 italic">
                         {confirmedCountToDisplay >= personalGoalToDisplay 
                           ? "Meta batida! Você está no topo. Mantenha o ritmo para um recorde histórico." 
                           : `Bora pra cima! Faltam apenas ${personalGoalToDisplay - confirmedCountToDisplay} confirmados para o próximo objetivo.`}
                       </p>
                    </div>
                 </div>
              </div>

              {/* PAINEL DE VENDAS GERAL (TODOS SEM EXCEÇÃO) */}
              <div id="painel-vendas-principal" className="bg-neutral-900 border border-white/5 p-6 rounded-[2.5rem] shadow-xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-yellow-400/10 rounded-xl text-yellow-400">
                      <LayoutGrid size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase text-white tracking-widest leading-none">Painel de Vendas</h4>
                      <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider mt-1">Troque o status para confirmado ou desistente quando quiser</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-black uppercase bg-yellow-400/10 text-yellow-500 border border-yellow-400/20 px-2.5 py-1 rounded-full">
                    {displayedSales.length} Alunos
                  </span>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                  <input 
                    className="w-full bg-black border border-white/5 p-3.5 pl-11 rounded-2xl outline-none focus:border-yellow-400 text-xs text-white"
                    placeholder="Buscar aluno no painel principal..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {displayedSales
                    .filter((s: any) => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((sale: any) => {
                      const saleContract = displayedContracts.find(c => c.saleId === sale.id) || 
                                           contractsHistory.find(h => h.saleId === sale.id) || 
                                           (sale.hasContract ? { id: 'ext_dummy_' + sale.id, clientName: sale.name, courseCity: sale.city, dummy: true, hasContract: true } : null);
                      
                      return (
                        <div key={sale.id} className="bg-black/40 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${saleContract ? 'bg-[#39FF14] text-black font-extrabold' : 'bg-red-500 text-white font-extrabold'}`}>
                                {saleContract ? 'CONTRATO OK' : 'SEM CONTRATO'}
                              </span>
                              <h5 className="font-bold text-xs uppercase text-white leading-none">
                                {sale.name}
                              </h5>
                            </div>
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              <span className="text-[8px] bg-neutral-900 px-1.5 py-0.5 rounded text-neutral-400 border border-neutral-800">{sale.city}</span>
                              <span className="text-[8px] bg-neutral-900 px-1.5 py-0.5 rounded text-yellow-400 border border-neutral-800 font-bold">R$ {sale.price}</span>
                              <span className="text-[8px] bg-neutral-900 px-1.5 py-0.5 rounded text-neutral-500 capitalize">{sale.vendorName || rawAllUsers.find(u => u.uid === sale.vendorId || u.id === sale.vendorId)?.name || 'Consultor'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-white/5">
                              <button
                                id={`btn-resumo-desistente-${sale.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus(sale.id, 'desistente');
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1 ${
                                  sale.status === 'desistente'
                                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                    : 'text-red-500/40 hover:text-red-500 hover:bg-red-500/10'
                                }`}
                              >
                                Desistente
                              </button>
                              <button
                                id={`btn-resumo-confirmado-${sale.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus(sale.id, 'confirmado');
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1 ${
                                  sale.status === 'confirmado'
                                     ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                                     : 'text-green-500/40 hover:text-green-500 hover:bg-green-500/10'
                                 }`}
                               >
                                 Confirmado
                               </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {displayedSales.filter((s: any) => s.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                    <div className="text-center py-6 text-neutral-600 text-[10px] uppercase font-bold">
                      Nenhum aluno encontrado
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ABA PROJEÇÃO & SIMULADOR */}
          {activeTab === 'projecao' && !isSecretaria && !isValiandro && (
            <motion.div key="projecao" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
              
              {/* CÁLCULOS DA SIMULAÇÃO (LÓGICA) */}
              {(() => {
                const isOpera = user?.email === 'operaformacao@gmail.com' || user?.email === 'operaformacar@gmail.com';
                const thresholds = Number(config.commissionThreshold) || 10;
                
                // Variáveis da Simulação Premium
                const simTotalSales = (Number(simSales) || 0) + (Number(simEadSales) || 0);
                const simCommCount = Math.max(0, simTotalSales - thresholds);
                const simCommValue = simCommCount * (Number(config.commissionValue) || 150);
                
                let simGenBonus = 0;
                if (simTotalSales >= 35) simGenBonus = Number(config.bonusGeneral35) || 1500;
                else if (simTotalSales >= 25) simGenBonus = Number(config.bonusGeneral25) || 1000;
                
                let simEadBonus = 0;
                if (simEadSales >= 15) simEadBonus = Number(config.bonusEAD15) || 500;

                // Cálculo de Viagens
                const simTripsValue = (Number(simTrips) || 0) * (Number(config.tripValue) || 400);
                const simExtraTripBonus = (Number(simTrips) || 0) > 0 ? (Number(config.bonusViagem) || 0) : 0;

                // Cálculo de Taxas por Cidade
                const rateLow = Number(config.studentRateLow) || 100;
                const rateMed = Number(config.studentRateMedium) || 150;
                const rateHigh = Number(config.studentRateHigh) || 200;

                let simStudentsValueTotal = 0;
                Object.values(simStudents).forEach((count: any) => {
                   const v = Number(count) || 0;
                   if (v > 0) {
                      if (v <= 14) simStudentsValueTotal += v * rateLow;
                      else if (v <= 19) simStudentsValueTotal += v * rateMed;
                      else simStudentsValueTotal += v * rateHigh;
                   }
                });

                // Bônus Extra de Classes (Opera)
                const simClassBonusesTotal = isOpera ? simClassBonuses.reduce((acc, active) => acc + (active ? 500 : 0), 0) : 0;
                
                const totalSim = Number(config.baseSalary || 1600) + simCommValue + simEadBonus + simGenBonus + simTripsValue + simExtraTripBonus + simStudentsValueTotal + simClassBonusesTotal;

                // Simulador Premium (Slider/Barra)
                return (
                  <div className="space-y-6 pb-24">
                     {/* HEADER SIMULADOR TECNOLÓGICO */}
                     <div className="bg-neutral-900 border border-white/5 p-8 rounded-[3rem] text-center relative overflow-hidden shadow-2xl relative">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-400/5 via-transparent to-transparent opacity-50" />
                        
                        {/* Efeito Tech Linhas */}
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                        <div className="relative z-10 space-y-4">
                           <div className="w-20 h-20 bg-black/40 border border-yellow-400/20 text-yellow-400 rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-yellow-400/10 group-hover:scale-110 transition-transform">
                              <RefreshCcw size={32} className="animate-spin-slow" />
                           </div>
                           <p className="text-[10px] font-black uppercase text-neutral-500 tracking-[0.5em]">Simulador de Projeção v2.0</p>
                           <h2 className="text-4xl font-black uppercase tracking-tighter italic text-white leading-none">
                              ENGENHARIA <span className="text-yellow-400">FINANCEIRA</span>
                           </h2>
                        </div>
                     </div>

                     {/* CARD DE RESULTADO BRUTAL */}
                     <div className="bg-gradient-to-br from-neutral-900 to-black border border-white/5 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                           <TrendingUp size={160} />
                        </div>
                        <div className="text-center relative z-10">
                           <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.4em] mb-4">Total Projetado Mensal</p>
                           <motion.h2 
                             key={totalSim}
                             initial={{ scale: 0.9, opacity: 0, y: 20 }}
                             animate={{ scale: 1, opacity: 1, y: 0 }}
                             className="text-6xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-yellow-400 to-white tracking-tighter"
                           >
                              R$ {totalSim.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                           </motion.h2>
                           <div className="mt-10 flex flex-wrap justify-center gap-4">
                              <div className="px-4 py-2 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
                                 <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Base Pura</p>
                                 <p className="text-xs font-black text-white">R$ {Number(config.baseSalary).toLocaleString('pt-BR')}</p>
                              </div>
                              <div className="px-4 py-2 bg-yellow-400/10 rounded-2xl border border-yellow-400/10 backdrop-blur-md">
                                 <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest">Comissões</p>
                                 <p className="text-xs font-black text-white">+ R$ {simCommValue.toLocaleString('pt-BR')}</p>
                              </div>
                              <div className="px-4 py-2 bg-green-500/10 rounded-2xl border border-green-500/10 backdrop-blur-md">
                                 <p className="text-[9px] font-black text-green-500 uppercase tracking-widest">Bônus & Viagens</p>
                                 <p className="text-xs font-black text-white">+ R$ {(simGenBonus + simEadBonus + simTripsValue + simExtraTripBonus + simClassBonusesTotal).toLocaleString('pt-BR')}</p>
                              </div>
                              <div className="px-4 py-2 bg-blue-500/10 rounded-2xl border border-blue-500/10 backdrop-blur-md">
                                 <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Taxas Alunos</p>
                                 <p className="text-xs font-black text-white">+ R$ {simStudentsValueTotal.toLocaleString('pt-BR')}</p>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* CONTROLES DE SIMULAÇÃO */}
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* CONTROLE VENDAS TOTAIS */}
                        <div className="bg-neutral-900/40 backdrop-blur-2xl border border-white/10 p-8 rounded-[3.5rem] shadow-2xl relative">
                           <div className="flex justify-between items-end mb-8">
                              <div>
                                 <p className="text-[12px] font-black text-white uppercase tracking-widest leading-none mb-2">Simular Vendas Totais</p>
                                 <p className="text-[9px] font-bold text-neutral-600 uppercase">Soma de todos os contratos fechados</p>
                              </div>
                              <div className="text-right">
                                 <span className="text-5xl font-black text-yellow-400 italic tracking-tighter leading-none">{simSales}</span>
                              </div>
                           </div>

                           <div className="relative group p-4 bg-black/40 rounded-3xl border border-white/5">
                              <div className="relative h-10 flex items-center">
                                <div className="absolute inset-0 h-1 bg-neutral-800 rounded-full my-auto overflow-hidden">
                                  <motion.div 
                                    className="h-full bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)]"
                                    initial={false}
                                    animate={{ width: `${Math.min(100, simSales)}%` }}
                                  />
                                </div>
                                <input 
                                   type="range"
                                   min="0"
                                   max="100"
                                   value={simSales}
                                   onChange={(e) => setSimSales(Number(e.target.value))}
                                   className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                                />
                                <motion.div 
                                  className="absolute w-8 h-8 flex items-center justify-center pointer-events-none"
                                  initial={false}
                                  animate={{ left: `calc(${Math.min(100, simSales)}% - 16px)` }}
                                >
                                  <div className="w-5 h-5 bg-white border-2 border-yellow-400 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.8)]" />
                                </motion.div>
                              </div>
                           </div>
                        </div>

                        {/* CONTROLE VIAGENS & EAD */}
                        <div className="bg-neutral-900/40 backdrop-blur-2xl border border-white/10 p-8 rounded-[3.5rem] shadow-2xl relative">
                           <div className="grid grid-cols-2 gap-4">
                              <div className="bg-black/40 p-4 rounded-3xl border border-white/5">
                                 <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-3">Viagens (Cidades)</p>
                                 <div className="flex items-center gap-4">
                                    <button 
                                      onClick={() => setSimTrips(Math.max(0, simTrips - 1))}
                                      className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white hover:bg-white/10"
                                    >
                                      -
                                    </button>
                                    <span className="text-2xl font-black text-white">{simTrips}</span>
                                    <button 
                                      onClick={() => setSimTrips(simTrips + 1)}
                                      className="w-10 h-10 bg-yellow-400 text-black rounded-xl flex items-center justify-center font-black hover:scale-105"
                                    >
                                      +
                                    </button>
                                 </div>
                              </div>
                              <div className="bg-black/40 p-4 rounded-3xl border border-white/5">
                                 <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-3">Vendas EAD</p>
                                 <div className="flex items-center gap-4">
                                    <button 
                                      onClick={() => setSimEadSales(Math.max(0, simEadSales - 1))}
                                      className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white"
                                    >
                                      -
                                    </button>
                                    <span className="text-2xl font-black text-white">{simEadSales}</span>
                                    <button 
                                      onClick={() => setSimEadSales(simEadSales + 1)}
                                      className="w-10 h-10 bg-yellow-400 text-black rounded-xl flex items-center justify-center font-black"
                                    >
                                      +
                                    </button>
                                 </div>
                              </div>
                           </div>
                        </div>

                        {/* CONTROLE ALUNOS POR CIDADE (TAXAS) */}
                        <div className="col-span-full bg-neutral-900/40 backdrop-blur-2xl border border-white/10 p-8 rounded-[3.5rem] shadow-2xl relative">
                           <p className="text-[12px] font-black text-white uppercase tracking-widest flex items-center gap-2 mb-6">
                              <MapPin size={16} className="text-yellow-400" /> Distribuição de Alunos por Cidade (Taxas)
                           </p>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {CITIES_LIST.map(city => (
                                 <div key={city} className="bg-black/40 p-4 rounded-3xl border border-white/5">
                                    <p className="text-[9px] font-black text-neutral-500 uppercase mb-2 truncate">{city}</p>
                                    <input 
                                      type="number"
                                      value={simStudents[city] || 0}
                                      onChange={(e) => setSimStudents({ ...simStudents, [city]: Number(e.target.value) })}
                                      className="w-full bg-neutral-800 border-none rounded-xl p-3 text-center text-xl font-black text-white focus:ring-1 focus:ring-yellow-400"
                                    />
                                    <div className="mt-2 text-center">
                                       <span className={`text-[8px] font-black uppercase ${Number(simStudents[city]) >= 20 ? 'text-green-500' : Number(simStudents[city]) >= 15 ? 'text-blue-400' : 'text-neutral-600'}`}>
                                          Rate: R$ {Number(simStudents[city]) >= 20 ? rateHigh : Number(simStudents[city]) >= 15 ? rateMed : rateLow}
                                       </span>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                        {/* BÔNUS EXTRAS & OPERA */}
                        {isOpera && (
                           <div className="col-span-full bg-neutral-900/40 backdrop-blur-2xl border border-white/10 p-8 rounded-[3.5rem] shadow-2xl relative">
                              <p className="text-[12px] font-black text-white uppercase tracking-widest flex items-center gap-2 mb-6">
                                 <PlusCircle size={16} className="text-yellow-400" /> Bônus por Turma Formada (Extra Opera)
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                 {['Turma 1', 'Turma 2', 'Turma 3', 'Turma 4'].map((label, idx) => (
                                    <button 
                                      key={idx}
                                      onClick={() => {
                                         const newBonuses = [...simClassBonuses];
                                         newBonuses[idx] = !newBonuses[idx];
                                         setSimClassBonuses(newBonuses);
                                      }}
                                      className={`p-4 rounded-3xl border transition-all text-center ${simClassBonuses[idx] ? 'bg-yellow-400 border-yellow-400 text-black font-black' : 'bg-black/40 border-white/5 text-neutral-500'}`}
                                    >
                                       <p className="text-[10px] uppercase font-black">{label}</p>
                                       <p className="text-xs mt-1">{simClassBonuses[idx] ? '+ R$ 500' : 'Inativo'}</p>
                                    </button>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>

                     {/* DETALHAMENTO TÉCNICO (INSIGHTS) */}
                     <div className="bg-neutral-900/60 p-10 rounded-[3.5rem] border border-white/5">
                        <h4 className="text-[10px] font-black uppercase text-neutral-500 tracking-[0.4em] mb-8 text-center italic">Extrato Detalhado da Projeção</h4>
                        <div className="space-y-4 max-w-2xl mx-auto">
                           <div className="flex justify-between items-center py-2 border-b border-white/5">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase">Salário Base Profissional</span>
                              <span className="font-mono text-white">R$ {Number(config.baseSalary).toLocaleString('pt-BR')}</span>
                           </div>
                           <div className="flex justify-between items-center py-2 border-b border-white/5">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase">Comissões ({simCommCount} vendas após meta de {thresholds})</span>
                              <span className="font-mono text-white">R$ {simCommValue.toLocaleString('pt-BR')}</span>
                           </div>
                           {simGenBonus > 0 && (
                              <div className="flex justify-between items-center py-2 border-b border-white/5 text-yellow-400">
                                 <span className="text-[10px] font-black uppercase">Bônus de Performance (Tier {simTotalSales >= 35 ? 'Platinum' : 'Gold'})</span>
                                 <span className="font-mono font-black">+ R$ {simGenBonus.toLocaleString('pt-BR')}</span>
                              </div>
                           )}
                           {simEadBonus > 0 && (
                              <div className="flex justify-between items-center py-2 border-b border-white/5 text-blue-400">
                                 <span className="text-[10px] font-black uppercase">Bônus Aceleração EAD (15+ vendas)</span>
                                 <span className="font-mono font-black">+ R$ {simEadBonus.toLocaleString('pt-BR')}</span>
                              </div>
                           )}
                           {simTripsValue > 0 && !isValiandro && (
                              <div className="flex justify-between items-center py-2 border-b border-white/5 text-green-400">
                                 <span className="text-[10px] font-black uppercase">Reembolso & Diárias de Viagem ({simTrips} city)</span>
                                 <span className="font-mono font-black">+ R$ {simTripsValue.toLocaleString('pt-BR')}</span>
                              </div>
                           )}
                           {simExtraTripBonus > 0 && !isValiandro && (
                              <div className="flex justify-between items-center py-2 border-b border-white/5 text-green-500">
                                 <span className="text-[10px] font-black uppercase">Bônus Logística (Viagens Realizadas)</span>
                                 <span className="font-mono font-black">+ R$ {simExtraTripBonus.toLocaleString('pt-BR')}</span>
                              </div>
                           )}
                           {simStudentsValueTotal > 0 && (
                              <div className="flex justify-between items-center py-2 border-b border-white/5 text-blue-500">
                                 <span className="text-[10px] font-black uppercase">Taxas Operacionais (Cidades)</span>
                                 <span className="font-mono font-black">+ R$ {simStudentsValueTotal.toLocaleString('pt-BR')}</span>
                              </div>
                           )}
                           {simClassBonusesTotal > 0 && (
                              <div className="flex justify-between items-center py-2 border-b border-white/5 text-yellow-500">
                                 <span className="text-[10px] font-black uppercase">Extra Formação (Turmas)</span>
                                 <span className="font-mono font-black">+ R$ {simClassBonusesTotal.toLocaleString('pt-BR')}</span>
                              </div>
                           )}
                           <div className="flex justify-between items-center pt-6 text-xl">
                              <span className="font-black text-white uppercase italic tracking-tighter">Total Líquido</span>
                              <span className="font-black text-yellow-400 tracking-tighter">R$ {totalSim.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-neutral-900/60 p-8 rounded-[3rem] border border-white/5 flex items-center justify-between">
                           <div>
                              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Cotação de Leads</p>
                              <p className="text-2xl font-black text-white italic">~{Math.round(simSales / 0.15)} LEADS</p>
                              <p className="text-[8px] font-bold text-neutral-700 uppercase mt-1">Estimativa de 15% de conversão técnica</p>
                           </div>
                           <div className="p-4 bg-white/5 rounded-2xl text-neutral-400">
                              <Target size={24} />
                           </div>
                        </div>
                        <div className="bg-yellow-400/5 p-8 rounded-[3rem] border border-yellow-400/10 flex items-center justify-between">
                           <div>
                              <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest mb-1">Status de Performance</p>
                              <p className="text-xl font-black text-white uppercase italic">
                                 {simSales < 25 ? "Em Crescimento" : (simSales < 35 ? "Top Performance" : "Legendary Level")}
                              </p>
                           </div>
                           <div className="p-4 bg-yellow-400/10 rounded-2xl text-yellow-400">
                              <GraduationCap size={24} />
                           </div>
                        </div>
                     </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* ABA 5: GESTÃO (APENAS GERÊNCIA) */}
          {activeTab === 'gestao' && isLucas && (
            <motion.div key="gestao" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
              
              {isLucas && (
                <>
                  <div className="bg-neutral-900 border border-neutral-800/60 p-4 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-dashed border-yellow-400/25">
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase text-yellow-400 flex items-center gap-1">
                        <Target size={14} /> Filtro da Equipe Gonçalves
                      </span>
                      <span className="text-[10px] text-neutral-500 font-bold uppercase mt-0.5">Exibe apenas vendas do mês vigente ou histórico completo</span>
                    </div>
                    <div className="flex bg-black p-1 rounded-2xl border border-neutral-800 shrink-0">
                      <button 
                        onClick={() => setManagerPeriodFilter('current')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                          managerPeriodFilter === 'current' 
                            ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' 
                            : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        Mês Vigente
                      </button>
                      <button 
                        onClick={() => setManagerPeriodFilter('all')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                          managerPeriodFilter === 'all' 
                            ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' 
                            : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        Histórico Completo
                      </button>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 border border-neutral-800 p-6 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-dashed border-yellow-400/30">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-yellow-400/10 rounded-2xl text-yellow-400">
                        <PlusCircle size={24} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase text-yellow-400 flex items-center gap-1.5">
                          Lançar Venda de Consultor (Sem App)
                        </span>
                        <span className="text-[10px] text-neutral-400 font-bold uppercase mt-1 leading-relaxed">
                          Registre vendas para consultores externos sem acesso ao app. O nome do vendedor e suas métricas ficarão fixos na equipe.
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowExternalSaleModal(true)}
                      className="px-6 py-3 bg-yellow-400 text-black rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-yellow-300 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-yellow-400/10 shrink-0 self-stretch md:self-auto text-center"
                    >
                      🚀 Lançar Venda Externa
                    </button>
                  </div>
                </>
              )}
              
              {!selectedSellerId ? (
                <>
                  {/* RANKING DE PERFORMANCE */}
                  {teamMetrics && sellersStats.length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-500/10 border border-green-500/20 p-5 rounded-[2.5rem] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                          <TrendingUp size={40} className="text-green-500" />
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-green-500 mb-1">Melhor Conversão</p>
                        <h4 className="text-lg font-black truncate text-white">{teamMetrics?.best?.name || 'N/A'}</h4>
                        <p className="text-xl font-black text-green-400 mt-1">
                          {(teamMetrics?.best?.conversionRate || 0).toFixed(1)}% {isLucas && <span className="text-[10px] text-neutral-400 font-bold uppercase block sm:inline sm:ml-1">({teamMetrics?.best?.confirmedCount || 0} de {teamMetrics?.best?.leadsCount || 0} leads)</span>}
                        </p>
                      </div>

                      <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-[2.5rem] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                          <AlertCircle size={40} className="text-red-500" />
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-red-500 mb-1">Menor Conversão</p>
                        <h4 className="text-lg font-black truncate text-white">{teamMetrics?.worst?.name || 'N/A'}</h4>
                        <p className="text-xl font-black text-red-400 mt-1">
                          {(teamMetrics?.worst?.conversionRate || 0).toFixed(1)}% {isLucas && <span className="text-[10px] text-neutral-400 font-bold uppercase block sm:inline sm:ml-1">({teamMetrics?.worst?.confirmedCount || 0} de {teamMetrics?.worst?.leadsCount || 0} leads)</span>}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* MÉTRICAS GERAIS DA EQUIPE */}
                  <div className="bg-neutral-900 border border-neutral-800/80 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                      <div>
                        <p className="text-[10px] font-black uppercase text-yellow-500 tracking-wider">Resultados Consolidados</p>
                        <h3 className="text-2xl font-black uppercase tracking-tight text-white mt-1">Performance Geral</h3>
                      </div>
                      <div className="flex flex-wrap gap-2 w-full md:w-auto shrink-0">
                        <button 
                          type="button"
                          onClick={() => exportConversionsPDF(false)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-cyan-500/20 text-[9px] font-black uppercase tracking-widest cursor-pointer"
                        >
                          <FileCheck2 size={16} /> Analisar Conversões (PDF)
                        </button>
                        <button 
                          type="button"
                          onClick={() => exportConversionsPDF(true)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-neutral-800 border border-neutral-750 text-white rounded-2xl hover:bg-neutral-700 active:scale-95 transition-all text-[9px] font-black uppercase tracking-widest cursor-pointer"
                        >
                          <Printer size={16} /> Conversões ECO
                        </button>
                        <button 
                          onClick={() => downloadManagerReport(false)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-yellow-400 text-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-yellow-400/20 text-[9px] font-black uppercase tracking-widest cursor-pointer"
                        >
                          <Eye size={16} /> Relatório Completo
                        </button>
                        <button 
                          onClick={() => downloadManagerReport(true)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-neutral-800 border border-neutral-750 text-white rounded-2xl hover:bg-neutral-700 active:scale-95 transition-all text-[9px] font-black uppercase tracking-widest cursor-pointer"
                        >
                          <Printer size={16} /> Impressão ECO
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      <div className="bg-black/40 p-5 rounded-2xl border border-white/5 text-center relative overflow-hidden group">
                        <p className="text-2xl font-black text-white">{teamMetrics?.totalConfirmed || 0}</p>
                        <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mt-1">Total Confirmado</p>
                        <div className="absolute top-0 left-0 w-1 h-full bg-white/20" />
                      </div>
                      <div className="bg-black/40 p-5 rounded-2xl border border-white/5 text-center relative overflow-hidden group">
                        <p className="text-2xl font-black text-yellow-400">{teamMetrics?.totalPresencial || 0}</p>
                        <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mt-1">Presencial</p>
                        <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400" />
                      </div>
                      <div className="bg-black/40 p-5 rounded-2xl border border-white/5 text-center relative overflow-hidden group">
                        <p className="text-2xl font-black text-blue-400">{teamMetrics?.totalEad || 0}</p>
                        <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mt-1">Alunos EAD</p>
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                      </div>
                      <div className="bg-black/40 p-5 rounded-2xl border border-white/5 text-center relative overflow-hidden group">
                        <p className="text-2xl font-black text-red-500">{teamMetrics?.totalDropout || 0}</p>
                        <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mt-1">Desistentes</p>
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                      </div>
                    </div>
                    
                    <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                        <span className="flex items-center gap-1.5"><Target size={12} className="text-yellow-400" /> Progresso da Meta Coletiva</span>
                        <span className="text-yellow-400">
                          {(teamMetrics?.totalConfirmed || 0)} / {config.teamMonthlyGoal || (config.monthlyGoal * (sellersStats.length || 1)) || 300} Alunos ({Math.round((teamMetrics?.totalConfirmed || 0) / (config.teamMonthlyGoal || (config.monthlyGoal * (sellersStats.length || 1)) || 300) * 100)}%)
                        </span>
                      </div>
                      <div className="h-3 bg-black rounded-full overflow-hidden p-[2px] border border-neutral-800">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (teamMetrics?.totalConfirmed || 0) / (config.teamMonthlyGoal || (config.monthlyGoal * (sellersStats.length || 1)) || 300) * 100)}%` }}
                          className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* LISTA DE VENDEDORES (CARDS) - VISÍVEL PARA TODOS */}
                  {(isGestor || isSecretaria || true) && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase text-neutral-500 tracking-widest ml-4">Monitoramento da Equipe</h4>
                    {sellersStats.map((seller: any) => (
                      <div 
                        key={seller.id}
                        onClick={() => {
                          setSelectedSellerId(seller.id);
                          setLocalLeadsInput(seller.leadsCount || 0);
                        }}
                        className="bg-neutral-900 p-6 rounded-[2.5rem] border border-neutral-800 hover:border-neutral-700/60 hover:shadow-2xl hover:shadow-yellow-500/[0.02] relative overflow-hidden cursor-pointer group transition-all duration-200"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-neutral-800 rounded-2xl flex items-center justify-center overflow-hidden border border-white/5 group-hover:border-yellow-400/50 transition-colors">
                              {seller.profilePic ? (
                                <img src={seller.profilePic} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <User className="text-yellow-400" size={28} />
                              )}
                            </div>
                            <div>
                              <h5 className="font-black text-base uppercase leading-none mb-1 group-hover:text-yellow-400 transition-colors flex items-center gap-2">
                                {seller.id === user?.uid 
                                  ? `${seller.name || 'Usuário'} (VOCÊ)` 
                                  : (seller.name || 'Usuário')}
                                {seller.leadsCount > 0 && (
                                  <span className="px-2 py-0.5 bg-yellow-400/10 text-yellow-500 rounded-lg text-[9px] font-black border border-yellow-400/20">
                                    {((seller.confirmedCount / seller.leadsCount) * 100).toFixed(1)}% CONV.
                                  </span>
                                )}
                              </h5>
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Toque para conferir detalhes</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <div className="text-right flex flex-col items-end">
                              <p className="text-2xl font-black text-white leading-none">{seller.confirmedCount}</p>
                              <p className="text-[8px] font-black text-neutral-500 uppercase mt-1">Vendas</p>
                              {isGestor && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newVal = window.prompt(`Editar vendas totais de ${seller.name}. Informe apenas o ajuste manual (ex: se o sistema marca 10 e você quer 15, digite 5):`, seller.manualSalesAdjust || 0);
                                    if (newVal !== null) {
                                      const val = parseInt(newVal);
                                      if (!isNaN(val)) updateSellerManualSales(seller.id, val);
                                    }
                                  }}
                                  className="mt-1 p-1 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400 hover:text-black rounded-md transition-all flex items-center gap-1"
                                  title="Ajuste Manual de Vendas"
                                >
                                  <Edit3 size={10} />
                                  <span className="text-[7px] font-bold">Ajustar</span>
                                </button>
                              )}
                            </div>
                            <div className="text-right h-12 w-px bg-white/5 mx-1" />
                            <div className="text-right flex flex-col items-end">
                              <p className="text-sm font-black text-red-500 leading-none">R$ {Math.round(seller.totalDiscount).toLocaleString('pt-BR')}</p>
                              <p className="text-[7px] font-black text-neutral-500 uppercase mt-1">Descontos</p>
                            </div>
                            <div className="flex flex-col gap-2 ml-2">
                              <div className="p-2 bg-neutral-800 rounded-xl text-neutral-600 transition-colors">
                                 <Plus size={16} />
                              </div>
                              {(isGestor || isSecretaria) && seller.id !== user?.uid && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeSeller(seller.id, seller.name);
                                  }}
                                  className="p-2 bg-red-500/10 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all transition-colors"
                                  title="Remover Vendedor"
                                >
                                  <UserMinus size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {sellersStats.length === 0 && (
                      <div className="text-center py-20 bg-neutral-900/50 rounded-[3rem] border border-dashed border-neutral-800">
                        <RefreshCcw size={40} className="mx-auto text-neutral-700 mb-4 animate-spin-slow" />
                        <p className="text-xs font-black text-neutral-500 uppercase">Aguardando registro dos vendedores...</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
                  <div className="space-y-6">
                    {/* DETALHES DO VENDEDOR SELECIONADO */}
                    {(() => {
                      const seller = sellersStats.find(s => s.id === selectedSellerId);
                      if (!seller) return null;

                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6 pb-12"
                      >
                        <button 
                          onClick={() => setSelectedSellerId(null)}
                          className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest mb-4"
                        >
                          <X size={14} /> Voltar para a Equipe
                        </button>

                        <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 p-8 rounded-[3rem] border border-yellow-400/20 shadow-2xl relative overflow-hidden">
                           <div className="flex items-center justify-between relative z-10">
                              <div className="flex items-center gap-6">
                                <div className="w-24 h-24 bg-neutral-800 rounded-[2rem] flex items-center justify-center overflow-hidden border-2 border-yellow-400 shadow-xl shadow-yellow-400/10 relative group-avatar">
                                  {seller.profilePic ? (
                                    <img src={seller.profilePic} className="w-full h-full object-cover" alt="" />
                                  ) : (
                                    <User className="text-yellow-400" size={40} />
                                  )}
                                  {(isGestor || isSecretaria || seller.id === user?.uid) && (
                                    <label className="absolute bottom-0 right-0 p-2 bg-yellow-400 text-black rounded-tl-xl cursor-pointer hover:scale-110 transition-transform shadow-lg">
                                      <Camera size={14} />
                                      <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*" 
                                        onChange={(e) => handleFileUpload(e, seller.id)} 
                                      />
                                    </label>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1">Perfil do Vendedor</p>
                                  <h3 className="text-3xl font-black uppercase leading-none">{seller.name || 'Vendedor'}</h3>
                                  <p className="text-neutral-500 font-bold text-xs mt-2 uppercase tracking-widest">{seller.email}</p>
                                </div>
                              </div>
                              
                              {(isGestor || isSecretaria) && (
                                <button 
                                  onClick={() => deleteUser(seller.id)}
                                  className="p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-xl shadow-red-500/5 group"
                                >
                                  <Trash2 size={24} className="group-hover:scale-110 transition-transform" />
                                </button>
                              )}
                           </div>
                        </div>

                        {/* MÉTRICAS ESPECÍFICAS */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-neutral-900 border border-white/5 p-6 rounded-[2.5rem]">
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Média de Ticket</p>
                            <p className="text-2xl font-black text-white">R$ {seller.avgTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                          </div>
                          <div className="bg-neutral-900 border border-white/5 p-6 rounded-[2.5rem]">
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Meta Estabelecida</p>
                            <p className="text-2xl font-black text-yellow-400">{seller.personalGoal || config.monthlyGoal} <span className="text-xs text-neutral-500 uppercase">Alunos</span></p>
                          </div>
                          <div className="bg-neutral-900 border border-white/5 p-6 rounded-[2.5rem]">
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Desconto Total (R$)</p>
                            <p className="text-2xl font-black text-red-500">R$ {seller.totalDiscount.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                          </div>
                          <div className="bg-neutral-900 border border-white/5 p-6 rounded-[2.5rem]">
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">% Médio Desconto</p>
                            <p className="text-2xl font-black text-red-500">{seller.discountPercentage.toFixed(1)}%</p>
                          </div>
                        </div>

                        {/* RESUMO DE STATUS */}
                        <div className="grid grid-cols-3 gap-2">
                           <div className="bg-black/40 p-4 rounded-3xl border border-white/5 text-center">
                              <p className="text-xl font-black text-white">{seller.confirmedCount}</p>
                              <p className="text-[8px] font-black text-neutral-500 uppercase">Confirmados</p>
                           </div>
                           <div className="bg-black/40 p-4 rounded-3xl border border-white/5 text-center">
                              <p className="text-xl font-black text-red-500">{seller.dropoutCount}</p>
                              <p className="text-[8px] font-black text-neutral-500 uppercase">Desistentes</p>
                           </div>
                           <div className="bg-black/40 p-4 rounded-3xl border border-white/5 text-center">
                              <p className="text-xl font-black text-cyan-400">{seller.needsAcc}</p>
                              <p className="text-[8px] font-black text-neutral-500 uppercase">Hospedagem</p>
                           </div>
                        </div>

                        {/* GESTÃO DE LEADS (EXCLUSIVO GESTOR GONÇALVES) */}
                        {isLucas ? (
                          <div className="bg-neutral-900 border border-white/5 p-8 rounded-[3rem] shadow-2xl">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
                              <div className="flex items-center gap-5">
                                <div className="p-4 bg-yellow-400/10 rounded-[1.5rem] text-yellow-400">
                                  <Target size={32} />
                                </div>
                                <div>
                                  <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest text-center mb-1">Entrada de Leads</p>
                                  <h4 className="text-xl font-black uppercase">Quantidade Mensal</h4>
                                </div>
                              </div>
                              <div className="flex flex-col gap-3 w-full md:w-64 group">
                                <div className="flex items-center justify-between bg-black/50 p-3 rounded-3xl border-2 border-white/10 relative group-focus-within:border-yellow-400 transition-all">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLocalLeadsInput(Math.max(0, (Number(localLeadsInput) || 0) - 1));
                                    }}
                                    className="w-14 h-14 flex items-center justify-center bg-neutral-800 rounded-2xl text-white hover:bg-neutral-700 transition-colors z-20 text-2xl font-black"
                                  >
                                    -
                                  </button>
                                  <div className="relative flex-1 px-4">
                                    <input 
                                      type="number" 
                                      autoFocus
                                      className="bg-transparent text-center text-4xl font-black w-full outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:text-yellow-400 transition-colors h-16 cursor-text"
                                      value={localLeadsInput}
                                      onChange={(e) => setLocalLeadsInput(e.target.value === '' ? '' : Number(e.target.value))}
                                    />
                                  </div>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLocalLeadsInput((Number(localLeadsInput) || 0) + 1);
                                    }}
                                    className="w-14 h-14 flex items-center justify-center bg-neutral-800 rounded-2xl text-white hover:bg-neutral-700 transition-colors z-20 text-2xl font-black"
                                  >
                                    +
                                  </button>
                                  {isSavingLeads && (
                                    <div className="absolute -top-8 right-0 left-0 text-center flex items-center justify-center gap-1 text-[9px] font-black text-yellow-400 animate-pulse">
                                      <RefreshCcw size={10} className="animate-spin" /> SINCRONIZANDO DADOS...
                                    </div>
                                  )}
                                </div>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase text-center opacity-60">Toque no número para digitar</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-white/5">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-tighter">Conversão Baseada em Leads</span>
                                <span className="text-[7px] text-neutral-600 font-bold uppercase tracking-widest">(Vendas Confirmadas / Leads Digitados)</span>
                              </div>
                              <div className="text-right">
                                <span className="text-2xl font-black text-yellow-400">
                                  {Number(localLeadsInput !== '' ? localLeadsInput : (seller.leadsCount || 0)) > 0 
                                    ? ((seller.confirmedCount / Number(localLeadsInput !== '' ? localLeadsInput : (seller.leadsCount || 0))) * 100).toFixed(1) 
                                    : '0.0'}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-neutral-900 border border-white/5 p-8 rounded-[3rem] shadow-2xl">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-5">
                                <div className="p-4 bg-yellow-400/10 rounded-[1.5rem] text-yellow-400">
                                  <CheckCircle2 size={32} />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest mb-1">Conversão Baseada em Leads</span>
                                  <span className="text-xs text-neutral-400 font-bold uppercase tracking-widest">Taxa de Conversão do Consultor</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-3xl font-black text-yellow-400 font-mono">
                                  {Number(seller.leadsCount || 0) > 0 
                                    ? ((seller.confirmedCount / Number(seller.leadsCount || 0)) * 100).toFixed(1) 
                                    : '0.0'}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* CREDENCIAIS E SEGURANÇA (EXCLUSIVO GESTOR) */}
                        {isGestor && (
                          <div className="bg-neutral-900 border border-white/5 p-8 rounded-[3rem] shadow-2xl space-y-6">
                            <div className="flex items-center gap-5">
                              <div className="p-4 bg-yellow-400/10 rounded-[1.5rem] text-yellow-400 font-black">
                                <Settings size={32} />
                              </div>
                              <div>
                                <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest mb-1">Acesso do Usuário (Exclusivo Gestão)</p>
                                <h4 className="text-xl font-black uppercase">Credenciais & PIN</h4>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-black/30 p-5 rounded-3xl border border-white/5">
                                <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest block mb-2">E-mail Cadastrado</span>
                                <span className="text-sm font-black text-white selection:bg-yellow-400 selection:text-black">{seller.email || 'Não informado'}</span>
                              </div>
                              <div className="bg-black/30 p-5 rounded-3xl border border-white/5 flex items-center justify-between">
                                <div className="flex-1">
                                  <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest block mb-2">PIN de Segurança Ativo</span>
                                  <span className="text-xl font-black font-mono text-yellow-400 tracking-wider">
                                    {seller.pin || '---'}
                                  </span>
                                </div>
                                <div className="text-[8px] font-black text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded-xl uppercase tracking-widest font-mono">
                                  {seller.role === 'gerente' ? 'GERENTE' : 'VENDEDOR'}
                                </div>
                              </div>
                            </div>

                            <div className="pt-4 border-t border-white/5 space-y-3">
                              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Alterar / Definir PIN do Usuário</label>
                              <div className="flex flex-col md:flex-row gap-4">
                                <input
                                  type="number"
                                  placeholder="Digite o novo PIN (4 a 6 dígitos)"
                                  className="flex-1 bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black text-white focus:border-yellow-400 focus:outline-none"
                                  id={`custom-pin-setter-${seller.id}`}
                                />
                                <button
                                  onClick={async () => {
                                    const inputEl = document.getElementById(`custom-pin-setter-${seller.id}`) as HTMLInputElement;
                                    const val = inputEl?.value?.replace(/\D/g, '') || '';
                                    if (val.length < 4 || val.length > 6) {
                                      alert("Por favor, insira um PIN numérico contendo de 4 a 6 dígitos!");
                                      return;
                                    }
                                    try {
                                      await updateDoc(doc(db, 'users', seller.id), { pin: val });
                                      alert(`O PIN do usuário "${seller.name || 'Vendedor'}" foi atualizado com sucesso para: ${val}`);
                                      if (inputEl) inputEl.value = '';
                                    } catch (err) {
                                      console.error("Erro ao atualizar PIN do usuário:", err);
                                      alert("Erro ao atualizar o PIN no banco de dados.");
                                    }
                                  }}
                                  className="px-8 py-4 bg-yellow-400 hover:bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-yellow-400/20 active:scale-95"
                                >
                                  Salvar PIN
                                </button>
                              </div>
                              <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider leading-relaxed">
                                * Nota de Segurança: Senhas de login do Firebase Authentication são criptografadas por padrão. Se o usuário esquecer a senha de login principal, ele deve usar a redefinição de senha ou o link direto com token de login.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* CIDADES ATENDIDAS */}
                        <div className="bg-neutral-900 border border-white/5 p-6 rounded-[3rem]">
                           <h4 className="text-xs font-black uppercase text-neutral-400 tracking-widest mb-4 ml-2">Métricas por Cidade</h4>
                           <div className="space-y-2">
                              {seller.cities.map((cityData: any) => (
                                <div key={cityData.city} className="bg-black/20 p-4 rounded-3xl border border-white/5">
                                   <div className="flex justify-between items-center mb-3">
                                      <div className="flex flex-col">
                                         <span className="font-black text-base uppercase text-white tracking-widest">{cityData.city}</span>
                                         <span className="text-[8px] text-neutral-500 font-bold uppercase">
                                           {Number(localLeadsInput !== '' ? localLeadsInput : (seller.leadsCount || 0)) > 0 
                                             ? ((cityData.count / Number(localLeadsInput !== '' ? localLeadsInput : (seller.leadsCount || 0))) * 100).toFixed(1) 
                                             : '0.0'}% Conv. Total
                                         </span>
                                      </div>
                                      <span className="bg-yellow-400 text-black px-4 py-1.5 rounded-full text-xs font-black shadow-lg shadow-yellow-400/20">{cityData.count} ALUNOS</span>
                                   </div>
                                   
                                   <div className="grid grid-cols-2 gap-2 mt-2">
                                      <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                         <p className="text-[8px] font-black text-neutral-600 uppercase mb-0.5">Ticket Médio</p>
                                         <p className="text-sm font-black text-white">R$ {cityData.avgTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                                      </div>
                                      <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                         <p className="text-[8px] font-black text-neutral-600 uppercase mb-0.5">Desc. Total</p>
                                         <p className="text-sm font-black text-red-500">R$ {cityData.discount.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                                      </div>
                                   </div>
                                </div>
                              ))}
                           </div>
                        </div>

                        {/* LISTAGEM DETALHADA DE CADA VENDA */}
                        <div className="space-y-4">
                           <h4 className="text-xs font-black uppercase text-neutral-400 tracking-widest mb-2 ml-4">Listagem Detalhada de Vendas</h4>
                           {seller.rawSales.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((sale: any) => {
                             const saleContract = contracts.find(c => c.saleId === sale.id) || contractsHistory.find(h => h.saleId === sale.id) || (sale.hasContract ? { id: 'ext_dummy_' + sale.id, clientName: sale.name, courseCity: sale.city, dummy: true, hasContract: true } : null);
                             return (
                               <div key={sale.id} className={`bg-neutral-900 p-5 rounded-3xl border transition-all ${saleContract ? 'border-[#39FF14]/50 shadow-[0_0_15px_rgba(57,255,20,0.1)]' : 'border-neutral-800'} flex flex-col gap-3`}>
                                  <div className="flex justify-between items-start">
                                     <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                           <h5 className="font-black text-sm uppercase text-white">{sale.name}</h5>
                                           <div className="flex items-center gap-1">
                                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${saleContract ? 'bg-[#39FF14] text-black shadow-[0_0_8px_rgba(57,255,20,0.4)]' : 'bg-red-500 text-white'}`}>
                                                 {saleContract ? 'CONTRATO OK' : 'SEM CONTRATO'}
                                              </span>
                                              {!saleContract && <AlertTriangle size={12} className="text-red-500 animate-pulse" />}
                                           </div>
                                        </div>
                                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">
                                           {sale.city} • {new Date(sale.createdAt).toLocaleDateString()}
                                        </p>
                                     </div>
                                     <div className="flex items-center gap-1">
                                        <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-tight ${sale.status === 'confirmado' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                           {sale.status}
                                        </span>
                                        <div className="flex gap-1">
                                           <button onClick={(e) => { e.stopPropagation(); updateStatus(sale.id, 'desistente'); }}
                                               className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1 ${
                                                  sale.status === 'desistente'
                                                     ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                                     : 'text-red-500/50 hover:text-red-500 hover:bg-red-500/10'
                                               }`}
                                            >
                                               Desistente
                                            </button>
                                           <button onClick={(e) => { e.stopPropagation(); updateStatus(sale.id, 'confirmado'); }}
                                               className={`px-1.5 py-1 rounded-lg text-[8px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1 ${
                                                  sale.status === 'confirmado'
                                                     ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                                                     : 'text-green-500/50 hover:text-green-500 hover:bg-green-500/10'
                                               }`}
                                            >
                                               Confirmado
                                            </button>
                                           <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Excluir aluno?')) deleteSale(sale.id); }}
                                               className="p-1 bg-neutral-800 text-neutral-500 rounded-lg hover:bg-red-500 hover:text-white transition-all flex items-center justify-center animate-none"
                                               title="Remover"
                                            >
                                               <Trash2 size={12} />
                                            </button>
                                        </div>
                                     </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 mt-2">
                                     <div className="bg-black/50 p-2 rounded-xl text-center">
                                        <p className="text-[8px] font-black text-neutral-600 uppercase">Valor do Curso</p>
                                        <p className="text-xs font-black text-yellow-400">R$ {Number(sale.price).toLocaleString('pt-BR')}</p>
                                     </div>
                                     <div className="bg-black/50 p-2 rounded-xl text-center">
                                        <p className="text-[8px] font-black text-neutral-600 uppercase">Hospedagem</p>
                                        <p className="text-xs font-black text-white">{sale.needsAccommodation ? 'SIM' : 'NÃO'}</p>
                                     </div>
                                  </div>
                               </div>
                             );
                           })}
                        </div>
                      </motion.div>
                    );
                  })()}
                </div>
              )}
            </motion.div>
          )}

          {/* ABA VENDAS (Vendedor + Emily) */}
          {(activeTab === 'vendas' && (!isSecretaria || (isSecretaria && ['emily@opera.com', 'emilyopera@gmail.com'].includes(user?.email?.toLowerCase() || '')))) && (
            <motion.div key="vendas" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
              
              {/* FORMULÁRIO DE EDIÇÃO OU ADIÇÃO */}
              <div className="bg-neutral-900 p-6 rounded-[2rem] border border-neutral-800 overflow-hidden relative">
                {editingId && <div className="absolute top-4 right-6 text-yellow-400 animate-pulse text-[10px] font-black uppercase">MODO EDIÇÃO</div>}
                <h3 className="text-lg font-black mb-4">{editingId ? 'Editar Aluno' : 'Cadastrar Novo Aluno'}</h3>
                <div className="space-y-3">
                  <input 
                    className="w-full bg-black border border-neutral-800 p-4 rounded-2xl focus:border-yellow-400 outline-none transition-all"
                    placeholder="Nome do Aluno"
                    value={editingId ? editFormData.name : newSale.name}
                    onChange={e => editingId ? setEditFormData({...editFormData, name: e.target.value}) : setNewSale({...newSale, name: e.target.value})}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                      <input 
                        type="number"
                        className="w-full bg-black border border-neutral-800 p-4 pl-10 rounded-2xl outline-none focus:border-yellow-400"
                        placeholder="Valor"
                        value={editingId ? editFormData.price : newSale.price}
                        onChange={e => editingId ? setEditFormData({...editFormData, price: Number(e.target.value)}) : setNewSale({...newSale, price: Number(e.target.value)})}
                      />
                      {(editingId ? editFormData.city : newSale.city) !== 'EAD' && (editingId ? editFormData.price : newSale.price) < 1799 && (
                        <p className="absolute -bottom-5 left-2 text-[8px] font-black text-red-500 uppercase">
                          Desconto: R$ {1799 - (editingId ? editFormData.price : newSale.price)}
                        </p>
                      )}
                    </div>
                    <select 
                      className="bg-black border border-neutral-800 p-4 rounded-2xl outline-none"
                      value={editingId ? editFormData.city : newSale.city}
                      onChange={e => editingId ? setEditFormData({...editFormData, city: e.target.value}) : setNewSale({...newSale, city: e.target.value})}
                    >
                      {['EAD', ...CITIES_LIST].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between bg-black border border-neutral-800 p-4 rounded-2xl">
                    <span className="text-xs font-bold uppercase text-neutral-400 flex items-center gap-2">
                      <BedDouble size={16} /> Hospedagem?
                    </span>
                    <button 
                      onClick={() => editingId ? setEditFormData({...editFormData, needsAccommodation: !editFormData.needsAccommodation}) : setNewSale({...newSale, needsAccommodation: !newSale.needsAccommodation})}
                      className={`px-4 py-1 rounded-lg text-[10px] font-black tracking-widest ${ (editingId ? editFormData.needsAccommodation : newSale.needsAccommodation) ? 'bg-yellow-400 text-black' : 'bg-neutral-800 text-neutral-500'}`}
                    >
                      {(editingId ? editFormData.needsAccommodation : newSale.needsAccommodation) ? "SIM" : "NÃO"}
                    </button>
                  </div>
                    <div className="flex gap-2">
                      <button onClick={editingId ? saveEdit : addSale} className="flex-1 bg-yellow-400 text-black font-black p-4 rounded-2xl flex items-center justify-center gap-2 hover:scale-95 transition-transform">
                        {editingId ? <CheckCircle2 size={20} /> : <Plus size={20} />} 
                        {editingId ? 'SALVAR ALTERAÇÕES' : 'ADICIONAR ALUNO'}
                      </button>
                      {editingId && (
                        <button onClick={() => {setEditingId(null); setEditFormData(null);}} className="bg-red-500/20 text-red-500 p-4 rounded-2xl border border-red-500/20">
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isLucas && (
                  <div className="bg-neutral-900 border border-neutral-800/60 p-4 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase text-neutral-400">Filtrar Período das Vendas</span>
                      <span className="text-[10px] text-neutral-500 font-bold uppercase mt-0.5">Define o escopo de visualização e cálculo do painel</span>
                    </div>
                    <div className="flex bg-black p-1 rounded-2xl border border-neutral-800 shrink-0">
                      <button 
                        onClick={() => setManagerPeriodFilter('current')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                          managerPeriodFilter === 'current' 
                            ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' 
                            : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        Mês Vigente
                      </button>
                      <button 
                        onClick={() => setManagerPeriodFilter('all')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                          managerPeriodFilter === 'all' 
                            ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' 
                            : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        Histórico Completo
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                    <input 
                      className="w-full bg-neutral-900 border border-neutral-800 p-4 pl-12 rounded-2xl outline-none focus:border-yellow-400"
                      placeholder="Buscar aluno..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => setShowFeeReportModal(true)}
                    className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-green-500/20 transition-all text-green-500 group"
                  >
                    <MessageCircle size={24} className="group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-center leading-tight">Enviar Taxas</span>
                  </button>
                  <button 
                    onClick={() => printMonthlyVendorReport()}
                    className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-blue-500/20 transition-all text-blue-400 group"
                  >
                    <Printer size={24} className="group-hover:scale-110 transition-transform text-blue-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-center leading-tight">Imprimir Vendas</span>
                  </button>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => {
                        setPdfEcoMode(false);
                        setShowPDFPeriodModal(true);
                      }}
                      className="p-2 bg-yellow-400 text-black rounded-[1.2rem] flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all text-[9px] font-black uppercase tracking-widest flex-1 shadow-lg shadow-yellow-400/20"
                    >
                      <Eye size={16} /> Ver PDF
                    </button>
                    <button 
                      onClick={() => {
                        setPdfEcoMode(true);
                        setShowPDFPeriodModal(true);
                      }}
                      className="p-2 bg-white/5 border border-white/10 text-white rounded-[1.2rem] flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all text-[9px] font-black uppercase tracking-widest flex-1"
                    >
                      <Printer size={16} /> Eco Print
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {displayedSales.filter((s: any) => s.name.toLowerCase().includes(searchTerm.toLowerCase())).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((sale: any) => {
                    const saleContract = displayedContracts.find(c => c.saleId === sale.id) || contractsHistory.find(h => h.saleId === sale.id) || (sale.hasContract ? { id: 'ext_dummy_' + sale.id, clientName: sale.name, courseCity: sale.city, dummy: true, hasContract: true } : null);
                    return (
                      <div key={sale.id} className={`bg-neutral-900 p-4 rounded-2xl border transition-all ${editingId === sale.id ? 'border-yellow-400 scale-[1.02]' : (saleContract ? 'border-[#39FF14]/50 shadow-[0_0_15px_rgba(57,255,20,0.1)]' : 'border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.05)]')} flex justify-between items-center`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${saleContract ? 'bg-[#39FF14] text-black shadow-[0_0_8px_rgba(57,255,20,0.4)]' : 'bg-red-500 text-white'}`}>
                              {saleContract ? 'CONTRATO OK' : 'SEM CONTRATO'}
                            </div>
                            <h4 className="font-bold text-sm uppercase flex items-center gap-2">
                              {sale.name}
                              {sale.isLocalPending && (
                                <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-wide uppercase">
                                  AGUARDANDO CONEXÃO
                                </span>
                              )}
                            </h4>
                            {sale.needsAccommodation && <BedDouble size={12} className="text-cyan-400" />}
                          </div>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[10px] bg-black px-2 py-0.5 rounded text-neutral-400 border border-neutral-800">{sale.city}</span>
                            <span className="text-[10px] bg-black px-2 py-0.5 rounded text-yellow-400 border border-neutral-800 font-bold">R$ {sale.price}</span>
                            {sale.city !== 'EAD' && Number(sale.price) < 1799 && (
                              <span className="text-[8px] bg-red-500/10 px-2 py-0.5 rounded text-red-500 border border-red-500/20 font-black">DESC: R$ {1799 - Number(sale.price)}</span>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${sale.status === 'confirmado' ? 'bg-green-500/10 text-green-500' : sale.status === 'desistente' ? 'bg-red-500/10 text-red-500' : 'bg-neutral-700 text-neutral-400'}`}>
                              {sale.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {saleContract ? (
                            !saleContract.dummy && (
                              <button 
                                onClick={() => {
                                  setContractForm(saleContract);
                                  setActiveTab('contratos');
                                }}
                                className="p-2 bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/20 rounded-xl hover:bg-[#39FF14] hover:text-black transition-all"
                                title="Editar Contrato"
                              >
                                <Pencil size={14} />
                              </button>
                            )
                          ) : (
                            <button 
                              onClick={() => prefillContract(sale)} 
                              className="p-2 bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 rounded-xl hover:bg-yellow-400 hover:text-black transition-all"
                              title="Gerar Contrato"
                            >
                              <FilePlus size={14} />
                            </button>
                          )}
                          <div className="flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-xl border border-white/5">
                            <button
                              id={`btn-vendas-desistente-${sale.id}`}
                              onClick={(e) => { e.stopPropagation(); updateStatus(sale.id, 'desistente'); }}
                              className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1 ${
                                sale.status === 'desistente'
                                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                  : 'text-red-500/50 hover:text-red-500 hover:bg-red-500/10'
                              }`}
                            >
                              Desistente
                            </button>
                            <button
                              id={`btn-vendas-confirmado-${sale.id}`}
                              onClick={(e) => { e.stopPropagation(); updateStatus(sale.id, 'confirmado'); }}
                              className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1 ${
                                sale.status === 'confirmado'
                                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                                  : 'text-green-500/50 hover:text-green-500 hover:bg-green-500/10'
                              }`}
                            >
                              Confirmado
                            </button>
                          </div>
                          <button 
                            onClick={() => deleteSale(sale.id)} 
                            className="ml-1 px-3 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all whitespace-nowrap"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {displayedSales.length === 0 && (
                    <div className="text-center p-12 bg-neutral-900/50 rounded-[2rem] border border-dashed border-neutral-800 text-neutral-600">
                      <List size={40} className="mx-auto mb-2 opacity-20" />
                      <p className="text-xs uppercase font-bold">Nenhum aluno cadastrado</p>
                    </div>
                  )}
                </div>
            </motion.div>
          )}



          {/* TAB: SIMULADOR DE CARTÃO DE CRÉDITO */}
          {activeTab === 'simulador' && (
            <motion.div key="simulador" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
              {renderSimulatorTab()}
            </motion.div>
          )}



          {/* TAB: IA CHATBOT */}
          {activeTab === 'ia' && (
            <motion.div key="ia" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
              {renderIATab()}
            </motion.div>
          )}
          
          {/* TAB: EQUIPE GONÇALVES */}
          {activeTab === 'equipe' && (isLucas || isOperaGoncalves) && (
            <motion.div key="equipe" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
              {renderEquipeTab()}
            </motion.div>
          )}

          {/* TAB: CARTEIRINHA */}
          {activeTab === 'carteirinha' && (
            <motion.div key="carteirinha" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
              {renderCarteirinhaTab()}
            </motion.div>
          )}



          {/* ABA 4: CONFIGURAÇÕES (UNIFICADO) */}
          {activeTab === 'config' && (
            <motion.div key="config-unified" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-6 max-w-4xl mx-auto">

              {/* --- MEU PERFIL (UNIFICADO) --- */}
              <div className="bg-neutral-900/50 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <h3 className="text-xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3 text-yellow-400">
                  <User size={24} /> Meu Perfil
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex flex-col items-center gap-6 bg-black/40 p-8 rounded-[2.5rem] border border-white/5 shadow-inner">
                    <div className="relative group">
                      <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-2 border-yellow-400 shadow-2xl relative bg-neutral-800">
                        {userProfile?.profilePic ? (
                          <img src={userProfile.profilePic} className="w-full h-full object-cover" alt="Perfil" />
                        ) : (
                          <User className="w-full h-full p-8 text-neutral-600" />
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <Camera size={24} className="text-white" />
                        </div>
                      </div>
                      <label className="absolute -bottom-3 -right-3 bg-yellow-400 p-3 rounded-2xl cursor-pointer shadow-2xl hover:scale-110 active:scale-95 transition-all">
                        <Camera size={20} className="text-black" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                      </label>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-1">Foto do Perfil</p>
                      <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest leading-relaxed">Clique para alterar sua imagem</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-4">Nome de Exibição</label>
                      <div className="relative">
                        <input 
                          className="w-full bg-black border border-neutral-800 p-4 rounded-2xl text-sm outline-none focus:border-yellow-400 transition-all font-bold"
                          placeholder="Digite seu nome"
                          value={newNameInput}
                          onChange={e => setNewNameInput(e.target.value)}
                        />
                        <button 
                          onClick={updateProfileName}
                          disabled={isUpdatingName}
                          className="absolute right-2 top-2 h-12 px-6 bg-yellow-400 text-black rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-yellow-300 transition-colors"
                        >
                          {isUpdatingName ? "..." : "SALVAR"}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-4">Minha Senha (PIN)</label>
                      <div className="relative">
                        <input 
                          type="password"
                          maxLength={6}
                          className="w-full bg-black border border-neutral-800 p-4 rounded-2xl text-sm outline-none focus:border-yellow-400 transition-all font-black tracking-widest"
                          placeholder="Novo Código"
                          value={newPinInput}
                          onChange={e => setNewPinInput(e.target.value)}
                        />
                        <button 
                          onClick={updateProfilePin}
                          disabled={isUpdatingPin}
                          className="absolute right-2 top-2 h-12 px-6 bg-yellow-400 text-black rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-yellow-300 transition-colors"
                        >
                          {isUpdatingPin ? "..." : "ALTERAR"}
                        </button>
                      </div>
                    </div>

                    {!isGestor && !isSecretaria && (
                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-4 flex items-center gap-2">
                          <Target size={12} /> Minha Meta Pessoal (Alunos)
                        </label>
                        <input 
                          type="number"
                          className="w-full bg-black border border-neutral-800 p-4 rounded-2xl text-sm outline-none focus:border-yellow-400 transition-all text-yellow-400 font-black"
                          placeholder="Ex: 30"
                          value={userProfile?.personalGoal || ''}
                          onChange={async (e) => {
                            const val = Number(e.target.value);
                            try {
                              await updateDoc(doc(db, 'users', user.uid), { personalGoal: val });
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[8px] text-neutral-700 font-bold uppercase mt-8 text-center italic tracking-widest">Acesso seguro • Opera Formação v3.0</p>
              </div>

              {/* --- CONFIGURAÇÕES DO GERENTE GONÇALVES (isLucas ONLY) --- */}
              {isLucas && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-6 border-t border-white/5">
                  <div className="text-center mb-8">
                    <div className="inline-block px-4 py-1.5 bg-yellow-400 text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">Gestão de Metas • Gonçalves</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {/* META PESSOAL DO GONÇALVES */}
                    <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-400" />
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-3 bg-yellow-400/10 rounded-2xl text-yellow-400">
                            <Target size={20} />
                          </div>
                          <div>
                            <h3 className="text-sm font-black uppercase text-white leading-none">Meta Mensal Pessoal</h3>
                            <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mt-1 block">Somente suas vendas contam</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase leading-relaxed mb-6">
                          Sua meta individual de vendas para o mês. O painel calculará o progresso usando apenas as vendas em seu e-mail.
                        </p>
                      </div>
                      
                      <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 mt-auto">
                        <label className="text-[10px] font-black text-neutral-400 uppercase flex items-center gap-2">
                          <User size={14} className="text-neutral-600" /> Minha Meta Pessoal (Alunos)
                        </label>
                        <input 
                          type="number"
                          className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-xl w-24 text-right text-yellow-400 font-black outline-none focus:border-yellow-400"
                          value={userProfile?.personalGoal || ''}
                          placeholder="Ex: 30"
                          onChange={async (e) => {
                            const val = Number(e.target.value);
                            try {
                              await updateDoc(doc(db, 'users', user.uid), { personalGoal: val });
                              setUserProfile((prev: any) => ({ ...prev, personalGoal: val }));
                            } catch (err) {
                              console.error("Erro ao salvar meta pessoal:", err);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* RELATÓRIO MENSAL DE VENDAS (LUCAS GONÇALVES APENAS) */}
                    {isLucasStrictReport && (
                      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-400" />
                        
                        <div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-yellow-400/10 rounded-2xl text-yellow-400">
                              <FileDown size={20} />
                            </div>
                            <div>
                              <h3 className="text-sm font-black uppercase text-white leading-none">Relatório de Vendas</h3>
                              <span className="text-[8px] text-yellow-400 font-bold uppercase tracking-widest mt-1 block">Acesso Exclusivo • Lucas Gonçalves</span>
                            </div>
                          </div>
                          
                          <p className="text-[10px] text-neutral-400 font-bold uppercase leading-relaxed mb-6">
                            Selecione o mês e o ano para gerar o relatório consolidado em PDF com datas, nomes, cidades, destinos e valores de todas as vendas.
                          </p>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            {/* Seleção do Mês */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest ml-1">Mês</label>
                              <select
                                value={reportMonth}
                                onChange={(e) => setReportMonth(Number(e.target.value))}
                                className="bg-black border border-neutral-800 text-white font-bold text-xs p-3 rounded-xl outline-none focus:border-yellow-400 transition-all cursor-pointer"
                              >
                                {[
                                  { value: 0, label: "Janeiro" },
                                  { value: 1, label: "Fevereiro" },
                                  { value: 2, label: "Março" },
                                  { value: 3, label: "Abril" },
                                  { value: 4, label: "Maio" },
                                  { value: 5, label: "Junho" },
                                  { value: 6, label: "Julho" },
                                  { value: 7, label: "Agosto" },
                                  { value: 8, label: "Setembro" },
                                  { value: 9, label: "Outubro" },
                                  { value: 10, label: "Novembro" },
                                  { value: 11, label: "Dezembro" },
                                ].map((m) => (
                                  <option key={m.value} value={m.value} className="bg-neutral-900 text-white">
                                    {m.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Seleção do Ano */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest ml-1">Ano</label>
                              <select
                                value={reportYear}
                                onChange={(e) => setReportYear(Number(e.target.value))}
                                className="bg-black border border-neutral-800 text-white font-bold text-xs p-3 rounded-xl outline-none focus:border-yellow-400 transition-all cursor-pointer"
                              >
                                {[2024, 2025, 2026, 2027].map((y) => (
                                  <option key={y} value={y} className="bg-neutral-900 text-white">
                                    {y}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <button
                            onClick={downloadLucasSalesReportPDF}
                            className="w-full h-12 bg-yellow-400 hover:bg-yellow-300 text-black rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-yellow-400/10 cursor-pointer mt-2"
                          >
                            <Printer size={14} /> Imprimir PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* --- CONFIGURAÇÕES GLOBAIS (GESTOR ONLY) --- */}
              {(isGestor && !isLucas) && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-6 border-t border-white/5">
                  <div className="text-center mb-8">
                    <div className="inline-block px-4 py-1.5 bg-yellow-400 text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">Painel de Gerência</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-neutral-900/80 p-8 rounded-[2.5rem] border border-neutral-800">
                      <h3 className="text-sm font-black uppercase mb-8 flex items-center gap-3 text-yellow-400">
                        <Target size={20} /> Metas de Vendas
                      </h3>
                      <div className="space-y-4">
                        {/* Meta Pessoal do Mês */}
                        <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5">
                          <label className="text-[10px] font-black text-neutral-400 uppercase flex items-center gap-2">
                            <User size={14} className="text-neutral-600" /> Meta Pessoal do Mês (Minhas Vendas)
                          </label>
                          <input 
                            type="number"
                            className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-xl w-24 text-right text-yellow-400 font-black outline-none focus:border-yellow-400"
                            value={userProfile?.personalGoal || ''}
                            placeholder="Ex: 30"
                            onChange={async (e) => {
                              const val = Number(e.target.value);
                              try {
                                await updateDoc(doc(db, 'users', user.uid), { personalGoal: val });
                                setUserProfile((prev: any) => ({ ...prev, personalGoal: val }));
                              } catch (err) {
                                console.error("Erro ao salvar meta pessoal:", err);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-neutral-900/80 p-8 rounded-[2.5rem] border border-neutral-800">
                      <h3 className="text-sm font-black uppercase mb-8 flex items-center gap-3 text-red-400">
                        <AlertTriangle size={20} /> Ajustes Manuais de Totais
                      </h3>
                      <div className="space-y-4">
                        {[
                          { key: 'presencial', label: 'Ajuste Presencial (+/-)', icon: MapPin },
                          { key: 'ead', label: 'Ajuste EAD (+/-)', icon: Smartphone },
                          { key: 'dropout', label: 'Ajuste Desistentes (+/-)', icon: UserMinus },
                        ].map(field => (
                          <div key={field.key} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5">
                            <label className="text-[10px] font-black text-neutral-400 uppercase flex items-center gap-2">
                              <field.icon size={14} className="text-neutral-600" /> {field.label}
                            </label>
                            <input 
                              type="number"
                              className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-xl w-24 text-right text-red-500 font-black outline-none focus:border-red-500"
                              value={(config.overrides as any)?.[field.key] || 0}
                              onChange={e => {
                                const newOverrides = { ...(config.overrides || { ead: 0, presencial: 0, dropout: 0 }), [field.key]: Number(e.target.value) };
                                setConfig({...config, overrides: newOverrides});
                              }}
                            />
                          </div>
                        ))}
                        <p className="text-[8px] text-neutral-600 uppercase font-black tracking-widest text-center mt-2">
                          *Use para zerar (ex: -50) ou adicionar números manuais no início do mês.
                        </p>
                      </div>
                    </div>

                    {!isValiandro && (
                      <div className="bg-neutral-900/80 p-8 rounded-[2.5rem] border border-neutral-800">
                        <h3 className="text-sm font-black uppercase mb-8 flex items-center gap-3 text-yellow-400">
                          <DollarSign size={20} /> Configurações Financeiras
                        </h3>
                        <div className="space-y-4">
                          {[
                            { key: 'baseSalary', label: 'Salário Base', icon: DollarSign },
                            { key: 'commissionValue', label: 'Valor p/ Taxa de Aluno (R$)', icon: CheckCircle2 },
                            { key: 'commissionThreshold', label: 'Início das Taxas (Ex: Após 10)', icon: List },
                            { key: 'tripValue', label: 'Valor p/ Adic. Viagem', icon: MapPin },
                          ].map(field => (
                            <div key={field.key} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5">
                              <label className="text-[10px] font-black text-neutral-400 uppercase flex items-center gap-2">
                                <field.icon size={14} className="text-neutral-600" /> {field.label}
                              </label>
                              <input 
                                type="number"
                                className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-xl w-24 text-right text-yellow-400 font-black outline-none focus:border-yellow-400"
                                value={(config as any)[field.key]}
                                onChange={e => setConfig({...config, [field.key]: Number(e.target.value)})}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* BOTÃO DE SALVAR GLOBAL */}
                  <div className="flex justify-center pt-4">
                    <button 
                      onClick={() => saveConfigToFirebase(config)}
                      disabled={isSavingConfig}
                      className="w-full max-w-md h-20 bg-yellow-400 text-black rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] shadow-2xl shadow-yellow-400/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
                    >
                      {isSavingConfig ? (
                        <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin" />
                      ) : (
                        <Save size={24} />
                      )}
                      {isSavingConfig ? "SALVANDO..." : "SALVAR CONFIGURAÇÕES"}
                    </button>
                  </div>

                  {!isValiandro && (
                    <div className="bg-neutral-900/80 p-8 rounded-[2.5rem] border border-neutral-800 border-dashed border-yellow-400/30 shadow-2xl">
                      <h3 className="text-sm font-black uppercase mb-6 flex items-center gap-3 text-yellow-400">
                        <Plus size={20} /> Bônus Adicionais Personalizados
                      </h3>
                      <div className="flex flex-col sm:flex-row gap-3 mb-8 bg-black/40 p-6 rounded-[2rem] border border-white/5">
                        <input 
                          className="flex-1 bg-black border border-neutral-800 p-4 rounded-2xl text-xs outline-none focus:border-yellow-400 font-bold"
                          placeholder="Nome do bônus (Ex: Meta Batida)"
                          value={extraBonusForm.label}
                          onChange={e => setExtraBonusForm({...extraBonusForm, label: e.target.value})}
                        />
                        <div className="relative">
                          <input 
                            type="number"
                            className="w-full sm:w-32 bg-black border border-neutral-800 p-4 rounded-2xl text-xs outline-none focus:border-yellow-400 font-black pl-8"
                            placeholder="0,00"
                            value={extraBonusForm.value || ''}
                            onChange={e => setExtraBonusForm({...extraBonusForm, value: Number(e.target.value)})}
                          />
                          <span className="absolute left-3 top-4 text-[10px] font-black text-neutral-600 leading-none">R$</span>
                        </div>
                        <button onClick={addExtraBonus} className="bg-yellow-400 text-black px-8 rounded-2xl font-black py-4 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-yellow-400/20 flex items-center justify-center gap-2">
                          <Plus size={18} /> <span className="text-[10px] uppercase">Adicionar</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(config.extraBonuses || []).map((bonus: any) => (
                          <div key={bonus.id} className="flex justify-between items-center bg-yellow-400/5 p-4 rounded-2xl border border-yellow-400/10 group hover:border-yellow-400/30 transition-all">
                            <div>
                              <p className="text-[10px] font-black text-neutral-500 uppercase group-hover:text-yellow-400 transition-colors">{bonus.label}</p>
                              <p className="text-sm font-black">R$ {bonus.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <button onClick={() => removeExtraBonus(bonus.id)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all shadow-sm"><Trash2 size={16} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}


              <div className="bg-neutral-900/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 text-center mb-12">
                <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-[0.25em] mb-3">Segurança e Sincronização</p>
                <div className="flex items-center justify-center gap-4 text-neutral-700">
                  <div className="h-[1px] w-12 bg-white/5" />
                  <p className="text-[9px] font-medium tracking-widest italic">Opera Formação • Dados criptografados no Firebase</p>
                  <div className="h-[1px] w-12 bg-white/5" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

            {/* BARRA DE NAVEGAÇÃO INFERIOR */}
            <nav id="bottom_nav" className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-neutral-900/80 backdrop-blur-xl border border-white/10 p-2 rounded-[2.5rem] flex justify-between shadow-2xl z-50">
              {menuItems.map(item => (
                <button 
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center p-1 rounded-2xl transition-all ${activeTab === item.id ? 'bg-yellow-400 text-black scale-105 shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
                  style={{ width: `${100 / (menuItems.length || 1) - 1}%` }}
                >
                  <item.icon size={menuItems.length > 5 ? 12 : 18} strokeWidth={activeTab === item.id ? 3 : 2} />
                  <span className={`text-[5.5px] font-black uppercase mt-0.5 tracking-tighter leading-none ${activeTab === item.id ? 'block' : 'hidden'}`}>{item.label}</span>
                </button>
              ))}
            </nav>
          </>
        )}
      </main>

      {/* Guia de Instalação (Modal de "Download") */}
      <AnimatePresence>
        {isInstallGuideOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsInstallGuideOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 pb-4">
                <div className="flex justify-between items-start mb-6">
                  <div className="bg-yellow-400 p-4 rounded-3xl text-black">
                    <Download size={32} />
                  </div>
                  <button 
                    onClick={() => setIsInstallGuideOpen(false)}
                    className="p-2 bg-white/5 rounded-full text-neutral-500 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">
                  Baixar App Oficial
                </h2>
                <p className="text-neutral-400 text-[11px] font-bold uppercase tracking-widest leading-relaxed">
                  Trabalhe com maior velocidade e receba notificações em tempo real.
                </p>
              </div>

              <div className="px-8 pb-10 space-y-6">
                {/* Botão de Instalação Direta se disponível */}
                {deferredPrompt ? (
                  <button 
                    onClick={handleInstallClick}
                    className="w-full h-16 bg-yellow-400 text-black rounded-2xl font-black uppercase text-[14px] tracking-[0.2em] shadow-[0_0_20px_rgba(250,204,21,0.4)] hover:scale-105 transition-all flex items-center justify-center gap-3"
                  >
                    <Download size={20} />
                    Instalar Agora
                  </button>
                ) : (
                  <div className="space-y-6">
                    {/* Android Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-500/20 rounded-xl flex items-center justify-center text-green-500">
                          <Smartphone size={16} />
                        </div>
                        <span className="text-[12px] font-black text-white uppercase tracking-tighter">Download Direto (Android)</span>
                      </div>
                      <div className="space-y-3 pl-11 border-l border-white/5">
                        <div className="flex items-center gap-3 text-[10px] text-neutral-300 font-bold uppercase tracking-wide">
                          <div className="w-5 h-5 bg-white/5 rounded-md flex items-center justify-center text-[8px] text-neutral-500">1</div>
                          Abra o Chrome e clique em <span>Instalar</span>
                        </div>
                        <div className="text-[9px] text-neutral-500 leading-tight">
                          O navegador irá criar o ícone automaticamente como um Aplicativo Nativo.
                        </div>
                      </div>
                    </div>

                    {/* Separator */}
                    <div className="h-[1px] bg-white/5 w-full"></div>

                    {/* iOS Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500">
                          <Smartphone size={16} />
                        </div>
                        <span className="text-[12px] font-black text-white uppercase tracking-tighter">No iPhone (iOS)</span>
                      </div>
                      <div className="space-y-3 pl-11 border-l border-white/5">
                        <div className="flex items-center gap-3 text-[10px] text-neutral-300 font-bold uppercase tracking-wide">
                          <div className="w-5 h-5 bg-white/5 rounded-md flex items-center justify-center text-[8px] text-neutral-500">1</div>
                          Clique em <span className="text-blue-400">Compartilhar</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-neutral-300 font-bold uppercase tracking-wide">
                          <div className="w-5 h-5 bg-white/5 rounded-md flex items-center justify-center text-[8px] text-neutral-500">2</div>
                          Selecione <span>Adicionar à Tela de Início</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => setIsInstallGuideOpen(false)}
                  className="w-full h-14 bg-white/5 text-neutral-400 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] hover:text-white transition-all mt-4"
                >
                  Continuar no Navegador
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Lançar Venda de Consultor sem App (Gerente Gonçalves) */}
      <AnimatePresence>
        {showExternalSaleModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowExternalSaleModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 25 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 25 }}
              className="relative w-full max-w-lg bg-neutral-900 border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl my-8 z-10"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="bg-yellow-400/10 p-4 rounded-3xl text-yellow-400">
                    <UserPlus size={32} />
                  </div>
                  <button 
                    onClick={() => setShowExternalSaleModal(false)}
                    className="p-2 bg-white/5 rounded-full text-neutral-500 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">
                  Lançar Venda de Consultor Externo
                </h2>
                <p className="text-xs text-neutral-400 uppercase font-bold tracking-wider mb-6">
                  Registre vendas para consultores externos de forma permanente
                </p>

                <form onSubmit={registerExternalSale} className="space-y-4">
                  {/* Tipo de Vendedor */}
                  <div className="bg-black/30 p-2 rounded-2xl border border-white/5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setExternalSaleForm(p => ({ ...p, vendorType: 'existing' }))}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                        externalSaleForm.vendorType === 'existing' 
                          ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' 
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Consultor Existente
                    </button>
                    <button
                      type="button"
                      onClick={() => setExternalSaleForm(p => ({ ...p, vendorType: 'new' }))}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                        externalSaleForm.vendorType === 'new' 
                          ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' 
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Novo Consultor (Sem App)
                    </button>
                  </div>

                  {/* Seleção de Consultor Existente */}
                  {externalSaleForm.vendorType === 'existing' ? (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest pl-2">Selecione o Consultor</label>
                      <select
                        value={externalSaleForm.existingVendorId}
                        onChange={(e) => setExternalSaleForm(p => ({ ...p, existingVendorId: e.target.value }))}
                        className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black text-white focus:border-yellow-400 focus:outline-none"
                      >
                        <option value="">-- Selecione o Consultor --</option>
                        {rawAllUsers
                          .filter((u: any) => u.role === 'vendedor' && !(u.email?.toLowerCase() || '').includes('karol') && !(u.name?.toLowerCase() || '').includes('karol'))
                          .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
                          .map((s: any) => (
                            <option key={s.id} value={s.id}>{s.name?.toUpperCase()}</option>
                          ))
                        }
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest pl-2">Nome Completo do Consultor</label>
                      <input
                        type="text"
                        placeholder="Ex: João da Silva"
                        value={externalSaleForm.newVendorName}
                        onChange={(e) => setExternalSaleForm(p => ({ ...p, newVendorName: e.target.value }))}
                        className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black text-white focus:border-yellow-400 focus:outline-none placeholder:text-neutral-600"
                      />
                    </div>
                  )}

                  {/* Nome do Aluno */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest pl-2">Nome do Aluno (Cliente)</label>
                    <input
                      type="text"
                      placeholder="Ex: Pedro Henrique"
                      value={externalSaleForm.studentName}
                      onChange={(e) => setExternalSaleForm(p => ({ ...p, studentName: e.target.value }))}
                      className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black text-white focus:border-yellow-400 focus:outline-none placeholder:text-neutral-600"
                    />
                  </div>

                  {/* Cidade ou EAD */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest pl-2">Cidade do Curso / EAD</label>
                      <select
                        value={externalSaleForm.city}
                        onChange={(e) => setExternalSaleForm(p => ({ ...p, city: e.target.value }))}
                        className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black text-white focus:border-yellow-400 focus:outline-none"
                      >
                        <option value="EAD">EAD / Online</option>
                        {CITIES_LIST.map((c: any) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest pl-2">Valor da Venda (R$)</label>
                      <input
                        type="number"
                        placeholder="Ex: 1799"
                        value={externalSaleForm.price}
                        onChange={(e) => setExternalSaleForm(p => ({ ...p, price: e.target.value }))}
                        className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black text-white focus:border-yellow-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Precisa de Hospedagem */}
                  <div className="bg-black/20 p-5 rounded-3xl border border-white/5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-white leading-none">Precisa de Hospedagem / Alojamento?</p>
                      <span className="text-[8px] text-neutral-500 font-bold uppercase mt-1 block">Indique se o aluno necessita de alojamento</span>
                    </div>
                    <div className="flex bg-black p-1 rounded-2xl border border-neutral-800 shrink-0 select-none">
                      <button
                        type="button"
                        onClick={() => setExternalSaleForm(p => ({ ...p, needsAccommodation: false }))}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                          !externalSaleForm.needsAccommodation 
                            ? 'bg-red-500/20 text-red-500 border border-red-500/20' 
                            : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        NÃO
                      </button>
                      <button
                        type="button"
                        onClick={() => setExternalSaleForm(p => ({ ...p, needsAccommodation: true }))}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                          externalSaleForm.needsAccommodation 
                            ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' 
                            : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        SIM
                      </button>
                    </div>
                  </div>

                  {/* Botão de Envio */}
                  <button
                    type="submit"
                    className="w-full py-5 bg-gradient-to-r from-yellow-500 to-yellow-300 hover:from-yellow-400 hover:to-yellow-200 text-black text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-yellow-400/20 active:scale-95 flex items-center justify-center gap-2 mt-4"
                  >
                    🚀 Registrar Venda Externa
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Opção de Envio de Taxas (Karol) */}
      <AnimatePresence>
        {showFeeReportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowFeeReportModal(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl p-8"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="bg-green-500 p-4 rounded-3xl text-black">
                  <MessageCircle size={32} />
                </div>
                <button 
                  onClick={() => setShowFeeReportModal(false)}
                  className="p-2 bg-white/5 rounded-full text-neutral-500 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">
                Enviar Taxas para Karol
              </h2>
              <p className="text-neutral-400 text-xs font-bold uppercase tracking-widest leading-relaxed mb-6">
                Escolha quais taxas de vendas confirmadas deseja enviar para a Karol.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowFeeReportModal(false);
                    sendFeeReport('week');
                  }}
                  className="w-full text-left p-5 rounded-3xl bg-neutral-950 border border-neutral-800 hover:border-yellow-400/50 hover:bg-neutral-900 transition-all flex items-center gap-4 group"
                >
                  <div className="p-3 rounded-2xl bg-yellow-400/10 text-yellow-400 group-hover:scale-110 transition-transform">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase tracking-tight text-sm">Somente as da Semana</h3>
                    <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">Vendas confirmadas da semana atual</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowFeeReportModal(false);
                    sendFeeReport('month');
                  }}
                  className="w-full text-left p-5 rounded-3xl bg-neutral-950 border border-neutral-800 hover:border-blue-400/50 hover:bg-neutral-900 transition-all flex items-center gap-4 group"
                >
                  <div className="p-3 rounded-2xl bg-blue-400/10 text-blue-400 group-hover:scale-110 transition-transform">
                    <List size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase tracking-tight text-sm">As do Mês Inteiro</h3>
                    <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">Vendas confirmadas do mês atual</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowFeeReportModal(false);
                    sendFeeReport('all');
                  }}
                  className="w-full text-left p-5 rounded-3xl bg-neutral-950 border border-neutral-800 hover:border-green-500/50 hover:bg-neutral-900 transition-all flex items-center gap-4 group"
                >
                  <div className="p-3 rounded-2xl bg-green-500/10 text-green-500 group-hover:scale-110 transition-transform">
                    <ClipboardCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase tracking-tight text-sm">Tudo que já foi vendido</h3>
                    <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">Histórico de todas as taxas confirmadas</p>
                  </div>
                </button>
              </div>

              <button 
                onClick={() => setShowFeeReportModal(false)}
                className="w-full h-14 bg-white/5 text-neutral-400 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] hover:text-white transition-all mt-6"
              >
                Voltar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Opção de Visualização de Relatório PDF (Escolha de Período) */}
      <AnimatePresence>
        {showPDFPeriodModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowPDFPeriodModal(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl p-8"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="bg-yellow-400 p-4 rounded-3xl text-black">
                  <Eye size={32} />
                </div>
                <button 
                  onClick={() => setShowPDFPeriodModal(false)}
                  className="p-2 bg-white/5 rounded-full text-neutral-500 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">
                Ver PDF de Taxas
              </h2>
              <p className="text-neutral-400 text-xs font-bold uppercase tracking-widest leading-relaxed mb-6">
                Selecione o período ideal de alunos confirmados para gerar o relatório PDF.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowPDFPeriodModal(false);
                    generatePDFReport('week', pdfEcoMode);
                  }}
                  className="w-full text-left p-5 rounded-3xl bg-neutral-950 border border-neutral-800 hover:border-yellow-400/50 hover:bg-neutral-900 transition-all flex items-center gap-4 group"
                >
                  <div className="p-3 rounded-2xl bg-yellow-400/10 text-yellow-400 group-hover:scale-110 transition-transform">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase tracking-tight text-sm">Apenas as da Semana</h3>
                    <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">Vendas confirmadas na semana atual</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowPDFPeriodModal(false);
                    generatePDFReport('all', pdfEcoMode);
                  }}
                  className="w-full text-left p-5 rounded-3xl bg-neutral-950 border border-neutral-800 hover:border-green-500/50 hover:bg-neutral-900 transition-all flex items-center gap-4 group"
                >
                  <div className="p-3 rounded-2xl bg-green-500/10 text-green-500 group-hover:scale-110 transition-transform">
                    <ClipboardCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase tracking-tight text-sm">Tudo até o Momento</h3>
                    <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">Histórico completo incluindo meses anteriores</p>
                  </div>
                </button>
              </div>

              <button 
                onClick={() => setShowPDFPeriodModal(false)}
                className="w-full h-14 bg-white/5 text-neutral-400 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] hover:text-white transition-all mt-6"
              >
                Voltar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* Sistema de Toasts Interativos para Emily (Secretaria) */}
      <div className="fixed bottom-24 right-6 left-6 md:left-auto md:w-96 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {contractToasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="pointer-events-auto bg-neutral-950 border-2 border-green-500/30 backdrop-blur-xl p-5 rounded-[2.5rem] shadow-[0_20px_40px_rgba(0,0,0,0.8)] flex items-start gap-4 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(23, 23, 23, 0.98), rgba(10, 10, 10, 0.99))"
              }}
            >
              {/* Green pulsing indicator at top */}
              <div className="absolute top-0 left-0 w-full h-1 bg-[#39FF14] animate-pulse" />
              
              <div className="bg-[#39FF14]/10 p-3 rounded-2xl text-[#39FF14] flex-shrink-0">
                <MessageCircle size={24} />
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start">
                  <h4 className="text-[9px] font-black tracking-[0.2em] uppercase text-[#39FF14]">
                    Novo Contrato Postado!
                  </h4>
                  <button
                    onClick={() => {
                      setContractToasts(prev => prev.filter(t => t.id !== toast.id));
                    }}
                    className="p-1 rounded-full bg-white/5 text-neutral-500 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-white font-black uppercase text-xs leading-tight pt-0.5">
                  {toast.contract.clientName}
                </p>
                <p className="text-[9px] font-bold text-neutral-400 uppercase leading-none pb-1">
                  Cidade: {toast.contract.courseCity} • Vend: {toast.contract.vendorName || toast.contract.consultant || 'Não Informado'}
                </p>
                
                <div className="pt-2">
                  <button
                    onClick={() => {
                      shareContractWhatsApp(toast.contract);
                      setContractToasts(prev => prev.filter(t => t.id !== toast.id));
                    }}
                    className="w-full py-2.5 bg-green-500 hover:bg-green-600 active:scale-95 text-black font-black uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-[0_4px_12px_rgba(34,197,94,0.3)] flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={14} fill="currentColor" />
                    Enviar Contrato
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
