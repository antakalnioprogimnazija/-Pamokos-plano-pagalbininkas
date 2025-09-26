import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Chat } from '@google/genai';

interface EDiaryEntry {
  classwork: string;
  homework: string;
  notes: string;
}

interface LessonPlan {
  lessonOverview: {
    topic: string;
    goal: string;
    competencies: string;
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

const App = () => {
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [activities, setActivities] = useState('');
  const [refinement, setRefinement] = useState('');

  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);


  const chatRef = useRef<Chat | null>(null);

  const systemInstruction = `Tu esi ekspertas pedagogas ir pamokų planavimo asistentas, puikiai išmanantis Lietuvos bendrąsias ugdymo programas (pasiekiamas https://emokykla.lt/bendrosios-programos/visos-bendrosios-programos). Tavo tikslas - padėti mokytojams kurti išsamius, struktūruotus ir diferencijuotus pamokų planus. Visada atsakyk lietuvių kalba.
Tavo atsakas privalo būti JSON formatu, griežtai laikantis šios struktūros:
{
  "lessonOverview": {
    "topic": "Pamokos tema",
    "goal": "Pamokos tikslas ir uždaviniai",
    "competencies": "Pagrindiniai gebėjimai pagal Bendrąsias Programas"
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
    "notes": "Pastabos apie pamoką, pvz., apie vertinimą ar priminimus mokiniams, tinkamos įrašyti į dienyno 'Pastabos apie pamoką' skiltį. Pvz.: 'Mokiniai bus vertinami už aktyvumą pamokoje.'"
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
    const prompt = `Sukurk pamokos planą.
    - Klasė: ${grade}
    - Dalykas: ${subject}
    - Pamokos tema: ${topic}
    ${goal ? `- Pamokos tikslas: ${goal}` : ''}
    ${activities ? `- Papildomos idėjos ar veiklos: ${activities}` : ''}
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

  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Pamokos plano pagalbininkas ✏️</h1>
        <p>Jūsų pagalbininkas kūrybiškoms ir efektyvioms pamokoms</p>
        <a 
          href="https://emokykla.lt/bendrosios-programos/visos-bendrosios-programos" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="external-link-button"
        >
          Bendrosios programos, vertinimo kriterijai
        </a>
      </header>
      <main className="main-content">
        <div className="form-container">
          <h2>Pamokos informacija</h2>
          <form onSubmit={handleInitialSubmit}>
            <div className="form-group">
              <label htmlFor="grade">Klasė <span className="required">*</span></label>
              <input type="text" id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="pvz., 5 klasė" required />
            </div>
            <div className="form-group">
              <label htmlFor="subject">Dalykas <span className="required">*</span></label>
              <input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="pvz., matematika" required/>
            </div>
            <div className="form-group">
              <label htmlFor="topic">Pamokos tema <span className="required">*</span></label>
              <input type="text" id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="pvz., trupmenų sudėtis" required/>
            </div>
            <div className="form-group">
              <label htmlFor="goal">Pamokos tikslas (nebūtina)</label>
              <textarea id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="pvz., išmokyti mokinius sudėti trupmenas su vienodais vardikliais"></textarea>
            </div>
            <div className="form-group">
              <label htmlFor="activities">Jūsų idėjos ar veiklos (nebūtina)</label>
              <textarea id="activities" value={activities} onChange={(e) => setActivities(e.target.value)} placeholder="pvz., darbas grupėse, interaktyvi užduotis su programėle"></textarea>
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
                <div className="lesson-plan">
                    <div className="card">
                        <h3>📖 Pamokos apžvalga</h3>
                        <p><strong>Tema:</strong> {lessonPlan.lessonOverview.topic}</p>
                        <p><strong>Tikslas ir uždaviniai:</strong> {renderFormattedText(lessonPlan.lessonOverview.goal)}</p>
                        <p><strong>Pagrindiniai gebėjimai (pagal Bendrąsias Programas):</strong> {renderFormattedText(lessonPlan.lessonOverview.competencies)}</p>
                    </div>
                    <div className="card">
                        <h3>🎨 Diferencijuotos pamokos veiklos</h3>
                        <p><strong>🚀 Gabesniems mokiniams:</strong> {renderFormattedText(lessonPlan.lessonActivities.gifted)}</p>
                        <p><strong>🙂 Bendro lygio mokiniams:</strong> {renderFormattedText(lessonPlan.lessonActivities.general)}</p>
                        <p><strong>🌱 Pagalbos reikalingiems mokiniams:</strong> {renderFormattedText(lessonPlan.lessonActivities.struggling)}</p>
                    </div>
                    <div className="card">
                        <h3>📚 Diferencijuoti namų darbai</h3>
                        <p><strong>🎯 Tikslas ir sąsajos:</strong> {renderFormattedText(lessonPlan.homework.purpose)}</p>
                        <p><strong>🚀 Gabesniems mokiniams:</strong> {renderFormattedText(lessonPlan.homework.gifted)}</p>
                        <p><strong>🙂 Bendro lygio mokiniams:</strong> {renderFormattedText(lessonPlan.homework.general)}</p>
                        <p><strong>🌱 Pagalbos reikalingiems mokiniams:</strong> {renderFormattedText(lessonPlan.homework.struggling)}</p>
                    </div>
                    {lessonPlan.eDiaryEntry && (
                        <div className="card">
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
                                placeholder="pvz., padaryk veiklas labiau žaismingas" 
                                disabled={isLoading}
                            />
                            <button type="submit" disabled={isLoading}>
                                {isLoading ? <div className="spinner"></div> : 'Atnaujinti pamokos aprašą'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);