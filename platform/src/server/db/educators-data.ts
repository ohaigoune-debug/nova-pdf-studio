/**
 * دليل أساتذة/قنوات يوتيوب للطور الثانوي — من ملف الأستاذ «دليل القنوات التعليمية – الجزائر 2026-2027» (Drive).
 * ترشيحات تُحلّ إلى قنوات حقيقية عبر YouTube API ويعتمدها المشرف؛ ليست اعتماداً رسمياً.
 */
export interface EducatorSeed {
  name: string
  /** درجة المطابقة كما في الدليل */
  note: string
  /** [رمز المادة، الترتيب في الدليل (1 = الأقوى)] */
  subjects: [string, number][]
}

export const SECONDARY_EDUCATORS: EducatorSeed[] = [
  { name: 'الأستاذ حيقون أسامة', note: 'متخصص بالأدب العربي', subjects: [['ARABIC', 1]] },
  { name: 'الأستاذ خالد للغة العربية', note: 'متخصص بالبكالوريا', subjects: [['ARABIC', 2]] },
  { name: 'الأستاذ أبو بكر – منصة اقتدار', note: 'متخصص بالأدب العربي', subjects: [['ARABIC', 3]] },
  { name: 'الأستاذ بوسيف DzTeaching', note: 'دروس ثانوية متعددة', subjects: [['ARABIC', 4]] },
  { name: 'الأستاذ نور الدين للرياضيات', note: 'متخصص بالثانوي والبكالوريا', subjects: [['MATH', 1]] },
  { name: 'الأستاذ عبد الباسط للرياضيات', note: 'متخصص بالبكالوريا', subjects: [['MATH', 2]] },
  { name: 'الأستاذ وليد مرنيز', note: 'متخصص بالبكالوريا', subjects: [['MATH', 3]] },
  { name: 'Mathyoun', note: 'متخصص بالرياضيات وشعبة رياضيات', subjects: [['MATH', 4]] },
  { name: 'Prof Ouss', note: 'متخصص بفرنسية البكالوريا', subjects: [['FRENCH', 1]] },
  { name: 'Sally français', note: 'متخصصة بفرنسية البكالوريا', subjects: [['FRENCH', 2]] },
  { name: 'الأستاذ نور الدين بركان', note: 'متخصص بفرنسية الثانوي', subjects: [['FRENCH', 3]] },
  { name: 'Mr Mansouri English & Français', note: 'متخصص باللغات', subjects: [['FRENCH', 4]] },
  { name: 'Nasri English', note: 'متخصص بالثانوي والبكالوريا', subjects: [['ENGLISH', 1]] },
  { name: 'Mister Amine', note: 'متخصص بالإنجليزية', subjects: [['ENGLISH', 2]] },
  { name: 'Miss Selsabile', note: 'متخصصة بإنجليزية البكالوريا', subjects: [['ENGLISH', 3]] },
  { name: 'English with Bilal', note: 'متخصص بإنجليزية البكالوريا', subjects: [['ENGLISH', 4]] },
  { name: 'الأستاذة بوسعادي', note: 'متخصصة بالعلوم الإسلامية', subjects: [['ISLAMIC', 1]] },
  { name: 'الأستاذ عبد الحق موسلي', note: 'متخصص بالعلوم الإسلامية', subjects: [['ISLAMIC', 2]] },
  { name: 'الأستاذ شمس الدين', note: 'متخصص بالعلوم الإسلامية', subjects: [['ISLAMIC', 3]] },
  { name: 'باك مع ياسين', note: 'قناة بكالوريا متعددة المواد', subjects: [['ISLAMIC', 4], ['GERMAN', 2], ['SPANISH', 2], ['ITALIAN', 2]] },
  { name: 'الأستاذ بورنان', note: 'متخصص بالتاريخ والجغرافيا', subjects: [['HISTGEO', 1]] },
  { name: 'Amine School', note: 'متخصص بالاجتماعيات', subjects: [['HISTGEO', 2]] },
  { name: 'الأستاذة هند', note: 'متخصصة بالاجتماعيات', subjects: [['HISTGEO', 3]] },
  { name: 'الأستاذ قنشوبة عبد الحفيظ', note: 'متخصص بالتاريخ والجغرافيا', subjects: [['HISTGEO', 4]] },
  { name: 'الأستاذ نابي ميلود', note: 'متخصص بالفلسفة', subjects: [['PHILO', 1]] },
  { name: 'الأستاذة دريسي للفلسفة', note: 'متخصصة بالفلسفة', subjects: [['PHILO', 2]] },
  { name: 'الأستاذ عبد النور خليفي', note: 'متخصص بالفلسفة', subjects: [['PHILO', 3]] },
  { name: 'موقع ابن فوغالة – فلسفة', note: 'مصدر متخصص بالفلسفة', subjects: [['PHILO', 4]] },
  { name: 'الأستاذة خيرة فليتي', note: 'متخصصة بعلوم الطبيعة', subjects: [['SCIENCES', 1]] },
  { name: 'الأستاذة كتفي شريف زينة', note: 'متخصصة بعلوم الطبيعة', subjects: [['SCIENCES', 2]] },
  { name: 'الأستاذ أيوب للعلوم', note: 'متخصص بعلوم الطبيعة', subjects: [['SCIENCES', 3]] },
  { name: 'الأستاذ شاوش', note: 'متخصص بعلوم الطبيعة والبكالوريا', subjects: [['SCIENCES', 4]] },
  { name: 'الأستاذ عبد اللطيف للفيزياء', note: 'متخصص بالبكالوريا', subjects: [['PHYSICS', 1]] },
  { name: 'محمد الأمين زيدون', note: 'متخصص بالبكالوريا', subjects: [['PHYSICS', 2]] },
  { name: 'Prof Ahmed Trir', note: 'متخصص بفيزياء الثانوي', subjects: [['PHYSICS', 3]] },
  { name: 'الأستاذ حمياني للفيزياء', note: 'متخصص بالفيزياء', subjects: [['PHYSICS', 4]] },
  { name: 'تقني رياضي هندسة كهربائية DZ', note: 'متخصص بالتقني الرياضي', subjects: [['TECHNOLOGY', 1], ['TECH_ELEC', 1], ['TECH_CIVIL', 1], ['TECH_MECA', 1], ['TECH_PROC', 1]] },
  { name: 'Cours DZ', note: 'دروس بكالوريا متعددة', subjects: [['TECHNOLOGY', 2], ['GERMAN', 1], ['SPANISH', 1], ['ITALIAN', 1], ['TECH_ELEC', 2], ['TECH_CIVIL', 2], ['TECH_MECA', 2], ['TECH_PROC', 2]] },
  { name: 'خطوة التعليمية', note: 'منصة جزائرية عامة', subjects: [['TECHNOLOGY', 3], ['COMPUTING', 1], ['GERMAN', 3], ['SPANISH', 3], ['ITALIAN', 3], ['TECH_ELEC', 3], ['TECH_CIVIL', 3], ['TECH_MECA', 3], ['TECH_PROC', 3]] },
  { name: 'الدراسة في الجزائر Eddirasa', note: 'منصة جزائرية عامة', subjects: [['TECHNOLOGY', 4], ['COMPUTING', 2], ['GERMAN', 4], ['SPANISH', 4], ['ITALIAN', 4], ['TECH_ELEC', 4], ['TECH_CIVIL', 4], ['TECH_MECA', 4], ['TECH_PROC', 4]] },
  { name: 'DzExams', note: 'منصة جزائرية عامة', subjects: [['COMPUTING', 3]] },
  { name: 'مدرسة نت', note: 'منصة جزائرية عامة', subjects: [['COMPUTING', 4]] },
  { name: 'الأستاذ عباشي', note: 'متخصص بمواد تسيير واقتصاد', subjects: [['ACCOUNTING', 1], ['ECONOMICS', 1], ['LAW', 1]] },
  { name: 'الأستاذ عبد الفتاح', note: 'متخصص بمواد تسيير واقتصاد', subjects: [['ACCOUNTING', 2], ['ECONOMICS', 2], ['LAW', 2]] },
  { name: 'Bassem Damous', note: 'محتوى تسيير واقتصاد', subjects: [['ACCOUNTING', 3], ['ECONOMICS', 3], ['LAW', 3]] },
  { name: 'Harkati Faycal HD', note: 'محتوى تسيير واقتصاد', subjects: [['ACCOUNTING', 4], ['ECONOMICS', 4], ['LAW', 4]] }
]
