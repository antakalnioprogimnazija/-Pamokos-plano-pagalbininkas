import React, { useState, useRef } from 'react';
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

const curriculumLinks = {
  'Pradinis ugdymas (1-4 kl.)': {
    'Lietuvių kalba ir literatūra': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/2-lietuviu-kalba-ir-literatura-pradinio-ugdymo-bendroji-programa/',
    'Matematika': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/3-matematika-pradinio-ugdymo-bendroji-programa/',
    'Pasaulio pažinimas': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/10-pasaulio-pazinimas-pradinio-ugdymo-bendroji-programa/',
    'Užsienio kalba (I)': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/6-uzsienio-kalba-pirmoji-pradinio-ugdymo-bendroji-programa/',
    'Meninis ugdymas (Dailė, Muzika, Šokis)': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/8-meninis-ugdymas-pradinio-ugdymo-bendroji-programa/',
  },
  'Pagrindinis ugdymas (5-10 kl.)': {
    'Lietuvių kalba ir literatūra': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/18-lietuviu-kalba-ir-literatura-pagrindinio-ir-vidurinio-ugdymo-bendrosios-programos/',
    'Matematika': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/19-matematika-pagrindinio-ir-vidurinio-ugdymo-bendrosios-programos/',
    'Gamtos mokslai (Biologija, Chemija, Fizika)': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/15-gamtos-mokslai-pagrindinio-ugdymo-bendroji-programa/',
    'Istorija': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/23-istorija-pagrindinio-ugdymo-bendroji-programa/',
    'Geografija': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/24-geografija-pagrindinio-ugdymo-bendroji-programa/',
    'Informatika': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/16-informatika-pagrindinio-ugdymo-bendroji-programa/',
    'Užsienio kalba (I)': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/20-uzsienio-kalba-pirmoji-pagrindinio-ugdymo-bendroji-programa/',
  },
  'Vidurinis ugdymas (11-12 kl.)': {
    'Lietuvių kalba ir literatūra': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/18-lietuviu-kalba-ir-literatura-pagrindinio-ir-vidurinio-ugdymo-bendrosios-programos/',
    'Matematika': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/19-matematika-pagrindinio-ir-vidurinio-ugdymo-bendrosios-programos/',
    'Biologija': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/28-biologija-vidurinio-ugdymo-bendroji-programa/',
    'Chemija': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/29-chemija-vidurinio-ugdymo-bendroji-programa/',
    'Fizika': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/30-fizika-vidurinio-ugdymo-bendroji-programa/',
    'Istorija': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/34-istorija-vidurinio-ugdymo-bendroji-programa/',
    'Geografija': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/35-geografija-vidurinio-ugdymo-bendroji-programa/',
    'Informatika': 'https://emokykla.lt/bendrosios-programos/bendroji-programa/26-informatika-vidurinio-ugdymo-bendroji-programa/',
  },
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
  const [isExporting, setIsExporting] = useState(false);
  const [isCurriculumModalOpen, setIsCurriculumModalOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [pdfSettings, setPdfSettings] = useState({
    includeGeneralNotes: true,
    includeLessonOverview: true,
    includeLessonActivities: true,
    includeHomework: true,
    includeEDiaryEntry: true,
    includeMotivation: true,
    fontSize: 'medium',
    isCompactLayout: false,
  });


  const chatRef = useRef<Chat | null>(null);

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

  const handlePdfSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setPdfSettings(prev => ({ ...prev, [name]: checked }));
    } else {
        setPdfSettings(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleExportPDF = async () => {
    const input = document.getElementById('lesson-plan-content');
    if (!input || !lessonPlan) return;

    setIsExporting(true);
    setIsExportModalOpen(false);

    const sectionSelectors = {
        includeGeneralNotes: '.general-notes-card',
        includeLessonOverview: '.lesson-overview-card',
        includeLessonActivities: '.lesson-activities-card',
        includeHomework: '.homework-card',
        includeEDiaryEntry: '.ediary-card',
        includeMotivation: '.motivation-card'
    };

    const tempClasses: { element: HTMLElement; className: string }[] = [];
    const hiddenElements: HTMLElement[] = [];

    try {
        // Apply temporary classes for export styling
        const fontClass = `export-font-${pdfSettings.fontSize}`;
        const layoutClass = pdfSettings.isCompactLayout ? 'export-layout-compact' : '';
        if (fontClass) input.classList.add(fontClass);
        if (layoutClass) input.classList.add(layoutClass);

        // Hide sections based on settings
        for (const [key, selector] of Object.entries(sectionSelectors)) {
            if (!pdfSettings[key as keyof typeof pdfSettings]) {
                const element = input.querySelector(selector) as HTMLElement;
                if (element) {
                    element.classList.add('export-hidden');
                    tempClasses.push({ element, className: 'export-hidden' });
                }
            }
        }
        
        // Hide UI elements
        const uiElementsToHide = input.querySelectorAll('.copy-button, .refinement-container');
        uiElementsToHide.forEach(el => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.visibility = 'hidden';
            hiddenElements.push(htmlEl);
        });

        // Generate PDF
        const canvas = await html2canvas(input, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        let position = 0;
        let heightLeft = pdfHeight;
        const pageHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
            position -= pageHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;
        }

        const cleanTopic = lessonPlan.lessonOverview.topic.toLowerCase().replace(/[^a-z0-9ąčęėįšųūž]+/g, ' ').trim().replace(/\s+/g, '-');
        pdf.save(`pamokos-planas-${cleanTopic}.pdf`);

    } catch (error) {
        console.error("Klaida eksportuojant PDF:", error);
        setError("Nepavyko eksportuoti PDF. Bandykite dar kartą.");
    } finally {
        // Cleanup: remove temporary classes and restore visibility
        const fontClass = `export-font-${pdfSettings.fontSize}`;
        const layoutClass = pdfSettings.isCompactLayout ? 'export-layout-compact' : '';
        if (fontClass) input.classList.remove(fontClass);
        if (layoutClass) input.classList.remove(layoutClass);

        tempClasses.forEach(({ element, className }) => element.classList.remove(className));
        hiddenElements.forEach(el => (el.style.visibility = 'visible'));
        
        setIsExporting(false);
    }
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  const evaluationOptions = ['Formuojamasis', 'Kaupiamasis', 'Diagnostinis', 'Tarpusavio vertinimas', 'Kitas'];
  
  const toggleAccordion = (category: string) => {
    setOpenAccordion(openAccordion === category ? null : category);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Pamokos plano pagalbininkas ✏️</h1>
        <p>Jūsų pagalbininkas kūrybiškoms ir efektyvioms pamokoms</p>
        <div className="header-buttons">
            <a 
              href="https://emokykla.lt/bendrosios-programos/visos-bendrosios-programos" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="external-link-button"
            >
              Visos bendrosios programos
            </a>
            <button 
                onClick={() => setIsCurriculumModalOpen(true)}
                className="external-link-button"
            >
                Programos pagal klases
            </button>
        </div>
      </header>
      <main className="main-content">
        <div className="form-container">
          <h2>Pamokos informacija</h2>
          <form onSubmit={handleInitialSubmit}>
            <div className="form-group">
              <label htmlFor="grade">Klasė / Grupė <span className="required">*</span></label>
              <input type="text" id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="pvz., 5b klasė, 'Varpelių' grupė" required />
            </div>
            <div className="form-group">
              <label htmlFor="subject">Dalykas <span className="required">*</span></label>
              <input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="pvz., Matematika, Pasaulio pažinimas" required/>
            </div>
            <div className="form-group">
              <label htmlFor="topic">Pamokos tema <span className="required">*</span></label>
              <input type="text" id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="pvz., Trupmenų sudėtis, K. Donelaičio 'Metai'" required/>
            </div>
            <div className="form-group">
              <label htmlFor="goal">Pamokos tikslas ir uždaviniai (nebūtina)</label>
              <textarea id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Aprašykite, ką mokiniai turėtų žinoti, suprasti ar gebėti padaryti po šios pamokos. Pvz., 'Mokiniai gebės atpažinti ir įvardinti pagrindines K. Donelaičio poemos 'Metai' temas.'"></textarea>
            </div>
            <div className="form-group">
              <label htmlFor="activities">Papildomos idėjos ar veiklos (nebūtina)</label>
              <textarea id="activities" value={activities} onChange={(e) => setActivities(e.target.value)} placeholder="Pasiūlykite metodų, žaidimų ar kitų veiklų, kurias norėtumėte įtraukti. Pvz., 'Diskusija porose apie metų laikų svarbą', 'Interaktyvi viktorina su Kahoot!'"></textarea>
            </div>
            <div className="form-group">
              <label htmlFor="generalNotes">Bendros pastabos mokytojui (nebūtina)</label>
              <textarea id="generalNotes" value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Įrašykite bet kokius priminimus sau: reikalingos priemonės, organizaciniai klausimai ir kt. Pvz., 'Paruošti 5 lapus su užduotimis grupėms.'"></textarea>
            </div>
            <div className="form-group">
                <label>Vertinimas ir įsivertinimas (nebūtina)</label>
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
                      <button onClick={() => setIsExportModalOpen(true)} disabled={isExporting} className="export-button">
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
      {isCurriculumModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCurriculumModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-button" onClick={() => setIsCurriculumModalOpen(false)}>&times;</button>
            <h2>Bendrosios ugdymo programos</h2>
            <div className="accordion">
              {Object.entries(curriculumLinks).map(([category, links]) => (
                <div className="accordion-item" key={category}>
                  <button className="accordion-header" onClick={() => toggleAccordion(category)}>
                    <span>{category}</span>
                    <span className={`accordion-icon ${openAccordion === category ? 'open' : ''}`}>&#9660;</span>
                  </button>
                  {openAccordion === category && (
                    <div className="accordion-content">
                      <ul>
                        {Object.entries(links).map(([subject, url]) => (
                          <li key={subject}>
                            <a href={url} target="_blank" rel="noopener noreferrer">{subject}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
       {isExportModalOpen && (
        <div className="modal-overlay" onClick={() => setIsExportModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-button" onClick={() => setIsExportModalOpen(false)}>&times;</button>
                <h2>PDF eksportavimo nustatymai</h2>
                <div className="pdf-settings-form">
                    <div className="settings-group">
                        <h4>Įtraukti skiltis</h4>
                        <div className="checkbox-grid">
                            <div className="checkbox-option">
                                <input type="checkbox" id="includeGeneralNotes" name="includeGeneralNotes" checked={pdfSettings.includeGeneralNotes} onChange={handlePdfSettingsChange} />
                                <label htmlFor="includeGeneralNotes">Bendros pastabos</label>
                            </div>
                            <div className="checkbox-option">
                                <input type="checkbox" id="includeLessonOverview" name="includeLessonOverview" checked={pdfSettings.includeLessonOverview} onChange={handlePdfSettingsChange} />
                                <label htmlFor="includeLessonOverview">Pamokos apžvalga</label>
                            </div>
                            <div className="checkbox-option">
                                <input type="checkbox" id="includeLessonActivities" name="includeLessonActivities" checked={pdfSettings.includeLessonActivities} onChange={handlePdfSettingsChange} />
                                <label htmlFor="includeLessonActivities">Pamokos veiklos</label>
                            </div>
                            <div className="checkbox-option">
                                <input type="checkbox" id="includeHomework" name="includeHomework" checked={pdfSettings.includeHomework} onChange={handlePdfSettingsChange} />
                                <label htmlFor="includeHomework">Namų darbai</label>
                            </div>
                            <div className="checkbox-option">
                                <input type="checkbox" id="includeEDiaryEntry" name="includeEDiaryEntry" checked={pdfSettings.includeEDiaryEntry} onChange={handlePdfSettingsChange} />
                                <label htmlFor="includeEDiaryEntry">El. dienyno įrašas</label>
                            </div>
                             <div className="checkbox-option">
                                <input type="checkbox" id="includeMotivation" name="includeMotivation" checked={pdfSettings.includeMotivation} onChange={handlePdfSettingsChange} />
                                <label htmlFor="includeMotivation">Motyvacija</label>
                            </div>
                        </div>
                    </div>
                    <div className="settings-group">
                        <h4>Išvaizda</h4>
                        <div className="form-group">
                          <label htmlFor="fontSize">Šrifto dydis</label>
                          <select id="fontSize" name="fontSize" value={pdfSettings.fontSize} onChange={handlePdfSettingsChange} className="settings-select">
                              <option value="small">Mažas</option>
                              <option value="medium">Vidutinis</option>
                              <option value="large">Didelis</option>
                          </select>
                        </div>
                        <div className="checkbox-option">
                           <input type="checkbox" id="isCompactLayout" name="isCompactLayout" checked={pdfSettings.isCompactLayout} onChange={handlePdfSettingsChange} />
                           <label htmlFor="isCompactLayout">Kompaktiškas išdėstymas (mažiau paraščių)</label>
                        </div>
                    </div>
                </div>
                <div className="modal-actions">
                    <button onClick={() => setIsExportModalOpen(false)} className="button-secondary">Atšaukti</button>
                    <button onClick={handleExportPDF} className="button-primary" disabled={isExporting}>
                        {isExporting ? 'Eksportuojama...' : 'Eksportuoti'}
                    </button>
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