import Modal from './Modal.jsx';
import {
  SMLMV,
  IBC_CAP_SMMLV,
  NIGHT_SURCHARGE,
  OT_DIURNAL,
  OT_NOCTURNAL,
  SUNDAY_HOLIDAY,
  DAILY_ORDINARY_LIMIT,
  HOURS_PER_MONTH,
  SEVERANCE_RATE,
  PRIMA_RATE,
  VACATION_RATE,
  SEVERANCE_INTEREST_ANNUAL,
  TRANSPORT_RATE,
  TRANSPORT_THRESHOLD_SMMLV,
  TRANSPORT_MODES,
} from '../utils/constants.js';
import {
  resolveHourlyRate,
  DIURNAL_START,
  DIURNAL_END,
} from '../utils/payrollCalculator.js';
import { formatCOP, formatPercent } from '../utils/format.js';

/** Las constantes del motor son fracciones (0.35 → "35%"). */
const pct = (v, digits = 0) => formatPercent(v * 100, digits);

/** 6 → "6:00 a.m.", 19 → "7:00 p.m." */
const hour12 = (h) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h >= 12 ? 'p.m.' : 'a.m.'}`;

const DAY_RANGE = `${hour12(DIURNAL_START)} – ${hour12(DIURNAL_END)}`;
const NIGHT_RANGE = `${hour12(DIURNAL_END)} – ${hour12(DIURNAL_START)}`;

/** Hora de referencia con la misma fórmula que la app: SMLMV ÷ divisor mensual. */
const BASE = resolveHourlyRate({ monthlySalary: SMLMV });

function Section({ icon, title, children }) {
  return (
    <section className="border-top pt-3 mt-3">
      <h3 className="h6 fw-bold mb-2">
        <i className={`bi ${icon} me-2 text-indigo`} />
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Fila regla → valor en badge (porcentajes y topes oficiales). */
function Rule({ label, note = '', value }) {
  return (
    <li className="d-flex align-items-start justify-content-between gap-3 py-1">
      <span className="small">
        {label}
        {note && <span className="d-block text-secondary">{note}</span>}
      </span>
      <span className="badge text-bg-light border text-nowrap fw-semibold tabular">{value}</span>
    </li>
  );
}

/** Ejemplo numérico breve, con el mismo valor de hora que usa la app. */
function Example({ children }) {
  return (
    <p className="small bg-body-tertiary rounded p-2 mb-2">
      <i className="bi bi-lightbulb me-1 text-indigo" />
      {children}
    </p>
  );
}

/** Guía accesible ("Cómo se calcula tu nómina"): reglas + ejemplos + respaldo legal. */
export default function PayrollGuide({ show, onClose }) {
  return (
    <Modal
      show={show}
      onClose={onClose}
      size="modal-lg"
      title={
        <>
          <i className="bi bi-journal-text me-1 text-indigo" />
          Cómo se calcula tu nómina
        </>
      }
    >
      <p className="small text-secondary mb-0">
        Tus números salen de tus turnos y de tus datos laborales. Aquí te lo contamos paso a paso,
        con ejemplos sencillos: todo lo de abajo es exactamente lo que hace la app.
      </p>

      <Section icon="bi-clock-history" title="1. Tu valor de hora ordinaria">
        <p className="small mb-2">En Datos laborales eliges una de dos formas:</p>
        <ul className="list-unstyled small mb-2">
          <li>
            <i className="bi bi-cash-coin me-2 text-indigo" />
            <strong>Salario mensual:</strong> lo dividimos entre {HOURS_PER_MONTH} horas al mes.
          </li>
          <li>
            <i className="bi bi-clock me-2 text-indigo" />
            <strong>Valor de la hora directo:</strong> lo usamos tal cual, sin dividirlo.
          </li>
        </ul>
        <Example>
          Con el salario mínimo {formatCOP(SMLMV)} ÷ {HOURS_PER_MONTH} h ={' '}
          <strong>{formatCOP(BASE)} por hora</strong>: ese es el precio de tu hora ordinaria diurna.
        </Example>
      </Section>

      <Section icon="bi-moon-stars" title="2. Jornada diurna y nocturna">
        <ul className="list-unstyled small mb-2">
          <Rule
            label={`Diurna: ${DAY_RANGE}`}
            note="Se paga a tu valor de hora normal."
            value="sin recargo"
          />
          <Rule
            label={`Nocturna: ${NIGHT_RANGE}`}
            note="Trabajo nocturno habitual (CST art. 56)."
            value={`+${pct(NIGHT_SURCHARGE)}`}
          />
        </ul>
        <Example>
          Una hora nocturna ordinaria vale {formatCOP(BASE)} × 1,35 ={' '}
          <strong>{formatCOP(BASE * (1 + NIGHT_SURCHARGE))}</strong>.
        </Example>
        <p className="small text-secondary mb-0">
          Si tu turno cruza la medianoche (22:00 → 06:00) la app lo parte en dos: el tramo del día
          1 y el del día 2, cada uno con su propia tarifa y evaluando por separado si es domingo o
          festivo.
        </p>
      </Section>

      <Section icon="bi-stopwatch" title="3. Jornada ordinaria y horas extras">
        <p className="small mb-2">
          Cada día se pagan como ordinarias hasta tu <strong>límite diario</strong> (por defecto{' '}
          {DAILY_ORDINARY_LIMIT} horas; puedes ajustarlo en Datos laborales, por ejemplo 7 horas si
          trabajas 42 h/semana en 6 días). Lo que exceda son horas extras, contadas en orden cronológico.
          Si tienes descanso no pagado, se descuenta primero de las horas diurnas.
        </p>
        <ul className="list-unstyled small mb-2">
          <Rule
            label="Extra diurna"
            note="Todas las horas extras diurnas, sin escalonado (CST art. 168)."
            value={`+${pct(OT_DIURNAL.first)}`}
          />
          <Rule
            label="Extra nocturna"
            note="Todas las horas extras nocturnas, sin escalonado (CST art. 168)."
            value={`+${pct(OT_NOCTURNAL.first)}`}
          />
        </ul>
        <Example>
          Turno de 8:00 a.m. a 7:00 p.m. = 11 h → {DAILY_ORDINARY_LIMIT} ordinarias (
          {formatCOP(BASE * DAILY_ORDINARY_LIMIT)}) + 3 extras diurnas al {pct(OT_DIURNAL.first)} (
          {formatCOP(BASE * (1 + OT_DIURNAL.first))}/h cada una).
        </Example>
      </Section>

      <Section icon="bi-calendar2-heart" title="4. Domingos y festivos">
        <ul className="list-unstyled small mb-2">
          <Rule
            label="Domingo o festivo diurno"
            note="Ordinarias diurnas (Ley 2466 de 2025: 90% desde jul-2026)."
            value={`+${pct(SUNDAY_HOLIDAY.diurnal)}`}
          />
          <Rule
            label="Domingo o festivo nocturno"
            note="90% dominical + 35% de recargo nocturno."
            value={`+${pct(SUNDAY_HOLIDAY.nocturnal)}`}
          />
        </ul>
        <Example>
          {formatCOP(BASE)} → {formatCOP(BASE * (1 + SUNDAY_HOLIDAY.diurnal))} si es diurna y{' '}
          {formatCOP(BASE * (1 + SUNDAY_HOLIDAY.nocturnal))} si es nocturna.
        </Example>
        <p className="small text-secondary mb-0">
          Las horas extras de un domingo o festivo son <strong>acumulativas</strong>: base
          dominical + recargo de extra → diurnas{' '}
          {pct(SUNDAY_HOLIDAY.overtimeBase + OT_DIURNAL.first)} (
          {formatCOP(BASE * (1 + SUNDAY_HOLIDAY.overtimeBase + OT_DIURNAL.first))}/h) y nocturnas{' '}
          {pct(SUNDAY_HOLIDAY.overtimeBase + OT_NOCTURNAL.first)} (
          {formatCOP(BASE * (1 + SUNDAY_HOLIDAY.overtimeBase + OT_NOCTURNAL.first))}/h). El recargo
          sube en escala gradual: 80% (jul-2025) → 90% (jul-2026) → 100% (jul-2027). Los festivos
          colombianos incluyen los fijos y la Semana Santa trasladada al lunes (Ley 51 de 1983); en
          Historial los verás marcados como <span className="badge text-bg-info">Fest.</span>
        </p>
      </Section>

      <Section icon="bi-heart-pulse" title="5. Deducciones: salud y pensión">
        <p className="small mb-2">
          Se calculan sobre tu ingreso base (IBC): los devengos del periodo{' '}
          <strong>sin</strong> el auxilio de transporte, con un tope de {IBC_CAP_SMMLV} salarios
          mínimos. Usa los porcentajes que tengas en Datos laborales.
        </p>
        <Example>
          Si devengas {formatCOP(2_000_000)} sin transporte, el IBC es {formatCOP(2_000_000)}; con
          4% pagas {formatCOP(80_000)} de salud y {formatCOP(80_000)} de pensión.
        </Example>
      </Section>

      <Section icon="bi-gift" title="6. Prestaciones y auxilio de transporte">
        <ul className="list-unstyled small mb-2">
          <Rule
            label="Cesantías"
            note="Base: devengados + auxilio de transporte. Solo contratos laborales."
            value={pct(SEVERANCE_RATE, 2)}
          />
          <Rule
            label="Prima de servicios"
            note="Base: devengados + auxilio de transporte. Solo contratos laborales."
            value={pct(PRIMA_RATE, 2)}
          />
          <Rule
            label="Vacaciones"
            note="Solo sobre la base ordinaria: sin extras ni recargos dominicales/festivos."
            value={pct(VACATION_RATE, 2)}
          />
          <Rule
            label="Intereses de cesantías"
            note="12% anual prorrateado por los días del periodo."
            value={`${pct(SEVERANCE_INTEREST_ANNUAL)} anual`}
          />
          <Rule
            label="Auxilio de transporte"
            note={`Si tu salario base no supera ${TRANSPORT_THRESHOLD_SMMLV} SMLMV y es contrato laboral (no depende de las horas extras).`}
            value={formatCOP(TRANSPORT_RATE * SMLMV)}
          />
        </ul>
        <p className="small text-secondary mb-1">Se paga según el modo que elijas:</p>
        <ul className="list-unstyled small mb-0">
          {TRANSPORT_MODES.map((m) => (
            <li key={m.value}>
              <i className="bi bi-check2-circle me-2 text-indigo" />
              <strong>{m.label}.</strong>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon="bi-journal-bookmark" title="7. Respaldo legal (en palabras simples)">
        <ul className="list-unstyled small mb-0">
          <Rule
            label="CST, arts. 55, 56, 57 y 59"
            note="Trabajo suplementario, nocturnidad y recargos."
            value="recargos"
          />
          <Rule
            label="CST, arts. 168 y 179"
            note="Extras planas (+25% diurnas / +75% nocturnas) y recargo dominical/festivo (90% en 2026)."
            value="extras · dom."
          />
          <Rule
            label="Ley 789 de 2002 y Ley 1846 de 2017"
            note="Franja diurna y nocturna: desde 2017 la noche empieza a las 7:00 p.m."
            value="horarios"
          />
          <Rule
            label="Ley 2101 de 2021"
            note="Reducción gradual de la jornada semanal (48 → 42 horas)."
            value="42 h/semana"
          />
          <Rule
            label="Ley 2466 de 2025 (reforma laboral)"
            note="Noche 7 p.m.–6 a.m., máximo 2 h extras/día y recargo dominical/festivo en escala gradual (90% desde jul-2026, 100% en 2027)."
            value="reforma 2025"
          />
          <Rule
            label="Ley 51 de 1983 y Ley 100 de 1993"
            note="Festivos con traslado al lunes y tope del IBC (25 SMLMV)."
            value="festivos · IBC"
          />
        </ul>
      </Section>

      <p className="small text-secondary border-top pt-3 mt-3 mb-0">
        <i className="bi bi-info-circle me-1" />
        Esta guía explica cómo la app estima tu nómina a partir de tus turnos: es una estimación con
        fines informativos y no reemplaza una liquidación oficial.
      </p>

      <div className="d-flex justify-content-end mt-3">
        <button type="button" className="btn btn-brand rounded-pill px-4" onClick={onClose}>
          Entendido
        </button>
      </div>
    </Modal>
  );
}
