import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Chat } from '@google/genai';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface EDiaryEntry {
  classwork: string;
  homework: string;
  notes: string;
  thematicPlanning: string;
  individualWork: string;
}

interface LessonPlan {
  generalNotes: string;
  lessonOverview: {
    topic: string;
    goal: string;
    competencies: string;
    evaluation: string;
  };
  lessonActivities: {
    gifted: string;
    general: string;
    struggling: string;
  };
  homework: {
    purpose: string;
    gifted: string;
    general: string;
    struggling: string;
  };
  eDiaryEntry: EDiaryEntry;
  motivation: string;
}

interface SavedPlan {
  id: string;
  title: string;
  plan: LessonPlan;
  createdAt: string;
}


const glossaryData: { [key: string]: string } = {
  'Diferencijuotos': 'Tai mokymo strategija, kai mokytojas pritaiko ugdymo turinį, procesą, aplinką ir vertinimą, atsižvelgdamas į skirtingus mokinių mokymosi poreikius, gebėjimus ir interesus.',
  'Diferencijuoti': 'Tai mokymo strategija, kai mokytojas pritaiko ugdymo turinį, procesą, aplinką ir vertinimą, atsižvelgdamas į skirtingus mokinių mokymosi poreikius, gebėjimus ir interesus.',
  'Formuojamasis vertinimas': 'Nuolatinis vertinimas pamokoje, skirtas stebėti mokinio pažangą, suprasti jo mokymosi sunkumus ir laiku suteikti pagalbą. Jo tikslas – gerinti mokymąsi, o ne rašyti pažymį.',
  'Kaupiamasis vertinimas': 'Vertinimo būdas, kai per tam tikrą laikotarpį surinkti mokinio pasiekimų įrodymai (pvz., taškai už užduotis, aktyvumą) sumuojami į vieną bendrą įvertinimą (pažymį).',
  'Diagnostinis vertinimas': 'Vertinimas, atliekamas temos ar kurso pradžioje, siekiant nustatyti esamas mokinių žinias, gebėjimus ir supratimą. Padeda mokytojui planuoti tolesnį mokymą.',
  'Kompetencijos': 'Gebėjimas atlikti tam tikrą veiklą, remiantis įgytomis žiniomis, įgūdžiais, vertybėmis ir požiūriais. Lietuvos ugdymo sistemoje išskiriamos kelios pagrindinės kompetencijos (pvz., komunikavimo, pažinimo, socialinė, pilietinė).',
  'Gebėjimai': 'Mokinio įgytos žinios ir įgūdžiai, leidžiantys jam sėkmingai atlikti tam tikras užduotis ar veiklas. Gebėjimai yra kompetencijų sudedamoji dalis.'
};


const App = () => {
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [activities, setActivities] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [refinement, setRefinement] = useState('');

  const [evaluationType, setEvaluationType] = useState('Formuojamasis');
  const [customEvaluationType, setCustomEvaluationType] = useState('');
  const [evaluationDescription, setEvaluationDescription] = useState('');

  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isAllCopied, setIsAllCopied] = useState(false);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [pdfSettings, setPdfSettings] = useState({
    includeGeneralNotes: true,
    includeLessonOverview: true,
    includeLessonActivities: true,
    includeHomework: true,
    includeEDiaryEntry: true,
    includeMotivation: true,
    fontSizes: {
      generalNotes: 'medium',
      lessonOverview: 'medium',
      lessonActivities: 'medium',
      homework: 'medium',
      eDiaryEntry: 'medium',
      motivation: 'small',
    },
    isCompactLayout: false,
  });
  
  const [selectedTerm, setSelectedTerm] = useState<{ term: string; definition: string; } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);


  const chatRef = useRef<Chat | null>(null);
  
  useEffect(() => {
    // Load onboarding status from local storage
    const onboardingComplete = localStorage.getItem('onboardingComplete');
    if (!onboardingComplete) {
      setShowOnboarding(true);
    }
    
    // Load saved plans from local storage
    try {
      const storedPlans = localStorage.getItem('savedLessonPlans');
      if (storedPlans) {
        setSavedPlans(JSON.parse(storedPlans));
      }
    } catch (error) {
      console.error("Nepavyko įkelti planų iš vietinės saugyklos:", error);
    }
  }, []);

  useEffect(() => {
    // Save plans to local storage whenever they change
    try {
      localStorage.setItem('savedLessonPlans', JSON.stringify(savedPlans));
    } catch (error) {
      console.error("Nepavyko išsaugoti planų vietinėje saugykloje:", error);
    }
  }, [savedPlans]);


  const systemInstruction = `Tu esi ekspertas pedagogas ir pamokų planavimo asistentas, puikiai išmanantis Lietuvos bendrąsias ugdymo programas (pasiekiamas https://emokykla.lt/bendrosios-programos/visos-bendrosios-programos). Tavo tikslas - padėti mokytojams kurti išsamius, strukturuotus ir diferencijuotus pamokų planus. Visada atsakyk lietuvių kalba.
Tavo atsakas privalo būti JSON formatu, griežtai laikantis šios struktūros:
{
  "generalNotes": "Bendros pastabos, komentarai ar priminimai mokytojui apie pamoką, kurie netelpa į kitas skiltis. Pvz., 'Nepamiršti patikrinti sąsiuvinių.' arba 'Paruošti interaktyvią lentą prieš pamoką.'. Jei pastabų nėra, šis laukas turi būti tuščias stringas.",
  "lessonOverview": {
    "topic": "Pamokos tema",
    "goal": "Pamokos tikslas ir uždaviniai",
    "competencies": "Pagrindiniai gebėjimai pagal Bendrąsiąs Programas",
    "evaluation": "Aprašymas, kaip bus vertinami mokiniai pamokoje, ir kokie vertinimo kriterijai bus taikomi. Pvz., 'Mokiniai bus vertinami kaupiamuoju balu už aktyvų dalyvavimą diskusijoje ir teisingai atliktą praktinę užduotį.'"
  },
  "lessonActivities": {
    "gifted": "Veiklos gabesniems mokiniams",
    "general": "Veiklos bendro lygio mokiniams",
    "struggling": "Veiklos pagalbos reikalingiems mokiniams"
  },
  "homework": {
    "purpose": "Namų darbų tikslas ir sąsajos su pamoka. Aprašymas turi būti motyvuojantis ir aiškiai paaiškinti, kodėl užduotis svarbi (pvz., 'kad geriau prisimintumėte, ką šiandien išmokome', 'kad įtvirtintumėte gebėjimą...', 'kad pasiruoštumėte rytojaus diskusijai apie...').",
    "gifted": "Užduotis gabesniems mokiniams",
    "general": "Užduotis bendro lygio mokiniams",
    "struggling": "Užduotis pagalbos reikalingiems mokiniams"
  },
  "eDiaryEntry": {
    "classwork": "Trumpas ir aiškus pamokos temos pavadinimas, tinkamas įrašyti į dienyno 'Klasės darbai' skiltį. Pvz.: 'Dviejų skaitmenų skaičių sudėtis'.",
    "homework": "Suformuluota namų darbų užduotis, tinkama įrašyti į dienyno 'Namų darbai' skiltį. Pvz.: 'Pratybų sąsiuvinis, p. 25, 3 pratimas.'. Jei namų darbai neskiriami, nurodyk 'Neskirta'.",
    "notes": "Pastabos apie pamoką, pvz., apie vertinimą ar priminimus mokiniams, tinkamos įrašyti į dienyno 'Pastabos apie pamoką' skiltį. Pvz.: 'Mokiniai bus vertinami už aktyvumą pamokoje.'",
    "thematicPlanning": "Temos pavadinimas iš teminio plano. Pvz., '2.3. Trupmenų sudėtis ir atimtis'.",
    "individualWork": "Pastabos apie individualų darbą su mokiniais, diferencijavimą ar pagalbą. Pvz., 'Kornelijui sekėsi puikiai, o Augustei reikia papildomos pagalbos su...'"
  },
  "motivation": "Trumpa, įkvepianti, motyvuojanti žinutė mokytojui, girianti jo darbą ir pastangas."
}
Nesvarbu, koks vartotojo prašymas, tavo atsakas privalo būti tik šis JSON objektas, be jokio papildomo teksto ar paaiškinimų.`;
    
  const handleGenerate = async (prompt: string, isInitial: boolean) => {
      if (!isInitial && !chatRef.current) {
          setError("Pokalbis nepradėtas. Pirmiausia sugeneruokite planą.");
          return;
      }
      
      setIsLoading(true);
      setError(null);

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
          
          if (isInitial || !chatRef.current) {
              const chat = ai.chats.create({
                  model: 'gemini-2.5-flash',
                  config: {
                      systemInstruction: systemInstruction,
                      responseMimeType: "application/json",
                  },
              });
              chatRef.current = chat;
          }
          
          if (!chatRef.current) throw new Error("Nepavyko sukurti pokalbio.");

          const result = await chatRef.current.sendMessage({ message: prompt });
          const text = result.text.trim();
          
          const jsonString = text.replace(/```json|```/g, '').trim();

          const parsedPlan: LessonPlan = JSON.parse(jsonString);
          setLessonPlan(parsedPlan);
          setActivePlanId(null); // Mark as new, unsaved plan
      } catch (e: any) {
          console.error(e);
          setError(`Atsiprašome, įvyko klaida generuojant planą. Pabandykite dar kartą. Klaidos detalės: ${e.message}`);
          setLessonPlan(null);
      } finally {
          setIsLoading(false);
      }
  };

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade || !subject || !topic) {
      setError('Būtina nurodyti klasę, dalyką ir temą.');
      return;
    }
    
    let evaluationPrompt = '';
    if (evaluationDescription) {
        const finalEvalType = evaluationType === 'Kitas' && customEvaluationType ? customEvaluationType : evaluationType;
        evaluationPrompt = `\n- Vertinimo tipas: ${finalEvalType}\n- Vertinimo aprašymas: ${evaluationDescription}`;
    }

    const prompt = `Sukurk pamokos planą.
- Klasė: ${grade}
- Dalykas: ${subject}
- Pamokos tema: ${topic}
${goal ? `- Pamokos tikslas: ${goal}` : ''}
${activities ? `- Papildomos idėjos ar veiklos: ${activities}` : ''}
${generalNotes ? `- Bendros pastabos: ${generalNotes}` : ''}${evaluationPrompt}
Sugeneruok planą.`;
    
    handleGenerate(prompt, true);
  };
    
  const handleRefinementSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!refinement) {
          setError("Įveskite patikslinimo tekstą.");
          return;
      }
      handleGenerate(refinement, false);
      setRefinement('');
  }

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text).then(() => {
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
  };

  const handleCopyAllDiaryEntries = () => {
    if (!lessonPlan || !lessonPlan.eDiaryEntry) return;

    const { classwork, homework, notes, thematicPlanning, individualWork } = lessonPlan.eDiaryEntry;
    
    const allEntriesText = `Klasės darbas: ${classwork}\n\nNamų darbai: ${homework}\n\nPastabos apie pamoką: ${notes}\n\nTeminis planavimas: ${thematicPlanning}\n\nIndividualus darbas: ${individualWork}`;

    navigator.clipboard.writeText(allEntriesText).then(() => {
        setIsAllCopied(true);
        setTimeout(() => setIsAllCopied(false), 2000);
    }).catch(err => {
        console.error('Failed to copy all diary entries: ', err);
    });
  };

  const handlePdfSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setPdfSettings(prev => ({ ...prev, [name]: checked }));
  };
  
  const handleFontSizeChange = (section: keyof typeof pdfSettings.fontSizes, value: string) => {
    setPdfSettings(prev => ({
      ...prev,
      fontSizes: {
        ...prev.fontSizes,
        [section]: value,
      },
    }));
  };

  const handleCompactLayoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setPdfSettings(prev => ({ ...prev, isCompactLayout: checked }));
  };

  const openExportModal = () => {
    setExportSuccess(false);
    setExportError(null);
    setIsExportModalOpen(true);
  };

  const handleExportPDF = async () => {
    const contentContainer = document.getElementById('lesson-plan-content');
    if (!contentContainer || !lessonPlan) return;

    setIsExporting(true);
    setExportSuccess(false);
    setExportError(null);

    const sectionMap: { [key: string]: keyof typeof pdfSettings.fontSizes } = {
        'general-notes-card': 'generalNotes',
        'lesson-overview-card': 'lessonOverview',
        'lesson-activities-card': 'lessonActivities',
        'homework-card': 'homework',
        'ediary-card': 'eDiaryEntry',
        'motivation-card': 'motivation'
    };
    
    const cards = Array.from(contentContainer.querySelectorAll('.card'));
    const visibleCards = cards.filter(card => {
        if (card.classList.contains('general-notes-card') && !pdfSettings.includeGeneralNotes) return false;
        if (card.classList.contains('lesson-overview-card') && !pdfSettings.includeLessonOverview) return false;
        if (card.classList.contains('lesson-activities-card') && !pdfSettings.includeLessonActivities) return false;
        if (card.classList.contains('homework-card') && !pdfSettings.includeHomework) return false;
        if (card.classList.contains('ediary-card') && !pdfSettings.includeEDiaryEntry) return false;
        if (card.classList.contains('motivation-card') && !pdfSettings.includeMotivation) return false;
        return true;
    }).map(card => card as HTMLElement);

    const hiddenElements: HTMLElement[] = [];
    try {
        const layoutClass = pdfSettings.isCompactLayout ? 'export-layout-compact' : '';
        if (layoutClass) contentContainer.classList.add(layoutClass);

        const uiElementsToHide = contentContainer.querySelectorAll('.copy-button, .copy-all-button, .refinement-container, .glossary-term');
        uiElementsToHide.forEach(el => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.visibility = 'hidden';
            hiddenElements.push(htmlEl);
        });

        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pdfWidth - margin * 2;
        let yPos = margin;
        
        for (let i = 0; i < visibleCards.length; i++) {
            const card = visibleCards[i];
            const sectionClass = Object.keys(sectionMap).find(c => card.classList.contains(c));
            const sectionKey = sectionClass ? sectionMap[sectionClass] : null;
            
            let fontClass = '';
            if (sectionKey) {
              const fontSize = pdfSettings.fontSizes[sectionKey];
              fontClass = `export-font-${fontSize}`;
              card.classList.add(fontClass);
            }

            const canvas = await html2canvas(card, { scale: 2 });
            
            if (fontClass) {
              card.classList.remove(fontClass);
            }

            const imgData = canvas.toDataURL('image/png');
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * contentWidth) / imgProps.width;

            if (yPos + imgHeight > pageHeight - margin && yPos > margin) {
                pdf.addPage();
                yPos = margin;
            }

            pdf.addImage(imgData, 'PNG', margin, yPos, contentWidth, imgHeight);
            yPos += imgHeight + 5;
        }
        
        const cleanTopic = lessonPlan.lessonOverview.topic.toLowerCase().replace(/[^a-z0-9ąčęėįšųūž]+/g, ' ').trim().replace(/\s+/g, '-');
        pdf.save(`pamokos-planas-${cleanTopic}.pdf`);
        
        setExportSuccess(true);
        setTimeout(() => {
            setIsExportModalOpen(false);
        }, 2500);

    } catch (error) {
        console.error("Klaida eksportuojant PDF:", error);
        setExportError("Nepavyko eksportuoti PDF. Bandykite dar kartą.");
    } finally {
        const layoutClass = pdfSettings.isCompactLayout ? 'export-layout-compact' : '';
        if (layoutClass) contentContainer.classList.remove(layoutClass);
        hiddenElements.forEach(el => (el.style.visibility = 'visible'));
        setIsExporting(false);
    }
  };

  const handleSavePlan = () => {
    if (!lessonPlan) return;
    const topic = lessonPlan.lessonOverview.topic || 'Neįvardinta tema';
    const date = new Date().toLocaleDateString('lt-LT', { day: '2-digit', month: '2-digit' });
    const title = `${topic} (${date})`;
    const newPlan: SavedPlan = {
      id: `plan-${Date.now()}`,
      title,
      plan: lessonPlan,
      createdAt: new Date().toISOString(),
    };
    setSavedPlans(prevPlans => [newPlan, ...prevPlans]);
    setActivePlanId(newPlan.id);
  };

  const handleLoadPlan = (planId: string) => {
    const planToLoad = savedPlans.find(p => p.id === planId);
    if (planToLoad) {
      setLessonPlan(planToLoad.plan);
      setActivePlanId(planToLoad.id);
    }
  };

  const handleDeletePlan = (planId: string) => {
    if (window.confirm('Ar tikrai norite ištrinti šį planą?')) {
      setSavedPlans(prevPlans => prevPlans.filter(p => p.id !== planId));
      if (activePlanId === planId) {
        setLessonPlan(null);
        setActivePlanId(null);
      }
    }
  };


  const renderTextWithGlossaryTerms = (text: string) => {
    if (!text) return text;

    const terms = Object.keys(glossaryData);
    const regex = new RegExp(`\\b(${terms.join('|')})\\b`, 'gi');
  
    const parts = text.split(regex);
  
    return parts.map((part, index) => {
      const lowerCasePart = part.toLowerCase();
      const originalTerm = terms.find(term => term.toLowerCase() === lowerCasePart);
  
      if (originalTerm) {
        return (
          <span
            key={index}
            className="glossary-term"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTerm({ term: originalTerm, definition: glossaryData[originalTerm] })
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {renderTextWithGlossaryTerms(line)}
        <br />
      </React.Fragment>
    ));
  };

  const closeOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('onboardingComplete', 'true');
  };

  const evaluationOptions = ['Formuojamasis', 'Kaupiamasis', 'Diagnostinis', 'Tarpusavio vertinimas', 'Kitas'];
  
  const pdfSections: {key: keyof typeof pdfSettings.fontSizes, includeKey: keyof typeof pdfSettings, label: string}[] = [
    { key: 'generalNotes', includeKey: 'includeGeneralNotes', label: 'Bendros pastabos' },
    { key: 'lessonOverview', includeKey: 'includeLessonOverview', label: 'Pamokos apžvalga' },
    { key: 'lessonActivities', includeKey: 'includeLessonActivities', label: 'Pamokos veiklos' },
    { key: 'homework', includeKey: 'includeHomework', label: 'Namų darbai' },
    { key: 'eDiaryEntry', includeKey: 'includeEDiaryEntry', label: 'El. dienyno įrašas' },
    { key: 'motivation', includeKey: 'includeMotivation', label: 'Motyvacija' },
  ];

  const onboardingSteps = [
    {
      title: 'Sveiki atvykę į Pamokos plano pagalbininką!',
      content: 'Šis trumpas gidas padės jums susipažinti su pagrindinėmis programėlės funkcijomis. Pradėkime!'
    },
    {
      title: '1. Užpildykite informaciją',
      content: "Kairėje pusėje esančioje formoje įveskite pagrindinius pamokos duomenis: klasę, dalyką ir temą. Kuo detalesnę informaciją pateiksite, tuo tikslesnis bus sugeneruotas planas."
    },
    {
      title: '2. Sugeneruokite planą',
      content: "Užpildę formą, paspauskite mygtuką 'Pateikti pamokos aprašą'. Mūsų dirbtinio intelekto asistentas per kelias akimirkas sukurs išsamų pamokos planą."
    },
    {
      title: '3. Peržiūrėkite ir tikslinkite',
      content: "Dešinėje atsiras jūsų planas, suskirstytas į patogias skiltis. Jei norite ką nors pakeisti, apačioje esančiame laukelyje įrašykite savo pageidavimą (pvz., 'pridėk žaidimą') ir atnaujinkite planą."
    },
    {
      title: '4. Kopijuokite, išsaugokite ir eksportuokite',
      content: "Patogiai kopijuokite dienyno įrašus, išsaugokite planą vėlesniam naudojimui, o kai jis bus tobulas, paspauskite 'Eksportuoti į PDF' ir pritaikykite dokumento išvaizdą."
    },
    {
      title: 'Viskas paruošta!',
      content: 'Dabar esate pasiruošę kurti nuostabias pamokas. Sėkmės!'
    }
  ];

  return (
    <div className="container">
      <header className="header">
        <h1>Pamokos plano pagalbininkas ✏️</h1>
        <p>Jūsų pagalbininkas kūrybiškoms ir efektyvioms pamokoms</p>
        <div className="header-buttons">
            <button
                onClick={() => { setOnboardingStep(0); setShowOnboarding(true); }}
                className="external-link-button"
            >
              Kaip naudotis?
            </button>
            <a 
              href="https://emokykla.lt/bendrosios-programos/visos-bendrosios-programos" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="external-link-button"
            >
              Visos bendrosios programos
            </a>
        </div>
      </header>
      <main className="main-content">
        <div className="form-container">
          <h2>Pamokos informacija</h2>
          <form onSubmit={handleInitialSubmit}>
            <div className="form-group">
              <div className="label-wrapper">
                <label htmlFor="grade">Klasė / Grupė <span className="required">*</span></label>
                <div className="tooltip">
                    <span className="tooltip-icon">ⓘ</span>
                    <p className="tooltip-text">Nurodykite klasę, pvz., 7a, arba grupę darželyje, pvz., 'Drugelių' grupė.</p>
                </div>
              </div>
              <input type="text" id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="pvz., 5b klasė, 'Varpelių' grupė" required />
            </div>
            <div className="form-group">
              <div className="label-wrapper">
                <label htmlFor="subject">Dalykas <span className="required">*</span></label>
                <div className="tooltip">
                    <span className="tooltip-icon">ⓘ</span>
                    <p className="tooltip-text">Įveskite pamokos dalyką, pvz., Lietuvių kalba ir literatūra, Dailė.</p>
                </div>
              </div>
              <input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="pvz., Matematika, Pasaulio pažinimas" required/>
            </div>
            <div className="form-group">
              <div className="label-wrapper">
                <label htmlFor="topic">Pamokos tema <span className="required">*</span></label>
                <div className="tooltip">
                    <span className="tooltip-icon">ⓘ</span>
                    <p className="tooltip-text">Kuo konkretesnė tema, tuo geresnis planas. Pvz., 'Veiksmažodžių asmenavimas', 'Rudens peizažas'.</p>
                </div>
              </div>
              <input type="text" id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="pvz., Trupmenų sudėtis, K. Donelaičio 'Metai'" required/>
            </div>
            <div className="form-group">
              <div className="label-wrapper">
                <label htmlFor="goal">Pamokos tikslas ir uždaviniai (nebūtina)</label>
                <div className="tooltip">
                    <span className="tooltip-icon">ⓘ</span>
                    <p className="tooltip-text">Nebūtina, bet padeda sukurti tikslesnį planą. Galite nurodyti, ką mokiniai išmoks arba gebės atlikti.</p>
                </div>
              </div>
              <textarea id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Aprašykite, ką mokiniai turėtų žinoti, suprasti ar gebėti padaryti po šios pamokos. Pvz., 'Mokiniai gebės atpažinti ir įvardinti pagrindines K. Donelaičio poemos 'Metai' temos.'"></textarea>
            </div>
            <div className="form-group">
              <div className="label-wrapper">
                <label htmlFor="activities">Papildomos idėjos ar veiklos (nebūtina)</label>
                 <div className="tooltip">
                    <span className="tooltip-icon">ⓘ</span>
                    <p className="tooltip-text">Pateikite savo idėjų, kurias asistentas galėtų išplėtoti. Pvz., 'Darbas grupėse su plakatais', 'Debatai'.</p>
                </div>
              </div>
              <textarea id="activities" value={activities} onChange={(e) => setActivities(e.target.value)} placeholder="Pasiūlykite metodų, žaidimų ar kitų veiklų, kurias norėtumėte įtraukti. Pvz., 'Diskusija porose apie metų laikų svarbą', 'Interaktyvi viktorina su Kahoot!'"></textarea>
            </div>
            <div className="form-group">
              <div className="label-wrapper">
                <label htmlFor="generalNotes">Bendros pastabos mokytojui (nebūtina)</label>
                <div className="tooltip">
                    <span className="tooltip-icon">ⓘ</span>
                    <p className="tooltip-text">Vieta Jūsų asmeniniams priminimams: reikalingos priemonės, organizaciniai klausimai ir pan.</p>
                </div>
              </div>
              <textarea id="generalNotes" value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Įrašykite bet kokius priminimus sau: reikalingos priemonės, organizaciniai klausimai ir kt. Pvz., 'Paruošti 5 lapus su užduotimis grupėms.'"></textarea>
            </div>
            <div className="form-group">
                <div className="label-wrapper">
                    <label>Vertinimas ir įsivertinimas (nebūtina)</label>
                     <div className="tooltip">
                        <span className="tooltip-icon">ⓘ</span>
                        <p className="tooltip-text">Aprašykite, kaip vertinsite mokinius. Pvz., 'Mokiniai vertins vieni kitų darbus', 'Užduoties atlikimas vertinamas kaupiamuoju balu'.</p>
                    </div>
                </div>
                <div className="radio-group">
                    {evaluationOptions.map((option) => (
                        <div key={option} className="radio-option">
                            <input
                                type="radio"
                                id={`eval-${option}`}
                                name="evaluationType"
                                value={option}
                                checked={evaluationType === option}
                                onChange={(e) => setEvaluationType(e.target.value)}
                            />
                            <label htmlFor={`eval-${option}`}>{option}</label>
                        </div>
                    ))}
                </div>
                {evaluationType === 'Kitas' && (
                    <div className="form-group" style={{ marginTop: '0.75rem' }}>
                         <label htmlFor="custom-eval-type" className="sr-only">Jūsų vertinimo tipas</label>
                         <input
                            type="text"
                            id="custom-eval-type"
                            value={customEvaluationType}
                            onChange={(e) => setCustomEvaluationType(e.target.value)}
                            placeholder="Įveskite savo vertinimo tipą, pvz., savęs įsivertinimas"
                         />
                    </div>
                )}
                <textarea
                    id="evaluation"
                    value={evaluationDescription}
                    onChange={(e) => setEvaluationDescription(e.target.value)}
                    placeholder="Nurodykite vertinimo kriterijus ar būdus. Pvz., 'Už teisingai atliktus 3 iš 5 pratimo veiksmus mokinys gaus kaupiamąjį tašką.' arba 'Mokiniai stebės vieni kitų pristatymus ir pateiks grįžtamąjį ryšį pagal pateiktus kriterijus.'"
                    style={{ marginTop: '0.75rem' }}
                ></textarea>
            </div>
            <button type="submit" disabled={isLoading} className="generate-button">
              {isLoading && !lessonPlan ? <div className="spinner"></div> : null}
              Pateikti pamokos aprašą
            </button>
          </form>
          <div className="saved-plans-container">
            <h3>Išsaugoti planai</h3>
            {savedPlans.length > 0 ? (
              <ul className="saved-plans-list">
                {savedPlans.map(plan => (
                  <li key={plan.id} className={plan.id === activePlanId ? 'active' : ''} onClick={() => handleLoadPlan(plan.id)}>
                    <span className="plan-title">
                      {plan.title}
                      <small>{new Date(plan.createdAt).toLocaleDateString('lt-LT')}</small>
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }} className="delete-button" aria-label="Ištrinti planą">✖</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-saved-plans">Išsaugotų planų nėra.</p>
            )}
          </div>
        </div>
        <div className="results-container">
            {isLoading && !lessonPlan && (
                <div className="loading-overlay">
                    <div className="spinner-large"></div>
                    <p>Generuojamas planas...</p>
                </div>
            )}
            {!isLoading && !lessonPlan && !error && (
                <div className="welcome-message">
                    <h2>Sveiki, mokytojau!</h2>
                    <p>Užpildykite formą kairėje ir aš padėsiu jums sukurti tobulą pamokos planą. Jūsų darbas įkvepia!</p>
                </div>
            )}
            {error && <div className="error-message">{error}</div>}
            {lessonPlan && (
                <>
                  <div className="export-container">
                      {activePlanId === null && lessonPlan && (
                        <button onClick={handleSavePlan} className="save-button">
                            Išsaugoti planą 💾
                        </button>
                      )}
                      <button onClick={openExportModal} disabled={isExporting} className="export-button">
                          {isExporting ? 'Eksportuojama...' : 'Eksportuoti į PDF 📄'}
                      </button>
                  </div>
                  <div className="lesson-plan" id="lesson-plan-content">
                      {lessonPlan.generalNotes && (
                        <div className="card general-notes-card">
                          <h3>📌 Bendros pastabos</h3>
                          <p>{renderFormattedText(lessonPlan.generalNotes)}</p>
                        </div>
                      )}
                      <div className="card lesson-overview-card">
                          <h3>📖 Pamokos apžvalga</h3>
                          <p><strong>Tema:</strong> {lessonPlan.lessonOverview.topic}</p>
                          <p><strong>Tikslas ir uždaviniai:</strong> {renderFormattedText(lessonPlan.lessonOverview.goal)}</p>
                          <p><strong>Pagrindiniai gebėjimai (pagal Bendrąsiąs Programas):</strong> {renderFormattedText(lessonPlan.lessonOverview.competencies)}</p>
                          <p><strong>Vertinimas:</strong> {renderFormattedText(lessonPlan.lessonOverview.evaluation)}</p>
                      </div>
                      <div className="card lesson-activities-card">
                          <h3>🎨 Diferencijuotos pamokos veiklos</h3>
                          <p><strong>🚀 Gabesniems mokiniams:</strong> {renderFormattedText(lessonPlan.lessonActivities.gifted)}</p>
                          <p><strong>🙂 Bendro lygio mokiniams:</strong> {renderFormattedText(lessonPlan.lessonActivities.general)}</p>
                          <p><strong>🌱 Pagalbos reikalingiems mokiniams:</strong> {renderFormattedText(lessonPlan.lessonActivities.struggling)}</p>
                      </div>
                      <div className="card homework-card">
                          <h3>📚 Diferencijuoti namų darbai</h3>
                          <p><strong>🎯 Tikslas ir sąsajos:</strong> {renderFormattedText(lessonPlan.homework.purpose)}</p>
                          <p><strong>🚀 Gabesniems mokiniams:</strong> {renderFormattedText(lessonPlan.homework.gifted)}</p>
                          <p><strong>🙂 Bendro lygio mokiniams:</strong> {renderFormattedText(lessonPlan.homework.general)}</p>
                          <p><strong>🌱 Pagalbos reikalingiems mokiniams:</strong> {renderFormattedText(lessonPlan.homework.struggling)}</p>
                      </div>
                      {lessonPlan.eDiaryEntry && (
                          <div className="card ediary-card">
                              <h3>✍️ Siūlomas įrašas el. dienynui</h3>
                              <div className="copy-all-container">
                                  <button
                                      onClick={handleCopyAllDiaryEntries}
                                      className={`copy-all-button ${isAllCopied ? 'copied' : ''}`}
                                  >
                                      {isAllCopied ? 'Viskas nukopijuota!' : 'Kopijuoti viską į el. dienyną'}
                                  </button>
                              </div>
                              <div className="diary-entry">
                                  <label>Klasės darbas:</label>
                                  <div className="diary-field">
                                      <p>{lessonPlan.eDiaryEntry.classwork}</p>
                                      <button onClick={() => handleCopy(lessonPlan.eDiaryEntry.classwork, 'classwork')} className={`copy-button ${copiedField === 'classwork' ? 'copied' : ''}`}>
                                          {copiedField === 'classwork' ? 'Nukopijuota!' : 'Kopijuoti'}
                                      </button>
                                  </div>
                              </div>
                              <div className="diary-entry">
                                  <label>Namų darbai:</label>
                                  <div className="diary-field">
                                      <p>{lessonPlan.eDiaryEntry.homework}</p>
                                      <button onClick={() => handleCopy(lessonPlan.eDiaryEntry.homework, 'homework')} className={`copy-button ${copiedField === 'homework' ? 'copied' : ''}`}>
                                          {copiedField === 'homework' ? 'Nukopijuota!' : 'Kopijuoti'}
                                      </button>
                                  </div>
                              </div>
                              <div className="diary-entry">
                                  <label>Pastabos apie pamoką:</label>
                                  <div className="diary-field">
                                      <p>{lessonPlan.eDiaryEntry.notes}</p>
                                      <button onClick={() => handleCopy(lessonPlan.eDiaryEntry.notes, 'notes')} className={`copy-button ${copiedField === 'notes' ? 'copied' : ''}`}>
                                          {copiedField === 'notes' ? 'Nukopijuota!' : 'Kopijuoti'}
                                      </button>
                                  </div>
                              </div>
                              <div className="diary-entry">
                                  <label>Teminis planavimas:</label>
                                  <div className="diary-field">
                                      <p>{lessonPlan.eDiaryEntry.thematicPlanning}</p>
                                      <button onClick={() => handleCopy(lessonPlan.eDiaryEntry.thematicPlanning, 'thematicPlanning')} className={`copy-button ${copiedField === 'thematicPlanning' ? 'copied' : ''}`}>
                                          {copiedField === 'thematicPlanning' ? 'Nukopijuota!' : 'Kopijuoti'}
                                      </button>
                                  </div>
                              </div>
                              <div className="diary-entry">
                                  <label>Individualus darbas:</label>
                                  <div className="diary-field">
                                      <p>{lessonPlan.eDiaryEntry.individualWork}</p>
                                      <button onClick={() => handleCopy(lessonPlan.eDiaryEntry.individualWork, 'individualWork')} className={`copy-button ${copiedField === 'individualWork' ? 'copied' : ''}`}>
                                          {copiedField === 'individualWork' ? 'Nukopijuota!' : 'Kopijuoti'}
                                      </button>
                                  </div>
                              </div>
                          </div>
                      )}
                      <div className="card motivation-card">
                          <h3>💖 Ačiū tau, mokytojau!</h3>
                          <p>{lessonPlan.motivation}</p>
                      </div>
                      <div className="refinement-container">
                          <h3>Norite kažką pakeisti?</h3>
                          <form onSubmit={handleRefinementSubmit} className="refinement-form">
                              <input 
                                  type="text" 
                                  value={refinement}
                                  onChange={(e) => setRefinement(e.target.value)}
                                  placeholder="pvz., 'Sutrumpink namų darbus', 'Pridėk daugiau kūrybinių užduočių'" 
                                  disabled={isLoading}
                              />
                              <button type="submit" disabled={isLoading}>
                                  {isLoading ? <div className="spinner"></div> : 'Atnaujinti pamokos aprašą'}
                              </button>
                          </form>
                      </div>
                  </div>
                </>
            )}
        </div>
      </main>
       {isExportModalOpen && (
        <div className="modal-overlay" onClick={() => !isExporting && setIsExportModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-button" onClick={() => setIsExportModalOpen(false)} disabled={isExporting}>&times;</button>
                <h2>PDF eksportavimo nustatymai</h2>
                <div className="pdf-settings-form">
                    <div className="settings-group">
                        <h4>Įtraukti skiltis ir šrifto dydžiai</h4>
                        <div className="section-settings-list">
                          {pdfSections.map((section) => (
                            <div key={section.key as string} className="pdf-section-setting">
                              <div className="checkbox-option">
                                  <input 
                                      type="checkbox"
                                      id={`include-${section.key as string}`} 
                                      name={section.includeKey as string} 
                                      checked={pdfSettings[section.includeKey as keyof typeof pdfSettings] as boolean} 
                                      onChange={handlePdfSettingsChange} 
                                  />
                                  <label htmlFor={`include-${section.key as string}`}>{section.label}</label>
                              </div>
                              <select 
                                  name={`fontSize-${section.key as string}`}
                                  value={pdfSettings.fontSizes[section.key]} 
                                  onChange={(e) => handleFontSizeChange(section.key, e.target.value)}
                                  className="settings-select-small"
                                  disabled={!(pdfSettings[section.includeKey as keyof typeof pdfSettings] as boolean)}
                              >
                                  <option value="small">Mažas</option>
                                  <option value="medium">Vidutinis</option>
                                  <option value="large">Didelis</option>
                              </select>
                            </div>
                          ))}
                        </div>
                    </div>
                    <div className="settings-group">
                        <h4>Išdėstymas</h4>
                        <div className="checkbox-option">
                           <input type="checkbox" id="isCompactLayout" name="isCompactLayout" checked={pdfSettings.isCompactLayout} onChange={handleCompactLayoutChange} />
                           <label htmlFor="isCompactLayout">Kompaktiškas išdėstymas (mažiau paraščių)</label>
                        </div>
                    </div>
                </div>
                {exportError && <div className="error-message modal-error">{exportError}</div>}
                <div className="modal-actions">
                    {isExporting ? (
                        <div className="export-status">
                            <div className="spinner"></div>
                            <span>Generuojamas PDF, prašome palaukti...</span>
                        </div>
                    ) : exportSuccess ? (
                        <div className="export-status success">
                            <span>✅ PDF sėkmingai sugeneruotas! Atsisiuntimas prasidės netrukus.</span>
                        </div>
                    ) : (
                        <>
                            <button onClick={() => setIsExportModalOpen(false)} className="button-secondary">Atšaukti</button>
                            <button onClick={handleExportPDF} className="button-primary">Eksportuoti</button>
                        </>
                    )}
                </div>
            </div>
        </div>
      )}
      {selectedTerm && (
        <div className="modal-overlay" onClick={() => setSelectedTerm(null)}>
          <div className="modal-content glossary-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-button" onClick={() => setSelectedTerm(null)}>&times;</button>
            <h3>{selectedTerm.term}</h3>
            <p>{selectedTerm.definition}</p>
          </div>
        </div>
      )}
      {showOnboarding && (
        <div className="modal-overlay">
          <div className="modal-content onboarding-modal">
            <div className="onboarding-step-content">
                <h3>{onboardingSteps[onboardingStep].title}</h3>
                <p>{onboardingSteps[onboardingStep].content}</p>
            </div>
            <div className="onboarding-dots">
                {onboardingSteps.map((_, index) => (
                    <span
                        key={index}
                        className={`dot ${onboardingStep === index ? 'active' : ''}`}
                    ></span>
                ))}
            </div>
            <div className="onboarding-nav">
                {onboardingStep < onboardingSteps.length - 1 && (
                    <button onClick={closeOnboarding} className="button-secondary">Praleisti</button>
                )}
                 <div>
                    {onboardingStep > 0 && (
                        <button onClick={() => setOnboardingStep(s => s - 1)} className="button-secondary">Atgal</button>
                    )}
                    {onboardingStep < onboardingSteps.length - 1 ? (
                        <button onClick={() => setOnboardingStep(s => s + 1)} className="button-primary">Toliau</button>
                    ) : (
                        <button onClick={closeOnboarding} className="button-primary">Užbaigti</button>
                    )}
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);