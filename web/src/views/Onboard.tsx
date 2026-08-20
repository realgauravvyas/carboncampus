/**
 * Onboarding: sign in, tell us where you live, take the two-minute baseline
 * quiz. The quiz exists so the dashboard says something useful on day one,
 * before a single daily log has been made.
 */

import { useMemo, useState } from 'react';
import {
  CAMPUS, baselineFromQuiz, fmtKg, PERSONAS,
  type MealType, type Persona, type Profile, type QuizAnswers, type TransportMode
} from '@carboncampus/shared';
import { useStore } from '../lib/store';
import { Card, ChipGroup, Stepper } from '../components/ui';
import { CategoryDonut } from '../components/Charts';

const COMMUTE_MODES: { value: TransportMode; label: string; icon: string }[] = [
  { value: 'walk', label: 'Walk', icon: '🚶' },
  { value: 'cycle', label: 'Cycle', icon: '🚲' },
  { value: 'shuttle', label: 'Shuttle', icon: '🚐' },
  { value: 'eshuttle', label: 'E-rickshaw', icon: '🛺' },
  { value: 'bus', label: 'Bus', icon: '🚌' },
  { value: 'bike', label: 'Bike', icon: '🏍️' },
  { value: 'scooter', label: 'Scooter', icon: '🛴' },
  { value: 'car', label: 'Car', icon: '🚙' }
];

const NONVEG: { value: MealType; label: string; icon: string }[] = [
  { value: 'egg', label: 'Egg', icon: '🍳' },
  { value: 'chicken', label: 'Chicken', icon: '🍗' },
  { value: 'fish', label: 'Fish', icon: '🐟' },
  { value: 'mutton', label: 'Mutton', icon: '🍖' }
];

const STEPS = ['You', 'Travel', 'Room', 'Food & waste', 'Baseline'];

export default function Onboard() {
  const { saveProfile, loadDemo } = useStore();
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    name: '', email: '', role: 'student' as Profile['role'],
    hostel: CAMPUS.hostels[6], dept: CAMPUS.departments[0], year: 2
  });

  const [quiz, setQuiz] = useState<QuizAnswers>({
    commuteMode: 'cycle', commuteKm: 1.8, cityMode: 'bus', cityTripsPerWeek: 1, flightsPerYear: 2,
    fanHours: 8, lightHours: 5, laptopHours: 6, acHours: 0, geyserMinutes: 10, labHours: 1,
    nonVegMealsPerWeek: 4, nonVegType: 'chicken', vegType: 'veg', teaPerDay: 2,
    outsideOrdersPerWeek: 1, plateWaste: 'low',
    bottlesPerWeek: 3, cupsPerWeek: 4, sheetsPerWeek: 10, parcelsPerMonth: 2
  });

  const baseline = useMemo(() => baselineFromQuiz(quiz), [quiz]);
  const set = <K extends keyof QuizAnswers>(k: K, v: QuizAnswers[K]) =>
    setQuiz(q => ({ ...q, [k]: v }));

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const canStart = form.name.trim().length > 1 && emailOk;

  async function finish(withDemo: Persona | null) {
    const profile: Profile = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      hostel: form.hostel,
      dept: form.dept,
      year: form.year,
      campus: CAMPUS.id,
      joinedAt: new Date().toISOString(),
      baselinePerDay: baseline.total,
      greenPoints: 0
    };
    if (withDemo) await loadDemo(withDemo, 30);
    await saveProfile(profile);
  }

  return (
    <div className="onboard">
      <header className="onboard-head">
        <div className="brand-mark" aria-hidden>🌿</div>
        <h1>CarbonCampus</h1>
        <p>Measure it. Shrink it. Repeat.</p>
        <ol className="steps" aria-label="Onboarding progress">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
              <span>{i + 1}</span>{s}
            </li>
          ))}
        </ol>
      </header>

      {step === 0 && (
        <Card title="Sign in with your campus identity"
              sub="Nothing leaves this device in the public demo — see Methodology → Privacy.">
          <div className="field">
            <label htmlFor="ob-name">Name</label>
            <input id="ob-name" value={form.name} autoComplete="name"
                   onChange={e => setForm({ ...form, name: e.target.value })}
                   placeholder="Your name" />
          </div>
          <div className="field">
            <label htmlFor="ob-email">Campus email</label>
            <input id="ob-email" type="email" value={form.email} autoComplete="email"
                   onChange={e => setForm({ ...form, email: e.target.value })}
                   placeholder="you@iitg.ac.in" />
            {form.email && !emailOk && <small className="err">That does not look like an email address.</small>}
          </div>
          <div className="field">
            <label>I am a</label>
            <ChipGroup
              value={form.role}
              onChange={v => setForm({ ...form, role: v })}
              options={[
                { value: 'student', label: 'Student', icon: '🎓' },
                { value: 'faculty', label: 'Faculty', icon: '📚' },
                { value: 'staff', label: 'Staff', icon: '🛠️' }
              ]}
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="ob-hostel">Hostel</label>
              <select id="ob-hostel" value={form.hostel}
                      onChange={e => setForm({ ...form, hostel: e.target.value })}>
                {CAMPUS.hostels.map(h => <option key={h}>{h}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ob-year">Year</label>
              <select id="ob-year" value={form.year}
                      onChange={e => setForm({ ...form, year: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="ob-dept">Department</label>
            <select id="ob-dept" value={form.dept}
                    onChange={e => setForm({ ...form, dept: e.target.value })}>
              {CAMPUS.departments.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <button className="btn primary block" disabled={!canStart} onClick={() => setStep(1)}>
            Start the 2-minute baseline
          </button>
          <p className="fineprint">
            In a hurry? <button className="linkbtn" onClick={() => setStep(4)}>Skip to the demo data</button>
          </p>
        </Card>
      )}

      {step === 1 && (
        <Card title="How do you get around?" sub="Your usual week — the daily log refines this later.">
          <label className="q">Main way you reach class</label>
          <ChipGroup value={quiz.commuteMode as TransportMode} options={COMMUTE_MODES}
                     onChange={v => set('commuteMode', v)} />
          <Stepper label="One-way distance" icon="📏" unit=" km" step={0.2} max={40}
                   value={quiz.commuteKm ?? 0} onChange={v => set('commuteKm', v)} />
          <Stepper label="City trips a week" icon="🏙️" step={1} max={20}
                   value={quiz.cityTripsPerWeek ?? 0} onChange={v => set('cityTripsPerWeek', v)}
                   hint="Market, station, weekend outings" />
          <label className="q">Usual mode for those trips</label>
          <ChipGroup value={quiz.cityMode as TransportMode}
                     options={COMMUTE_MODES.filter(m => !['walk', 'cycle'].includes(m.value))}
                     onChange={v => set('cityMode', v)} />
          <Stepper label="Flights a year" icon="✈️" step={1} max={30}
                   value={quiz.flightsPerYear ?? 0} onChange={v => set('flightsPerYear', v)}
                   hint="Return trips home count as two" />
          <Nav onBack={() => setStep(0)} onNext={() => setStep(2)} />
        </Card>
      )}

      {step === 2 && (
        <Card title="Your room and lab" sub="Rough hours on a normal day are fine.">
          <Stepper label="Fan" icon="🌀" unit=" h" step={1} max={24}
                   value={quiz.fanHours ?? 0} onChange={v => set('fanHours', v)} />
          <Stepper label="Lights" icon="💡" unit=" h" step={1} max={24}
                   value={quiz.lightHours ?? 0} onChange={v => set('lightHours', v)} />
          <Stepper label="Air conditioner" icon="❄️" unit=" h" step={1} max={24}
                   value={quiz.acHours ?? 0} onChange={v => set('acHours', v)} />
          <Stepper label="Laptop" icon="💻" unit=" h" step={1} max={24}
                   value={quiz.laptopHours ?? 0} onChange={v => set('laptopHours', v)} />
          <Stepper label="Geyser / immersion rod" icon="🚿" unit=" min" step={5} max={120}
                   value={quiz.geyserMinutes ?? 0} onChange={v => set('geyserMinutes', v)} />
          <Stepper label="Lab equipment" icon="🔬" unit=" h" step={1} max={12}
                   value={quiz.labHours ?? 0} onChange={v => set('labHours', v)}
                   hint="Your share of running instruments" />
          <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} />
        </Card>
      )}

      {step === 3 && (
        <Card title="Food and everyday waste" sub="The mess plate is usually the second biggest lever.">
          <Stepper label="Non-veg meals a week" icon="🍗" step={1} max={21}
                   value={quiz.nonVegMealsPerWeek ?? 0} onChange={v => set('nonVegMealsPerWeek', v)} />
          <label className="q">Most common non-veg choice</label>
          <ChipGroup value={quiz.nonVegType as MealType} options={NONVEG}
                     onChange={v => set('nonVegType', v)} />
          <Stepper label="Tea or coffee a day" icon="☕" step={1} max={12}
                   value={quiz.teaPerDay ?? 0} onChange={v => set('teaPerDay', v)} />
          <Stepper label="Delivered orders a week" icon="🛵" step={1} max={21}
                   value={quiz.outsideOrdersPerWeek ?? 0} onChange={v => set('outsideOrdersPerWeek', v)} />
          <label className="q">How much is usually left on your plate?</label>
          <ChipGroup value={quiz.plateWaste ?? 'low'}
                     onChange={v => set('plateWaste', v)}
                     options={[
                       { value: 'none', label: 'Clean plate', icon: '🍽️' },
                       { value: 'low', label: 'A few bites', icon: '🥄' },
                       { value: 'mid', label: 'A quarter', icon: '🥘' },
                       { value: 'high', label: 'Half or more', icon: '🗑️' }
                     ]} />
          <Stepper label="Plastic bottles a week" icon="🧴" step={1} max={40}
                   value={quiz.bottlesPerWeek ?? 0} onChange={v => set('bottlesPerWeek', v)} />
          <Stepper label="Disposable cups a week" icon="🥤" step={1} max={40}
                   value={quiz.cupsPerWeek ?? 0} onChange={v => set('cupsPerWeek', v)} />
          <Stepper label="Parcels a month" icon="📦" step={1} max={30}
                   value={quiz.parcelsPerMonth ?? 0} onChange={v => set('parcelsPerMonth', v)} />
          <Nav onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="See my baseline" />
        </Card>
      )}

      {step === 4 && (
        <Card title="Your starting point"
              sub="This is an estimate from the quiz. Daily logging replaces it with measurement.">
          <div className="baseline-hero">
            <CategoryDonut by={baseline.by} total={baseline.total} subtitle="kg CO2e / day" height={190} />
            <div className="baseline-facts">
              <p>
                About <strong>{fmtKg(baseline.total)} a day</strong>, or
                {' '}<strong>{fmtKg(baseline.total * 365)}</strong> a year.
              </p>
              <p className="muted">
                Range {fmtKg(baseline.low)}–{fmtKg(baseline.high)} once factor uncertainty is carried
                through. The Indian average is roughly 2 t CO2e per person per year.
              </p>
            </div>
          </div>

          <h3 className="mini-head">Start with demo history?</h3>
          <p className="muted small">
            Judges and first-time visitors can load 30 days of realistic logs to see the dashboard,
            recommendations and leaderboards working immediately. It is clearly labelled and one tap clears it.
          </p>
          <div className="persona-grid">
            {PERSONAS.map(p => (
              <button key={p.id} className="persona" onClick={() => void finish(p.id)}>
                <strong>{p.name}</strong>
                <span>{p.blurb}</span>
              </button>
            ))}
          </div>

          <button className="btn ghost block" onClick={() => void finish(null)}>
            Start empty and log my own days
          </button>
          <button className="linkbtn back" onClick={() => setStep(3)}>← Back to the quiz</button>
        </Card>
      )}
    </div>
  );
}

function Nav({ onBack, onNext, nextLabel = 'Next' }: {
  onBack: () => void; onNext: () => void; nextLabel?: string;
}) {
  return (
    <div className="nav-row">
      <button className="btn ghost" onClick={onBack}>Back</button>
      <button className="btn primary" onClick={onNext}>{nextLabel}</button>
    </div>
  );
}
