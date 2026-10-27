import type { Locale } from '@/i18n'

const labels = {
  ar: {
    welcome: 'مرحبًا بك في مدرسة', welcomeIntro: 'دروسك ومراجعتك في مكان واحد.', noAccount: 'ليس لديك حساب؟',
    learnIntro: 'تابع دوراتك وتدرّب على ما تعلّمته.', freeForAll: 'مجانًا للجميع', lessonsCount: 'دروس',
    studentOnlyTitle: 'هذا التطبيق مخصص للتلاميذ', logout: 'تسجيل الخروج',
    studentOnlyBody: 'أنت مسجّل الآن بحساب أستاذ أو إدارة. أدِر دوراتك ومحتواك من موقع madrasadz.com على المتصفح، أو سجّل الخروج لتدخل بحساب تلميذ.',
    home: 'مساحة التعلّم', account: 'حسابي', login: 'تسجيل الدخول', register: 'إنشاء حساب',
    intro: 'تعلّم بحسابك الحالي، واحفظ روابط الدروس في المفضلة ونظّم مراجعتك من تبويبات التطبيق.',
    mode: 'نسخة iPhone للتعلّم: الشراء وتفعيل الأكواد والمناقشات غير متاحة في هذه النسخة.',
    courses: 'دوراتي', publicLessons: 'دروس متاحة للجميع', noCourses: 'لا توجد دورات مفعلة في حسابك حاليًا.',
    noLessons: 'لم تُنشر دروس في هذا القسم بعد.', open: 'متابعة التعلّم', ended: 'انتهت صلاحية الوصول',
    videos: 'الفيديوهات', lessons: 'الدروس والملفات', upcoming: 'مواعيد الحصص', noContent: 'لا محتوى منشور بعد.',
    privacy: 'الخصوصية', otherRole: 'هذه النسخة مخصصة لحسابات التلاميذ.', unavailable: 'المحتوى غير متاح لحسابك حاليًا.',
    back: 'العودة إلى التعلّم', rights: 'تُراجع صلاحية الحساب والاشتراك على الخادم عند فتح المحتوى.',
    practice: 'تدرّب واختبر نفسك', play: 'تدريب PLAY', exercises: 'تمارين تطبيقية', quizzes: 'اختبارات قصيرة', exams: 'الامتحانات',
    webTools: 'تُفتح هذه الأدوات في صفحات المنصة الحالية، وقد يظهر تنقّل الموقع. الشراء والمناقشات غير متاحة داخل التطبيق.',
    unavailableAction: 'هذا القسم غير متاح في نسخة iPhone للتعلّم. يمكنك متابعة دروسك والأدوات المتاحة أدناه.'
  },
  fr: {
    welcome: 'Bienvenue sur Madrasa', welcomeIntro: 'Vos cours et vos révisions au même endroit.', noAccount: 'Pas encore de compte ?',
    learnIntro: 'Reprenez vos cours et entraînez-vous.', freeForAll: 'Gratuit pour tous', lessonsCount: 'leçons',
    studentOnlyTitle: 'Cette application est réservée aux élèves', logout: 'Se déconnecter',
    studentOnlyBody: 'Vous êtes connecté avec un compte enseignant ou administrateur. Gérez vos cours sur madrasadz.com depuis un navigateur, ou déconnectez-vous pour utiliser un compte élève.',
    home: 'Apprendre', account: 'Mon compte', login: 'Connexion', register: 'Créer un compte',
    intro: 'Retrouvez votre compte, ajoutez des cours aux favoris et organisez vos révisions dans les onglets de l’application.',
    mode: 'Version iPhone consacrée à l’apprentissage : achats, activation par code et discussions indisponibles.',
    courses: 'Mes cours', publicLessons: 'Leçons accessibles à tous', noCourses: 'Aucun cours actif sur votre compte actuellement.',
    noLessons: 'Aucune leçon publiée dans cette section.', open: 'Continuer', ended: 'Accès expiré',
    videos: 'Vidéos', lessons: 'Leçons et fichiers', upcoming: 'Calendrier des séances', noContent: 'Aucun contenu publié.',
    privacy: 'Confidentialité', otherRole: 'Cette version est réservée aux comptes élèves.', unavailable: 'Ce contenu n’est pas accessible à votre compte actuellement.',
    back: 'Retour aux cours', rights: 'Le serveur vérifie votre compte et vos droits à chaque ouverture.',
    practice: 'S’entraîner et se tester', play: 'Entraînement PLAY', exercises: 'Exercices', quizzes: 'Quiz', exams: 'Examens',
    webTools: 'Ces outils utilisent les pages actuelles de la plateforme, dont la navigation peut apparaître. Les achats et les discussions restent indisponibles dans l’application.',
    unavailableAction: 'Cette section n’est pas disponible dans la version iPhone dédiée à l’apprentissage. Retrouvez les leçons et les outils ci-dessous.'
  },
  en: {
    welcome: 'Welcome to Madrasa', welcomeIntro: 'Your lessons and revision in one place.', noAccount: 'No account yet?',
    learnIntro: 'Continue your courses and practise what you learned.', freeForAll: 'Free for everyone', lessonsCount: 'lessons',
    studentOnlyTitle: 'This app is for students', logout: 'Sign out',
    studentOnlyBody: 'You are signed in with a teacher or admin account. Manage your courses on madrasadz.com in a browser, or sign out to use a student account.',
    home: 'Learn', account: 'My account', login: 'Sign in', register: 'Create account',
    intro: 'Use your existing account, bookmark lessons and organise revision in the app’s native tabs.',
    mode: 'Learning-only iPhone version: purchases, code activation and discussions are unavailable.',
    courses: 'My courses', publicLessons: 'Public lessons', noCourses: 'No active courses on your account at present.',
    noLessons: 'No lessons have been published in this section.', open: 'Continue learning', ended: 'Access expired',
    videos: 'Videos', lessons: 'Lessons and files', upcoming: 'Session schedule', noContent: 'No published content yet.',
    privacy: 'Privacy', otherRole: 'This version is for student accounts.', unavailable: 'This content is not currently available to your account.',
    back: 'Back to learning', rights: 'Your account and access rights are checked by the server whenever content is opened.',
    practice: 'Practise and test yourself', play: 'PLAY practice', exercises: 'Practice exercises', quizzes: 'Quizzes', exams: 'Exams',
    webTools: 'These tools open existing platform pages and may display website navigation. Purchases and discussions remain unavailable in the app.',
    unavailableAction: 'This section is unavailable in the learning-only iPhone version. Continue with the lessons and tools below.'
  }
}

export function iosLabels(locale: Locale) { return labels[locale] }
